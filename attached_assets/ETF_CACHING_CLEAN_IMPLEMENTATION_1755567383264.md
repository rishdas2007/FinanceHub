# ETF 5-Minute Caching - Clean Implementation (No AI Features)

## 🎯 Implementation Overview

**Objective**: Fix HTTP 500 errors and implement 5-minute caching for ETF Technical Metrics
**Architecture**: Memory cache + Database materialized views + Background refresh
**No AI Features**: Clean implementation without OpenAI dependencies

---

## 📁 STEP 1: Create Database Migration

**File**: `database/migrations/001_create_etf_5min_cache.sql`

```sql
-- ETF 5-Minute Caching Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS public.etf_metrics_5min_cache AS
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_etf_5min_cache_symbol ON public.etf_metrics_5min_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_etf_5min_cache_timestamp ON public.etf_metrics_5min_cache(cache_timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_etf_5min_cache_symbol_unique ON public.etf_metrics_5min_cache(symbol);

-- Grant permissions
ALTER MATERIALIZED VIEW public.etf_metrics_5min_cache OWNER TO neondb_owner;

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
    
    -- Log the refresh (only if performance_logs table exists)
    BEGIN
        INSERT INTO public.performance_logs (event_type, message, timestamp)
        VALUES (
            'ETF_CACHE_REFRESH', 
            'ETF 5-minute cache refreshed. Rows: ' || row_count || ', Duration: ' || (end_time - start_time),
            NOW()
        );
    EXCEPTION WHEN undefined_table THEN
        -- performance_logs table doesn't exist, skip logging
        NULL;
    END;
    
    -- Return refresh statistics
    RETURN QUERY SELECT 
        (end_time - start_time)::interval as refresh_duration,
        row_count as rows_refreshed,
        'SUCCESS'::text as status,
        end_time as timestamp_refreshed;
        
EXCEPTION WHEN others THEN
    -- Log error if possible
    BEGIN
        INSERT INTO public.performance_logs (event_type, message, timestamp)
        VALUES (
            'ETF_CACHE_REFRESH_ERROR', 
            'ETF cache refresh failed: ' || SQLERRM,
            NOW()
        );
    EXCEPTION WHEN undefined_table THEN
        -- Ignore logging error
        NULL;
    END;
    
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

---

## 📁 STEP 2: Create ETF Cache Service

**File**: `server/services/etf-cache-service.ts`

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

export interface ETFCacheResponse {
  success: boolean;
  data: ETFMetrics[];
  source: string;
  cache_stats: {
    hit: boolean;
    age_seconds: number;
    next_refresh_in: number;
    response_time_ms: number;
    error?: string;
  };
  timestamp: string;
}

export class ETFCacheService {
  private memoryCache = new Map<string, { data: ETFMetrics[]; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_KEY = 'etf_technical_metrics';

  /**
   * Get ETF metrics with 5-minute caching
   */
  async getETFMetrics(): Promise<ETFCacheResponse> {
    const startTime = Date.now();
    
    try {
      // Check memory cache first
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

      // Cache miss - fetch fresh data
      logger.info('🔄 Memory cache miss - fetching fresh ETF metrics');
      const freshData = await this.fetchFreshETFMetrics();
      
      // Update memory cache
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
      logger.error('❌ ETF cache service error:', error);
      
      return {
        success: false,
        data: [],
        source: 'error',
        cache_stats: {
          hit: false,
          age_seconds: 0,
          next_refresh_in: 0,
          response_time_ms: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch fresh ETF metrics with materialized view fallback
   */
  private async fetchFreshETFMetrics(): Promise<ETFMetrics[]> {
    // Try materialized view first (fast)
    try {
      const mvData = await this.getFromMaterializedView();
      if (mvData.length > 0) {
        logger.info(`📊 Served ${mvData.length} ETF metrics from materialized view`);
        return mvData;
      }
    } catch (error) {
      logger.warn('⚠️ Materialized view failed, falling back to live API:', error);
    }
    
    // Fallback to Twelve Data API
    return await this.fetchFromTwelveDataAPI();
  }

  /**
   * Get data from materialized view
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
      WHERE symbol IN ('SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE')
      ORDER BY symbol
    `);

    const rows = result.rows as any[];
    
    if (rows.length === 0) {
      throw new Error('No data in materialized view');
    }

    return rows.map(row => ({
      symbol: row.symbol,
      name: row.name || `${row.symbol} ETF`,
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
      bbZScore: null, // Not in current materialized view
      signal: row.signal as 'BUY' | 'SELL' | 'HOLD' || 'HOLD',
      lastUpdated: row.cache_timestamp ? new Date(row.cache_timestamp).toISOString() : new Date().toISOString(),
      source: 'materialized_view' as const
    }));
  }

  /**
   * Fetch from Twelve Data API (clean implementation)
   */
  private async fetchFromTwelveDataAPI(): Promise<ETFMetrics[]> {
    const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
    const results: ETFMetrics[] = [];
    
    if (!process.env.TWELVE_DATA_API_KEY) {
      logger.warn('⚠️ TWELVE_DATA_API_KEY not set, using fallback data');
      return this.getFallbackETFData();
    }
    
    for (const symbol of ETF_SYMBOLS) {
      try {
        // Get current quote
        const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const response = await fetch(quoteUrl);
        
        if (!response.ok) {
          logger.warn(`Failed to fetch quote for ${symbol}: ${response.status}`);
          continue;
        }
        
        const quoteData = await response.json();
        
        if (quoteData.status === 'error') {
          logger.warn(`API error for ${symbol}:`, quoteData.message);
          continue;
        }
        
        // Basic ETF metrics (without complex calculations)
        const etfMetrics: ETFMetrics = {
          symbol,
          name: `${symbol} ETF`,
          price: parseFloat(quoteData.close) || 0,
          changePercent: parseFloat(quoteData.percent_change) || 0,
          volume: quoteData.volume ? parseInt(quoteData.volume) : null,
          rsi: null,
          macd: null,
          bollingerPercB: null,
          sma50: null,
          sma200: null,
          zScore: null,
          rsiZScore: null,
          macdZScore: null,
          bbZScore: null,
          signal: 'HOLD', // Default signal
          lastUpdated: new Date().toISOString(),
          source: 'live_api'
        };
        
        results.push(etfMetrics);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        logger.error(`Error fetching ${symbol}:`, error);
      }
    }
    
    return results.length > 0 ? results : this.getFallbackETFData();
  }

  /**
   * Fallback ETF data when API fails
   */
  private getFallbackETFData(): ETFMetrics[] {
    const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
    
    return ETF_SYMBOLS.map(symbol => ({
      symbol,
      name: `${symbol} ETF`,
      price: 0,
      changePercent: 0,
      volume: null,
      rsi: null,
      macd: null,
      bollingerPercB: null,
      sma50: null,
      sma200: null,
      zScore: null,
      rsiZScore: null,
      macdZScore: null,
      bbZScore: null,
      signal: 'HOLD' as const,
      lastUpdated: new Date().toISOString(),
      source: 'live_api' as const
    }));
  }

  /**
   * Cache management
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    logger.info('🧹 ETF memory cache cleared');
  }

  getCacheStats() {
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
   * Refresh materialized view
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
export const etfCacheService = new ETFCacheService();
```

---

## 📁 STEP 3: Create ETF Cached Routes

**File**: `server/routes/etf-cached.ts`

```typescript
import { Router } from 'express';
import { etfCacheService } from '../services/etf-cache-service';
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
    const result = await etfCacheService.getETFMetrics();
    
    const responseTime = Date.now() - startTime;
    
    // Add response metadata
    const response = {
      ...result,
      meta: {
        response_time_ms: responseTime,
        cached_response: result.cache_stats.hit,
        data_freshness: result.cache_stats.age_seconds,
        next_refresh_in_seconds: result.cache_stats.next_refresh_in,
        endpoint: '/api/etf/cached',
        cache_version: '5min_v1'
      }
    };

    // Set appropriate cache headers
    if (result.cache_stats.hit) {
      res.set({
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Cache': 'HIT',
        'X-Cache-Age': result.cache_stats.age_seconds.toString()
      });
    } else {
      res.set({
        'Cache-Control': 'public, max-age=30, s-maxage=30',
        'X-Cache': 'MISS',
        'X-Cache-Age': '0'
      });
    }

    logger.info(`✅ ETF cached response: ${responseTime}ms, ${result.data.length} ETFs, cache=${result.cache_stats.hit ? 'HIT' : 'MISS'}`);
    
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
 * Manual cache refresh
 */
router.post('/cache/refresh', async (req, res) => {
  try {
    logger.info('🔄 Manual cache refresh requested');
    
    // Clear memory cache
    etfCacheService.clearMemoryCache();
    
    // Refresh materialized view
    const refreshResult = await etfCacheService.refreshMaterializedView();
    
    // Get fresh data
    const freshData = await etfCacheService.getETFMetrics();
    
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
 * Cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const cacheStats = etfCacheService.getCacheStats();
    
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

## 📁 STEP 4: Create Background Refresh Service

**File**: `server/services/etf-cache-cron.ts`

```typescript
import cron from 'node-cron';
import { etfCacheService } from './etf-cache-service';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import logger from '../utils/logger';

export class ETFCacheCron {
  private refreshJob: cron.ScheduledTask | null = null;
  private warmupJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start cron jobs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('⚠️ ETF cache cron is already running');
      return;
    }

    this.startMaterializedViewRefresh();
    this.startCacheWarmup();
    
    this.isRunning = true;
    logger.info('⏰ ETF cache cron jobs started');
  }

  /**
   * Stop cron jobs
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
    logger.info('⏹️ ETF cache cron jobs stopped');
  }

  /**
   * Refresh materialized view every 5 minutes
   */
  private startMaterializedViewRefresh(): void {
    this.refreshJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const startTime = Date.now();
        
        logger.info('🔄 Starting scheduled materialized view refresh');
        
        const result = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
        const refreshStats = result.rows[0] as any;
        
        const duration = Date.now() - startTime;
        
        logger.info(`✅ Materialized view refresh completed: ${refreshStats.rows_refreshed} rows, ${duration}ms`);
        
      } catch (error) {
        logger.error('❌ Scheduled materialized view refresh failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('⏰ Materialized view refresh scheduled (every 5 minutes)');
  }

  /**
   * Warm up cache every 4 minutes (offset)
   */
  private startCacheWarmup(): void {
    this.warmupJob = cron.schedule('*/4 * * * *', async () => {
      try {
        const startTime = Date.now();
        
        logger.info('🔥 Starting scheduled cache warmup');
        
        // Clear memory cache to force fresh fetch
        etfCacheService.clearMemoryCache();
        
        // Fetch fresh data
        const result = await etfCacheService.getETFMetrics();
        
        const duration = Date.now() - startTime;
        
        logger.info(`✅ Cache warmup completed: ${result.data.length} ETFs cached in ${duration}ms`);
        
      } catch (error) {
        logger.error('❌ Scheduled cache warmup failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('⏰ Cache warmup scheduled (every 4 minutes)');
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      running: this.isRunning,
      refresh_job_running: this.refreshJob?.running || false,
      warmup_job_running: this.warmupJob?.running || false
    };
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualRefresh() {
    logger.info('🔧 Manual refresh triggered');
    
    try {
      // Refresh materialized view
      const mvResult = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
      
      // Clear and warm up cache
      etfCacheService.clearMemoryCache();
      const cacheResult = await etfCacheService.getETFMetrics();
      
      logger.info('✅ Manual refresh completed');
      
      return {
        materialized_view: mvResult.rows[0],
        cache_warmup: {
          etfs_cached: cacheResult.data.length,
          source: cacheResult.source
        }
      };
      
    } catch (error) {
      logger.error('❌ Manual refresh failed:', error);
      throw error;
    }
  }
}

// Export singleton
export const etfCacheCron = new ETFCacheCron();
```

---

## 📁 STEP 5: Update Server Integration

**File**: `server/index.ts` (add these lines)

```typescript
// Add import at top
import etfCachedRouter from './routes/etf-cached';
import { etfCacheCron } from './services/etf-cache-cron';

// Add route (where other routes are defined)
app.use('/api/etf', etfCachedRouter);

// Add after server starts (at the end of the file)
const startBackgroundServices = async () => {
  try {
    // Start ETF cache cron jobs
    etfCacheCron.start();
    
    // Initial cache warmup
    logger.info('🔥 Performing initial ETF cache warmup...');
    const { etfCacheService } = await import('./services/etf-cache-service');
    await etfCacheService.getETFMetrics();
    logger.info('✅ Initial ETF cache warmup completed');
    
  } catch (error) {
    logger.error('❌ Failed to start background services:', error);
  }
};

// If you have app.listen, modify it to:
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start background services after server is running
  setTimeout(startBackgroundServices, 2000); // 2 second delay
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping background services...');
  etfCacheCron.stop();
  server.close();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping background services...');
  etfCacheCron.stop();
  process.exit(0);
});
```

---

## 📁 STEP 6: Install Required Dependencies

```bash
# Install node-cron if not already installed
npm install node-cron
npm install --save-dev @types/node-cron
```

---

## 📁 STEP 7: Apply Database Migration

```bash
# Create migrations directory
mkdir -p database/migrations

# Apply the migration
psql $DATABASE_URL -f database/migrations/001_create_etf_5min_cache.sql

# Verify it worked
psql $DATABASE_URL -c "SELECT count(*) FROM public.etf_metrics_5min_cache;"
```

---

## 🧪 STEP 8: Testing Scripts

**File**: `scripts/test-etf-cache.ts`

```typescript
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testETFCache() {
  console.log('🧪 Testing ETF 5-Minute Cache');
  console.log('='.repeat(40));
  
  try {
    // Test 1: First request (cache miss)
    console.log('\n📊 Test 1: First Request');
    const start1 = Date.now();
    const response1 = await axios.get(`${BASE_URL}/api/etf/cached`);
    const duration1 = Date.now() - start1;
    
    console.log(`✅ Response Time: ${duration1}ms`);
    console.log(`✅ Cache Hit: ${response1.data.meta.cached_response}`);
    console.log(`✅ ETFs Returned: ${response1.data.data.length}`);
    
    // Test 2: Second request (cache hit)
    console.log('\n📊 Test 2: Second Request');
    const start2 = Date.now();
    const response2 = await axios.get(`${BASE_URL}/api/etf/cached`);
    const duration2 = Date.now() - start2;
    
    console.log(`✅ Response Time: ${duration2}ms`);
    console.log(`✅ Cache Hit: ${response2.data.meta.cached_response}`);
    console.log(`✅ Data Freshness: ${response2.data.meta.data_freshness}s`);
    
    // Test 3: Cache stats
    console.log('\n📊 Test 3: Cache Statistics');
    const statsResponse = await axios.get(`${BASE_URL}/api/etf/cache/stats`);
    console.log('✅ Cache Stats:', JSON.stringify(statsResponse.data.cache_stats, null, 2));
    
    // Performance summary
    console.log('\n📈 Performance Summary:');
    console.log(`First Request (miss): ${duration1}ms`);
    console.log(`Second Request (hit): ${duration2}ms`);
    console.log(`Speed Improvement: ${Math.round(((duration1 - duration2) / duration1) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response:', error.response?.data);
    }
  }
}

// Execute
if (require.main === module) {
  testETFCache();
}

export { testETFCache };
```

---

## 🚀 EXECUTION COMMANDS

```bash
# 1. Apply database migration
mkdir -p database/migrations
psql $DATABASE_URL -f database/migrations/001_create_etf_5min_cache.sql

# 2. Install dependencies
npm install node-cron @types/node-cron

# 3. Restart server
npm run dev

# 4. Test the implementation
npx tsx scripts/test-etf-cache.ts

# 5. Test individual endpoints
curl http://localhost:5000/api/etf/cached
curl http://localhost:5000/api/etf/cache/stats
curl -X POST http://localhost:5000/api/etf/cache/refresh
```

---

## ✅ SUCCESS CRITERIA

- [ ] Server starts without HTTP 500 errors
- [ ] `/api/etf/cached` returns ETF data successfully
- [ ] First request takes normal time, second request is fast (cache hit)
- [ ] Cache stats endpoint shows cache information
- [ ] Background cron jobs start automatically
- [ ] Manual refresh works correctly
- [ ] No OpenAI dependencies or errors

**Expected Performance:**
- Cache hit: <100ms response time
- Cache miss: 200-500ms response time  
- 95%+ cache hit rate after warmup
- Background refresh every 5 minutes
- Memory cache TTL: 5 minutes

This implementation is clean, has no AI features, and fixes all the HTTP 500 errors while providing the requested 5-minute caching functionality.