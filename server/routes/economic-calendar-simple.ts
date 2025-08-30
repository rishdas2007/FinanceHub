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
      ),
      quarterly_data AS (
        SELECT DISTINCT ON (ec1.series_id)
          ec1.series_id,
          ec2.actual_value::numeric as quarter_ago_value
        FROM economic_calendar ec1
        LEFT JOIN economic_calendar ec2 ON (
          ec1.series_id = ec2.series_id 
          AND ec2.period_date >= ec1.period_date - INTERVAL '6 months'
          AND ec2.period_date <= ec1.period_date - INTERVAL '2 months'
          AND ec2.actual_value IS NOT NULL
        )
        WHERE ec1.actual_value IS NOT NULL
        AND ec1.series_id IN ('GDP', 'GDPC1')
        ORDER BY ec1.series_id, ec1.release_date DESC
      ),
      monthly_data AS (
        SELECT DISTINCT ON (ec1.series_id)
          ec1.series_id,
          ec2.actual_value::numeric as month_ago_value
        FROM economic_calendar ec1
        LEFT JOIN economic_calendar ec2 ON (
          ec1.series_id = ec2.series_id 
          AND ec2.period_date >= ec1.period_date - INTERVAL '45 days'
          AND ec2.period_date <= ec1.period_date - INTERVAL '15 days'
          AND ec2.actual_value IS NOT NULL
        )
        WHERE ec1.actual_value IS NOT NULL
        AND ec1.series_id IN ('PAYEMS', 'PCE', 'PCEPI', 'CPIAUCSL', 'UNRATE', 'FEDFUNDS', 'INDPRO', 'HOUST')
        ORDER BY ec1.series_id, ec1.release_date DESC
      )
      SELECT 
        ld.series_id as "seriesId",
        ld.metric_name as "metricName", 
        ld.category,
        ld.release_date as "releaseDate",
        ld.period_date as "periodDate",
        -- Transform values to investor-relevant formats
        CASE 
          -- Inflation metrics: Show YoY % change instead of index level
          WHEN ld.series_id IN ('PCEPI', 'CPIAUCSL') THEN
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
              THEN ROUND(((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100), 2)
              ELSE NULL
            END
          -- GDP metrics: Show annualized quarterly growth rate  
          WHEN ld.series_id IN ('GDP', 'GDPC1') THEN
            CASE 
              WHEN qd.quarter_ago_value IS NOT NULL AND qd.quarter_ago_value > 0
              THEN ROUND(POWER((ld.current_value / qd.quarter_ago_value), 4) - 1, 4) * 100
              ELSE NULL
            END
          -- Industrial Production: Show YoY % change
          WHEN ld.series_id = 'INDPRO' THEN
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
              THEN ROUND(((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100), 2)
              ELSE NULL
            END
          -- Nonfarm Payrolls: Show monthly change in thousands
          WHEN ld.series_id = 'PAYEMS' THEN
            CASE 
              WHEN md.month_ago_value IS NOT NULL
              THEN ROUND((ld.current_value - md.month_ago_value) / 1000, 0)
              ELSE NULL
            END
          -- PCE Spending: Show monthly % change annualized
          WHEN ld.series_id = 'PCE' THEN
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND md.month_ago_value > 0
              THEN ROUND(POWER((ld.current_value / md.month_ago_value), 12) - 1, 4) * 100
              ELSE NULL
            END
          -- Keep as-is for Fed Funds Rate, Unemployment Rate, Housing Starts
          ELSE ld.current_value
        END as "actualValue",
        -- Previous Value for backwards compatibility
        CASE 
          WHEN md.month_ago_value IS NOT NULL THEN md.month_ago_value
          WHEN qd.quarter_ago_value IS NOT NULL THEN qd.quarter_ago_value
          WHEN yd.year_ago_value IS NOT NULL THEN yd.year_ago_value
          ELSE NULL
        END as "previousValue",
        NULL as "variance", 
        NULL as "variancePercent",
        -- Update units to match transformed values
        CASE 
          WHEN ld.series_id IN ('PCEPI', 'CPIAUCSL', 'INDPRO') THEN 'Percent Change from Year Ago, Seasonally Adjusted'
          WHEN ld.series_id IN ('GDP', 'GDPC1') THEN 'Percent Change from Previous Quarter, Annualized, Seasonally Adjusted'
          WHEN ld.series_id = 'PAYEMS' THEN 'Change from Previous Month, Seasonally Adjusted (Thousands)'
          WHEN ld.series_id = 'PCE' THEN 'Percent Change from Previous Month, Annualized'
          ELSE ld.unit
        END as unit,
        ld.frequency,
        NULL as "seasonalAdjustment",
        
        -- Calculate Prior Reading (in same format as Actual Value)
        CASE 
          -- Inflation metrics: Show prior YoY % change instead of index level
          WHEN ld.series_id IN ('PCEPI', 'CPIAUCSL') THEN
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND md.month_ago_value IS NOT NULL AND md.month_ago_value > 0
              THEN ROUND(((md.month_ago_value - yd.year_ago_value) / yd.year_ago_value * 100), 2)
              ELSE NULL
            END
          -- GDP metrics: Show prior annualized quarterly growth rate  
          WHEN ld.series_id IN ('GDP', 'GDPC1') THEN
            CASE 
              WHEN qd.quarter_ago_value IS NOT NULL AND md.month_ago_value IS NOT NULL AND md.month_ago_value > 0
              THEN ROUND(POWER((qd.quarter_ago_value / md.month_ago_value), 4) - 1, 4) * 100
              ELSE NULL
            END
          -- Industrial Production: Show prior YoY % change
          WHEN ld.series_id = 'INDPRO' THEN
            CASE 
              WHEN yd.year_ago_value IS NOT NULL AND md.month_ago_value IS NOT NULL AND yd.year_ago_value > 0
              THEN ROUND(((md.month_ago_value - yd.year_ago_value) / yd.year_ago_value * 100), 2)
              ELSE NULL
            END
          -- Nonfarm Payrolls: Show prior monthly change in thousands
          WHEN ld.series_id = 'PAYEMS' THEN
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND yd.year_ago_value IS NOT NULL
              THEN ROUND((md.month_ago_value - yd.year_ago_value) / 1000, 0)
              ELSE NULL
            END
          -- PCE Spending: Show prior monthly % change annualized
          WHEN ld.series_id = 'PCE' THEN
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0
              THEN ROUND(POWER((md.month_ago_value / yd.year_ago_value), 12) - 1, 4) * 100
              ELSE NULL
            END
          -- Keep as-is for Fed Funds Rate, Unemployment Rate, Housing Starts (show previous month value)
          ELSE md.month_ago_value
        END as "priorReading",
        
        -- Generate Investment Signal with corrected logic and momentum focus
        CASE 
          -- Inflation Metrics: CORRECTED - Higher/rising inflation = BEARISH
          WHEN ld.series_id IN ('PCEPI', 'CPIAUCSL') THEN
            CASE 
              -- Month-over-month momentum for inflation
              WHEN md.month_ago_value IS NOT NULL AND md.month_ago_value > 0 THEN
                CASE 
                  -- Rising inflation (MoM acceleration) = BEARISH
                  WHEN ld.current_value > md.month_ago_value * 1.002 THEN 'bearish'  -- >0.2% MoM increase
                  -- Falling inflation (MoM deceleration) = BULLISH  
                  WHEN ld.current_value < md.month_ago_value * 0.998 THEN 'bullish'  -- >0.2% MoM decrease
                  ELSE 'neutral'
                END
              -- Fallback to YoY level thresholds (CORRECTED LOGIC)
              WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0 THEN
                CASE 
                  -- High inflation (>4% YoY) = BEARISH
                  WHEN ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 4 THEN 'bearish'
                  -- Low inflation (1-3% YoY) = BULLISH (Fed target zone)
                  WHEN ((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) BETWEEN 1 AND 3 THEN 'bullish'
                  ELSE 'neutral'
                END
              ELSE 'neutral'
            END
            
          -- Federal Funds Rate: CORRECTED - Higher/rising rates = BEARISH for equities
          WHEN ld.series_id = 'FEDFUNDS' THEN
            CASE 
              -- Month-over-month rate change momentum
              WHEN md.month_ago_value IS NOT NULL THEN
                CASE 
                  -- Rate hikes = BEARISH
                  WHEN ld.current_value > md.month_ago_value + 0.1 THEN 'bearish'  -- >10bp increase
                  -- Rate cuts = BULLISH
                  WHEN ld.current_value < md.month_ago_value - 0.1 THEN 'bullish'  -- >10bp decrease
                  ELSE 'neutral'  -- Pause/small changes
                END
              ELSE 'neutral'
            END
            
          -- Unemployment Rate: Change-based logic (rising unemployment = BEARISH)
          WHEN ld.series_id = 'UNRATE' THEN
            CASE 
              WHEN md.month_ago_value IS NOT NULL THEN
                CASE 
                  -- Rising unemployment = BEARISH
                  WHEN ld.current_value > md.month_ago_value + 0.1 THEN 'bearish'  -- >0.1% increase
                  -- Falling unemployment = BULLISH (but watch for overheating)
                  WHEN ld.current_value < md.month_ago_value - 0.1 THEN 
                    CASE 
                      -- But if unemployment gets too low (<3.5%), it's concerning
                      WHEN ld.current_value < 3.5 THEN 'neutral'  -- Overheating risk
                      ELSE 'bullish'
                    END
                  ELSE 'neutral'
                END
              ELSE 'neutral'
            END
            
          -- Growth Metrics: Higher growth = BULLISH (logic was correct)
          WHEN ld.series_id IN ('GDP', 'GDPC1', 'INDPRO') THEN
            CASE 
              -- Focus on acceleration/deceleration vs previous period
              WHEN ld.series_id IN ('GDP', 'GDPC1') AND qd.quarter_ago_value IS NOT NULL AND qd.quarter_ago_value > 0 THEN
                CASE 
                  -- Accelerating growth = BULLISH
                  WHEN ld.current_value > qd.quarter_ago_value * 1.1 THEN 'bullish'  -- 10% acceleration
                  -- Decelerating growth = BEARISH
                  WHEN ld.current_value < qd.quarter_ago_value * 0.9 THEN 'bearish'  -- 10% deceleration
                  ELSE 'neutral'
                END
              WHEN ld.series_id = 'INDPRO' AND md.month_ago_value IS NOT NULL AND md.month_ago_value > 0 THEN
                CASE 
                  -- Industrial production acceleration = BULLISH
                  WHEN ld.current_value > md.month_ago_value * 1.005 THEN 'bullish'  -- 0.5% MoM growth
                  -- Industrial production decline = BEARISH
                  WHEN ld.current_value < md.month_ago_value * 0.995 THEN 'bearish'  -- 0.5% MoM decline
                  ELSE 'neutral'
                END
              ELSE 'neutral'
            END
            
          -- Employment: Strong job growth = BULLISH
          WHEN ld.series_id = 'PAYEMS' THEN
            CASE 
              WHEN md.month_ago_value IS NOT NULL THEN
                CASE 
                  -- Strong job growth (>200K) = BULLISH
                  WHEN (ld.current_value - md.month_ago_value) > 200 THEN 'bullish'
                  -- Job losses = BEARISH
                  WHEN (ld.current_value - md.month_ago_value) < -50 THEN 'bearish'
                  ELSE 'neutral'
                END
              ELSE 'neutral'
            END
            
          -- Consumer spending & Housing: Higher levels = BULLISH (logic was correct)
          ELSE
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND md.month_ago_value > 0 THEN
                CASE 
                  WHEN ld.current_value > md.month_ago_value * 1.02 THEN 'bullish'  -- 2% MoM growth
                  WHEN ld.current_value < md.month_ago_value * 0.98 THEN 'bearish'  -- 2% MoM decline
                  ELSE 'neutral'
                END
              ELSE 'neutral'
            END
        END as "investmentSignal",
        
        -- Trend Strength based on month-over-month momentum
        CASE 
          WHEN md.month_ago_value IS NOT NULL AND md.month_ago_value > 0 THEN
            CASE 
              -- Strong momentum (>1% MoM change)
              WHEN ABS((ld.current_value - md.month_ago_value) / md.month_ago_value * 100) > 1 THEN
                CASE 
                  WHEN ld.current_value > md.month_ago_value THEN 0.7  -- Strong positive momentum
                  ELSE -0.7  -- Strong negative momentum
                END
              -- Moderate momentum (0.2-1% MoM change)
              WHEN ABS((ld.current_value - md.month_ago_value) / md.month_ago_value * 100) > 0.2 THEN
                CASE 
                  WHEN ld.current_value > md.month_ago_value THEN 0.3  -- Moderate positive momentum
                  ELSE -0.3  -- Moderate negative momentum
                END
              ELSE 0.1  -- Minimal momentum
            END
          -- Fallback to YoY if no monthly data
          WHEN yd.year_ago_value IS NOT NULL AND yd.year_ago_value > 0 THEN
            CASE 
              WHEN ABS((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 5 THEN
                CASE 
                  WHEN ld.current_value > yd.year_ago_value THEN 0.5
                  ELSE -0.5
                END
              WHEN ABS((ld.current_value - yd.year_ago_value) / yd.year_ago_value * 100) > 2 THEN 0.2
              ELSE 0.1
            END
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
        
        -- Asset Class Impact (using corrected signal logic)
        CASE 
          WHEN ld.series_id IN ('PCEPI', 'CPIAUCSL') THEN  -- Inflation metrics
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND md.month_ago_value > 0 AND ld.current_value > md.month_ago_value * 1.002 
                THEN 'Negative for equities and bonds (rate hike risk)'
              WHEN md.month_ago_value IS NOT NULL AND md.month_ago_value > 0 AND ld.current_value < md.month_ago_value * 0.998 
                THEN 'Positive for equities and bonds (disinflation)'
              ELSE 'Mixed impact across asset classes'
            END
          WHEN ld.series_id = 'FEDFUNDS' THEN  -- Fed Funds Rate
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND ld.current_value > md.month_ago_value + 0.1 
                THEN 'Negative for equities, mixed for bonds'
              WHEN md.month_ago_value IS NOT NULL AND ld.current_value < md.month_ago_value - 0.1 
                THEN 'Positive for equities, negative for bonds'
              ELSE 'Neutral across asset classes'
            END
          WHEN ld.series_id IN ('GDP', 'GDPC1', 'INDPRO', 'PAYEMS', 'PCE', 'HOUST') THEN  -- Growth metrics
            CASE 
              WHEN md.month_ago_value IS NOT NULL AND ld.current_value > md.month_ago_value * 1.01 
                THEN 'Positive for equities, mixed for bonds'
              WHEN md.month_ago_value IS NOT NULL AND ld.current_value < md.month_ago_value * 0.99 
                THEN 'Negative for equities, positive for bonds'
              ELSE 'Mixed signals across asset classes'
            END
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
      LEFT JOIN quarterly_data qd ON ld.series_id = qd.series_id
      LEFT JOIN monthly_data md ON ld.series_id = md.series_id
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