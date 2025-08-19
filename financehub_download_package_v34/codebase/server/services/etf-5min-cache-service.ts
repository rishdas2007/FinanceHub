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
        0 as composite_zscore,
        0 as rsi_zscore,
        0 as macd_zscore,
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
   * Fetch from database API (fallback to existing implementation)
   */
  private async fetchFromTwelveDataAPI(): Promise<ETFMetrics[]> {
    try {
      // Use existing database table as fallback
      const result = await db.execute(sql`
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
          CASE 
            WHEN rsi < 30 THEN 'BUY'
            WHEN rsi > 70 THEN 'SELL' 
            ELSE 'HOLD'
          END as signal
        FROM public.etf_metrics_latest
        WHERE symbol IN ('SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE')
        ORDER BY symbol
      `);

      const rows = result.rows as any[];
      
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
        zScore: 0, // Calculated elsewhere
        rsiZScore: 0, // Calculated elsewhere
        macdZScore: 0, // Calculated elsewhere
        bbZScore: null,
        signal: row.signal as 'BUY' | 'SELL' | 'HOLD',
        lastUpdated: new Date().toISOString(),
        source: 'live_api' as const
      }));
    } catch (error) {
      logger.error('❌ Database fallback failed:', error);
      return [];
    }
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
export const etf5MinCache = new ETF5MinCacheService();