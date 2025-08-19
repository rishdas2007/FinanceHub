import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MOVERS } from '../config/movers';
import { getCache, setCache, getLastGood, setLastGood } from '../cache/unified-dashboard-cache';

// Removed spark12m function - no longer needed

export const getEconMovers = async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 5));
  const cacheKey = `movers:econ:${limit}:v2`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  try {
    // Latest NON-DAILY series (default transform, coalesced)
    const latest = await db.execute(sql`
      with latest as (
        select d.series_id,
               d.display_name,
               coalesce(nullif(d.default_transform,''),'LEVEL') as default_transform,
               d.standard_unit,
               max(o.period_end) as last_period
        from econ_series_def d
        join econ_series_observation o
          on o.series_id = d.series_id
         and o.transform_code = coalesce(nullif(d.default_transform,''),'LEVEL')
         and o.freq <> 'D'
        group by d.series_id, d.display_name, d.default_transform, d.standard_unit
      )
      select * from latest
      order by last_period desc
      limit ${limit};
    `);

    const out = [];
    for (const r of latest.rows as any[]) {
      const { series_id, display_name, default_transform, standard_unit, last_period } = r;

      const cur = await db.execute(sql`
        select period_end, value_std
        from econ_series_observation
        where series_id = ${series_id}
          and transform_code = ${default_transform}
          and period_end = ${last_period}
        limit 1;
      `);
      const prior = await db.execute(sql`
        select period_end, value_std
        from econ_series_observation
        where series_id = ${series_id}
          and transform_code = ${default_transform}
          and period_end < ${last_period}
        order by period_end desc
        limit 1;
      `);

      const currentVal = cur.rows[0]?.value_std ?? null;
      const priorVal   = prior.rows[0]?.value_std ?? null;

      const zq = await db.execute(sql`
        select level_z
        from econ_series_features
        where series_id = ${series_id}
          and transform_code = ${default_transform}
          and period_end = ${last_period}
        order by pipeline_version desc
        limit 1;
      `);
      const z = zq.rows[0]?.level_z ?? null;

      const vsPrior = (currentVal != null && priorVal != null)
        ? Number(currentVal) - Number(priorVal)
        : null;

      out.push({
        seriesId: series_id,
        displayName: display_name,
        transform: default_transform,
        unit: standard_unit,
        period: String(last_period),
        current: currentVal,
        prior: priorVal,
        vsPrior,
        zScore: z
      });
    }

    await setCache(cacheKey, out, MOVERS.CACHE_TTL_ECON_MS);
    await setLastGood(cacheKey, out);
    return res.json({ success: true, data: out });
  } catch (err) {
    console.error('[movers/econ] error', err);
    const last = await getLastGood(cacheKey);
    if (last) return res.json({ success: true, data: last, warning: 'stale_lastGood' });
    return res.json({ success: true, data: [], warning: 'data_unavailable' });
  }
};