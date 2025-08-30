/**
 * Economic Calendar Caching Strategy
 * Multi-layer intelligent caching system for sub-100ms query performance
 */

import { logger } from '../../shared/utils/logger';

export class EconomicCalendarCacheStrategy {
  
  // Cache TTL configurations (in minutes)
  static readonly CACHE_TTL = {
    CRITICAL_INDICATORS: 5,     // Ultra-fast updates for most important data
    LATEST_MODE: 15,           // Recent data updates frequently
    CATEGORY_DATA: 20,         // Category-specific data
    TIMELINE_MODE: 30,         // Aggregated timeline data (changes less frequently)
    RECENT_RELEASES: 10,       // Recent releases (30-day window)
    INVESTMENT_SIGNALS: 15,    // Investment signal analysis
    ALL_MODE: 45,              // Complete dataset queries
    PERFORMANCE_STATS: 60      // Performance monitoring data
  };

  // Cache key patterns
  static readonly CACHE_KEYS = {
    CRITICAL_INDICATORS: 'critical_indicators',
    LATEST_MODE: (params: any) => `ec_latest_${JSON.stringify(params)}`,
    CATEGORY: (category: string) => `category_${category}`,
    TIMELINE: (params: any) => `ec_timeline_${JSON.stringify(params)}`,
    RECENT_RELEASES: 'recent_releases',
    INVESTMENT_SIGNALS: (params: any) => `investment_signals_${JSON.stringify(params)}`,
    PERFORMANCE_STATS: (hours: number) => `performance_stats_${hours}h`
  };

  /**
   * INTELLIGENT CACHE WARMING STRATEGY
   * Pre-populate cache with frequently accessed data patterns
   */
  static async warmCache() {
    const startTime = Date.now();
    logger.info('🔥 [CACHE WARMING] Starting intelligent cache warming...');

    try {
      // Import here to avoid circular dependency
      const { optimizedEconomicQueries } = await import('./optimized-economic-queries');
      
      const warmingTasks = [
        // 1. Critical indicators (highest priority)
        {
          name: 'Critical Indicators',
          task: () => optimizedEconomicQueries.getCachedQuery(
            this.CACHE_KEYS.CRITICAL_INDICATORS,
            () => optimizedEconomicQueries.getCriticalIndicators(),
            this.CACHE_TTL.CRITICAL_INDICATORS
          )
        },

        // 2. Recent releases (high traffic)
        {
          name: 'Recent Releases',
          task: () => optimizedEconomicQueries.getCachedQuery(
            this.CACHE_KEYS.RECENT_RELEASES,
            () => optimizedEconomicQueries.getLatestEconomicData({
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              limit: 50
            }),
            this.CACHE_TTL.RECENT_RELEASES
          )
        },

        // 3. Major categories (frequent access patterns)
        ...['Labor', 'Inflation', 'Growth', 'Finance'].map(category => ({
          name: `Category: ${category}`,
          task: () => optimizedEconomicQueries.getCachedQuery(
            this.CACHE_KEYS.CATEGORY(category),
            () => optimizedEconomicQueries.getCategoryEconomicData(category, {
              limit: 100,
              includeSignals: true
            }),
            this.CACHE_TTL.CATEGORY_DATA
          )
        })),

        // 4. Latest mode with common filters
        {
          name: 'Latest Mode - Default',
          task: () => optimizedEconomicQueries.getCachedQuery(
            this.CACHE_KEYS.LATEST_MODE({ limit: 50, offset: 0 }),
            () => optimizedEconomicQueries.getLatestEconomicData({ limit: 50, offset: 0 }),
            this.CACHE_TTL.LATEST_MODE
          )
        },

        // 5. Investment signals (BULLISH/BEARISH)
        ...['BULLISH', 'BEARISH'].map(signalType => ({
          name: `Investment Signals: ${signalType}`,
          task: () => optimizedEconomicQueries.getCachedQuery(
            this.CACHE_KEYS.INVESTMENT_SIGNALS({ signalType, minStrength: 0.5 }),
            () => optimizedEconomicQueries.getInvestmentSignals({
              signalType: signalType as any,
              minStrength: 0.5,
              limit: 50
            }),
            this.CACHE_TTL.INVESTMENT_SIGNALS
          )
        }))
      ];

      // Execute warming tasks in parallel (with concurrency limit)
      const results = await this.executeTasksBatched(warmingTasks, 3);
      const successCount = results.filter(r => r.success).length;
      const totalTime = Date.now() - startTime;

      logger.info(`🔥 [CACHE WARMING] Completed: ${successCount}/${warmingTasks.length} successful in ${totalTime}ms`);

      return {
        success: true,
        warmed: successCount,
        total: warmingTasks.length,
        executionTime: totalTime,
        details: results
      };

    } catch (error) {
      logger.error('❌ [CACHE WARMING] Failed:', error);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * SMART CACHE INVALIDATION
   * Intelligent cache invalidation based on data dependencies
   */
  static async invalidateRelatedCache(seriesIds: string[], categories?: string[]) {
    logger.info('🧹 [CACHE INVALIDATION] Starting smart invalidation...', { seriesIds, categories });

    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      // Build invalidation patterns
      const invalidationPatterns = [
        // Always invalidate critical indicators if any series updated
        this.CACHE_KEYS.CRITICAL_INDICATORS,
        
        // Invalidate recent releases
        this.CACHE_KEYS.RECENT_RELEASES,

        // If categories provided, invalidate category caches
        ...(categories || []).map(cat => this.CACHE_KEYS.CATEGORY(cat))
      ];

      // Check if critical series were updated
      const criticalSeries = ['GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'UNRATE', 'PAYEMS', 'FEDFUNDS'];
      const hasCriticalUpdates = seriesIds.some(id => criticalSeries.includes(id));
      
      if (hasCriticalUpdates) {
        // Invalidate more aggressively for critical series
        invalidationPatterns.push(
          'ec_latest_%', // All latest mode queries
          'investment_signals_%' // All investment signal queries
        );
      }

      // Execute cache deletion
      const deletePromises = invalidationPatterns.map(async pattern => {
        if (pattern.includes('%')) {
          // Pattern-based deletion
          return db.execute(sql`
            DELETE FROM economic_calendar_cache 
            WHERE cache_key LIKE ${pattern}
          `);
        } else {
          // Exact key deletion
          return db.execute(sql`
            DELETE FROM economic_calendar_cache 
            WHERE cache_key = ${pattern}
          `);
        }
      });

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      logger.info(`🧹 [CACHE INVALIDATION] Completed: ${successCount}/${invalidationPatterns.length} patterns invalidated`);

      return {
        success: true,
        invalidated: successCount,
        patterns: invalidationPatterns.length
      };

    } catch (error) {
      logger.error('❌ [CACHE INVALIDATION] Failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * CACHE HEALTH MONITORING
   * Monitor cache performance and hit rates
   */
  static async getCacheHealthMetrics() {
    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      // Cache utilization metrics
      const cacheStatsQuery = sql`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
          AVG(hit_count) as avg_hit_count,
          SUM(hit_count) as total_hits,
          MAX(hit_count) as max_hit_count,
          
          -- Cache efficiency by key pattern
          COUNT(*) FILTER (WHERE cache_key LIKE 'critical_%') as critical_cache_entries,
          AVG(hit_count) FILTER (WHERE cache_key LIKE 'critical_%') as critical_avg_hits,
          
          COUNT(*) FILTER (WHERE cache_key LIKE 'ec_latest_%') as latest_cache_entries,
          AVG(hit_count) FILTER (WHERE cache_key LIKE 'ec_latest_%') as latest_avg_hits,
          
          COUNT(*) FILTER (WHERE cache_key LIKE 'category_%') as category_cache_entries,
          AVG(hit_count) FILTER (WHERE cache_key LIKE 'category_%') as category_avg_hits,
          
          COUNT(*) FILTER (WHERE cache_key LIKE 'investment_%') as signal_cache_entries,
          AVG(hit_count) FILTER (WHERE cache_key LIKE 'investment_%') as signal_avg_hits
        FROM economic_calendar_cache
      `;

      const cacheStats = await db.execute(cacheStatsQuery);

      // Top performing cache keys
      const topKeysQuery = sql`
        SELECT 
          cache_key,
          hit_count,
          created_at,
          expires_at,
          EXTRACT(EPOCH FROM (expires_at - created_at)) / 60 as ttl_minutes
        FROM economic_calendar_cache
        WHERE expires_at > NOW()
        ORDER BY hit_count DESC
        LIMIT 10
      `;

      const topKeys = await db.execute(topKeysQuery);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        overall: cacheStats.rows[0],
        topPerformingKeys: topKeys.rows,
        recommendations: this.generateCacheRecommendations(cacheStats.rows[0])
      };

    } catch (error) {
      logger.error('❌ [CACHE HEALTH] Failed to get metrics:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * CACHE OPTIMIZATION RECOMMENDATIONS
   */
  private static generateCacheRecommendations(stats: any) {
    const recommendations = [];

    if (stats.expired_entries > stats.active_entries * 0.5) {
      recommendations.push({
        type: 'WARNING',
        message: 'High ratio of expired cache entries detected. Consider running cache cleanup more frequently.',
        priority: 'HIGH'
      });
    }

    if (stats.critical_avg_hits < 5) {
      recommendations.push({
        type: 'OPTIMIZATION',
        message: 'Critical indicators cache has low hit rate. Consider extending TTL or warming more frequently.',
        priority: 'MEDIUM'
      });
    }

    if (stats.total_entries > 1000) {
      recommendations.push({
        type: 'MAINTENANCE',
        message: 'Cache size is growing large. Schedule regular cleanup to maintain performance.',
        priority: 'LOW'
      });
    }

    if (stats.latest_avg_hits > 20) {
      recommendations.push({
        type: 'SUCCESS',
        message: 'Latest mode queries showing excellent cache performance.',
        priority: 'INFO'
      });
    }

    return recommendations;
  }

  /**
   * Execute tasks in batches to prevent overwhelming the system
   */
  private static async executeTasksBatched(tasks: any[], batchSize: number = 3) {
    const results = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchPromises = batch.map(async task => {
        try {
          const startTime = Date.now();
          await task.task();
          return {
            name: task.name,
            success: true,
            executionTime: Date.now() - startTime
          };
        } catch (error) {
          return {
            name: task.name,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => 
        r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }
      ));

      // Small delay between batches
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * AUTOMATIC CACHE REFRESH SCHEDULER
   * Background task to keep hot data fresh
   */
  static async scheduleAutomaticRefresh() {
    logger.info('⏰ [CACHE SCHEDULER] Setting up automatic refresh intervals...');

    // Critical indicators refresh every 5 minutes
    setInterval(async () => {
      try {
        const { optimizedEconomicQueries } = await import('./optimized-economic-queries');
        await optimizedEconomicQueries.getCachedQuery(
          this.CACHE_KEYS.CRITICAL_INDICATORS,
          () => optimizedEconomicQueries.getCriticalIndicators(),
          this.CACHE_TTL.CRITICAL_INDICATORS
        );
        logger.debug('🔄 [CACHE SCHEDULER] Critical indicators refreshed');
      } catch (error) {
        logger.warn('⚠️ [CACHE SCHEDULER] Failed to refresh critical indicators:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Recent releases refresh every 10 minutes
    setInterval(async () => {
      try {
        const { optimizedEconomicQueries } = await import('./optimized-economic-queries');
        await optimizedEconomicQueries.getCachedQuery(
          this.CACHE_KEYS.RECENT_RELEASES,
          () => optimizedEconomicQueries.getLatestEconomicData({
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            limit: 50
          }),
          this.CACHE_TTL.RECENT_RELEASES
        );
        logger.debug('🔄 [CACHE SCHEDULER] Recent releases refreshed');
      } catch (error) {
        logger.warn('⚠️ [CACHE SCHEDULER] Failed to refresh recent releases:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Cache cleanup every hour
    setInterval(async () => {
      try {
        const { optimizedEconomicQueries } = await import('./optimized-economic-queries');
        const cleaned = await optimizedEconomicQueries.cleanCache();
        if (cleaned > 0) {
          logger.info(`🧹 [CACHE SCHEDULER] Cleaned ${cleaned} expired cache entries`);
        }
      } catch (error) {
        logger.warn('⚠️ [CACHE SCHEDULER] Failed to clean cache:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    logger.info('✅ [CACHE SCHEDULER] Automatic refresh intervals configured');
  }
}

// Export for use in other modules
export const economicCalendarCacheStrategy = EconomicCalendarCacheStrategy;