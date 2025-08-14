import { Router } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const router = Router();

// ETF universe configuration
const ETF_UNIVERSE = ['SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE'];

interface ETFMetricsResponse {
  symbol: string;
  price: number;
  pctChange: number;
  compositeZ: number | null;
  dz1: number | null;
  dz5: number | null;
  signal: 'BUY' | 'SELL' | 'HOLD';
  components: {
    macdZ: number | null;
    rsi14: number | null;
    bbPctB: number | null;
    maGapPct: number | null;
    mom5dZ: number | null;
  };
  ma: {
    ma50: number | null;
    ma200: number | null;
    gapPct: number | null;
  };
  atr14: number | null;
  rs: {
    rs30: number | null;
    rs90: number | null;
    beta252: number | null;
    corr252: number | null;
  };
  liq: {
    avgDollarVol20d: number | null;
  };
}

// Enhanced ETF metrics with new features  
router.get('/metrics', async (req, res) => {
  try {
    const horizon = req.query.horizon as string || '60D';
    
    console.log(`📊 Fetching enhanced ETF metrics for horizon: ${horizon}`);
    
    // Get latest features for each symbol
    const featuresResult = await db.execute(sql`
      SELECT DISTINCT ON (symbol) 
             symbol, composite_z_60d, dz1_60d, dz5_60d, macd_z_60d, 
             rsi14, bb_pctb_20, ma_gap_pct, atr14,
             rs_spy_30d, rs_spy_90d, beta_spy_252d, corr_spy_252d, vol_dollar_20d,
             ma50, ma200,
             rsi_z_60d, bb_z_60d, ma_gap_z_60d, mom5d_z_60d,
             asof_date
      FROM equity_features_daily
      WHERE horizon = ${horizon}
        AND symbol IN ('SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE')
      ORDER BY symbol, asof_date DESC
    `);

    // Fetch real-time Bollinger Bands from Twelve Data API as authoritative source
    const symbols = ['SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE'];
    const { bollingerBandsService } = await import('../services/bollinger-bands-service');
    const realTimeBB = await bollingerBandsService.getBollingerBandsBatch(symbols);
    
    console.log(`📊 Fetched real-time Bollinger Bands for ${realTimeBB.size} symbols from Twelve Data API`);
    
    // Get latest prices for each symbol (last two bars for price change)
    const pricesResult = await db.execute(sql`
      WITH latest_bars AS (
        SELECT 
          symbol,
          close,
          LAG(close) OVER (PARTITION BY symbol ORDER BY ts_utc) AS prev_close,
          ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY ts_utc DESC) AS rn
        FROM equity_daily_bars
        WHERE symbol IN ('SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE')
          AND ts_utc >= CURRENT_DATE - INTERVAL '10 days'
      )
      SELECT symbol, close AS price, 
             CASE WHEN prev_close > 0 THEN (close - prev_close) / prev_close ELSE 0 END AS pct_change
      FROM latest_bars
      WHERE rn = 1
    `);
    
    // Debug: log the structure of database results
    console.log('📊 Features result structure:', { 
      type: typeof featuresResult, 
      isArray: Array.isArray(featuresResult),
      keys: Object.keys(featuresResult),
      rowCount: featuresResult?.rows?.length || 'no rows property'
    });
    
    // Create lookup maps - handle both array and object result formats
    const featuresArray = Array.isArray(featuresResult) ? featuresResult : (featuresResult.rows || []);
    const pricesArray = Array.isArray(pricesResult) ? pricesResult : (pricesResult.rows || []);
    
    const featuresMap = new Map(featuresArray.map(f => [f.symbol as string, f]));
    const pricesMap = new Map(pricesArray.map(p => [p.symbol as string, p]));
    
    // Add debug logging before processing
    console.log('🔍 ETF API Debug - Raw features data:', {
      SPY: featuresMap.get('SPY'),
      XLV: featuresMap.get('XLV'), 
      XLB: featuresMap.get('XLB')
    });

    // Build response
    const metrics: ETFMetricsResponse[] = ETF_UNIVERSE.map(symbol => {
      const features = featuresMap.get(symbol);
      const priceData = pricesMap.get(symbol);
      
      const compositeZ = features?.composite_z_60d ? Number(features.composite_z_60d) : null;
      
      // Determine signal based on composite Z-score with 0.75 thresholds
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (compositeZ !== null) {
        if (compositeZ <= -0.75) signal = 'BUY';
        else if (compositeZ >= 0.75) signal = 'SELL';
      }
      
      return {
        symbol,
        price: priceData ? Number(priceData.price) : 0,
        pctChange: priceData ? Number(priceData.pct_change) : 0,
        compositeZ,
        dz1: features?.dz1_60d ? Number(features.dz1_60d) : null,
        dz5: features?.dz5_60d ? Number(features.dz5_60d) : null,
        signal,
        components: {
          macdZ: features?.macd_z_60d ? Number(features.macd_z_60d) : null,
          rsi14: features?.rsi14 ? Number(features.rsi14) : null,
          rsiZ: features?.rsi_z_60d ? Number(features.rsi_z_60d) : null, // Use real RSI Z-score from DB
          bbPctB: (() => {
            // Use real-time Bollinger Band data if available, otherwise use database values
            const realtimeBB = realTimeBB.get(symbol);
            return realtimeBB ? realtimeBB.percentB : (features?.bb_pctb_20 ? Number(features.bb_pctb_20) : null);
          })(),
          bbZ: (() => {
            // Use real-time Bollinger Band Z-score if available, otherwise use database values
            const realtimeBB = realTimeBB.get(symbol);
            return realtimeBB ? bollingerBandsService.calculatePercentBZScore(realtimeBB.percentB) : (features?.bb_z_60d ? Number(features.bb_z_60d) : null);
          })(),
          maGapPct: features?.ma_gap_pct ? Number(features.ma_gap_pct) : null,
          maGapZ: (() => {
            // Use database Z-score if available and non-zero, otherwise calculate fallback
            const dbZScore = features?.ma_gap_z_60d ? Number(features.ma_gap_z_60d) : null;
            if (dbZScore !== null && dbZScore !== 0) return dbZScore;
            
            // Fallback calculation for missing/zero Z-scores
            const maGapPct = features?.ma_gap_pct ? Number(features.ma_gap_pct) : null;
            if (!maGapPct) return null;
            
            const normalizedGap = maGapPct * 100;
            if (Math.abs(normalizedGap) > 8) return normalizedGap > 0 ? 3.0 : -3.0;
            if (Math.abs(normalizedGap) > 5) return normalizedGap > 0 ? 2.0 : -2.0;
            if (Math.abs(normalizedGap) > 3) return normalizedGap > 0 ? 1.5 : -1.5;
            if (Math.abs(normalizedGap) > 1.5) return normalizedGap > 0 ? 1.0 : -1.0;
            if (Math.abs(normalizedGap) > 0.5) return normalizedGap > 0 ? 0.5 : -0.5;
            return normalizedGap > 0 ? 0.1 : (normalizedGap < 0 ? -0.1 : 0.0);
          })(),
          mom5dZ: features?.mom5d_z_60d ? Number(features.mom5d_z_60d) : null // Use real momentum Z-score from DB
        },
        ma: {
          ma50: features?.ma50 ? Number(features.ma50) : null,
          ma200: features?.ma200 ? Number(features.ma200) : null,
          gapPct: features?.ma_gap_pct ? Number(features.ma_gap_pct) : null
        },
        atr14: features?.atr14 ? Number(features.atr14) : null,
        rs: {
          rs30: features?.rs_spy_30d ? Number(features.rs_spy_30d) : null,
          rs90: features?.rs_spy_90d ? Number(features.rs_spy_90d) : null,
          beta252: features?.beta_spy_252d ? Number(features.beta_spy_252d) : null,
          corr252: features?.corr_spy_252d ? Number(features.corr_spy_252d) : null
        },
        liq: {
          avgDollarVol20d: features?.vol_dollar_20d ? Number(features.vol_dollar_20d) : null
        }
      };
    });

    console.log('🔍 ETF API Debug - Processed metrics:', {
      totalSymbols: metrics.length,
      sampleMetrics: metrics.slice(0, 3)
    });
    
    res.json({
      success: true,
      data: metrics,
      horizon,
      timestamp: new Date().toISOString(),
      source: 'enhanced-features'
    });
    
  } catch (error) {
    console.error('❌ Enhanced ETF metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced ETF metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ETF breadth indicator
router.get('/breadth', async (req, res) => {
  try {
    const horizon = req.query.horizon as string || '60D';
    const buyThreshold = Number(req.query.buy || -1.0);
    const sellThreshold = Number(req.query.sell || 1.0);
    
    const result = await db.execute(sql`
      WITH latest_features AS (
        SELECT DISTINCT ON (symbol)
          symbol,
          composite_z_60d
        FROM equity_features_daily
        WHERE horizon = ${horizon}
          AND symbol IN ('SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE')
          AND composite_z_60d IS NOT NULL
        ORDER BY symbol, asof_date DESC
      )
      SELECT 
        COUNT(CASE WHEN composite_z_60d <= ${buyThreshold} THEN 1 END) AS buy_count,
        COUNT(CASE WHEN composite_z_60d >= ${sellThreshold} THEN 1 END) AS sell_count,
        COUNT(*) AS total_count
      FROM latest_features
    `);
    
    const breadth = result.rows[0];
    
    res.json({
      success: true,
      buy: Number(breadth.buy_count),
      sell: Number(breadth.sell_count),
      total: Number(breadth.total_count),
      thresholds: { buy: buyThreshold, sell: sellThreshold },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ETF breadth error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF breadth'
    });
  }
});

// Get features for a specific symbol
router.get('/features/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const horizon = req.query.horizon as string || '60D';
    
    if (!ETF_UNIVERSE.includes(symbol)) {
      return res.status(400).json({
        success: false,
        error: `Invalid symbol. Must be one of: ${ETF_UNIVERSE.join(', ')}`
      });
    }
    
    console.log(`📊 Fetching enhanced features for ${symbol} (horizon: ${horizon})`);
    
    // Get latest features for the symbol
    const result = await db.execute(sql`
      SELECT *
      FROM equity_features_daily
      WHERE symbol = ${symbol} 
        AND horizon = ${horizon}
      ORDER BY asof_date DESC
      LIMIT 100
    `);
    
    res.json({
      success: true,
      symbol,
      horizon,
      features: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Features error for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch symbol features',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Conditional statistics for backtesting signals
router.get('/conditional-stats', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const rule = req.query.rule as string || 'composite_z_60d<=-1.0';
    const forward = Number(req.query.forward || 20);
    const horizon = req.query.horizon as string || '60D';
    
    if (!symbol || !ETF_UNIVERSE.includes(symbol)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol'
      });
    }
    
    // Parse simple rule format (e.g., 'composite_z_60d<=-1.0')
    const ruleMatch = rule.match(/composite_z_60d([<>=]+)([-\d.]+)/);
    if (!ruleMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid rule format'
      });
    }
    
    const operator = ruleMatch[1];
    const threshold = Number(ruleMatch[2]);
    
    let sqlOperator: string;
    switch (operator) {
      case '<=': sqlOperator = '<='; break;
      case '>=': sqlOperator = '>='; break;
      case '<': sqlOperator = '<'; break;
      case '>': sqlOperator = '>'; break;
      case '=': sqlOperator = '='; break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported operator'
        });
    }
    
    const result = await db.execute(sql`
      WITH signal_dates AS (
        SELECT asof_date
        FROM equity_features_daily
        WHERE symbol = ${symbol} 
          AND horizon = ${horizon}
          AND composite_z_60d ${sql.raw(sqlOperator)} ${threshold}
      ),
      forward_returns AS (
        SELECT 
          s.asof_date AS entry_date,
          b_forward.close / b_entry.close - 1 AS return_forward
        FROM signal_dates s
        JOIN equity_daily_bars b_entry ON b_entry.symbol = ${symbol} 
          AND b_entry.ts_utc::date = s.asof_date
        JOIN LATERAL (
          SELECT close 
          FROM equity_daily_bars 
          WHERE symbol = ${symbol} 
            AND ts_utc::date > s.asof_date
          ORDER BY ts_utc ASC 
          OFFSET ${forward - 1} 
          LIMIT 1
        ) b_forward ON true
      )
      SELECT 
        COUNT(*) AS n,
        AVG(return_forward) AS mean,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY return_forward) AS median,
        AVG(CASE WHEN return_forward > 0 THEN 1.0 ELSE 0.0 END) AS hit_rate,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY return_forward) AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY return_forward) AS p75,
        MIN(return_forward) AS min_return,
        MAX(return_forward) AS max_return
      FROM forward_returns
    `);
    
    const stats = result.rows[0];
    
    res.json({
      success: true,
      symbol,
      rule,
      forward_days: forward,
      stats: {
        n: Number(stats.n),
        mean: stats.mean ? Number(stats.mean) : null,
        median: stats.median ? Number(stats.median) : null,
        hitRate: stats.hit_rate ? Number(stats.hit_rate) : null,
        p25: stats.p25 ? Number(stats.p25) : null,
        p75: stats.p75 ? Number(stats.p75) : null,
        min: stats.min_return ? Number(stats.min_return) : null,
        max: stats.max_return ? Number(stats.max_return) : null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Conditional stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conditional statistics'
    });
  }
});

export default router;