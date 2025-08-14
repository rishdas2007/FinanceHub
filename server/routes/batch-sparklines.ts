import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { cacheService as cache } from '../services/cache-unified';
import { logger } from '../utils/logger';

export async function getBatchSparklines(req: Request, res: Response) {
  const { seriesIds, months = 12, transform = 'LEVEL' } = req.body;

  if (!Array.isArray(seriesIds)) {
    return res.status(400).json({ error: 'seriesIds array required' });
  }

  const batchCacheKey = `sparklines:batch:${seriesIds.sort().join(',')}:${transform}:${months}:v2`;
  const cached = cache.get(batchCacheKey);

  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  try {
    logger.info(`📊 Batch sparklines request: ${seriesIds.length} series, transform: ${transform}`);
    
    // Use raw SQL with proper parameter handling
    const monthsValue = Math.max(6, Math.min(36, months));
    const isYOY = transform === 'YOY';
    
    const seriesIdsArray = seriesIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    
    const query = `
      WITH monthly_data AS (
        SELECT 
          o.series_id,
          date_trunc('month', period_end::date) as month_end,
          period_end::date as pe,
          value_std::FLOAT as value_std,
          ROW_NUMBER() OVER (
            PARTITION BY o.series_id, date_trunc('month', period_end::date) 
            ORDER BY period_end DESC
          ) as rn
        FROM econ_series_observation o
        WHERE o.series_id = ANY(ARRAY[${seriesIdsArray}])
          AND value_std IS NOT NULL
          AND period_end >= current_date - interval '36 months'
      ),
      latest_per_month AS (
        SELECT series_id, month_end::date as period_end, value_std
        FROM monthly_data 
        WHERE rn = 1
      ),
      with_calculations AS (
        SELECT 
          series_id,
          period_end,
          value_std,
          ${isYOY ? `
          LAG(value_std, 12) OVER (PARTITION BY series_id ORDER BY period_end) as value_12m_ago,
          CASE 
            WHEN LAG(value_std, 12) OVER (PARTITION BY series_id ORDER BY period_end) IS NOT NULL 
            THEN ((value_std - LAG(value_std, 12) OVER (PARTITION BY series_id ORDER BY period_end)) / LAG(value_std, 12) OVER (PARTITION BY series_id ORDER BY period_end)) * 100
            ELSE NULL
          END as final_value
          ` : `
          NULL as value_12m_ago,
          value_std as final_value
          `}
        FROM latest_per_month
      )
      SELECT 
        series_id,
        period_end,
        final_value as value_std
      FROM with_calculations
      WHERE ${isYOY ? 'final_value IS NOT NULL' : 'final_value IS NOT NULL'}
        AND period_end >= current_date - interval '${monthsValue} months'
      ORDER BY series_id, period_end ASC
    `;
    
    const results = await db.execute(sql.raw(query));

    // Group results by series
    const sparklineData: Record<string, any[]> = {};

    for (const row of results.rows as any[]) {
      if (!sparklineData[row.series_id]) {
        sparklineData[row.series_id] = [];
      }
      sparklineData[row.series_id].push({
        t: Date.parse(row.period_end),
        date: row.period_end,
        value: parseFloat(row.value_std) || 0
      });
    }

    // Cache for 5 minutes
    cache.set(batchCacheKey, sparklineData, 300000);

    logger.info(`⚡ Batch sparklines completed: ${seriesIds.length} series, ${results.rows.length} total points`);

    res.json({ success: true, data: sparklineData, cached: false });

  } catch (error) {
    logger.error('Batch sparklines error:', error);
    res.status(500).json({ error: 'Failed to fetch sparklines' });
  }
}