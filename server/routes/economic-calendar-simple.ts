import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /api/economic-calendar-simple
 * Simple economic calendar with calculated investment metrics
 */
router.get('/', async (req, res) => {
  try {
    const { limit = '20', mode = 'latest' } = req.query;
    
    logger.info('📊 [SIMPLE ECONOMIC CALENDAR] GET request:', { limit, mode });
    
    const startTime = Date.now();
    
    // Query with calculated YoY growth and investment signals
    const result = await db.execute(sql`
      WITH latest_data AS (
        SELECT DISTINCT ON (series_id)
          series_id,
          metric_name,
          category,
          release_date,
          period_date,
          actual_value::numeric as current_value,
          unit,
          frequency
        FROM economic_calendar
        WHERE actual_value IS NOT NULL
        ORDER BY series_id, release_date DESC
      ),
      yoy_data AS (
        SELECT DISTINCT ON (ec1.series_id)
          ec1.series_id,
          ec2.actual_value::numeric as year_ago_value
        FROM economic_calendar ec1
        LEFT JOIN economic_calendar ec2 ON (
          ec1.series_id = ec2.series_id 
          AND ec2.period_date >= ec1.period_date - INTERVAL '15 months'
          AND ec2.period_date <= ec1.period_date - INTERVAL '9 months'
          AND ec2.actual_value IS NOT NULL
        )
        WHERE ec1.actual_value IS NOT NULL
        ORDER BY ec1.series_id, ec1.release_date DESC
      )
      SELECT 
        ld.series_id as "seriesId",
        ld.metric_name as "metricName", 
        ld.category,
        ld.release_date as "releaseDate",
        ld.period_date as "periodDate",
        ld.current_value as "actualValue",
        NULL as "previousValue",
        NULL as "variance", 
        NULL as "variancePercent",
        ld.unit,
        ld.frequency,
        NULL as "seasonalAdjustment",
        
        -- Calculate YoY Growth
        CASE 
          WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
          THEN ROUND(((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100), 2)
          ELSE NULL
        END as "yoyGrowthRate",
        
        -- Generate Investment Signal
        CASE 
          WHEN ld.category = 'Inflation' THEN
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) BETWEEN 1 AND 4
                THEN 'bullish'
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 5
                THEN 'bearish'
              ELSE 'neutral'
            END
          WHEN ld.series_id = 'UNRATE' THEN
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) < -10
                THEN 'bullish'
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 20
                THEN 'bearish'
              ELSE 'neutral'
            END
          ELSE
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 2
                THEN 'bullish'
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) < -2
                THEN 'bearish'
              ELSE 'neutral'
            END
        END as "investmentSignal",
        
        -- Trend Strength (simplified)
        CASE 
          WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
            AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 5
            THEN 0.7
          WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
            AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) < -5
            THEN -0.7
          WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
            AND ABS((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 2
            THEN 0.3
          ELSE 0.1
        END as "trendStrength",
        
        -- Percentile Rank (simplified within category)
        PERCENT_RANK() OVER (
          PARTITION BY ld.category 
          ORDER BY ld.current_value ASC
        ) * 100 as "percentileRank1y",
        
        -- Sector Implication
        CASE 
          WHEN ld.category = 'Inflation' THEN 'Monitor bond yields and REIT exposure'
          WHEN ld.category = 'Labor' THEN 'Watch consumer discretionary and wage-sensitive sectors' 
          WHEN ld.category = 'Growth' THEN 'Broad market implications across sectors'
          WHEN ld.category = 'Housing' THEN 'Real estate, construction, and home retail impact'
          WHEN ld.category = 'Finance' THEN 'Banking, fintech, and credit-sensitive sectors'
          ELSE 'Monitor sector rotation opportunities'
        END as "sectorImplication",
        
        -- Asset Class Impact
        CASE 
          WHEN (
            CASE 
              WHEN ld.category = 'Inflation' THEN
                CASE 
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) BETWEEN 1 AND 4
                    THEN 'bullish'
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 5
                    THEN 'bearish'
                  ELSE 'neutral'
                END
              ELSE
                CASE 
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 2
                    THEN 'bullish'
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) < -2
                    THEN 'bearish'
                  ELSE 'neutral'
                END
            END
          ) = 'bullish' THEN 'Positive for equities, negative for bonds'
          WHEN (
            CASE 
              WHEN ld.category = 'Inflation' THEN
                CASE 
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) BETWEEN 1 AND 4
                    THEN 'bullish'
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 5
                    THEN 'bearish'
                  ELSE 'neutral'
                END
              ELSE
                CASE 
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 2
                    THEN 'bullish'
                  WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
                    AND ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) < -2
                    THEN 'bearish'
                  ELSE 'neutral'
                END
            END
          ) = 'bearish' THEN 'Negative for equities, positive for bonds'
          ELSE 'Mixed signals across asset classes'
        END as "assetClassImpact",
        
        -- Calculation Confidence
        CASE 
          WHEN yd.year_ago_value IS NOT NULL THEN 0.8
          ELSE 0.3
        END as "calculationConfidence",
        
        -- Additional fields expected by frontend
        NULL as "qoqAnnualizedRate",
        NULL as "momAnnualizedRate", 
        NULL as "volatility12m",
        NULL as "percentileRank5y",
        NULL as "signalStrength",
        NULL as "cyclePosition",
        NULL as "regimeClassification",
        NULL as "realValue",
        NULL as "realYoyGrowth", 
        NULL as "inflationImpact"
        
      FROM latest_data ld
      LEFT JOIN yoy_data yd ON ld.series_id = yd.series_id
      WHERE ld.series_id IN ('GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'PCE', 'UNRATE', 'PAYEMS', 'FEDFUNDS', 'INDPRO', 'HOUST')
      ORDER BY 
        CASE 
          WHEN ld.series_id IN ('GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'PCE', 'UNRATE', 'PAYEMS', 'FEDFUNDS') THEN 0
          ELSE 1
        END,
        ld.release_date DESC
      LIMIT ${parseInt(limit as string)}
    `);

    const responseTime = Date.now() - startTime;
    const data = result.rows;

    logger.info(`✅ [SIMPLE ECONOMIC CALENDAR] Retrieved ${data.length} records (${responseTime}ms)`);

    res.json({
      success: true,
      data,
      pagination: {
        total: data.length,
        page: 1,
        totalPages: 1,
        limit: parseInt(limit as string),
        offset: 0
      },
      metadata: {
        responseTime,
        categories: ['Growth', 'Inflation', 'Labor', 'Housing', 'Finance', 'Consumption'],
        frequencies: ['daily', 'weekly', 'monthly', 'quarterly', 'annual'],
        investmentMetricsCalculated: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [SIMPLE ECONOMIC CALENDAR] Failed to fetch data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch economic calendar data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;