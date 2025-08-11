import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MOVERS } from '../config/movers';

async function getSpark12m(seriesId: string, transform: string) {
  const q = await db.execute(sql`
    with raw as (
      select period_end::date as pe, value_std
      from econ_series_observation
      where series_id = ${seriesId}
        and transform_code = ${transform}
        and period_end >= date_trunc('month', current_date) - interval '12 months'
    ),
    bucket as (
      select date_trunc('month', pe) as m_end, pe, value_std from raw
    ),
    last_per_month as (
      select distinct on (m_end) m_end::date as period_end, value_std
      from bucket
      order by m_end, pe desc
    )
    select period_end, value_std
    from last_per_month
    order by period_end asc;
  `);
  
  return (q.rows as any[]).map(r => ({
    t: Date.parse(r.period_end),
    value: Number(r.value_std)
  }));
}

export const getEconMovers = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 5));
    
    console.log(`📊 Economic Movers: Processing latest ${limit} non-daily series`);

    // 1) Find the latest updated NON-DAILY series using each series' default transform
    const latest = await db.execute(sql`
      with latest as (
        select d.series_id, d.display_name, d.default_transform, d.standard_unit,
               max(o.period_end) as last_period
        from econ_series_def d
        join econ_series_observation o
          on o.series_id = d.series_id
         and o.transform_code = d.default_transform
         and o.freq <> 'D'
        group by d.series_id, d.display_name, d.default_transform, d.standard_unit
      )
      select *
      from latest
      order by last_period desc
      limit ${limit};
    `);

    const out = [];
    
    for (const r of (latest.rows as any[])) {
      const { series_id, display_name, default_transform, standard_unit, last_period } = r;

      // 2) Fetch current & prior from Silver
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
      const priorVal = prior.rows[0]?.value_std ?? null;

      // 3) z-score from Gold (level_z for same period/transform)
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

      // 4) vs prior (difference; if transform is YOY, it's percentage-point delta)
      const vsPrior = (currentVal != null && priorVal != null) ? (Number(currentVal) - Number(priorVal)) : null;

      // 5) sparkline (12M monthly)
      const spark = await getSpark12m(series_id, default_transform);

      out.push({
        seriesId: series_id,
        displayName: display_name,
        transform: default_transform,
        unit: standard_unit,
        period: String(last_period),
        current: currentVal,
        prior: priorVal,
        vsPrior,
        zScore: z,
        spark12m: spark
      });
    }

    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Economic Movers completed in ${responseTime}ms: ${out.length} series`);
    
    res.json({
      success: true,
      data: out,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Economic Movers error:', error);
    res.status(500).json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};