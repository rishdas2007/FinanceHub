/**
 * Real Data Preservation Service
 * Ensures authentic market data is maintained while implementing performance optimizations
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cacheManager } from './intelligent-cache-manager';

interface DataIntegrityCheck {
  source: string;
  isRealData: boolean;
  confidence: number;
  details: any;
  recommendation: string;
}

export class RealDataPreservationService {
  private dataQualityThresholds = {
    minPriceVariance: 5.0,
    maxWeekendRecords: 10,
    minVolumeThreshold: 1000,
    realismScore: 0.8
  };

  /**
   * Perform comprehensive data integrity check
   */
  async performDataIntegrityCheck(): Promise<DataIntegrityCheck[]> {
    const checks: DataIntegrityCheck[] = [];
    
    try {
      logger.info('🔍 Performing real data integrity check...');
      
      // Check 1: ETF Historical Data Quality
      const etfCheck = await this.checkETFDataIntegrity();
      checks.push(etfCheck);
      
      // Check 2: Economic Data Quality  
      const economicCheck = await this.checkEconomicDataIntegrity();
      checks.push(economicCheck);
      
      // Check 3: API Response Quality
      const apiCheck = await this.checkAPIResponseIntegrity();
      checks.push(apiCheck);
      
      return checks;
      
    } catch (error) {
      logger.error('Data integrity check failed:', error);
      checks.push({
        source: 'Integrity Check System',
        isRealData: false,
        confidence: 0,
        details: { error: error.message },
        recommendation: 'System error - manual investigation required'
      });
      return checks;
    }
  }

  /**
   * Check ETF data for authenticity markers
   */
  private async checkETFDataIntegrity(): Promise<DataIntegrityCheck> {
    try {
      const result = await db.execute(sql`
        WITH etf_analysis AS (
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT symbol) as unique_symbols,
            STDDEV(close_price) as price_variance,
            AVG(close_price) as avg_price,
            COUNT(CASE WHEN EXTRACT(DOW FROM date) IN (0,6) THEN 1 END) as weekend_records,
            COUNT(CASE WHEN volume > 1000 THEN 1 END) as realistic_volume_records,
            -- Check for price continuity (real data should have sequential days)
            COUNT(DISTINCT date) as unique_dates,
            MAX(date) as latest_date,
            MIN(date) as earliest_date,
            -- Sample recent data
            ARRAY_AGG(
              JSON_BUILD_OBJECT(
                'symbol', symbol,
                'price', close_price,
                'volume', volume,
                'date', date
              ) ORDER BY date DESC LIMIT 5
            ) as recent_samples
          FROM etf_metrics_cache
          WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        )
        SELECT 
          *,
          -- Calculate realism score
          CASE 
            WHEN price_variance > ${this.dataQualityThresholds.minPriceVariance} 
                 AND weekend_records < ${this.dataQualityThresholds.maxWeekendRecords}
                 AND realistic_volume_records > total_records * 0.8
                 AND avg_price BETWEEN 10 AND 1000
            THEN 0.9
            WHEN price_variance > 2 AND weekend_records < 20
            THEN 0.6
            ELSE 0.2
          END as realism_score
        FROM etf_analysis
      `);

      const data = result.rows[0];
      const realismScore = Number(data.realism_score);
      const isRealData = realismScore >= this.dataQualityThresholds.realismScore;

      return {
        source: 'ETF Historical Data',
        isRealData,
        confidence: realismScore,
        details: {
          total_records: data.total_records,
          unique_symbols: data.unique_symbols,
          price_variance: data.price_variance,
          avg_price: data.avg_price,
          weekend_records: data.weekend_records,
          date_range: `${data.earliest_date} to ${data.latest_date}`,
          recent_samples: data.recent_samples
        },
        recommendation: isRealData 
          ? 'ETF data appears authentic. Implement caching to preserve quality.'
          : 'ETF data quality concerns detected. Investigate data sources.'
      };

    } catch (error) {
      return {
        source: 'ETF Historical Data',
        isRealData: false,
        confidence: 0,
        details: { error: error.message },
        recommendation: 'Cannot access ETF data. Check database connectivity.'
      };
    }
  }

  /**
   * Check economic data for authenticity
   */
  private async checkEconomicDataIntegrity(): Promise<DataIntegrityCheck> {
    try {
      const result = await db.execute(sql`
        WITH economic_analysis AS (
          SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT series_id) as unique_series,
            -- Check for realistic economic values
            COUNT(CASE WHEN value BETWEEN -50 AND 50 THEN 1 END) as realistic_values,
            COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as non_null_values,
            MAX(date) as latest_date,
            MIN(date) as earliest_date,
            -- Sample data for inspection
            ARRAY_AGG(
              JSON_BUILD_OBJECT(
                'series_id', series_id,
                'value', value,
                'date', date
              ) ORDER BY date DESC LIMIT 3
            ) as recent_samples
          FROM economic_indicators_current
          WHERE date >= CURRENT_DATE - INTERVAL '90 days'
        )
        SELECT 
          *,
          CASE 
            WHEN realistic_values::float / NULLIF(non_null_values, 0) > 0.8
                 AND unique_series > 5
            THEN 0.9
            ELSE 0.3
          END as realism_score
        FROM economic_analysis
      `);

      const data = result.rows[0];
      const realismScore = Number(data.realism_score || 0);
      const isRealData = realismScore >= this.dataQualityThresholds.realismScore;

      return {
        source: 'Economic Indicators',
        isRealData,
        confidence: realismScore,
        details: {
          total_records: data.total_records,
          unique_series: data.unique_series,
          data_quality_ratio: data.non_null_values > 0 ? 
            Number(data.realistic_values) / Number(data.non_null_values) : 0,
          date_range: `${data.earliest_date} to ${data.latest_date}`,
          recent_samples: data.recent_samples
        },
        recommendation: isRealData
          ? 'Economic data appears authentic. Cache for performance.'
          : 'Economic data needs quality improvement.'
      };

    } catch (error) {
      return {
        source: 'Economic Indicators',
        isRealData: false,
        confidence: 0,
        details: { error: error.message },
        recommendation: 'Cannot access economic data. Check database structure.'
      };
    }
  }

  /**
   * Check API response authenticity
   */
  private async checkAPIResponseIntegrity(): Promise<DataIntegrityCheck> {
    try {
      // Test the ETF metrics API for data quality
      const response = await fetch('http://localhost:5000/api/etf-metrics');
      const apiData = await response.json();

      if (!apiData.success || !apiData.data || apiData.data.length === 0) {
        return {
          source: 'ETF Metrics API',
          isRealData: false,
          confidence: 0,
          details: { error: 'API returned no data' },
          recommendation: 'API endpoint not functioning. Check route configuration.'
        };
      }

      // Analyze the returned data for authenticity markers
      const etfs = apiData.data;
      const priceVariance = this.calculateVariance(etfs.map(e => e.price));
      const hasRealisticPrices = etfs.every(e => e.price > 10 && e.price < 1000);
      const hasVariedData = new Set(etfs.map(e => e.price)).size > etfs.length * 0.8;
      const hasRealSymbols = etfs.some(e => ['SPY', 'QQQ', 'XLK', 'XLV'].includes(e.symbol));

      const qualityScore = [
        priceVariance > 5 ? 0.3 : 0,
        hasRealisticPrices ? 0.3 : 0,
        hasVariedData ? 0.2 : 0,
        hasRealSymbols ? 0.2 : 0
      ].reduce((a, b) => a + b, 0);

      const isRealData = qualityScore >= 0.8;

      return {
        source: 'ETF Metrics API',
        isRealData,
        confidence: qualityScore,
        details: {
          response_time: apiData.metadata?.responseTime,
          data_count: etfs.length,
          price_variance: priceVariance,
          realistic_prices: hasRealisticPrices,
          data_variety: hasVariedData,
          real_symbols: hasRealSymbols,
          sample_prices: etfs.slice(0, 3).map(e => ({ symbol: e.symbol, price: e.price }))
        },
        recommendation: isRealData
          ? 'API returning authentic market data. Implement intelligent caching.'
          : 'API data quality concerns. Check data source pipeline.'
      };

    } catch (error) {
      return {
        source: 'ETF Metrics API',
        isRealData: false,
        confidence: 0,
        details: { error: error.message },
        recommendation: 'API endpoint error. Check server status.'
      };
    }
  }

  /**
   * Calculate variance for data authenticity checking
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Create data preservation strategy based on integrity checks
   */
  async createPreservationStrategy(): Promise<{
    strategy: string;
    actions: string[];
    priority: 'high' | 'medium' | 'low';
    estimated_improvement: string;
  }> {
    const checks = await this.performDataIntegrityCheck();
    const realDataSources = checks.filter(check => check.isRealData);
    const avgConfidence = checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length;

    if (realDataSources.length >= 2 && avgConfidence > 0.8) {
      return {
        strategy: 'INTELLIGENT_CACHING',
        actions: [
          'Implement multi-tier caching for authenticated data sources',
          'Create background refresh system to maintain data freshness',
          'Add cache warming for frequently accessed endpoints',
          'Implement cache invalidation on data updates',
          'Monitor cache hit rates and performance metrics'
        ],
        priority: 'high',
        estimated_improvement: 'Response times: <50ms, Data integrity: 100% preserved'
      };
    } else if (realDataSources.length >= 1) {
      return {
        strategy: 'SELECTIVE_CACHING',
        actions: [
          'Cache only verified authentic data sources',
          'Implement fallback to direct queries for unverified data',
          'Restore data quality for low-confidence sources',
          'Add data validation middleware',
          'Create data quality monitoring dashboard'
        ],
        priority: 'medium',
        estimated_improvement: 'Partial performance gains while maintaining data authenticity'
      };
    } else {
      return {
        strategy: 'DATA_RESTORATION',
        actions: [
          'Restore authentic market data connections',
          'Fix data pipeline issues',
          'Validate API data sources',
          'Implement data quality controls',
          'Only cache after data authenticity is verified'
        ],
        priority: 'high',
        estimated_improvement: 'Restore data authenticity first, then implement caching'
      };
    }
  }

  /**
   * Execute the preservation strategy
   */
  async executePreservationStrategy(): Promise<void> {
    logger.info('🎯 Executing real data preservation strategy...');
    
    const strategy = await this.createPreservationStrategy();
    logger.info(`📋 Strategy: ${strategy.strategy} (Priority: ${strategy.priority})`);
    
    // Log the recommended actions
    strategy.actions.forEach((action, index) => {
      logger.info(`  ${index + 1}. ${action}`);
    });

    // For intelligent caching strategy, warm up the cache
    if (strategy.strategy === 'INTELLIGENT_CACHING') {
      await this.warmUpCache();
    }
  }

  /**
   * Warm up cache with real data
   */
  private async warmUpCache(): Promise<void> {
    try {
      logger.info('🔥 Warming up cache with real market data...');
      
      // Warm up ETF metrics cache
      await cacheManager.get('etf-metrics', async () => {
        const response = await fetch('http://localhost:5000/api/etf-metrics');
        const data = await response.json();
        return data.data || [];
      });

      logger.info('✅ Cache warmed up successfully');
      
    } catch (error) {
      logger.error('Failed to warm up cache:', error);
    }
  }
}

// Export singleton instance
export const realDataPreservationService = new RealDataPreservationService();