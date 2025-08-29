import { logger } from '../../shared/utils/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Comprehensive logging service to validate assumptions before implementing
 * hybrid lazy loading schema conformance solution
 */
export class SchemaConformanceLogger {
  
  /**
   * Log current data state and schema mapping challenges
   */
  static async validateCurrentDataState(): Promise<void> {
    logger.info('🔍 [SCHEMA CONFORMANCE] Starting comprehensive data validation...');
    
    try {
      // 1. Analyze economic_indicators_history table current state
      const historyTableStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT series_id) as unique_series,
          COUNT(DISTINCT metric_name) as unique_metrics,
          MIN(period_date) as earliest_date,
          MAX(period_date) as latest_date,
          COUNT(*) FILTER (WHERE z_score_12m IS NOT NULL AND z_score_12m != 0) as records_with_zscore
        FROM economic_indicators_history
      `);
      
      logger.info('📊 [HISTORY TABLE ANALYSIS]', {
        totalRecords: historyTableStats.rows[0]?.total_records || 0,
        uniqueSeries: historyTableStats.rows[0]?.unique_series || 0,
        uniqueMetrics: historyTableStats.rows[0]?.unique_metrics || 0,
        dateRange: {
          earliest: historyTableStats.rows[0]?.earliest_date,
          latest: historyTableStats.rows[0]?.latest_date
        },
        recordsWithZScore: historyTableStats.rows[0]?.records_with_zscore || 0
      });

      // 2. Check for schema field mapping requirements
      const sampleHistoryData = await db.execute(sql`
        SELECT 
          series_id,
          metric_name,
          category,
          type,
          frequency,
          value,
          period_date,
          release_date,
          unit,
          z_score_12m,
          prior_value,
          monthly_change,
          annual_change
        FROM economic_indicators_history 
        LIMIT 5
      `);
      
      logger.info('🔍 [HISTORY SCHEMA SAMPLE]', {
        sampleData: sampleHistoryData.rows.map(row => ({
          seriesId: row.series_id,
          metricName: row.metric_name,
          hasZScore: !!row.z_score_12m,
          hasPriorValue: !!row.prior_value,
          hasCalculatedFields: !!(row.monthly_change || row.annual_change)
        }))
      });

      // 3. Analyze current API data vs schema requirements
      await this.analyzeApiDataMapping();
      
      // 4. Check FRED API usage and rate limits
      await this.analyzeFredApiUsage();
      
      // 5. Estimate data gaps and backfill requirements
      await this.estimateDataGaps();
      
    } catch (error) {
      logger.error('❌ [SCHEMA CONFORMANCE] Validation failed:', error);
      throw error;
    }
  }

  /**
   * Analyze current API data structure vs target schema
   */
  private static async analyzeApiDataMapping(): Promise<void> {
    logger.info('🔍 [API MAPPING ANALYSIS] Starting...');
    
    try {
      // Simulate API data analysis (since we can't directly access the API response here)
      const apiMappingRequirements = {
        fieldMappings: {
          'metric → metricName': 'Direct mapping required',
          'currentValue → value': 'Decimal conversion needed',
          'period_date → periodDate': 'Direct mapping',
          'seriesId → seriesId': 'Direct mapping',
          'unit → unit': 'Direct mapping',
          'category → category': 'Direct mapping',
          'type → type': 'Direct mapping',
          'frequency → frequency': 'Direct mapping'
        },
        calculationRequirements: {
          priorValue: 'Calculate from time series data',
          monthlyChange: 'Calculate (current - prior) / prior * 100',
          annualChange: 'Calculate YoY change',
          zScore12m: 'Calculate using 12-month rolling window'
        },
        dataTypeConversions: {
          'currentReading (string) → value (decimal)': 'Parse and convert',
          'period_date (string) → periodDate (timestamp)': 'Date parsing',
          'releaseDate (string) → releaseDate (timestamp)': 'Date parsing'
        }
      };
      
      logger.info('📊 [API MAPPING REQUIREMENTS]', apiMappingRequirements);
      
    } catch (error) {
      logger.error('❌ [API MAPPING ANALYSIS] Failed:', error);
    }
  }

  /**
   * Analyze FRED API usage patterns and rate limits
   */
  private static async analyzeFredApiUsage(): Promise<void> {
    logger.info('🔍 [FRED API ANALYSIS] Checking usage patterns...');
    
    try {
      // Check if there's a FRED API log table
      const fredLogExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'fred_update_log'
        )
      `);
      
      if (fredLogExists.rows[0]?.exists) {
        const recentFredActivity = await db.execute(sql`
          SELECT 
            COUNT(*) as total_calls,
            COUNT(DISTINCT series_id) as unique_series_requested,
            MIN(created_at) as earliest_call,
            MAX(created_at) as latest_call,
            AVG(response_time_ms) as avg_response_time
          FROM fred_update_log 
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `);
        
        logger.info('📊 [FRED API USAGE - LAST 7 DAYS]', {
          totalCalls: recentFredActivity.rows[0]?.total_calls || 0,
          uniqueSeries: recentFredActivity.rows[0]?.unique_series_requested || 0,
          dateRange: {
            earliest: recentFredActivity.rows[0]?.earliest_call,
            latest: recentFredActivity.rows[0]?.latest_call
          },
          avgResponseTime: recentFredActivity.rows[0]?.avg_response_time + 'ms' || 'N/A'
        });
      } else {
        logger.warn('⚠️ [FRED API ANALYSIS] No fred_update_log table found - usage tracking unavailable');
      }
      
      // Estimate API call requirements
      const estimatedApiRequirements = {
        rateLimit: '120 calls per minute (FRED API limit)',
        dailyLimit: '172800 calls per day (theoretical max)',
        backfillStrategy: 'Batch requests with 1-second delays',
        prioritization: 'Focus on series with existing z-score calculations first'
      };
      
      logger.info('📊 [FRED API REQUIREMENTS]', estimatedApiRequirements);
      
    } catch (error) {
      logger.error('❌ [FRED API ANALYSIS] Failed:', error);
    }
  }

  /**
   * Estimate data gaps and backfill requirements
   */
  private static async estimateDataGaps(): Promise<void> {
    logger.info('🔍 [DATA GAPS ANALYSIS] Estimating backfill requirements...');
    
    try {
      // Check which series exist in history vs current mixed data
      const gapAnalysis = {
        historicalSeriesCount: 0,
        missingSeriesEstimate: 0,
        avgTimeSeriesLength: 0,
        zScoreCalculationGaps: 0
      };
      
      // Get count of series with sufficient data for z-score calculation
      const zscoreReadySeries = await db.execute(sql`
        SELECT 
          series_id,
          COUNT(*) as data_points,
          MIN(period_date) as earliest,
          MAX(period_date) as latest,
          COUNT(*) FILTER (WHERE z_score_12m IS NOT NULL AND z_score_12m != 0) as zscore_points
        FROM economic_indicators_history 
        WHERE series_id IS NOT NULL
        GROUP BY series_id
        HAVING COUNT(*) >= 12  -- At least 12 points for meaningful z-score
        ORDER BY COUNT(*) DESC
      `);
      
      gapAnalysis.historicalSeriesCount = zscoreReadySeries.rows.length;
      gapAnalysis.avgTimeSeriesLength = zscoreReadySeries.rows.reduce(
        (sum, row) => sum + (Number(row.data_points) || 0), 0
      ) / Math.max(zscoreReadySeries.rows.length, 1);
      
      gapAnalysis.zScoreCalculationGaps = zscoreReadySeries.rows.filter(
        row => (Number(row.zscore_points) || 0) === 0
      ).length;
      
      logger.info('📊 [DATA GAPS ANALYSIS]', {
        seriesWithSufficientData: gapAnalysis.historicalSeriesCount,
        avgTimeSeriesLength: Math.round(gapAnalysis.avgTimeSeriesLength),
        seriesNeedingZScoreCalculation: gapAnalysis.zScoreCalculationGaps,
        estimatedBackfillEffort: `${gapAnalysis.zScoreCalculationGaps * 50} API calls needed`,
        implementationComplexity: 'MEDIUM - Schema mapping + z-score calculation'
      });
      
      // Log series ready for immediate z-score calculation
      if (zscoreReadySeries.rows.length > 0) {
        logger.info('🎯 [READY FOR ZSCORE]', {
          topSeries: zscoreReadySeries.rows.slice(0, 10).map(row => ({
            seriesId: row.series_id,
            dataPoints: row.data_points,
            dateRange: `${row.earliest} to ${row.latest}`,
            needsZScoreCalc: (Number(row.zscore_points) || 0) === 0
          }))
        });
      }
      
    } catch (error) {
      logger.error('❌ [DATA GAPS ANALYSIS] Failed:', error);
    }
  }

  /**
   * Log recommended implementation approach
   */
  static logRecommendedApproach(): void {
    const recommendation = {
      solution: 'Hybrid Lazy Loading with Schema Normalization',
      rationale: [
        'Fast implementation - modify existing macroeconomic-indicators service',
        'FRED API friendly - only fetches when needed, respects rate limits', 
        'Self-healing - automatically fills gaps when users request data',
        'Immediate results - users see improvements right away',
        'Low risk - no mass data migration or complex infrastructure'
      ],
      implementation: [
        '1. Modify /api/macroeconomic-indicators to check economic_indicators_history first',
        '2. If data missing/stale, fetch from FRED API and normalize to schema',
        '3. Cache in economic_indicators_history table for future requests',
        '4. Calculate z-scores using historical data from normalized table'
      ],
      expectedOutcomes: {
        'Week 1': 'Schema mapping and basic lazy loading functional',
        'Week 2': 'Z-score calculations working for top 20 indicators',
        'Week 3': 'Full backfill for most-requested series',
        'Week 4': 'Performance optimization and monitoring'
      }
    };
    
    logger.info('🎯 [IMPLEMENTATION RECOMMENDATION]', recommendation);
  }
}