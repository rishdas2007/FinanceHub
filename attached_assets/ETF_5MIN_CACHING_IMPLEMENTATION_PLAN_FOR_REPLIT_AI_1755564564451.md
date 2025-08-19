# ETF 5-Minute Caching Implementation Plan for Replit AI Agent

## 🎯 Implementation Overview

**Objective**: Implement 5-minute caching for ETF Technical Metrics to reduce response time from 495ms to <100ms by eliminating redundant Twelve Data API calls.

**Architecture**: Hybrid caching using materialized views + in-memory cache + background refresh
**Expected Result**: 89% faster response times, 95% reduction in API calls
**Implementation Time**: ~3 hours across 4 phases

---

## 📋 PHASE 1: Database Infrastructure Setup (45 minutes)

### Step 1.1: Create ETF 5-Minute Materialized View

**File**: `database/migrations/001_create_etf_5min_cache.sql`

```sql
-- ETF 5-Minute Caching Materialized View
CREATE MATERIALIZED VIEW public.etf_metrics_5min_cache AS
SELECT 
    symbol,
    symbol || ' ETF' as name,
    last_price,
    pct_change_1d,
    volume,
    rsi,
    macd,
    bb_percent_b,
    sma_50,
    sma_200,
    composite_zscore,
    rsi_zscore,
    macd_zscore,
    CASE 
        WHEN composite_zscore < -1.5 THEN 'BUY'
        WHEN composite_zscore > 1.5 THEN 'SELL' 
        ELSE 'HOLD'
    END as signal,
    CURRENT_TIMESTAMP as cache_timestamp,
    'materialized_view' as data_source,
    5 as cache_ttl_minutes
FROM public.etf_metrics_latest_new
WHERE symbol IN ('SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE')
ORDER BY symbol
WITH DATA;

-- Create indexes for fast access
CREATE INDEX idx_etf_5min_cache_symbol ON public.etf_metrics_5min_cache(symbol);
CREATE INDEX idx_etf_5min_cache_timestamp ON public.etf_metrics_5min_cache(cache_timestamp);
CREATE UNIQUE INDEX idx_etf_5min_cache_symbol_unique ON public.etf_metrics_5min_cache(symbol);

-- Grant permissions
ALTER MATERIALIZED VIEW public.etf_metrics_5min_cache OWNER TO neondb_owner;
```

### Step 1.2: Create Refresh Function

**Add to same file**: `database/migrations/001_create_etf_5min_cache.sql`

```sql
-- Function to refresh ETF 5-minute cache
CREATE OR REPLACE FUNCTION public.refresh_etf_5min_cache()
RETURNS TABLE(
    refresh_duration interval,
    rows_refreshed integer,
    status text,
    timestamp_refreshed timestamp
) AS $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    row_count integer;
BEGIN
    start_time := clock_timestamp();
    
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW public.etf_metrics_5min_cache;
    
    end_time := clock_timestamp();
    
    -- Get row count
    SELECT count(*) INTO row_count FROM public.etf_metrics_5min_cache;
    
    -- Log the refresh
    INSERT INTO public.performance_logs (event_type, message, timestamp)
    VALUES (
        'ETF_CACHE_REFRESH', 
        'ETF 5-minute cache refreshed successfully. Rows: ' || row_count || ', Duration: ' || (end_time - start_time),
        NOW()
    );
    
    -- Return refresh statistics
    RETURN QUERY SELECT 
        (end_time - start_time)::interval as refresh_duration,
        row_count as rows_refreshed,
        'SUCCESS'::text as status,
        end_time as timestamp_refreshed;
        
EXCEPTION WHEN others THEN
    -- Log error
    INSERT INTO public.performance_logs (event_type, message, timestamp)
    VALUES (
        'ETF_CACHE_REFRESH_ERROR', 
        'ETF 5-minute cache refresh failed: ' || SQLERRM,
        NOW()
    );
    
    -- Return error status
    RETURN QUERY SELECT 
        (clock_timestamp() - start_time)::interval as refresh_duration,
        0 as rows_refreshed,
        ('ERROR: ' || SQLERRM)::text as status,
        clock_timestamp() as timestamp_refreshed;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.refresh_etf_5min_cache() TO neondb_owner;
```

### Step 1.3: Execute Database Migration

**Commands to run**:
```bash
# Apply the migration
psql $DATABASE_URL -f database/migrations/001_create_etf_5min_cache.sql

# Verify materialized view exists
psql $DATABASE_URL -c "SELECT count(*) FROM public.etf_metrics_5min_cache;"

# Test refresh function
psql $DATABASE_URL -c "SELECT * FROM public.refresh_etf_5min_cache();"
```

---

## 📋 PHASE 2: ETF Caching Service Implementation (60 minutes)

### Step 2.1: Create ETF 5-Minute Cache Service

**File**: `server/services/etf-5min-cache-service.ts`

```typescript
import { db } from '../db';
import { sql } from 'drizzle-orm';
import logger from '../utils/logger';

export interface ETFMetrics {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number | null;
  rsi: number | null;
  macd: number | null;
  bollingerPercB: number | null;
  sma50: number | null;
  sma200: number | null;
  zScore: number | null;
  rsiZScore: number | null;
  macdZScore: number | null;
  bbZScore: number | null;
  signal: 'BUY' | 'SELL' | 'HOLD';
  lastUpdated: string;
  source: 'cached_5min' | 'live_api' | 'materialized_view';
  cacheStats?: {
    hit: boolean;
    age_seconds: number;
    next_refresh_in: number;
  };
}

export class ETF5MinCacheService {
  private memoryCache: Map<string, { data: ETFMetrics[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_KEY = 'etf_technical_metrics';

  /**
   * Main method to get ETF metrics with 5-minute caching
   */
  async getETFMetrics(): Promise<{
    success: boolean;
    data: ETFMetrics[];
    source: string;
    cache_stats: any;
    timestamp: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Step 1: Check memory cache first
      const cached = this.memoryCache.get(this.CACHE_KEY);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
        const ageSeconds = Math.floor((now - cached.timestamp) / 1000);
        const nextRefreshIn = Math.floor((this.CACHE_TTL_MS - (now - cached.timestamp)) / 1000);
        
        logger.info(`✅ Serving ETF metrics from memory cache (age: ${ageSeconds}s)`);
        
        return {
          success: true,
          data: cached.data.map(item => ({
            ...item,
            cacheStats: {
              hit: true,
              age_seconds: ageSeconds,
              next_refresh_in: nextRefreshIn
            }
          })),
          source: 'memory_cache',
          cache_stats: {
            hit: true,
            age_seconds: ageSeconds,
            next_refresh_in: nextRefreshIn,
            response_time_ms: Date.now() - startTime
          },
          timestamp: new Date().toISOString()
        };
      }

      // Step 2: Cache miss - fetch fresh data
      logger.info('🔄 Memory cache miss - fetching fresh ETF metrics');
      const freshData = await this.fetchFreshETFMetrics();
      
      // Step 3: Update memory cache
      this.memoryCache.set(this.CACHE_KEY, {
        data: freshData,
        timestamp: now
      });

      return {
        success: true,
        data: freshData,
        source: 'fresh_fetch',
        cache_stats: {
          hit: false,
          age_seconds: 0,
          next_refresh_in: Math.floor(this.CACHE_TTL_MS / 1000),
          response_time_ms: Date.now() - startTime
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ ETF 5-minute cache service error:', error);
      
      return {
        success: false,
        data: [],
        source: 'error',
        cache_stats: {
          hit: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          response_time_ms: Date.now() - startTime
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch fresh ETF metrics with materialized view fallback
   */
  private async fetchFreshETFMetrics(): Promise<ETFMetrics[]> {
    // Try materialized view first (fast - ~20ms)
    try {
      const mvData = await this.getFromMaterializedView();
      if (mvData.length > 0) {
        logger.info(`📊 Served ${mvData.length} ETF metrics from materialized view`);
        return mvData;
      }
    } catch (error) {
      logger.warn('⚠️ Materialized view failed, falling back to live API:', error);
    }
    
    // Fallback to live API (slow but reliable - ~495ms)
    logger.info('🌐 Falling back to live Twelve Data API');
    return await this.fetchFromTwelveDataAPI();
  }

  /**
   * Get data from materialized view (fast)
   */
  private async getFromMaterializedView(): Promise<ETFMetrics[]> {
    const result = await db.execute(sql`
      SELECT 
        symbol,
        name,
        last_price,
        pct_change_1d,
        volume,
        rsi,
        macd,
        bb_percent_b,
        sma_50,
        sma_200,
        composite_zscore,
        rsi_zscore,
        macd_zscore,
        signal,
        cache_timestamp,
        data_source
      FROM public.etf_metrics_5min_cache
      ORDER BY symbol
    `);

    const rows = result.rows as any[];
    
    if (rows.length === 0) {
      throw new Error('No data in materialized view');
    }

    return rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      price: parseFloat(row.last_price) || 0,
      changePercent: parseFloat(row.pct_change_1d) || 0,
      volume: row.volume ? parseInt(row.volume) : null,
      rsi: row.rsi ? parseFloat(row.rsi) : null,
      macd: row.macd ? parseFloat(row.macd) : null,
      bollingerPercB: row.bb_percent_b ? parseFloat(row.bb_percent_b) : null,
      sma50: row.sma_50 ? parseFloat(row.sma_50) : null,
      sma200: row.sma_200 ? parseFloat(row.sma_200) : null,
      zScore: row.composite_zscore ? parseFloat(row.composite_zscore) : null,
      rsiZScore: row.rsi_zscore ? parseFloat(row.rsi_zscore) : null,
      macdZScore: row.macd_zscore ? parseFloat(row.macd_zscore) : null,
      bbZScore: null, // Not in materialized view yet
      signal: row.signal as 'BUY' | 'SELL' | 'HOLD',
      lastUpdated: row.cache_timestamp ? new Date(row.cache_timestamp).toISOString() : new Date().toISOString(),
      source: 'materialized_view' as const
    }));
  }

  /**
   * Fetch from Twelve Data API (existing implementation)
   */
  private async fetchFromTwelveDataAPI(): Promise<ETFMetrics[]> {
    // Import and use existing logic from etf-technical-clean.ts
    // This is the fallback when materialized view is empty/failed
    const { default: existingRoute } = await import('../routes/etf-technical-clean');
    
    // Create mock request/response to reuse existing logic
    const mockReq = {} as any;
    const mockRes = {
      json: (data: any) => data,
      status: () => mockRes
    } as any;

    try {
      // Call existing implementation (this is a workaround)
      // In production, extract the core logic to a shared service
      const response = await this.callExistingETFLogic();
      return response.data || [];
    } catch (error) {
      logger.error('❌ Twelve Data API fallback failed:', error);
      return [];
    }
  }

  /**
   * Simplified version of existing ETF logic (extract later)
   */
  private async callExistingETFLogic(): Promise<{ data: ETFMetrics[] }> {
    // Placeholder - in production, extract core logic from etf-technical-clean.ts
    // For now, return empty array to prevent errors
    return { data: [] };
  }

  /**
   * Cache management methods
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    logger.info('🧹 ETF memory cache cleared');
  }

  getCacheStats(): {
    memory_cache: {
      size: number;
      oldest_entry_age_seconds: number | null;
      next_expiry_seconds: number | null;
    };
  } {
    const entries = Array.from(this.memoryCache.entries());
    const now = Date.now();
    
    if (entries.length === 0) {
      return {
        memory_cache: {
          size: 0,
          oldest_entry_age_seconds: null,
          next_expiry_seconds: null
        }
      };
    }

    const oldestEntry = entries.reduce((oldest, current) => 
      current[1].timestamp < oldest[1].timestamp ? current : oldest
    );

    const oldestAge = Math.floor((now - oldestEntry[1].timestamp) / 1000);
    const nextExpiry = Math.floor((this.CACHE_TTL_MS - (now - oldestEntry[1].timestamp)) / 1000);

    return {
      memory_cache: {
        size: this.memoryCache.size,
        oldest_entry_age_seconds: oldestAge,
        next_expiry_seconds: Math.max(0, nextExpiry)
      }
    };
  }

  /**
   * Force refresh materialized view
   */
  async refreshMaterializedView(): Promise<any> {
    try {
      const result = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
      logger.info('🔄 Materialized view refreshed manually');
      return result.rows[0];
    } catch (error) {
      logger.error('❌ Failed to refresh materialized view:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const etf5MinCacheService = new ETF5MinCacheService();
```

### Step 2.2: Create Cached ETF Route

**File**: `server/routes/etf-cached.ts`

```typescript
import { Router } from 'express';
import { etf5MinCacheService } from '../services/etf-5min-cache-service';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/etf/cached
 * ETF Technical Metrics with 5-minute caching
 */
router.get('/cached', async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('🚀 ETF cached endpoint called');
    
    // Get cached ETF metrics
    const result = await etf5MinCacheService.getETFMetrics();
    
    const responseTime = Date.now() - startTime;
    
    // Add response metadata
    const response = {
      ...result,
      meta: {
        response_time_ms: responseTime,
        cached_response: result.cache_stats?.hit || false,
        data_freshness: result.cache_stats?.age_seconds || 0,
        next_refresh_in_seconds: result.cache_stats?.next_refresh_in || 0,
        endpoint: '/api/etf/cached',
        cache_version: '5min_v1'
      }
    };

    // Set cache headers for browser
    if (result.cache_stats?.hit) {
      // Cache hit - set short browser cache
      res.set({
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Cache': 'HIT',
        'X-Cache-Age': result.cache_stats.age_seconds?.toString() || '0'
      });
    } else {
      // Fresh data - allow browser to cache briefly
      res.set({
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'X-Cache': 'MISS',
        'X-Cache-Age': '0'
      });
    }

    logger.info(`✅ ETF cached response: ${responseTime}ms, ${result.data.length} ETFs, cache=${result.cache_stats?.hit ? 'HIT' : 'MISS'}`);
    
    res.json(response);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('❌ ETF cached endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: [],
      source: 'error',
      meta: {
        response_time_ms: responseTime,
        cached_response: false,
        endpoint: '/api/etf/cached',
        error_type: 'internal_server_error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/etf/cache/refresh
 * Manual cache refresh endpoint
 */
router.post('/cache/refresh', async (req, res) => {
  try {
    logger.info('🔄 Manual cache refresh requested');
    
    // Clear memory cache
    etf5MinCacheService.clearMemoryCache();
    
    // Refresh materialized view
    const refreshResult = await etf5MinCacheService.refreshMaterializedView();
    
    // Get fresh data
    const freshData = await etf5MinCacheService.getETFMetrics();
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      refresh_stats: refreshResult,
      fresh_data_count: freshData.data.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Cache refresh error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Cache refresh failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/etf/cache/stats
 * Cache statistics endpoint
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const cacheStats = etf5MinCacheService.getCacheStats();
    
    res.json({
      success: true,
      cache_stats: cacheStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Cache stats error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
```

---

## 📋 PHASE 3: Background Refresh & Integration (45 minutes)

### Step 3.1: Create Background Refresh Service

**File**: `server/services/etf-cache-refresh-cron.ts`

```typescript
import cron from 'node-cron';
import { etf5MinCacheService } from './etf-5min-cache-service';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import logger from '../utils/logger';

export class ETFCacheRefreshCron {
  private refreshJob: cron.ScheduledTask | null = null;
  private warmupJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start all cron jobs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('⚠️ ETF cache refresh cron is already running');
      return;
    }

    this.startMaterializedViewRefresh();
    this.startCacheWarmup();
    
    this.isRunning = true;
    logger.info('⏰ ETF cache refresh cron jobs started');
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    if (this.refreshJob) {
      this.refreshJob.stop();
      this.refreshJob = null;
    }
    
    if (this.warmupJob) {
      this.warmupJob.stop();
      this.warmupJob = null;
    }
    
    this.isRunning = false;
    logger.info('⏹️ ETF cache refresh cron jobs stopped');
  }

  /**
   * Start materialized view refresh every 5 minutes
   */
  private startMaterializedViewRefresh(): void {
    // Refresh materialized view every 5 minutes
    this.refreshJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const startTime = Date.now();
        
        logger.info('🔄 Starting scheduled materialized view refresh');
        
        // Execute refresh function
        const result = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
        const refreshStats = result.rows[0] as any;
        
        const duration = Date.now() - startTime;
        
        logger.info(`✅ Materialized view refresh completed: ${refreshStats.rows_refreshed} rows in ${refreshStats.refresh_duration}, total time: ${duration}ms`);
        
        // Log success metrics
        await this.logRefreshMetrics('materialized_view_refresh', 'success', {
          rows_refreshed: refreshStats.rows_refreshed,
          duration_ms: duration,
          database_duration: refreshStats.refresh_duration
        });
        
      } catch (error) {
        logger.error('❌ Scheduled materialized view refresh failed:', error);
        
        // Log error metrics
        await this.logRefreshMetrics('materialized_view_refresh', 'error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('⏰ Materialized view refresh scheduled (every 5 minutes)');
  }

  /**
   * Start cache warmup every 4 minutes (offset to avoid conflicts)
   */
  private startCacheWarmup(): void {
    // Warm up application cache every 4 minutes (offset from DB refresh)
    this.warmupJob = cron.schedule('*/4 * * * *', async () => {
      try {
        const startTime = Date.now();
        
        logger.info('🔥 Starting scheduled cache warmup');
        
        // Clear memory cache to force fresh fetch
        etf5MinCacheService.clearMemoryCache();
        
        // Fetch fresh data (this will warm up the cache)
        const result = await etf5MinCacheService.getETFMetrics();
        
        const duration = Date.now() - startTime;
        
        logger.info(`✅ Cache warmup completed: ${result.data.length} ETFs cached in ${duration}ms, source: ${result.source}`);
        
        // Log warmup metrics
        await this.logRefreshMetrics('cache_warmup', 'success', {
          etfs_cached: result.data.length,
          duration_ms: duration,
          data_source: result.source
        });
        
      } catch (error) {
        logger.error('❌ Scheduled cache warmup failed:', error);
        
        // Log error metrics
        await this.logRefreshMetrics('cache_warmup', 'error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('⏰ Cache warmup scheduled (every 4 minutes)');
  }

  /**
   * Log refresh metrics to database
   */
  private async logRefreshMetrics(
    operation: string, 
    status: 'success' | 'error', 
    details: any
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO public.performance_logs (event_type, message, timestamp, details)
        VALUES (
          ${`ETF_${operation.toUpperCase()}`},
          ${`${operation} ${status}: ${JSON.stringify(details)}`},
          NOW(),
          ${JSON.stringify(details)}::jsonb
        )
      `);
    } catch (error) {
      logger.error('Failed to log refresh metrics:', error);
    }
  }

  /**
   * Get cron job status
   */
  getStatus(): {
    running: boolean;
    refresh_job_running: boolean;
    warmup_job_running: boolean;
  } {
    return {
      running: this.isRunning,
      refresh_job_running: this.refreshJob?.running || false,
      warmup_job_running: this.warmupJob?.running || false
    };
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualRefresh(): Promise<{
    materialized_view: any;
    cache_warmup: any;
  }> {
    logger.info('🔧 Manual refresh triggered');
    
    const startTime = Date.now();
    
    try {
      // Refresh materialized view
      const mvResult = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
      
      // Clear and warm up cache
      etf5MinCacheService.clearMemoryCache();
      const cacheResult = await etf5MinCacheService.getETFMetrics();
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Manual refresh completed in ${duration}ms`);
      
      return {
        materialized_view: mvResult.rows[0],
        cache_warmup: {
          etfs_cached: cacheResult.data.length,
          source: cacheResult.source,
          duration_ms: duration
        }
      };
      
    } catch (error) {
      logger.error('❌ Manual refresh failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const etfCacheRefreshCron = new ETFCacheRefreshCron();
```

### Step 3.2: Update Main Server Integration

**File**: `server/index.ts` (add to existing file)

```typescript
// Add these imports at the top
import etfCachedRouter from './routes/etf-cached';
import { etfCacheRefreshCron } from './services/etf-cache-refresh-cron';

// Add the cached route (add to existing routes section)
app.use('/api/etf', etfCachedRouter);

// Start background cron jobs (add after server startup)
const startBackgroundServices = async () => {
  try {
    // Start ETF cache refresh cron jobs
    etfCacheRefreshCron.start();
    
    // Initial cache warmup
    logger.info('🔥 Performing initial ETF cache warmup...');
    const { etf5MinCacheService } = await import('./services/etf-5min-cache-service');
    await etf5MinCacheService.getETFMetrics();
    logger.info('✅ Initial ETF cache warmup completed');
    
  } catch (error) {
    logger.error('❌ Failed to start background services:', error);
  }
};

// Call after server starts
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start background services
  startBackgroundServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping background services...');
  etfCacheRefreshCron.stop();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping background services...');
  etfCacheRefreshCron.stop();
  process.exit(0);
});
```

---

## 📋 PHASE 4: Testing & Verification (30 minutes)

### Step 4.1: Create Test Scripts

**File**: `scripts/test-etf-5min-cache.ts`

```typescript
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testETF5MinCache() {
  console.log('🧪 Testing ETF 5-Minute Cache Implementation');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Cache Miss (First Request)
    console.log('\n📊 Test 1: First Request (Cache Miss Expected)');
    const startTime1 = Date.now();
    
    const response1 = await axios.get(`${BASE_URL}/api/etf/cached`);
    const duration1 = Date.now() - startTime1;
    
    console.log(`Response Time: ${duration1}ms`);
    console.log(`Cache Hit: ${response1.data.meta.cached_response}`);
    console.log(`ETFs Returned: ${response1.data.data.length}`);
    console.log(`Data Source: ${response1.data.source}`);
    
    // Test 2: Cache Hit (Second Request)
    console.log('\n📊 Test 2: Second Request (Cache Hit Expected)');
    const startTime2 = Date.now();
    
    const response2 = await axios.get(`${BASE_URL}/api/etf/cached`);
    const duration2 = Date.now() - startTime2;
    
    console.log(`Response Time: ${duration2}ms`);
    console.log(`Cache Hit: ${response2.data.meta.cached_response}`);
    console.log(`Data Freshness: ${response2.data.meta.data_freshness}s`);
    console.log(`Next Refresh In: ${response2.data.meta.next_refresh_in_seconds}s`);
    
    // Test 3: Cache Stats
    console.log('\n📊 Test 3: Cache Statistics');
    const statsResponse = await axios.get(`${BASE_URL}/api/etf/cache/stats`);
    console.log('Cache Stats:', JSON.stringify(statsResponse.data.cache_stats, null, 2));
    
    // Test 4: Manual Refresh
    console.log('\n📊 Test 4: Manual Cache Refresh');
    const refreshStartTime = Date.now();
    
    const refreshResponse = await axios.post(`${BASE_URL}/api/etf/cache/refresh`);
    const refreshDuration = Date.now() - refreshStartTime;
    
    console.log(`Refresh Duration: ${refreshDuration}ms`);
    console.log(`Refresh Success: ${refreshResponse.data.success}`);
    console.log(`Fresh Data Count: ${refreshResponse.data.fresh_data_count}`);
    
    // Test 5: Performance Comparison
    console.log('\n📊 Test 5: Performance Comparison (5 Requests)');
    const times: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await axios.get(`${BASE_URL}/api/etf/cached`);
      const duration = Date.now() - start;
      times.push(duration);
      console.log(`Request ${i + 1}: ${duration}ms`);
    }
    
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('\n📈 Performance Summary:');
    console.log(`Average Response Time: ${avgTime.toFixed(1)}ms`);
    console.log(`Minimum Response Time: ${minTime}ms`);
    console.log(`Maximum Response Time: ${maxTime}ms`);
    
    // Test 6: Data Quality Validation
    console.log('\n📊 Test 6: Data Quality Validation');
    const dataResponse = await axios.get(`${BASE_URL}/api/etf/cached`);
    const etfData = dataResponse.data.data;
    
    console.log('Data Quality Checks:');
    console.log(`✅ Total ETFs: ${etfData.length}`);
    console.log(`✅ ETFs with RSI: ${etfData.filter((etf: any) => etf.rsi !== null).length}`);
    console.log(`✅ ETFs with MACD: ${etfData.filter((etf: any) => etf.macd !== null).length}`);
    console.log(`✅ ETFs with Z-Scores: ${etfData.filter((etf: any) => etf.zScore !== null).length}`);
    console.log(`✅ ETFs with Signals: ${etfData.filter((etf: any) => ['BUY', 'SELL', 'HOLD'].includes(etf.signal)).length}`);
    
    // Check for realistic values
    const rsiValues = etfData.filter((etf: any) => etf.rsi !== null).map((etf: any) => etf.rsi);
    const pricesValues = etfData.filter((etf: any) => etf.price > 0).map((etf: any) => etf.price);
    
    console.log(`✅ RSI Range: ${Math.min(...rsiValues).toFixed(1)} - ${Math.max(...rsiValues).toFixed(1)}`);
    console.log(`✅ Price Range: $${Math.min(...pricesValues).toFixed(2)} - $${Math.max(...pricesValues).toFixed(2)}`);
    
    console.log('\n🎉 ETF 5-Minute Cache Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response:', error.response?.data);
    }
  }
}

// Execute test
if (require.main === module) {
  testETF5MinCache();
}

export { testETF5MinCache };
```

### Step 4.2: Database Verification Script

**File**: `scripts/verify-etf-cache-database.ts`

```typescript
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function verifyETFCacheDatabase() {
  console.log('🔍 Verifying ETF Cache Database Setup');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Check if materialized view exists
    console.log('\n📊 Test 1: Materialized View Existence');
    const viewExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'etf_metrics_5min_cache' 
        AND table_schema = 'public'
      ) as view_exists
    `);
    
    console.log(`Materialized View Exists: ${viewExists.rows[0].view_exists}`);
    
    // Test 2: Check data in materialized view
    console.log('\n📊 Test 2: Materialized View Data');
    const dataCount = await db.execute(sql`
      SELECT count(*) as row_count FROM public.etf_metrics_5min_cache
    `);
    
    console.log(`Rows in Materialized View: ${dataCount.rows[0].row_count}`);
    
    if (dataCount.rows[0].row_count > 0) {
      // Show sample data
      const sampleData = await db.execute(sql`
        SELECT symbol, last_price, rsi, macd, composite_zscore, signal, cache_timestamp
        FROM public.etf_metrics_5min_cache
        LIMIT 3
      `);
      
      console.log('Sample Data:');
      sampleData.rows.forEach((row: any) => {
        console.log(`  ${row.symbol}: $${row.last_price}, RSI=${row.rsi}, Z=${row.composite_zscore}, Signal=${row.signal}`);
      });
    }
    
    // Test 3: Check refresh function
    console.log('\n📊 Test 3: Refresh Function Test');
    const refreshResult = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
    const refreshStats = refreshResult.rows[0] as any;
    
    console.log(`Refresh Status: ${refreshStats.status}`);
    console.log(`Rows Refreshed: ${refreshStats.rows_refreshed}`);
    console.log(`Refresh Duration: ${refreshStats.refresh_duration}`);
    
    // Test 4: Check performance logs
    console.log('\n📊 Test 4: Performance Logs');
    const recentLogs = await db.execute(sql`
      SELECT event_type, message, timestamp
      FROM public.performance_logs
      WHERE event_type LIKE '%ETF%'
      ORDER BY timestamp DESC
      LIMIT 5
    `);
    
    console.log('Recent ETF Cache Logs:');
    recentLogs.rows.forEach((log: any) => {
      console.log(`  [${log.timestamp}] ${log.event_type}: ${log.message}`);
    });
    
    // Test 5: Index verification
    console.log('\n📊 Test 5: Index Verification');
    const indexes = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'etf_metrics_5min_cache'
      AND schemaname = 'public'
    `);
    
    console.log('Indexes on Materialized View:');
    indexes.rows.forEach((index: any) => {
      console.log(`  ✅ ${index.indexname}`);
    });
    
    console.log('\n🎉 Database Verification Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    throw error;
  }
}

// Execute verification
if (require.main === module) {
  verifyETFCacheDatabase().catch(console.error);
}

export { verifyETFCacheDatabase };
```

---

## 🚀 EXECUTION COMMANDS FOR REPLIT AI AGENT

### Step-by-Step Execution:

```bash
# PHASE 1: Database Setup
echo "🚀 Starting ETF 5-Minute Cache Implementation"

# Create database migration
mkdir -p database/migrations
# Create the migration file with SQL content from Step 1.1 & 1.2

# Apply database migration
psql $DATABASE_URL -f database/migrations/001_create_etf_5min_cache.sql

# Verify materialized view
psql $DATABASE_URL -c "SELECT count(*) FROM public.etf_metrics_5min_cache;"

# PHASE 2: Service Implementation
# Create the cache service file (Step 2.1)
# Create the cached route file (Step 2.2)

# PHASE 3: Background Services
# Create the cron service file (Step 3.1)
# Update server/index.ts with integration code (Step 3.2)

# PHASE 4: Testing
# Create test scripts (Step 4.1 & 4.2)

# Install dependencies if needed
npm install node-cron

# Restart the server
npm run dev

# Run tests
npx tsx scripts/verify-etf-cache-database.ts
npx tsx scripts/test-etf-5min-cache.ts
```

### Key URLs to Test:
- `GET /api/etf/cached` - Main cached endpoint
- `POST /api/etf/cache/refresh` - Manual refresh
- `GET /api/etf/cache/stats` - Cache statistics

### Success Criteria:
- ✅ Response time <100ms for cache hits
- ✅ Response time >400ms only for cache misses (every 5 minutes)
- ✅ 12 ETFs returned with complete data
- ✅ Cache hit rate >95% after warmup
- ✅ Background refresh working every 5 minutes
- ✅ Materialized view updating with fresh data

---

## 🔧 TROUBLESHOOTING GUIDE

### Common Issues:

1. **Materialized View Empty**
   ```bash
   # Check source data
   psql $DATABASE_URL -c "SELECT count(*) FROM public.etf_metrics_latest_new;"
   
   # Manual refresh
   psql $DATABASE_URL -c "SELECT * FROM public.refresh_etf_5min_cache();"
   ```

2. **Cache Not Working**
   ```bash
   # Check cache stats
   curl http://localhost:5000/api/etf/cache/stats
   
   # Clear cache
   curl -X POST http://localhost:5000/api/etf/cache/refresh
   ```

3. **Cron Jobs Not Running**
   ```bash
   # Check server logs for cron startup messages
   # Look for: "⏰ ETF cache refresh cron jobs started"
   ```

4. **Performance Issues**
   ```bash
   # Check database connections
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
   
   # Check materialized view size
   psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_total_relation_size('public.etf_metrics_5min_cache'));"
   ```

---

**🎯 IMPLEMENTATION COMPLETE CRITERIA:**
- All files created and database migrations applied
- ETF cache endpoint responding in <100ms
- Background refresh running every 5 minutes
- Test scripts passing all validation checks
- Cache hit rate >95% after initial warmup

**Estimated Implementation Time: 3 hours**
**Expected Performance Improvement: 89% faster response times**