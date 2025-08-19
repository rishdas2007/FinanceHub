import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface CacheMonitoringMetrics {
  cache_hit_rate: number;
  average_response_time: number;
  materialized_view_freshness: number;
  memory_cache_size: number;
  refresh_success_rate: number;
  last_refresh_time: string;
  error_count: number;
  data_quality_score: number;
}

export class ETFCacheMonitoringService {
  private metrics: Map<string, any> = new Map();
  private startTime = Date.now();

  /**
   * Record cache hit
   */
  recordCacheHit(source: 'memory' | 'materialized_view' | 'fallback', responseTime: number): void {
    const now = Date.now();
    this.metrics.set('last_cache_hit', { source, responseTime, timestamp: now });
    
    // Update running averages
    const hits = this.metrics.get('total_hits') || 0;
    const totalResponseTime = this.metrics.get('total_response_time') || 0;
    
    this.metrics.set('total_hits', hits + 1);
    this.metrics.set('total_response_time', totalResponseTime + responseTime);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(reason: string, responseTime: number): void {
    const now = Date.now();
    this.metrics.set('last_cache_miss', { reason, responseTime, timestamp: now });
    
    const misses = this.metrics.get('total_misses') || 0;
    this.metrics.set('total_misses', misses + 1);
  }

  /**
   * Record refresh attempt
   */
  recordRefreshAttempt(success: boolean, duration: number, rowsRefreshed: number): void {
    const now = Date.now();
    this.metrics.set('last_refresh', { 
      success, 
      duration, 
      rowsRefreshed, 
      timestamp: now 
    });
    
    const refreshes = this.metrics.get('total_refreshes') || 0;
    const successfulRefreshes = this.metrics.get('successful_refreshes') || 0;
    
    this.metrics.set('total_refreshes', refreshes + 1);
    if (success) {
      this.metrics.set('successful_refreshes', successfulRefreshes + 1);
    }
  }

  /**
   * Record error
   */
  recordError(error: string, context: string): void {
    const now = Date.now();
    const errors = this.metrics.get('errors') || [];
    errors.push({ error, context, timestamp: now });
    
    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
    
    this.metrics.set('errors', errors);
  }

  /**
   * Get comprehensive monitoring metrics
   */
  async getMonitoringMetrics(): Promise<CacheMonitoringMetrics> {
    try {
      // Calculate cache hit rate
      const totalHits = this.metrics.get('total_hits') || 0;
      const totalMisses = this.metrics.get('total_misses') || 0;
      const totalRequests = totalHits + totalMisses;
      const cacheHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

      // Calculate average response time
      const totalResponseTime = this.metrics.get('total_response_time') || 0;
      const averageResponseTime = totalHits > 0 ? totalResponseTime / totalHits : 0;

      // Get materialized view freshness
      const freshness = await this.getMaterializedViewFreshness();

      // Calculate refresh success rate
      const totalRefreshes = this.metrics.get('total_refreshes') || 0;
      const successfulRefreshes = this.metrics.get('successful_refreshes') || 0;
      const refreshSuccessRate = totalRefreshes > 0 ? (successfulRefreshes / totalRefreshes) * 100 : 100;

      // Get error count
      const errors = this.metrics.get('errors') || [];
      const recentErrors = errors.filter((e: any) => (Date.now() - e.timestamp) < 3600000); // Last hour

      // Calculate data quality score
      const dataQualityScore = await this.calculateDataQualityScore();

      return {
        cache_hit_rate: Number(cacheHitRate.toFixed(2)),
        average_response_time: Number(averageResponseTime.toFixed(2)),
        materialized_view_freshness: freshness,
        memory_cache_size: this.getMemoryCacheSize(),
        refresh_success_rate: Number(refreshSuccessRate.toFixed(2)),
        last_refresh_time: this.getLastRefreshTime(),
        error_count: recentErrors.length,
        data_quality_score: dataQualityScore
      };

    } catch (error) {
      console.error('❌ Failed to get monitoring metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Get materialized view freshness (minutes since last refresh)
   */
  private async getMaterializedViewFreshness(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT 
          EXTRACT(EPOCH FROM (now() - MAX(cache_timestamp))) / 60 as minutes_since_refresh
        FROM public.etf_metrics_5min_cache
      `);

      const minutes = result.rows[0]?.minutes_since_refresh || 0;
      return Number(Number(minutes).toFixed(2));
    } catch (error) {
      console.warn('⚠️ Failed to get materialized view freshness:', error);
      return 999; // Indicate stale data
    }
  }

  /**
   * Calculate data quality score based on various factors
   */
  private async calculateDataQualityScore(): Promise<number> {
    try {
      // Check data completeness
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(CASE WHEN last_price > 0 THEN 1 END) as valid_prices,
          COUNT(CASE WHEN rsi IS NOT NULL AND rsi BETWEEN 0 AND 100 THEN 1 END) as valid_rsi,
          COUNT(CASE WHEN macd IS NOT NULL THEN 1 END) as valid_macd
        FROM public.etf_metrics_5min_cache
      `);

      const row = result.rows[0];
      const totalRows = Number(row?.total_rows || 0);
      
      if (totalRows === 0) {
        return 0; // No data available
      }

      const validPrices = Number(row?.valid_prices || 0);
      const validRsi = Number(row?.valid_rsi || 0);
      const validMacd = Number(row?.valid_macd || 0);

      // Calculate quality score (0-100)
      const priceQuality = (validPrices / totalRows) * 40; // 40% weight
      const rsiQuality = (validRsi / totalRows) * 30; // 30% weight
      const macdQuality = (validMacd / totalRows) * 30; // 30% weight

      return Number((priceQuality + rsiQuality + macdQuality).toFixed(2));

    } catch (error) {
      console.warn('⚠️ Failed to calculate data quality score:', error);
      return 50; // Default middle score
    }
  }

  /**
   * Get memory cache size (rough estimate)
   */
  private getMemoryCacheSize(): number {
    // Rough estimate based on metrics stored
    return this.metrics.size * 100; // bytes estimate
  }

  /**
   * Get last refresh time
   */
  private getLastRefreshTime(): string {
    const lastRefresh = this.metrics.get('last_refresh');
    if (lastRefresh?.timestamp) {
      return new Date(lastRefresh.timestamp).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * Get default metrics when calculation fails
   */
  private getDefaultMetrics(): CacheMonitoringMetrics {
    return {
      cache_hit_rate: 0,
      average_response_time: 0,
      materialized_view_freshness: 999,
      memory_cache_size: 0,
      refresh_success_rate: 0,
      last_refresh_time: new Date().toISOString(),
      error_count: 0,
      data_quality_score: 0
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.startTime = Date.now();
    console.log('📊 ETF cache monitoring metrics reset');
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport(): any {
    const now = Date.now();
    const uptimeHours = (now - this.startTime) / (1000 * 60 * 60);

    return {
      uptime_hours: Number(uptimeHours.toFixed(2)),
      total_requests: (this.metrics.get('total_hits') || 0) + (this.metrics.get('total_misses') || 0),
      total_hits: this.metrics.get('total_hits') || 0,
      total_misses: this.metrics.get('total_misses') || 0,
      total_refreshes: this.metrics.get('total_refreshes') || 0,
      successful_refreshes: this.metrics.get('successful_refreshes') || 0,
      recent_errors: (this.metrics.get('errors') || []).length,
      last_cache_hit: this.metrics.get('last_cache_hit'),
      last_cache_miss: this.metrics.get('last_cache_miss'),
      last_refresh: this.metrics.get('last_refresh')
    };
  }
}

// Export singleton instance
export const etfCacheMonitoring = new ETFCacheMonitoringService();