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

  const cacheKey = `movers:etf:${horizon}:${universe.join('|')}:v3`;
  const cached = await getCache(cacheKey);
  if (cached && !req.query.nocache) return res.json({ success: true, data: cached, cached: true });

  try {
    // Get price data for each symbol individually
    const priceMap = new Map<string, {price:number|null; pctChange:number|null}>();
    
    for (const symbol of universe) {
      try {
        const priceData = await db.execute(sql`
          select close,
            lag(close) over (order by ts_utc) as prev_close
          from equity_daily_bars 
          where symbol = ${symbol}
          order by ts_utc desc
          limit 2
        `);
        
        if (priceData.rows.length > 0) {
          const latest = priceData.rows[0] as { close: number | string; prev_close: number | string | null };
          const current = Number(latest.close);
          const previous = latest.prev_close ? Number(latest.prev_close) : null;
          const pctChange = (previous && previous > 0) ? (current - previous) / previous : null;
          
          priceMap.set(symbol, { price: current, pctChange });
        } else {
          priceMap.set(symbol, { price: null, pctChange: null });
        }
      } catch (error) {
        priceMap.set(symbol, { price: null, pctChange: null });
      }
    }

    // Get z-scores for each symbol individually
    const zMap = new Map<string, number|null>();
    
    for (const symbol of universe) {
      try {
        const zData = await db.execute(sql`
          select z_close
          from equity_features_daily
          where symbol = ${symbol} 
            and horizon = ${horizon}
          order by asof_date desc
          limit 1
        `);
        
        if (zData.rows.length > 0) {
          const z = (zData.rows[0] as { z_close: number | string | null }).z_close;
          zMap.set(symbol, z ? Number(z) : null);
        } else {
          zMap.set(symbol, null);
        }
      } catch (error) {
        zMap.set(symbol, null);
      }
    }

    // --- Spark helper (30D daily closes) ---
    async function spark(symbol: string) {
      try {
        const series = await loadDailyCloses(symbol, MOVERS.ETF_SPARK_DAYS);
        return (series ?? []).map((p: { date: string | Date; close: number | string }) => ({ 
          t: new Date(p.date).getTime(), 
          value: Number(p.close) 
        }));
      } catch (error) {
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