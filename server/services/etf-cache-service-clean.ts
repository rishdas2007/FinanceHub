import { db } from '../db';
import { sql } from 'drizzle-orm';

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
        
        console.log(`✅ Serving ETF metrics from memory cache (age: ${ageSeconds}s)`);
        
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
      console.log('🔄 Memory cache miss - fetching fresh ETF metrics');
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
      console.error('❌ ETF cache service error:', error);
      
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
        console.log(`📊 Served ${mvData.length} ETF metrics from materialized view`);
        return mvData;
      }
    } catch (error) {
      console.warn('⚠️ Materialized view failed, falling back to live API:', error);
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
      console.warn('⚠️ TWELVE_DATA_API_KEY not set, using fallback data');
      return this.getFallbackETFData();
    }
    
    for (const symbol of ETF_SYMBOLS) {
      try {
        // Get current quote
        const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const response = await fetch(quoteUrl);
        
        if (!response.ok) {
          console.warn(`Failed to fetch quote for ${symbol}: ${response.status}`);
          continue;
        }
        
        const quoteData = await response.json();
        
        if (quoteData.status === 'error') {
          console.warn(`API error for ${symbol}:`, quoteData.message);
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
        console.error(`Error fetching ${symbol}:`, error);
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
    console.log('🧹 ETF memory cache cleared');
  }

  getCacheStats() {
    const entries = Array.from(this.memoryCache.entries());
    return {
      total_entries: entries.length,
      cache_ttl_minutes: Math.floor(this.CACHE_TTL_MS / 60000),
      entries: entries.map(([key, value]) => ({
        key,
        age_seconds: Math.floor((Date.now() - value.timestamp) / 1000),
        data_count: value.data.length
      }))
    };
  }
}

export const etfCacheService = new ETFCacheService();