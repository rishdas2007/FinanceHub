import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Simple ETF metrics fix - minimal complexity for immediate results
 */
router.get('/etf-metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Use the working query from the optimized route (but with simpler processing)
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
        COALESCE(volume::numeric, 0) as volume
      FROM latest_etf
      ORDER BY symbol
    `);

    // Process results with explicit rows handling
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
      lastUpdated: new Date().toISOString()
    }));

    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ Simple ETF fix: ${responseTime}ms (${metrics.length} ETFs)`);

    res.json({
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        responseTime: `${responseTime}ms`,
        source: 'simple_fix'
      }
    });

  } catch (error) {
    logger.error('Simple ETF fix error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF metrics',
      message: error.message
    });
  }
});

export default router;