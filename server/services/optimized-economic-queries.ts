/**
 * Optimized Economic Calendar Queries
 * High-performance query implementations for sub-100ms response times
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../../shared/utils/logger';

export class OptimizedEconomicQueries {
  
  /**
   * OPTIMIZED LATEST MODE QUERY
   * Uses materialized view for maximum performance
   * Expected execution time: < 5ms
   */
  static async getLatestEconomicData(options: {
    startDate?: string;
    endDate?: string;
    category?: string;
    frequency?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { startDate, endDate, category, frequency, limit = 100, offset = 0 } = options;
    
    const startTime = Date.now();
    
    try {
      // Use materialized view for optimal performance
      let query = sql`
        SELECT 
          series_id as "seriesId",
          metric_name as "metricName",
          category,
          release_date as "releaseDate",
          period_date as "periodDate",
          actual_value as "actualValue",
          previous_value as "previousValue",
          variance,
          variance_percent as "variancePercent",
          unit,
          frequency,
          seasonal_adjustment as "seasonalAdjustment",
          
          -- Investment-focused derived metrics
          yoy_growth_rate as "yoyGrowthRate",
          qoq_annualized_rate as "qoqAnnualizedRate", 
          mom_annualized_rate as "momAnnualizedRate",
          volatility_12m as "volatility12m",
          trend_strength as "trendStrength",
          percentile_rank_1y as "percentileRank1y",
          percentile_rank_5y as "percentileRank5y",
          investment_signal as "investmentSignal",
          signal_strength as "signalStrength",
          cycle_position as "cyclePosition",
          regime_classification as "regimeClassification",
          
          -- Real value adjustments
          real_value as "realValue",
          real_yoy_growth as "realYoyGrowth",
          inflation_impact as "inflationImpact",
          
          -- Investment context
          sector_implication as "sectorImplication",
          asset_class_impact as "assetClassImpact",
          calculation_confidence as "calculationConfidence",
          
          priority_rank
        FROM mv_economic_calendar_latest
        WHERE 1=1
      `;

      // Add filters
      if (category) {
        query = sql`${query} AND category = ${category}`;
      }
      if (frequency) {
        query = sql`${query} AND frequency = ${frequency}`;
      }
      if (startDate) {
        query = sql`${query} AND release_date >= ${startDate}`;
      }
      if (endDate) {
        query = sql`${query} AND release_date <= ${endDate}`;
      }

      // Optimized sorting using pre-computed priority_rank
      query = sql`${query}
        ORDER BY priority_rank ASC, release_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await db.execute(query);
      const executionTime = Date.now() - startTime;

      // Track performance
      await this.trackQueryPerformance('latest_optimized', executionTime, result.rows.length);

      logger.info(`🚀 [OPTIMIZED QUERY] Latest mode: ${result.rows.length} records in ${executionTime}ms`);
      
      return {
        data: result.rows,
        executionTime,
        fromCache: false,
        optimization: 'materialized_view'
      };

    } catch (error) {
      logger.error('❌ [OPTIMIZED QUERY] Latest mode failed:', error);
      throw error;
    }
  }

  /**
   * OPTIMIZED TIMELINE MODE QUERY  
   * Uses optimized aggregation with proper indexing
   * Expected execution time: < 50ms
   */
  static async getTimelineEconomicData(options: {
    startDate?: string;
    endDate?: string;
    category?: string;
    frequency?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { startDate, endDate, category, frequency, limit = 100, offset = 0 } = options;
    
    const startTime = Date.now();
    
    try {
      // Use pre-computed view for timeline data
      let query = sql`
        SELECT 
          series_id as "seriesId",
          metric_name as "metricName",
          category,
          unit,
          frequency,
          release_count as "releaseCount",
          latest_release_date as "latestReleaseDate",
          timeline_data as "timeline"
        FROM v_economic_timeline
        WHERE 1=1
      `;

      // Add filters
      if (category) {
        query = sql`${query} AND category = ${category}`;
      }
      if (frequency) {
        query = sql`${query} AND frequency = ${frequency}`;
      }

      query = sql`${query}
        ORDER BY metric_name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await db.execute(query);
      const executionTime = Date.now() - startTime;

      // Track performance
      await this.trackQueryPerformance('timeline_optimized', executionTime, result.rows.length);

      logger.info(`📈 [OPTIMIZED QUERY] Timeline mode: ${result.rows.length} series in ${executionTime}ms`);
      
      return {
        data: result.rows,
        executionTime,
        fromCache: false,
        optimization: 'pre_computed_view'
      };

    } catch (error) {
      logger.error('❌ [OPTIMIZED QUERY] Timeline mode failed:', error);
      throw error;
    }
  }

  /**
   * OPTIMIZED CATEGORY QUERY
   * Uses category-specific indexes for fast filtering
   * Expected execution time: < 10ms
   */
  static async getCategoryEconomicData(category: string, options: {
    limit?: number;
    includeSignals?: boolean;
  } = {}) {
    const { limit = 50, includeSignals = true } = options;
    const startTime = Date.now();
    
    try {
      // Use materialized view with category index
      let query = sql`
        SELECT 
          series_id as "seriesId",
          metric_name as "metricName",
          actual_value as "actualValue",
          variance_percent as "variancePercent",
          release_date as "releaseDate",
          unit,
          frequency,
          priority_rank
      `;

      if (includeSignals) {
        query = sql`${query},
          investment_signal as "investmentSignal",
          signal_strength as "signalStrength",
          percentile_rank_1y as "percentileRank1y"
        `;
      }

      query = sql`${query}
        FROM mv_economic_calendar_latest
        WHERE category = ${category}
        ORDER BY priority_rank ASC, release_date DESC
        LIMIT ${limit}
      `;

      const result = await db.execute(query);
      const executionTime = Date.now() - startTime;

      // Track performance  
      await this.trackQueryPerformance('category_optimized', executionTime, result.rows.length);

      logger.info(`🏷️ [OPTIMIZED QUERY] Category ${category}: ${result.rows.length} records in ${executionTime}ms`);
      
      return {
        data: result.rows,
        category,
        executionTime,
        fromCache: false,
        optimization: 'category_index'
      };

    } catch (error) {
      logger.error(`❌ [OPTIMIZED QUERY] Category ${category} failed:`, error);
      throw error;
    }
  }

  /**
   * OPTIMIZED CRITICAL INDICATORS QUERY
   * Ultra-fast access to most important economic data
   * Expected execution time: < 2ms
   */
  static async getCriticalIndicators() {
    const startTime = Date.now();
    
    try {
      const query = sql`
        SELECT 
          series_id as "seriesId",
          metric_name as "metricName",
          category,
          actual_value as "actualValue",
          variance_percent as "variancePercent",
          release_date as "releaseDate",
          period_date as "periodDate",
          investment_signal as "investmentSignal",
          percentile_rank_1y as "percentileRank1y",
          priority_rank
        FROM v_critical_economic_indicators
        ORDER BY priority_rank, release_date DESC
      `;

      const result = await db.execute(query);
      const executionTime = Date.now() - startTime;

      // Track performance
      await this.trackQueryPerformance('critical_indicators', executionTime, result.rows.length);

      logger.info(`⚡ [OPTIMIZED QUERY] Critical indicators: ${result.rows.length} records in ${executionTime}ms`);
      
      return {
        data: result.rows,
        executionTime,
        fromCache: false,
        optimization: 'priority_view'
      };

    } catch (error) {
      logger.error('❌ [OPTIMIZED QUERY] Critical indicators failed:', error);
      throw error;
    }
  }

  /**
   * CACHED QUERY WRAPPER
   * Implements intelligent caching for API responses
   */
  static async getCachedQuery(
    cacheKey: string, 
    queryFunc: () => Promise<any>, 
    ttlMinutes: number = 15
  ) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheQuery = sql`
        SELECT cache_data, created_at, expires_at
        FROM economic_calendar_cache  
        WHERE cache_key = ${cacheKey} AND expires_at > NOW()
      `;
      
      const cacheResult = await db.execute(cacheQuery);
      
      if (cacheResult.rows.length > 0) {
        // Cache hit - update hit count
        await db.execute(sql`
          UPDATE economic_calendar_cache 
          SET hit_count = hit_count + 1 
          WHERE cache_key = ${cacheKey}
        `);
        
        const executionTime = Date.now() - startTime;
        logger.info(`💾 [CACHE HIT] ${cacheKey} served from cache in ${executionTime}ms`);
        
        return {
          ...cacheResult.rows[0].cache_data,
          executionTime,
          fromCache: true,
          cacheAge: Math.round((Date.now() - new Date(cacheResult.rows[0].created_at).getTime()) / 1000)
        };
      }

      // Cache miss - execute query
      const result = await queryFunc();
      const executionTime = Date.now() - startTime;

      // Store in cache
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await db.execute(sql`
        INSERT INTO economic_calendar_cache (cache_key, cache_data, expires_at, cache_params)
        VALUES (${cacheKey}, ${JSON.stringify(result)}, ${expiresAt}, ${JSON.stringify({ttlMinutes})})
        ON CONFLICT (cache_key) DO UPDATE SET
          cache_data = EXCLUDED.cache_data,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
      `);

      logger.info(`🔄 [CACHE MISS] ${cacheKey} cached for ${ttlMinutes}m, execution: ${executionTime}ms`);
      
      return {
        ...result,
        executionTime,
        fromCache: false
      };

    } catch (error) {
      logger.error(`❌ [CACHE ERROR] ${cacheKey}:`, error);
      // Fallback to direct query execution
      return await queryFunc();
    }
  }

  /**
   * INVESTMENT SIGNAL ANALYSIS QUERY
   * Optimized for investment-focused metrics analysis
   */
  static async getInvestmentSignals(options: {
    signalType?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    minStrength?: number;
    categories?: string[];
    limit?: number;
  } = {}) {
    const { signalType, minStrength = 0.5, categories, limit = 100 } = options;
    const startTime = Date.now();
    
    try {
      let query = sql`
        SELECT 
          series_id as "seriesId",
          metric_name as "metricName",
          category,
          investment_signal as "investmentSignal",
          signal_strength as "signalStrength",
          percentile_rank_1y as "percentileRank1y",
          percentile_rank_5y as "percentileRank5y",
          cycle_position as "cyclePosition",
          sector_implication as "sectorImplication",
          asset_class_impact as "assetClassImpact",
          calculation_confidence as "calculationConfidence",
          release_date as "releaseDate"
        FROM mv_economic_calendar_latest
        WHERE investment_signal IS NOT NULL 
          AND signal_strength IS NOT NULL
          AND signal_strength >= ${minStrength}
      `;

      if (signalType) {
        query = sql`${query} AND investment_signal = ${signalType}`;
      }

      if (categories && categories.length > 0) {
        query = sql`${query} AND category = ANY(${categories})`;
      }

      query = sql`${query}
        ORDER BY signal_strength DESC, release_date DESC
        LIMIT ${limit}
      `;

      const result = await db.execute(query);
      const executionTime = Date.now() - startTime;

      // Track performance
      await this.trackQueryPerformance('investment_signals', executionTime, result.rows.length);

      logger.info(`📊 [OPTIMIZED QUERY] Investment signals: ${result.rows.length} records in ${executionTime}ms`);
      
      return {
        data: result.rows,
        executionTime,
        fromCache: false,
        optimization: 'signal_index'
      };

    } catch (error) {
      logger.error('❌ [OPTIMIZED QUERY] Investment signals failed:', error);
      throw error;
    }
  }

  /**
   * Performance tracking helper
   */
  private static async trackQueryPerformance(
    queryType: string,
    executionTime: number,
    rowsReturned: number,
    cacheHit: boolean = false,
    queryParams: any = null
  ) {
    try {
      await db.execute(sql`
        SELECT track_query_performance(
          ${queryType},
          ${executionTime},
          ${rowsReturned}, 
          ${cacheHit},
          ${queryParams ? JSON.stringify(queryParams) : null}
        )
      `);
    } catch (error) {
      // Don't fail the main query if performance tracking fails
      logger.warn('⚠️ Failed to track query performance:', error);
    }
  }

  /**
   * Get performance statistics
   */
  static async getPerformanceStats(hours: number = 24) {
    try {
      const query = sql`
        SELECT 
          query_type,
          COUNT(*) as query_count,
          AVG(execution_time_ms)::integer as avg_execution_ms,
          MAX(execution_time_ms) as max_execution_ms,
          MIN(execution_time_ms) as min_execution_ms,
          AVG(rows_returned)::integer as avg_rows_returned,
          COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
          ROUND(COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / COUNT(*), 1) as cache_hit_rate
        FROM economic_query_performance
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY query_type
        ORDER BY query_count DESC
      `;

      const result = await db.execute(query);
      
      return {
        period_hours: hours,
        statistics: result.rows
      };

    } catch (error) {
      logger.error('❌ Failed to get performance stats:', error);
      return { period_hours: hours, statistics: [] };
    }
  }

  /**
   * Cache maintenance - clean expired entries
   */
  static async cleanCache() {
    try {
      const result = await db.execute(sql`
        DELETE FROM economic_calendar_cache 
        WHERE expires_at < NOW()
      `);

      logger.info(`🧹 Cache cleanup: removed ${result.rowCount || 0} expired entries`);
      return result.rowCount || 0;

    } catch (error) {
      logger.error('❌ Cache cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Manual cache refresh trigger
   */
  static async refreshMaterializedView() {
    const startTime = Date.now();
    
    try {
      await db.execute(sql`SELECT refresh_economic_calendar_cache()`);
      
      const executionTime = Date.now() - startTime;
      logger.info(`🔄 Materialized view refreshed in ${executionTime}ms`);
      
      return { success: true, executionTime };

    } catch (error) {
      logger.error('❌ Materialized view refresh failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export const optimizedEconomicQueries = OptimizedEconomicQueries;