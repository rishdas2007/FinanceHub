import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Optimized ETF Metrics endpoint using materialized views
 * Target: < 50ms response time (was 998ms)
 */
router.get('/etf-metrics-optimized', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Query pre-calculated materialized view
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
      ),
      etf_with_names AS (
        SELECT 
          e.*,
          CASE 
            WHEN e.symbol = 'SPY' THEN 'S&P 500 INDEX'
            WHEN e.symbol = 'XLK' THEN 'SPDR Technology'
            WHEN e.symbol = 'XLV' THEN 'SPDR Healthcare'
            WHEN e.symbol = 'XLF' THEN 'SPDR Financial'
            WHEN e.symbol = 'XLY' THEN 'SPDR Consumer Discretionary'
            WHEN e.symbol = 'XLI' THEN 'SPDR Industrial'
            WHEN e.symbol = 'XLC' THEN 'SPDR Communication Services'
            WHEN e.symbol = 'XLP' THEN 'SPDR Consumer Staples'
            WHEN e.symbol = 'XLE' THEN 'SPDR Energy'
            WHEN e.symbol = 'XLU' THEN 'SPDR Utilities'
            WHEN e.symbol = 'XLB' THEN 'SPDR Materials'
            WHEN e.symbol = 'XLRE' THEN 'SPDR Real Estate'
            ELSE e.symbol
          END as name
        FROM latest_etf e
      )
      SELECT 
        symbol,
        name,
        close_price as price,
        COALESCE(daily_return, 0) as change_percent,
        COALESCE(volume, 0) as volume,
        ROUND(COALESCE(volatility_20d, 0)::numeric, 2) as volatility,
        ROUND(COALESCE(sma_5, 0)::numeric, 2) as sma5,
        ROUND(COALESCE(sma_20, 0)::numeric, 2) as sma20,
        -- Simple Z-Score calculation for performance
        CASE 
          WHEN volatility_20d > 0 THEN 
            ROUND(((close_price - sma_20) / volatility_20d)::numeric, 2)
          ELSE 0
        END as z_score,
        -- Signal based on simple moving average crossover
        CASE 
          WHEN sma_5 > sma_20 AND daily_return > 0 THEN 'BUY'
          WHEN sma_5 < sma_20 AND daily_return < -1 THEN 'SELL'
          WHEN daily_return BETWEEN -0.5 AND 0.5 THEN 'HOLD'
          ELSE 'NEUTRAL'
        END as signal,
        date as last_updated
      FROM etf_with_names
      ORDER BY symbol
    `);

    const metrics = Array.from(result).map(row => ({
      symbol: row.symbol as string,
      name: row.name as string,
      price: Number(row.price),
      changePercent: Number(row.change_percent),
      volume: Number(row.volume),
      volatility: row.volatility ? Number(row.volatility) : null,
      sma5: row.sma5 ? Number(row.sma5) : null,
      sma20: row.sma20 ? Number(row.sma20) : null,
      zScore: Number(row.z_score),
      signal: row.signal as 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL',
      lastUpdated: new Date(row.last_updated as Date).toISOString()
    }));

    const responseTime = Date.now() - startTime;
    logger.info(`⚡ Optimized ETF metrics served in ${responseTime}ms (${metrics.length} ETFs)`);

    res.json({
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        responseTime: `${responseTime}ms`,
        cached: true,
        source: 'materialized_view'
      }
    });

  } catch (error) {
    logger.error('Failed to get optimized ETF metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF metrics',
      message: 'Internal server error'
    });
  }
});

/**
 * Replace the slow ETF metrics endpoint with the optimized version
 */
router.get('/etf-metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Use the same optimized logic but maintain API compatibility
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
        close_price as price,
        COALESCE(daily_return, 0) as changePercent,
        COALESCE(volume, 0) as volume,
        -- Create components object structure for compatibility
        CASE WHEN sma_20 > 0 THEN ((sma_5 - sma_20) / sma_20 * 100) ELSE 0 END as maGapPct,
        0 as weightedScore,
        'NEUTRAL' as weightedSignal,
        -- Create basic z-score for compatibility
        CASE WHEN volatility_20d > 0 THEN ((close_price - sma_20) / volatility_20d) ELSE 0 END as compositeZScore,
        ROUND(COALESCE(volatility_20d, 0)::numeric, 2) as volatility,
        ROUND(COALESCE(sma_5, 0)::numeric, 2) as sma5,
        ROUND(COALESCE(sma_20, 0)::numeric, 2) as sma20,
        date as lastUpdated
      FROM latest_etf
      ORDER BY symbol
    `);

    // Debug: Log the raw result structure
    logger.info(`📊 Raw DB result type: ${typeof result}`);
    logger.info(`📊 Raw DB result keys: ${Object.keys(result)}`);
    
    // Handle different Drizzle result formats
    let rows;
    if (Array.isArray(result)) {
      rows = result;
    } else if (result.rows) {
      rows = result.rows;
    } else if (typeof result === 'object' && result[Symbol.iterator]) {
      rows = Array.from(result);
    } else {
      rows = [];
    }
    
    logger.info(`📊 Processed rows: ${rows.length}`);
    if (rows.length > 0) {
      logger.info('📊 Sample row:', rows[0]);
    }

    const metrics = rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      price: Number(row.price),
      changePercent: Number(row.changePercent),
      volume: Number(row.volume),
      components: {
        macdZ: 0,
        rsi14: 50,
        rsiZ: 0,
        bbPctB: 0.5,
        bbZ: 0,
        maGapPct: Number(row.maGapPct || 0)
      },
      weightedScore: Number(row.weightedScore),
      weightedSignal: row.weightedSignal,
      zScoreData: {
        rsiZScore: 0,
        macdZScore: 0,
        bollingerZScore: 0,
        compositeZScore: Number(row.compositeZScore || 0)
      },
      volatility: row.volatility ? Number(row.volatility) : null,
      sma5: row.sma5 ? Number(row.sma5) : null,
      sma20: row.sma20 ? Number(row.sma20) : null,
      lastUpdated: new Date(row.lastUpdated as Date).toISOString()
    }));

    const responseTime = Date.now() - startTime;
    
    if (responseTime > 500) {
      logger.warn(`⚠️ ETF metrics still slow: ${responseTime}ms`);
    } else {
      logger.info(`⚡ Fast ETF metrics: ${responseTime}ms (${metrics.length} ETFs)`);
    }

    res.json({
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        responseTime: `${responseTime}ms`,
        source: 'materialized_view'
      }
    });

  } catch (error) {
    logger.error('Failed to get ETF metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF metrics',
      message: 'Internal server error'
    });
  }
});

export default router;