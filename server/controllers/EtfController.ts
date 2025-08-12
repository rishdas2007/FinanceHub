import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getEtfMetricsLatest } from '../services/etfMetricsService';
import { getCache, setCache } from '../services/cache';
import { withServerTiming } from '../middleware/serverTiming';

const CACHE_KEY = 'etf:metrics:latest';
const TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

export const getEtfMetricsBulk = withServerTiming(async (req: Request, res: Response) => {
  // Try cache first
  const start = performance.now();
  let payload = await getCache(CACHE_KEY);
  const cacheMs = performance.now() - start;

  if (!payload) {
    const dbStart = performance.now();
    const data = await getEtfMetricsLatest(); // returns a flat array of rows
    const dbMs = performance.now() - dbStart;
    payload = JSON.stringify({ updatedAt: new Date().toISOString(), items: data });
    await setCache(CACHE_KEY, payload, TTL_SECONDS);
    res.locals.serverTiming = { ...(res.locals.serverTiming || {}), db: dbMs.toFixed(1) };
  } else {
    res.locals.serverTiming = { ...(res.locals.serverTiming || {}), cache: cacheMs.toFixed(1) };
  }

  // ETag + conditional
  const etag = crypto.createHash('sha1').update(payload).digest('hex');
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.type('application/json').status(200).send(payload);
});