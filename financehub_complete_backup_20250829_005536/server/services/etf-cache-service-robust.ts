import { db } from '../db';
import { sql } from 'drizzle-orm';
import { etfCacheMonitoring } from './etf-cache-monitoring';

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
  source: 'cached_5min' | 'live_api' | 'materialized_view' | 'fallback';
}

export class ETFCacheServiceRobust {
  private memoryCache = new Map<string, { data: ETFMetrics[]; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_KEY = 'etf_technical_metrics';
  private isInitialized = false;

  /**
   * Initialize service safely
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing ETF Cache Service...');
      
      // Test database connection
      await this.testDatabaseConnection();
      
      // Test materialized view
      await this.testMaterializedView();
      
      this.isInitialized = true;
      console.log('✅ ETF Cache Service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ ETF Cache Service initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Test database connection
   */
  private async testDatabaseConnection(): Promise<void> {
    try {
      await db.execute(sql`SELECT 1 as test`);
      console.log('✅ Database connection test passed');
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * Test materialized view
   */
  private async testMaterializedView(): Promise<void> {
    try {
      const result = await db.execute(sql`
        SELECT count(*) as row_count 
        FROM public.etf_metrics_5min_cache
      `);
      
      const rowCount = result.rows[0]?.row_count || 0;
      console.log(`📊 Materialized view test: ${rowCount} rows available`);
      
      if (rowCount === 0) {
        console.warn('⚠️ Materialized view is empty, will use fallback data');
      }
      
    } catch (error) {
      console.warn('⚠️ Materialized view test failed, will use fallback:', error);
    }
  }

  /**
   * Get ETF metrics with robust error handling
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
      // Check if service is initialized
      if (!this.isInitialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          return this.getFallbackResponse(startTime);
        }
      }

      // Check memory cache first
      const cached = this.memoryCache.get(this.CACHE_KEY);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
        const ageSeconds = Math.floor((now - cached.timestamp) / 1000);
        const nextRefreshIn = Math.floor((this.CACHE_TTL_MS - (now - cached.timestamp)) / 1000);
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ Serving ETF metrics from memory cache (age: ${ageSeconds}s)`);
        
        // Record cache hit
        etfCacheMonitoring.recordCacheHit('memory', responseTime);
        
        return {
          success: true,
          data: cached.data,
          source: 'memory_cache',
          cache_stats: {
            hit: true,
            age_seconds: ageSeconds,
            next_refresh_in: nextRefreshIn,
            response_time_ms: responseTime
          },
          timestamp: new Date().toISOString()
        };
      }

      // Cache miss - fetch fresh data
      console.log('🔄 Memory cache miss - fetching fresh ETF metrics');
      etfCacheMonitoring.recordCacheMiss('expired_or_empty', 0);
      const freshData = await this.fetchFreshETFMetrics();
      
      // Update memory cache
      this.memoryCache.set(this.CACHE_KEY, {
        data: freshData,
        timestamp: now
      });
      
      console.log(`📊 Cached ${freshData.length} ETF metrics in memory`);
      
      return {
        success: true,
        data: freshData,
        source: 'fresh_data',
        cache_stats: {
          hit: false,
          refresh_reason: 'cache_miss',
          response_time_ms: Date.now() - startTime
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ ETF Cache Service error:', error);
      return this.getFallbackResponse(startTime, error);
    }
  }

  /**
   * Fetch fresh ETF metrics with multiple fallback strategies
   */
  private async fetchFreshETFMetrics(): Promise<ETFMetrics[]> {
    try {
      // Strategy 1: Try materialized view
      const mvData = await this.fetchFromMaterializedView();
      if (mvData.length > 0) {
        console.log(`📊 Fetched ${mvData.length} ETF metrics from materialized view`);
        return mvData;
      }

      // Strategy 2: Try base table
      const tableData = await this.fetchFromBaseTable();
      if (tableData.length > 0) {
        console.log(`📊 Fetched ${tableData.length} ETF metrics from base table`);
        return tableData;
      }

      // Strategy 3: Use hardcoded fallback
      console.warn('⚠️ Using hardcoded fallback ETF data');
      return this.getHardcodedFallbackData();
      
    } catch (error) {
      console.error('❌ All ETF data fetch strategies failed:', error);
      return this.getHardcodedFallbackData();
    }
  }

  /**
   * Fetch from materialized view
   */
  private async fetchFromMaterializedView(): Promise<ETFMetrics[]> {
    try {
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
          signal,
          cache_timestamp
        FROM public.etf_metrics_5min_cache
        ORDER BY symbol
      `);

      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        name: row.name || `${row.symbol} ETF`,
        price: Number(row.last_price) || 0,
        changePercent: Number(row.pct_change_1d) || 0,
        volume: row.volume ? Number(row.volume) : null,
        rsi: row.rsi ? Number(row.rsi) : null,
        macd: row.macd ? Number(row.macd) : null,
        bollingerPercB: row.bb_percent_b ? Number(row.bb_percent_b) : null,
        sma50: row.sma_50 ? Number(row.sma_50) : null,
        sma200: row.sma_200 ? Number(row.sma_200) : null,
        zScore: this.calculateZScore(row.rsi, row.macd, row.bb_percent_b),
        rsiZScore: this.calculateRSIZScore(row.rsi),
        macdZScore: this.calculateMACDZScore(row.macd),
        bbZScore: this.calculateBBZScore(row.bb_percent_b),
        signal: row.signal || 'HOLD',
        lastUpdated: row.cache_timestamp || new Date().toISOString(),
        source: 'materialized_view'
      }));
      
    } catch (error) {
      console.warn('⚠️ Materialized view fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch from base table
   */
  private async fetchFromBaseTable(): Promise<ETFMetrics[]> {
    try {
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
          updated_at
        FROM public.etf_metrics_latest
        WHERE symbol IN ('SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE')
        ORDER BY symbol
      `);

      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        name: row.name || `${row.symbol} ETF`,
        price: Number(row.last_price) || 0,
        changePercent: Number(row.pct_change_1d) || 0,
        volume: row.volume ? Number(row.volume) : null,
        rsi: row.rsi ? Number(row.rsi) : null,
        macd: row.macd ? Number(row.macd) : null,
        bollingerPercB: row.bb_percent_b ? Number(row.bb_percent_b) : null,
        sma50: row.sma_50 ? Number(row.sma_50) : null,
        sma200: row.sma_200 ? Number(row.sma_200) : null,
        zScore: this.calculateZScore(row.rsi, row.macd, row.bb_percent_b),
        rsiZScore: this.calculateRSIZScore(row.rsi),
        macdZScore: this.calculateMACDZScore(row.macd),
        bbZScore: this.calculateBBZScore(row.bb_percent_b),
        signal: this.calculateSignal(row.rsi),
        lastUpdated: row.updated_at || new Date().toISOString(),
        source: 'live_api'
      }));
      
    } catch (error) {
      console.warn('⚠️ Base table fetch failed:', error);
      return [];
    }
  }

  /**
   * Get hardcoded fallback data
   */
  private getHardcodedFallbackData(): ETFMetrics[] {
    const fallbackData = [
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', price: 450.00, change: 0.25, rsi: 55.5 },
      { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund', price: 180.00, change: 0.45, rsi: 62.3 },
      { symbol: 'XLV', name: 'Health Care Select Sector SPDR Fund', price: 130.00, change: -0.15, rsi: 48.2 },
      { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund', price: 38.00, change: 0.35, rsi: 58.7 },
      { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund', price: 170.00, change: 0.85, rsi: 67.1 },
      { symbol: 'XLI', name: 'Industrial Select Sector SPDR Fund', price: 110.00, change: 0.15, rsi: 52.3 },
      { symbol: 'XLC', name: 'Communication Services Select Sector SPDR Fund', price: 75.00, change: 0.65, rsi: 61.4 },
      { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR Fund', price: 80.00, change: -0.25, rsi: 45.8 },
      { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', price: 85.00, change: 1.25, rsi: 72.5 },
      { symbol: 'XLU', name: 'Utilities Select Sector SPDR Fund', price: 70.00, change: -0.35, rsi: 42.1 },
      { symbol: 'XLB', name: 'Materials Select Sector SPDR Fund', price: 95.00, change: 0.55, rsi: 59.6 },
      { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR Fund', price: 45.00, change: 0.75, rsi: 63.8 }
    ];

    return fallbackData.map(item => ({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      changePercent: item.change,
      volume: 10000000,
      rsi: item.rsi,
      macd: 0.1,
      bollingerPercB: 0.6,
      sma50: item.price * 0.98,
      sma200: item.price * 0.95,
      zScore: this.calculateZScore(item.rsi, 0.1, 0.6),
      rsiZScore: this.calculateRSIZScore(item.rsi),
      macdZScore: this.calculateMACDZScore(0.1),
      bbZScore: this.calculateBBZScore(0.6),
      signal: this.calculateSignal(item.rsi),
      lastUpdated: new Date().toISOString(),
      source: 'fallback' as const
    }));
  }

  /**
   * Calculate composite Z-score
   */
  private calculateZScore(rsi: number | null, macd: number | null, bb: number | null): number {
    const rsiZ = this.calculateRSIZScore(rsi);
    const macdZ = this.calculateMACDZScore(macd);
    const bbZ = this.calculateBBZScore(bb);
    
    return Number(((rsiZ + macdZ + bbZ) / 3).toFixed(4));
  }

  /**
   * Calculate RSI Z-score
   */
  private calculateRSIZScore(rsi: number | null): number {
    if (!rsi) return 0;
    return Number(((rsi - 50) / 15).toFixed(4));
  }

  /**
   * Calculate MACD Z-score
   */
  private calculateMACDZScore(macd: number | null): number {
    if (!macd) return 0;
    return Number((macd / 1.03).toFixed(4));
  }

  /**
   * Calculate Bollinger Band Z-score
   */
  private calculateBBZScore(bb: number | null): number {
    if (!bb) return 0;
    return Number(((bb - 0.5) / 0.25).toFixed(4));
  }

  /**
   * Calculate trading signal
   */
  private calculateSignal(rsi: number | null): 'BUY' | 'SELL' | 'HOLD' {
    if (!rsi) return 'HOLD';
    if (rsi < 30) return 'BUY';
    if (rsi > 70) return 'SELL';
    return 'HOLD';
  }

  /**
   * Get fallback response
   */
  private getFallbackResponse(startTime: number, error?: any): {
    success: boolean;
    data: ETFMetrics[];
    source: string;
    cache_stats: any;
    timestamp: string;
  } {
    return {
      success: true,
      data: this.getHardcodedFallbackData(),
      source: 'emergency_fallback',
      cache_stats: {
        hit: false,
        error: error?.message || 'Service unavailable',
        response_time_ms: Date.now() - startTime
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Refresh materialized view
   */
  async refreshMaterializedView(): Promise<boolean> {
    try {
      console.log('🔄 Refreshing ETF materialized view...');
      
      const result = await db.execute(sql`
        SELECT * FROM public.refresh_etf_5min_cache()
      `);
      
      console.log('✅ Materialized view refreshed:', result.rows[0]);
      
      // Clear memory cache to force fresh data
      this.memoryCache.delete(this.CACHE_KEY);
      
      return true;
      
    } catch (error) {
      console.error('❌ Materialized view refresh failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const etfCacheServiceRobust = new ETFCacheServiceRobust();