import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MOVERS } from '../config/movers';
import { getCache, setCache, getLastGood, setLastGood } from '../cache/unified-dashboard-cache';
import { loadDailyCloses } from '../services/history/load-daily-closes.service';

type Spark = { t: number; value: number };

function classify(z: number | null) {
  if (z == null) return 'NEUTRAL' as const;
  if (z <= MOVERS.Z_THRESH_BUY) return 'BUY' as const;
  if (z >= MOVERS.Z_THRESH_SELL) return 'SELL' as const;
  return 'NEUTRAL' as const;
}

export const getEtfMovers = async (req: Request, res: Response) => {
  const horizon = String(req.query.horizon || MOVERS.ETF_DEFAULT_HORIZON).toUpperCase();
  const limit = Math.max(1, Math.min(24, Number(req.query.limit) || 12));

  const raw = String(req.query.universe || 'SPY,XLK,XLF,XLV,XLY,XLI,XLC,XLE,XLP,XLU,IYR,IWM');
  const universe = Array.from(new Set(raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)));
  if (!universe.includes('SPY')) universe.unshift('SPY');

  const cacheKey = `movers:etf:${horizon}:${universe.join('|')}:v2`;
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  try {
    // --- Prices & pct change (safe array param via UNNEST) ---
    const pricesQ = await db.execute(sql`
      with u as (select unnest(${universe}::text[]) as symbol),
      last2 as (
        select b.symbol, b.ts_utc, b.close,
               row_number() over (partition by b.symbol order by b.ts_utc desc) rn
        from equity_daily_bars b
        join u using(symbol)
      )
      select l.symbol,
             l.close as price,
             (l.close - p.close) / nullif(p.close,0)::float as pct_change
      from (select symbol, close from last2 where rn=1) l
      left join (select symbol, close from last2 where rn=2) p using(symbol);
    `);

    const priceMap = new Map<string, {price:number|null; pctChange:number|null}>();
    for (const r of pricesQ.rows as any[]) {
      priceMap.set(r.symbol, { price: Number(r.price ?? null), pctChange: Number(r.pct_change ?? null) });
    }

    // --- Z-scores (safe array param via UNNEST) ---
    const zQ = await db.execute(sql`
      with u as (select unnest(${universe}::text[]) as symbol),
      mx as (
        select f.symbol, max(f.asof_date) as d
        from equity_features_daily f
        join u using(symbol)
        where f.horizon = ${horizon}
        group by f.symbol
      )
      select f.symbol, f.z_close
      from equity_features_daily f
      join mx on mx.symbol=f.symbol and mx.d=f.asof_date
      where f.horizon = ${horizon};
    `);
    const zMap = new Map<string, number|null>();
    for (const r of zQ.rows as any[]) zMap.set(r.symbol, r.z_close == null ? null : Number(r.z_close));

    // --- Spark helper (30D daily closes) ---
    async function spark(symbol: string) {
      try {
        const series = await loadDailyCloses(symbol, MOVERS.ETF_SPARK_DAYS);
        return (series ?? []).map((p: any) => ({ t: new Date(p.date).getTime(), value: Number(p.close) }));
      } catch (error) {
        console.warn(`Failed to load spark data for ${symbol}:`, error);
        return [];
      }
    }

    // --- Assemble payload ---
    const benchSym = 'SPY';
    const bench = {
      symbol: benchSym,
      price: priceMap.get(benchSym)?.price ?? null,
      pctChange: priceMap.get(benchSym)?.pctChange ?? null,
      zScore: zMap.get(benchSym) ?? null,
      signal: classify(zMap.get(benchSym) ?? null),
      spark: await spark(benchSym)
    };

    const rows = [];
    for (const s of universe) {
      if (s === benchSym) continue;
      const z = zMap.get(s) ?? null;
      const signal = classify(z);
      if (signal === 'NEUTRAL') continue;
      rows.push({
        symbol: s,
        price: priceMap.get(s)?.price ?? null,
        pctChange: priceMap.get(s)?.pctChange ?? null,
        zScore: z,
        signal,
        spark: await spark(s)
      });
      if (rows.length >= limit) break;
    }

    const payload = { benchmark: bench, signals: rows };
    await setCache(cacheKey, payload, MOVERS.CACHE_TTL_ETF_MS);
    await setLastGood(cacheKey, payload);
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[movers/etf] error', err);
    const last = await getLastGood(cacheKey);
    if (last) return res.json({ success: true, data: last, warning: 'stale_lastGood' });
    return res.json({ success: true, data: { benchmark: null, signals: [] }, warning: 'data_unavailable' });
  }
};