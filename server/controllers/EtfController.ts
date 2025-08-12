import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getEtfMetricsLatest } from '../services/etfMetricsService';
import { getCache, setCache } from '../services/cache';
import { withServerTiming } from '../middleware/serverTiming';

const CACHE_KEY = 'etf:metrics:latest';
const TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '30', 10); // Reduced cache time for more real-time data

export const getEtfMetricsBulk = withServerTiming(async (req: Request, res: Response) => {
  // Skip cache for real-time data if requested
  const bypassCache = req.query.nocache === 'true' || req.headers['cache-control'] === 'no-cache';
  
  // Try cache first (unless bypassed)
  const cacheStart = performance.now();
  let payload = bypassCache ? null : await getCache(CACHE_KEY);
  const cacheMs = performance.now() - cacheStart;

  if (!payload) {
    const dbStart = performance.now();
    const data = await getEtfMetricsLatest();
    const dbMs = performance.now() - dbStart;
    
    const serializeStart = performance.now();
    // Optimized payload with only essential fields
    const optimizedData = data.map(row => ({
      symbol: row.symbol,
      name: row.name,
      last_price: Number(row.last_price),
      pct_change_1d: Number(row.pct_change_1d),
      perf_5d: Number(row.perf_5d) || 0,
      perf_1m: Number(row.perf_1m) || 0,
      volume: Number(row.volume) || 0,
      rsi: Number(row.rsi) || 0,
      macd: Number(row.macd) || 0,
      bb_percent_b: Number(row.bb_percent_b) || 0,
      sma_50: Number(row.sma_50) || 0,
      sma_200: Number(row.sma_200) || 0,
      ema_21: Number(row.ema_21) || 0,
      mini_trend_30d: Array.isArray(row.mini_trend_30d) ? row.mini_trend_30d : []
    }));
    
    payload = JSON.stringify({ 
      version: 1,
      updatedAt: new Date().toISOString(), 
      items: optimizedData 
    });
    const serializeMs = performance.now() - serializeStart;
    
    await setCache(CACHE_KEY, payload, TTL_SECONDS);
    
    res.locals.serverTiming = { 
      ...res.locals.serverTiming,
      db: dbMs.toFixed(1),
      serialize: serializeMs.toFixed(1),
      cache_status: 'miss'
    };
  } else {
    res.locals.serverTiming = { 
      ...res.locals.serverTiming,
      cache: cacheMs.toFixed(1),
      cache_status: 'hit'
    };
  }

  // ETag + conditional with weak validation
  const etag = `W/"${crypto.createHash('sha1').update(payload).digest('hex')}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.setHeader('X-Cache-Status', payload ? 'hit' : 'miss');
  
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.type('application/json').status(200).send(payload);
});