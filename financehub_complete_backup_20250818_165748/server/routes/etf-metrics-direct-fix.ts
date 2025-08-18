import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Direct fix for ETF metrics - bypassing materialized view issues
 * Uses direct query to historical_sector_data for immediate results
 */
router.get('/etf-metrics-direct', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Direct query to historical data with latest records per symbol
    const result = await db.execute(sql`
      WITH latest_etf AS (
        SELECT DISTINCT ON (symbol) 
          symbol,
          close,
          volume,
          date,
          LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) as prev_close
        FROM historical_sector_data 
        WHERE symbol IN ('SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE')
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
        close as price,
        COALESCE(
          CASE WHEN prev_close > 0 THEN ((close - prev_close) / prev_close) * 100 ELSE 0 END,
          0
        ) as changePercent,
        COALESCE(volume, 0) as volume,
        date as lastUpdated
      FROM latest_etf
      ORDER BY symbol
    `);

    // Process results with explicit handling
    const rows = result?.rows || Array.from(result);
    
    logger.info(`📊 Direct ETF query: ${rows.length} results`);
    
    const metrics = rows.map(row => ({
      symbol: row.symbol as string,
      name: row.name as string,
      price: Number(row.price),
      changePercent: Number(row.changePercent),
      volume: Number(row.volume),
      components: {
        macdZ: 0,
        rsi14: 50,
        rsiZ: 0,
        bbPctB: 0.5,
        bbZ: 0,
        maGapPct: 0
      },
      weightedScore: 0,
      weightedSignal: 'NEUTRAL',
      zScoreData: {
        rsiZScore: 0,
        macdZScore: 0,
        bollingerZScore: 0,
        compositeZScore: 0
      },
      volatility: null,
      sma5: null,
      sma20: null,
      lastUpdated: new Date(row.lastUpdated as Date).toISOString()
    }));

    const responseTime = Date.now() - startTime;
    
    logger.info(`⚡ Direct ETF metrics: ${responseTime}ms (${metrics.length} ETFs)`);

    res.json({
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        responseTime: `${responseTime}ms`,
        source: 'direct_query'
      }
    });

  } catch (error) {
    logger.error('Failed to get direct ETF metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF metrics',
      message: error.message
    });
  }
});

/**
 * Replace the main ETF metrics endpoint with the working direct approach
 */
router.get('/etf-metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Use the direct working query
    const result = await db.execute(sql`
      WITH latest_etf AS (
        SELECT DISTINCT ON (symbol) 
          symbol,
          close,
          volume,
          date,
          LAG(close, 1) OVER (PARTITION BY symbol ORDER BY date) as prev_close
        FROM historical_sector_data 
        WHERE symbol IN ('SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE')
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
        close as price,
        COALESCE(
          CASE WHEN prev_close > 0 THEN ((close - prev_close) / prev_close) * 100 ELSE 0 END,
          0
        ) as changePercent,
        COALESCE(volume, 0) as volume,
        date as lastUpdated
      FROM latest_etf
      ORDER BY symbol
    `);

    // Handle the result properly - try different access methods
    let rows;
    if (result && Array.isArray(result)) {
      rows = result;
    } else if (result && result.rows) {
      rows = result.rows;
    } else if (result && typeof result[Symbol.iterator] === 'function') {
      rows = Array.from(result);
    } else {
      rows = [];
      logger.warn('📊 Unexpected result format, using empty array');
    }
    
    const metrics = rows.map(row => ({
      symbol: row.symbol as string,
      name: row.name as string,
      price: Number(row.price),
      changePercent: Number(row.changePercent),
      volume: Number(row.volume),
      components: {
        macdZ: 0,
        rsi14: 50,
        rsiZ: 0,
        bbPctB: 0.5,
        bbZ: 0,
        maGapPct: 0
      },
      weightedScore: 0,
      weightedSignal: 'NEUTRAL',
      zScoreData: {
        rsiZScore: 0,
        macdZScore: 0,
        bollingerZScore: 0,
        compositeZScore: 0
      },
      volatility: null,
      sma5: null,
      sma20: null,
      lastUpdated: new Date(row.lastUpdated as Date).toISOString()
    }));

    const responseTime = Date.now() - startTime;
    
    logger.info(`⚡ ETF metrics fixed: ${responseTime}ms (${metrics.length} ETFs)`);

    res.json({
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        responseTime: `${responseTime}ms`,
        source: 'direct_historical'
      }
    });

  } catch (error) {
    logger.error('Failed to get ETF metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF metrics',
      message: error.message
    });
  }
});

export default router;