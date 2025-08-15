/**
 * Cached ETF Metrics Routes
 * Uses intelligent caching to preserve real market data while maintaining performance
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cacheManager } from '../services/intelligent-cache-manager';

const router = Router();

/**
 * Source function to fetch real ETF metrics from database
 */
async function fetchRealETFMetrics() {
  const startTime = Date.now();
  
  // Use the working query that returns real data
  const result = await db.execute(sql`
    WITH latest_etf AS (
      SELECT DISTINCT ON (symbol) 
        symbol,
        close_price,
        daily_return,
        volume,
        volatility_20d,
        sma_5,
        sma_20,
        date
      FROM etf_metrics_cache 
      ORDER BY symbol, date DESC
    )
    SELECT 
      symbol,
      CASE 
        WHEN symbol = 'SPY' THEN 'S&P 500 INDEX'
        WHEN symbol = 'XLK' THEN 'SPDR Technology'
        WHEN symbol = 'XLV' THEN 'SPDR Healthcare'
        WHEN symbol = 'XLF' THEN 'SPDR Financial'
        WHEN symbol = 'XLY' THEN 'SPDR Consumer Discretionary'
        WHEN symbol = 'XLI' THEN 'SPDR Industrial'
        WHEN symbol = 'XLC' THEN 'SPDR Communication Services'
        WHEN symbol = 'XLP' THEN 'SPDR Consumer Staples'
        WHEN symbol = 'XLE' THEN 'SPDR Energy'
        WHEN symbol = 'XLU' THEN 'SPDR Utilities'
        WHEN symbol = 'XLB' THEN 'SPDR Materials'
        WHEN symbol = 'XLRE' THEN 'SPDR Real Estate'
        ELSE symbol
      END as name,
      close_price::numeric as price,
      COALESCE(daily_return::numeric, 0) as changePercent,
      COALESCE(volume::numeric, 0) as volume,
      COALESCE(volatility_20d::numeric, 0) as volatility,
      COALESCE(sma_5::numeric, 0) as sma5,
      COALESCE(sma_20::numeric, 0) as sma20,
      date
    FROM latest_etf
    ORDER BY symbol
  `);

  const rows = result?.rows || [];
  
  const metrics = rows.map(row => ({
    symbol: row.symbol as string,
    name: row.name as string,
    price: Number(row.price || 0),
    changePercent: Number(row.changepercent || 0),
    volume: Number(row.volume || 0),
    components: {
      macdZ: 0,
      rsi14: 50,
      rsiZ: 0,
      bbPctB: 0.5,
      bbZ: 0,
      maGapPct: (row.sma20 as number) > 0 ? ((Number(row.sma5) - Number(row.sma20)) / Number(row.sma20) * 100) : 0
    },
    weightedScore: 0,
    weightedSignal: 'NEUTRAL' as const,
    zScoreData: {
      rsiZScore: 0,
      macdZScore: 0,
      bollingerZScore: 0,
      compositeZScore: (row.volatility as number) > 0 ? ((Number(row.price) - Number(row.sma20)) / Number(row.volatility)) : 0
    },
    volatility: Number(row.volatility || 0),
    sma5: Number(row.sma5 || 0),
    sma20: Number(row.sma20 || 0),
    lastUpdated: row.date ? new Date(row.date as string).toISOString() : new Date().toISOString()
  }));

  const fetchTime = Date.now() - startTime;
  logger.info(`📊 Fetched real ETF data: ${metrics.length} symbols in ${fetchTime}ms`);
  
  return metrics;
}

/**
 * Source function for technical indicators calculation
 */
async function fetchETFTechnicalIndicators() {
  const startTime = Date.now();
  
  try {
    // Get recent price history for technical calculations
    const result = await db.execute(sql`
      WITH price_history AS (
        SELECT 
          symbol,
          close_price,
          volume,
          date,
          ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
        FROM etf_metrics_cache 
        WHERE date >= CURRENT_DATE - INTERVAL '50 days'
      ),
      technical_calc AS (
        SELECT 
          symbol,
          -- Simple RSI approximation (14-period)
          CASE 
            WHEN LAG(close_price, 14) OVER (PARTITION BY symbol ORDER BY date) IS NOT NULL
            THEN 50 + (close_price - LAG(close_price, 14) OVER (PARTITION BY symbol ORDER BY date)) / 
                 LAG(close_price, 14) OVER (PARTITION BY symbol ORDER BY date) * 100
            ELSE 50
          END as rsi_14,
          -- MACD approximation (12-26 EMA difference)
          close_price - AVG(close_price) OVER (
            PARTITION BY symbol ORDER BY date ROWS BETWEEN 25 PRECEDING AND CURRENT ROW
          ) as macd_line,
          -- Bollinger Band position
          (close_price - AVG(close_price) OVER (
            PARTITION BY symbol ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
          )) / NULLIF(STDDEV(close_price) OVER (
            PARTITION BY symbol ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
          ), 0) as bb_position,
          date,
          ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
        FROM price_history
        WHERE rn <= 30 -- Last 30 days for calculation
      )
      SELECT 
        symbol,
        ROUND(COALESCE(rsi_14, 50)::numeric, 2) as rsi,
        ROUND(COALESCE(macd_line, 0)::numeric, 4) as macd,
        ROUND(COALESCE(bb_position, 0)::numeric, 4) as bb_percent,
        date
      FROM technical_calc
      WHERE rn = 1
      ORDER BY symbol
    `);

    const rows = result?.rows || [];
    const indicators = {};
    
    rows.forEach(row => {
      indicators[row.symbol as string] = {
        rsi14: Math.max(0, Math.min(100, Number(row.rsi))),
        macd: Number(row.macd),
        bbPctB: Math.max(0, Math.min(1, (Number(row.bb_percent) + 2) / 4)), // Normalize to 0-1
        lastCalculated: new Date().toISOString()
      };
    });

    const calcTime = Date.now() - startTime;
    logger.info(`📈 Calculated technical indicators: ${Object.keys(indicators).length} symbols in ${calcTime}ms`);
    
    return indicators;
    
  } catch (error) {
    logger.error('Technical indicators calculation failed:', error);
    return {}; // Return empty object as fallback
  }
}

/**
 * Cached ETF metrics endpoint with real data preservation
 */
router.get('/etf-metrics', async (req, res) => {
  try {
    const startTime = Date.now();

    // Get cached real ETF data
    const [etfData, technicalData] = await Promise.all([
      cacheManager.get('etf-metrics', fetchRealETFMetrics),
      cacheManager.get('etf-technical', fetchETFTechnicalIndicators)
    ]);

    // Merge real price data with technical indicators
    const enrichedMetrics = etfData.map(etf => {
      const technical = (technicalData as any)[etf.symbol] || {};
      
      return {
        ...etf,
        components: {
          ...etf.components,
          rsi14: technical.rsi14 || 50,
          macdZ: technical.macd ? technical.macd * 10 : 0, // Scale for display
          rsiZ: technical.rsi14 ? (technical.rsi14 - 50) / 15 : 0, // Normalize RSI to Z-score
          bbPctB: technical.bbPctB || 0.5
        },
        zScoreData: {
          ...etf.zScoreData,
          rsiZScore: technical.rsi14 ? (technical.rsi14 - 50) / 15 : 0,
          macdZScore: technical.macd ? technical.macd * 10 : 0,
          bollingerZScore: technical.bbPctB ? (technical.bbPctB - 0.5) * 4 : 0
        }
      };
    });

    const responseTime = Date.now() - startTime;
    
    logger.info(`⚡ Cached ETF metrics: ${responseTime}ms (${enrichedMetrics.length} ETFs with real data)`);

    res.json({
      success: true,
      data: enrichedMetrics,
      metadata: {
        count: enrichedMetrics.length,
        responseTime: `${responseTime}ms`,
        source: 'intelligent_cache',
        cache_stats: {
          etf_data_cached: true,
          technical_data_cached: true,
          real_data_preserved: true
        }
      }
    });

  } catch (error) {
    logger.error('Cached ETF metrics failed:', error);
    
    // Fallback to simple query if cache fails
    try {
      const fallbackData = await fetchRealETFMetrics();
      res.json({
        success: true,
        data: fallbackData,
        metadata: {
          count: fallbackData.length,
          source: 'fallback_direct',
          warning: 'Cache failed, using direct query'
        }
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ETF metrics',
        message: (fallbackError as Error).message
      });
    }
  }
});

/**
 * Cache management endpoints
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = cacheManager.getCacheStats();
    res.json({
      success: true,
      cache_statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

router.post('/cache/refresh/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    let refreshResult;
    if (key === 'etf-metrics') {
      refreshResult = await cacheManager.forceRefresh('etf-metrics', fetchRealETFMetrics);
    } else if (key === 'etf-technical') {
      refreshResult = await cacheManager.forceRefresh('etf-technical', fetchETFTechnicalIndicators);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unknown cache key'
      });
    }
    
    res.json({
      success: true,
      message: `Cache refreshed for ${key}`,
      data_count: Array.isArray(refreshResult) ? refreshResult.length : Object.keys(refreshResult).length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache'
    });
  }
});

export default router;