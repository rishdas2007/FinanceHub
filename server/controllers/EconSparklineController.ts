import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cacheService as cache } from '../services/cache-unified';

export async function getEconSparkline(req: Request, res: Response) {
  const { seriesId, months = 12, transform = 'LEVEL' } = req.query;

  if (!seriesId || typeof seriesId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'seriesId is required'
    });
  }

  const cacheKey = `econ:spark:${seriesId}:${transform}:${months}:v3`;
  
  try {
    // Check cache first
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.data,
        meta: cached.meta,
        cached: true
      });
    }

    // Use the requested transform directly (no auto-detection)
    let finalTransform = transform as string;

    // Query Silver layer with monthly resampling and transform support
    let queryResult;
    
    logger.info(`📊 Sparkline query for ${seriesId} with transform: ${finalTransform} (type: ${typeof finalTransform})`);
    
    if (finalTransform === 'YOY') {
      // Year-over-Year percentage change calculation
      logger.info(`🧮 Using YOY calculation for ${seriesId}`);
      queryResult = await db.execute(sql`
        WITH monthly_base AS (
          SELECT DISTINCT ON (date_trunc('month', period_end)) 
            date_trunc('month', period_end)::date as month_start,
            period_end::date as period_end, 
            value_std
          FROM econ_series_observation
          WHERE series_id = ${seriesId}
            AND value_std IS NOT NULL
            AND period_end >= current_date - interval '36 months'
          ORDER BY date_trunc('month', period_end), period_end DESC
        ),
        with_yoy_calculation AS (
          SELECT 
            period_end,
            value_std as current_value,
            LAG(value_std, 12) OVER (ORDER BY month_start) as value_12m_ago,
            CASE 
              WHEN LAG(value_std, 12) OVER (ORDER BY month_start) IS NOT NULL 
              THEN ROUND(((value_std - LAG(value_std, 12) OVER (ORDER BY month_start)) / LAG(value_std, 12) OVER (ORDER BY month_start)) * 100, 2)
              ELSE NULL 
            END as yoy_rate
          FROM monthly_base
        )
        SELECT 
          period_end, 
          COALESCE(yoy_rate, current_value) as value_std
        FROM with_yoy_calculation
        WHERE period_end >= current_date - interval '${months} months'
          AND (yoy_rate IS NOT NULL OR current_value IS NOT NULL)
        ORDER BY period_end ASC
      `);
    } else {
      // Level data (default)
      logger.info(`📊 Using LEVEL data query for ${seriesId} (transform: ${finalTransform})`);
      queryResult = await db.execute(sql`
        WITH raw AS (
          SELECT period_end::date as pe, value_std
          FROM econ_series_observation
          WHERE series_id = ${seriesId}
            AND value_std IS NOT NULL
            AND period_end >= date_trunc('month', current_date) - (${months} || ' months')::interval
            AND period_end <= current_date  -- Include up to today
        ),
        bucket AS (
          SELECT date_trunc('month', pe) as m_end, pe, value_std
          FROM raw
        ),
        last_per_month AS (
          SELECT DISTINCT ON (m_end) 
            m_end::date as period_end, 
            value_std
          FROM bucket
          ORDER BY m_end, pe DESC
        ),
        -- CRITICAL: Ensure we have the absolute latest data point
        latest_overall AS (
          SELECT period_end::date, value_std
          FROM econ_series_observation
          WHERE series_id = ${seriesId}
            AND value_std IS NOT NULL
          ORDER BY period_end DESC
          LIMIT 1
        )
        -- Combine monthly data with latest point
        SELECT DISTINCT period_end, value_std
        FROM (
          SELECT period_end, value_std FROM last_per_month
          UNION ALL
          SELECT period_end, value_std FROM latest_overall
        ) combined
        ORDER BY period_end ASC
        LIMIT 50
      `);
    }

    const result = queryResult;

    // Transform data for client
    const data = result.rows.map((row: any) => ({
      t: Date.parse(row.period_end), // epoch milliseconds
      date: row.period_end,
      value: parseFloat(row.value_std) || 0
    }));

    const response = {
      data,
      meta: {
        seriesId,
        transform: finalTransform,
        months: parseInt(months as string),
        points: data.length
      }
    };

    // Check if sparkline data is consistent with latest available data
    const latestCheck = await db.execute(sql`
      SELECT period_end::date, value_std
      FROM econ_series_observation
      WHERE series_id = ${seriesId}
        AND value_std IS NOT NULL
      ORDER BY period_end DESC
      LIMIT 1
    `);

    // If we have newer data than what's in sparkline, invalidate cache
    if (latestCheck.rows.length > 0) {
      const latestInDB = new Date(latestCheck.rows[0].period_end as string);
      const latestInSparkline = data.length > 0 ? new Date(data[data.length - 1].date) : new Date(0);

      if (latestInDB > latestInSparkline) {
        logger.info(`Newer data available for ${seriesId}, refreshing sparkline`);
        // Don't cache, return fresh data
        return res.json({
          success: true,
          ...response,
          cached: false,
          refreshed: true
        });
      }
    }

    // Cache for 5 minutes for fresher sparklines
    cache.set(cacheKey, response, 5 * 60 * 1000);

    res.json({
      success: true,
      ...response,
      cached: false
    });

  } catch (error) {
    logger.error(`Failed to fetch sparkline for ${seriesId}:`, error);
    
    // Try to serve last good data from cache if available
    const lastGood = cache.get<any>(`${cacheKey}:lastgood`);
    if (lastGood) {
      return res.json({
        success: true,
        data: lastGood.data,
        meta: lastGood.meta,
        cached: true,
        warning: 'using_cached_data'
      });
    }

    // Return empty data on error (never return error response)
    res.json({
      success: true,
      data: [],
      meta: {
        seriesId,
        transform: transform as string,
        months: parseInt(months as string),
        points: 0
      },
      warning: 'data_unavailable'
    });
  }
}