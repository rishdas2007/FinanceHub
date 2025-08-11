import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { MOVERS } from '../config/movers';

type Spark = { t: number; value: number };

function classify(z: number | null) {
  if (z == null) return 'NEUTRAL' as const;
  if (z <= MOVERS.Z_THRESH_BUY) return 'BUY' as const;
  if (z >= MOVERS.Z_THRESH_SELL) return 'SELL' as const;
  return 'NEUTRAL' as const;
}

export const getEtfMovers = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const horizon = String(req.query.horizon || MOVERS.ETF_DEFAULT_HORIZON).toUpperCase();
    const limit = Math.max(1, Math.min(24, Number(req.query.limit) || 12));

    // universe parse + ensure SPY present
    const universeRaw = String(req.query.universe || MOVERS.ETF_UNIVERSE.join(','));
    const universe = Array.from(new Set(universeRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)));
    if (!universe.includes('SPY')) universe.unshift('SPY');

    console.log(`📊 ETF Movers: Processing ${universe.length} symbols for ${horizon} horizon`);

    // Get latest price data for each symbol individually to avoid SQL casting issues
    const priceMap = new Map<string, {price: number | null; pctChange: number | null}>();
    
    for (const symbol of universe) {
      try {
        const priceData = await db.execute(sql`
          select close, ts_utc,
            lag(close) over (order by ts_utc) as prev_close
          from equity_daily_bars 
          where symbol = ${symbol}
          order by ts_utc desc
          limit 2
        `);
        
        if (priceData.rows.length > 0) {
          const latest = priceData.rows[0] as any;
          const current = Number(latest.close);
          const previous = latest.prev_close ? Number(latest.prev_close) : null;
          const pctChange = (previous && previous > 0) ? (current - previous) / previous : null;
          
          priceMap.set(symbol, { price: current, pctChange });
        } else {
          priceMap.set(symbol, { price: null, pctChange: null });
        }
      } catch (error) {
        console.warn(`Failed to get price data for ${symbol}:`, error);
        priceMap.set(symbol, { price: null, pctChange: null });
      }
    }



    // Get z-scores for each symbol individually
    const zMap = new Map<string, number | null>();
    
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
          const z = (zData.rows[0] as any).z_close;
          zMap.set(symbol, z ? Number(z) : null);
        } else {
          zMap.set(symbol, null);
        }
      } catch (error) {
        console.warn(`Failed to get z-score for ${symbol}:`, error);
        zMap.set(symbol, null);
      }
    }

    // Build spark (30D closes) for benchmark + signaled ETFs
    async function getSpark(symbol: string): Promise<Spark[]> {
      const sparkData = await db.execute(sql`
        select ts_utc, close
        from equity_daily_bars
        where symbol = ${symbol}
          and ts_utc >= current_date - interval '30 days'
        order by ts_utc asc
        limit 30;
      `);
      
      return (sparkData.rows as any[]).map(p => ({ 
        t: new Date(p.ts_utc).getTime(), 
        value: Number(p.close) 
      }));
    }

    // Assemble benchmark
    const benchmarkSymbol = 'SPY';
    const bench = {
      symbol: benchmarkSymbol,
      price: priceMap.get(benchmarkSymbol)?.price ?? null,
      pctChange: priceMap.get(benchmarkSymbol)?.pctChange ?? null,
      zScore: zMap.get(benchmarkSymbol) ?? null,
      signal: classify(zMap.get(benchmarkSymbol) ?? null) as 'BUY' | 'SELL' | 'NEUTRAL',
      spark: await getSpark(benchmarkSymbol)
    };

    // Filter only BUY/SELL (exclude NEUTRAL), limit N
    const candidates = universe.filter(s => s !== benchmarkSymbol);
    const rows: any[] = [];
    
    for (const s of candidates) {
      const z = zMap.get(s) ?? null;
      const signal = classify(z);
      if (signal === 'NEUTRAL') continue;
      
      rows.push({
        symbol: s,
        price: priceMap.get(s)?.price ?? null,
        pctChange: priceMap.get(s)?.pctChange ?? null,
        zScore: z,
        signal,
        spark: await getSpark(s)
      });
      
      if (rows.length >= limit) break;
    }

    const responseTime = Date.now() - startTime;
    const payload = { benchmark: bench, signals: rows };
    
    console.log(`✅ ETF Movers completed in ${responseTime}ms: ${rows.length} signals`);
    
    res.json({
      success: true,
      data: payload,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ETF Movers error:', error);
    res.status(500).json({
      success: false,
      data: { benchmark: null, signals: [] },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};