# PR A — Backend Bulk Endpoint

## File: README.md

```md
# PR A — Backend: Bulk ETF Endpoint, Caching, Schedulers, and ETag

**Goal:** Cut page TTI by replacing multiple per-row calls with one bulk payload, cached for ~60s and pre-warmed by the scheduler. Adds `Server-Timing`, `ETag`, `Cache-Control`, and a materialized table for fast reads.

## What’s included
1. New endpoint: `GET /api/v2/etf-metrics?bulk=true`
2. Cache layer for hot key `etf:metrics:latest` (memory or Redis)
3. Scheduler warm path to refresh DB + cache
4. Materialized table SQL for precomputed metrics
5. Middleware to send `ETag` and `Server-Timing`
6. Minimal wiring in `server/index.ts`

## Apply steps (high level)
- Drop the new files into your repo at the matching paths.
- Apply the `.patch` files to update existing imports/routers.
- Run the SQL under `db/materialized_tables.sql` (adjust schema name if needed).
- Set `CACHE_TTL_SECONDS=60` (or keep default 60).
- Deploy; verify `ETag` and `Cache-Control` headers and `Server-Timing` appear.


```

## File: server-index.patch

```patch
*** Begin Patch
*** Update File: server/index.ts
@@
 import express from 'express';
@@
+import serverTiming from './middleware/serverTiming'; // if default export, else adjust
+import etfMetricsBulkRouter from './routes/api/v2/etfMetricsBulk';
@@
   app.use('/api/v2/health', healthRouterV2);
+  // Bulk ETF metrics endpoint with ETag + Server-Timing
+  app.use('/api/v2', etfMetricsBulkRouter);
*** End Patch

```

## File: server/controllers/EtfController.ts

```ts
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getEtfMetricsLatest } from '../../services/etfMetricsService';
import { getCache, setCache } from '../../services/cache';
import { withServerTiming } from '../../middleware/serverTiming';

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

```

## File: server/services/etfMetricsService.ts

```ts
import { db } from '../storage/db';
/**
 * Returns precomputed ETF metrics from a materialized table for fast SELECT.
 * Shape is flat/columnar to gzip well.
 */
export async function getEtfMetricsLatest() {
  // Adjust to your Drizzle schema or use raw SQL as needed.
  // Example using a raw query; replace with Drizzle query builder if preferred.
  const result = await db.query(`
    SELECT
      symbol,
      name,
      last_price,
      pct_change_1d,
      perf_5d,
      perf_1m,
      volume,
      rsi,
      macd,
      bb_percent_b,
      sma_50,
      sma_200,
      ema_21,
      mini_trend_30d  -- JSON array of small numbers for a sparkline-like display
    FROM etf_metrics_latest
    ORDER BY symbol ASC
  `);
  return result.rows;
}

```

## File: server/services/cache.ts

```ts
import Redis from 'ioredis';

let redis: Redis | null = null;
const memory = new Map<string, { expiresAt: number, value: string }>();

function getRedis(): Redis | null {
  if (process.env.REDIS_URL) {
    if (!redis) redis = new Redis(process.env.REDIS_URL);
    return redis;
  }
  return null;
}

export async function getCache(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) return await r.get(key);
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { memory.delete(key); return null; }
  return hit.value;
}

export async function setCache(key: string, value: string, ttlSeconds: number) {
  const r = getRedis();
  if (r) await r.setex(key, ttlSeconds, value);
  else memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

```

## File: server/services/schedulerWarmers.ts

```ts
import { getEtfMetricsLatest } from '../services/etfMetricsService';
import { setCache } from '../services/cache';

const CACHE_KEY = 'etf:metrics:latest';
const TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

/**
 * Call this from your existing cron initialization after DB refresh.
 */
export async function warmEtfMetricsCache() {
  const rows = await getEtfMetricsLatest();
  const payload = JSON.stringify({ updatedAt: new Date().toISOString(), items: rows });
  await setCache(CACHE_KEY, payload, TTL_SECONDS);
  return rows.length;
}

```

## File: server/routes/api/v2/etfMetricsBulk.ts

```ts
import { Router } from 'express';
import { getEtfMetricsBulk } from '../../controllers/EtfController';

const router = Router();

/**
 * GET /api/v2/etf-metrics?bulk=true
 * Returns a single payload with all ETF rows needed for the main table.
 */
router.get('/etf-metrics', (req, res, next) => {
  if (req.query.bulk === 'true') return getEtfMetricsBulk(req, res).catch(next);
  // If needed, fall back to non-bulk handler (not included here).
  res.status(400).json({ ok: false, error: 'Set ?bulk=true to use the bulk endpoint.' });
});

export default router;

```

## File: server/middleware/serverTiming.ts

```ts
import type { Request, Response, NextFunction } from 'express';

/**
 * Decorator to time handlers and emit Server-Timing header.
 */
export function withServerTiming(handler: (req: Request, res: Response, next?: NextFunction) => Promise<any>) {
  return async (req: Request, res: Response, next?: NextFunction) => {
    const t0 = performance.now();
    res.locals.serverTiming = res.locals.serverTiming || {};
    try {
      await handler(req, res, next);
    } finally {
      const total = performance.now() - t0;
      const parts: string[] = [];
      for (const [k, v] of Object.entries(res.locals.serverTiming)) {
        parts.push(`${k};dur=${v}`);
      }
      parts.push(`total;dur=${total.toFixed(1)}`);
      res.setHeader('Server-Timing', parts.join(', '));
    }
  };
}

```

## File: db/materialized_tables.sql

```sql
-- db/materialized_tables.sql
-- Adjust schema name as needed.

CREATE TABLE IF NOT EXISTS etf_metrics_latest (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  last_price NUMERIC NOT NULL,
  pct_change_1d NUMERIC NOT NULL,
  perf_5d NUMERIC,
  perf_1m NUMERIC,
  volume BIGINT,
  rsi NUMERIC,
  macd NUMERIC,
  bb_percent_b NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  ema_21 NUMERIC,
  mini_trend_30d JSONB NOT NULL
);

-- Create or refresh this table from your intraday ETL/scheduler.
-- Example pattern (pseudocode):
-- INSERT INTO etf_metrics_latest (...) SELECT ... FROM staging_tables
-- ON CONFLICT (symbol) DO UPDATE SET (...)= (EXCLUDED....);

```

# PR B — Frontend Performance

## File: README.md

```md
# PR B — Frontend: One Bulk Query, Code-Splitting, Idle Inits, Virtualized Table

**Goal:** Reduce JS work and network waterfalls on first paint. Replace multiple queries with one, defer non-critical hooks, virtualize large tables, and configure Vite chunking.

## Changes
1. React Query: single `useQuery(['etf-metrics-bulk'])` hitting `/api/v2/etf-metrics?bulk=true`
2. Idle/deferred hooks (`useDeferredInit`) for performance trackers, WebSocket, etc.
3. Table virtualization for >100 rows
4. Vite `manualChunks` to split vendor/UI/chart libs
5. Switch Lucide to per-icon imports

Apply the patch and drop in new files. Rebuild and verify bundle sizes and first-load requests.

```

## File: dashboard.patch

```patch
*** Begin Patch
*** Update File: client/src/pages/Dashboard.tsx
@@
-import { useQuery } from '@tanstack/react-query';
+import { useQuery } from '@tanstack/react-query';
+import { useDeferredInit } from '../hooks/useDeferredInit';
@@
-  const { data, isLoading, error } = useQuery({
-    queryKey: ['etf-metrics'],
-    queryFn: () => fetch('/api/v1/etf-metrics').then(r => r.json()),
-  });
+  const { data, isLoading, error } = useQuery({
+    queryKey: ['etf-metrics-bulk'],
+    queryFn: async () => {
+      const r = await fetch('/api/v2/etf-metrics?bulk=true', { headers: { 'Accept': 'application/json' } });
+      if (r.status === 304) return null; // cache still valid
+      return r.json();
+    },
+    staleTime: 60_000,
+    retry: 1,
+    refetchOnWindowFocus: false,
+  });
+
+  // Defer non-critical hooks (perf tracker, websocket, etc.)
+  useDeferredInit(() => {
+    // initPerformanceMonitoring();
+    // initWebsocket();
+  }, 500);
*** End Patch

```

## File: vite.patch

```patch
*** Begin Patch
*** Update File: vite.config.ts
@@
 import { defineConfig } from 'vite';
 import react from '@vitejs/plugin-react';
@@
 export default defineConfig({
   plugins: [react()],
+  build: {
+    cssCodeSplit: true,
+    sourcemap: false,
+    rollupOptions: {
+      output: {
+        manualChunks: {
+          vendor: ['react', 'react-dom'],
+          query: ['@tanstack/react-query'],
+          ui: ['wouter', 'lucide-react'],
+          virt: ['react-window']
+        }
+      }
+    }
+  }
 });
*** End Patch

```

## File: package.patch

```patch
*** Begin Patch
*** Update File: package.json
@@
   "dependencies": {
@@
+    "react-window": "^1.8.9"
   }
*** End Patch

```

## File: client/src/hooks/useDeferredInit.ts

```ts
import { useEffect, useRef } from 'react';

export function useDeferredInit(cb: () => void, delayMs = 0) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const run = () => {
      if (done.current) return;
      done.current = true;
      setTimeout(cb, delayMs);
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
      // Fallback to next tick
      setTimeout(run, 0);
    }
  }, [cb, delayMs]);
}

```

## File: client/src/components/ETFTableVirtualized.tsx

```tsx
import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';

type Row = {
  symbol: string;
  name: string;
  last_price: number;
  pct_change_1d: number;
  perf_5d?: number;
  perf_1m?: number;
  volume?: number;
  rsi?: number;
  macd?: number;
  bb_percent_b?: number;
  sma_50?: number;
  sma_200?: number;
  ema_21?: number;
  mini_trend_30d: number[];
};

function RowView({ data, index, style }: any) {
  const row: Row = data.items[index];
  return (
    <div style={style} className="grid grid-cols-8 px-3 py-2 border-b text-sm">
      <div className="font-mono">{row.symbol}</div>
      <div className="truncate">{row.name}</div>
      <div className="text-right">{row.last_price.toFixed(2)}</div>
      <div className={row.pct_change_1d >= 0 ? 'text-green-600 text-right' : 'text-red-600 text-right'}>
        {row.pct_change_1d.toFixed(2)}%
      </div>
      <div className="text-right">{(row.perf_5d ?? 0).toFixed(2)}%</div>
      <div className="text-right">{(row.perf_1m ?? 0).toFixed(2)}%</div>
      <div className="text-right">{row.volume?.toLocaleString() ?? '-'}</div>
      <div className="text-right">{(row.rsi ?? 0).toFixed(1)}</div>
    </div>
  );
}

const areEqual = (prev: any, next: any) => {
  const a = prev.data.items[prev.index];
  const b = next.data.items[next.index];
  return a === b ||
    (a.symbol === b.symbol &&
     a.last_price === b.last_price &&
     a.pct_change_1d === b.pct_change_1d &&
     a.perf_5d === b.perf_5d &&
     a.perf_1m === b.perf_1m &&
     a.volume === b.volume &&
     a.rsi === b.rsi);
};

const MemoRow = memo(RowView, areEqual);

export function ETFTableVirtualized({ items }: { items: Row[] }) {
  const height = Math.min(600, Math.max(300, items.length * 40));
  return (
    <div className="rounded-xl shadow-sm border">
      <div className="grid grid-cols-8 px-3 py-2 bg-gray-50 text-xs uppercase tracking-wide">
        <div>Symbol</div><div>Name</div><div>Price</div><div>1D %</div><div>5D</div><div>1M</div><div>Volume</div><div>RSI</div>
      </div>
      <List
        height={height}
        itemCount={items.length}
        itemSize={40}
        width="100%"
        itemData={{ items }}
      >
        {MemoRow as any}
      </List>
    </div>
  );
}

```

# PR C — Ops Observability

## File: README.md

```md
# PR C — Ops: Nginx Brotli/ETag/HTTP2, Server-Timing, Web Vitals

**Goal:** Improve delivery, enable observability of wins, and keep assets small on the wire.

## Changes
1. Nginx config enabling brotli + gzip, `etag on`, HTTP/2 (or HTTP/3), proper caching headers pass-through
2. Express `Server-Timing` middleware (used by PR A)
3. Tiny Web Vitals reporter to measure FCP/LCP/TTI in production

Drop the files/snippets in place and reload Nginx.

```

## File: main.patch

```patch
*** Begin Patch
*** Update File: client/src/main.tsx
@@
 import React from 'react';
 import ReactDOM from 'react-dom/client';
 import App from './App';
+import { initWebVitals } from './lib/webVitals';
@@
 const root = ReactDOM.createRoot(document.getElementById('root')!);
 root.render(<App />);
+// Defer to idle
+if ('requestIdleCallback' in window) {
+  (window as any).requestIdleCallback(() => initWebVitals());
+} else {
+  setTimeout(() => initWebVitals(), 0);
+}
*** End Patch

```

## File: nginx/nginx.conf

```conf
# nginx/nginx.conf (snippet)
# Requires brotli module installed; if not available, keep gzip.

http {
  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_timeout 65;
  types_hash_max_size 4096;
  include       mime.types;
  default_type  application/octet-stream;

  # Compression
  gzip on;
  gzip_comp_level 6;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml+rss text/javascript image/svg+xml;
  gzip_min_length 512;

  # Brotli (if module available)
  brotli on;
  brotli_comp_level 5;
  brotli_types text/plain text/css application/json application/javascript text/xml application/xml+rss text/javascript image/svg+xml;

  # Caching/ETag
  etag on;

  server {
    listen 80;
    # listen 443 ssl http2; # enable with certs
    server_name _;

    location / {
      proxy_pass http://app:5000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
    }

    location ~* \.(js|css|svg|woff2?)$ {
      expires 7d;
      add_header Cache-Control "public, max-age=604800, immutable";
      try_files $uri @app;
    }

    location @app {
      proxy_pass http://app:5000;
    }
  }
}

```

## File: client/src/lib/webVitals.ts

```ts
// client/src/lib/webVitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

function send(metric: any) {
  try {
    navigator.sendBeacon?.('/api/v2/quality/web-vitals', JSON.stringify(metric));
  } catch {}
}

export function initWebVitals() {
  onCLS(send);
  onFID(send);
  onLCP(send);
  onFCP(send);
  onTTFB(send);
}

```
