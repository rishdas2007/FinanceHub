import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cache } from '../services/cache-service';

export async function getEconSparkline(req: Request, res: Response) {
  const { seriesId, months = 12, transform = 'LEVEL' } = req.query;

  if (!seriesId || typeof seriesId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'seriesId is required'
    });
  }

  const cacheKey = `econ:spark:${seriesId}:${transform}:${months}:v1`;
  
  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.data,
        meta: cached.meta,
        cached: true
      });
    }

    // Get default transform from series definition if not provided
    let finalTransform = transform;
    if (transform === 'LEVEL') {
      try {
        const seriesDef = await db.execute(sql`
          SELECT default_transform, native_unit, frequency
          FROM econ_series_def 
          WHERE series_id = ${seriesId}
          LIMIT 1
        `);
        
        if (seriesDef.rows.length > 0) {
          const def = seriesDef.rows[0] as any;
          finalTransform = def.default_transform || 'LEVEL';
        }
      } catch (error) {
        logger.warn(`Failed to get series definition for ${seriesId}:`, error);
      }
    }

    // Query Silver layer with monthly resampling
    const result = await db.execute(sql`
      WITH raw AS (
        SELECT period_end::date as pe, value_std
        FROM econ_series_observation
        WHERE series_id = ${seriesId}
          AND value_std IS NOT NULL
          AND period_end >= date_trunc('month', current_date) - (${months} || ' months')::interval
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
      )
      SELECT period_end, value_std
      FROM last_per_month
      ORDER BY period_end ASC
      LIMIT 50
    `);

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

    // Cache for 30 minutes
    cache.set(cacheKey, response, 30 * 60 * 1000);

    res.json({
      success: true,
      ...response,
      cached: false
    });

  } catch (error) {
    logger.error(`Failed to fetch sparkline for ${seriesId}:`, error);
    
    // Try to serve last good data from cache if available
    const lastGood = cache.get(`${cacheKey}:lastgood`);
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
        transform: finalTransform,
        months: parseInt(months as string),
        points: 0
      },
      warning: 'data_unavailable'
    });
  }
}