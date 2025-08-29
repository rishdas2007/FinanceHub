/**
 * Unified Economic Data Access Layer
 * 
 * Abstracts schema differences between economic_indicators_history and economic_indicators_current
 * Provides standardized data access interface with consistent formatting
 * 
 * @author Schema Normalization Implementation
 * @version 1.0.0
 * @since 2025-08-29
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../../shared/utils/logger';

export interface UnifiedEconomicIndicator {
  seriesId: string;
  metric: string;
  category: string;
  type: string;
  frequency: string;
  unit: string;
  value: number;
  periodDate: Date;
  releaseDate: Date;
  source: 'history' | 'current';
  // Standardized additional fields
  priorValue?: number;
  monthlyChange?: number;
  annualChange?: number;
  zScore?: number;
}

export interface DataAccessOptions {
  preferredSource?: 'history' | 'current' | 'auto';
  validateUnits?: boolean;
  normalizeValues?: boolean;
  includeMetadata?: boolean;
}

export class UnifiedEconomicDataAccess {
  private unitStandardizationMap = new Map<string, string>([
    // Standardize unit variations
    ['Thousands', 'thousands'],
    ['Percent', 'percent'],
    ['percent', 'percent'],
    ['thousands', 'thousands'],
    // Add more mappings as needed
  ]);

  /**
   * Get unified economic data with schema abstraction
   */
  async getEconomicIndicators(
    seriesIds?: string[], 
    options: DataAccessOptions = {}
  ): Promise<UnifiedEconomicIndicator[]> {
    try {
      logger.info(`🔄 [UNIFIED ACCESS] Getting economic data for ${seriesIds?.length || 'all'} series with options:`, options);
      
      // Get data from both tables and merge intelligently
      const [historyData, currentData] = await Promise.all([
        this.getFromHistoryTable(seriesIds, options),
        this.getFromCurrentTable(seriesIds, options)
      ]);
      
      // Merge and deduplicate with preference handling
      const mergedData = this.mergeDataSources(historyData, currentData, options);
      
      // Apply standardization
      const standardizedData = options.normalizeValues ? 
        this.normalizeData(mergedData) : mergedData;
      
      logger.info(`✅ [UNIFIED ACCESS] Returning ${standardizedData.length} standardized indicators`);
      return standardizedData;
      
    } catch (error) {
      logger.error('❌ [UNIFIED ACCESS] Failed to get unified data:', error);
      throw error;
    }
  }

  /**
   * Get data from history table with column mapping
   */
  private async getFromHistoryTable(
    seriesIds?: string[], 
    options: DataAccessOptions = {}
  ): Promise<UnifiedEconomicIndicator[]> {
    try {
      const whereClause = seriesIds && seriesIds.length > 0 ? 
        sql`WHERE series_id = ANY(${seriesIds})` : sql``;
      
      const result = await db.execute(sql`
        SELECT 
          series_id as "seriesId",
          metric_name as "metric",  -- Column name mapping
          category,
          type,
          frequency,
          unit,
          value,                    -- Column name mapping  
          period_date as "periodDate",
          release_date as "releaseDate",
          prior_value as "priorValue",
          monthly_change as "monthlyChange",
          annual_change as "annualChange",
          z_score_12m as "zScore"
        FROM economic_indicators_history
        ${whereClause}
        ORDER BY series_id, period_date DESC
      `);

      const indicators: UnifiedEconomicIndicator[] = result.rows.map(row => ({
        seriesId: row.seriesId,
        metric: row.metric,
        category: row.category,
        type: row.type,
        frequency: row.frequency,
        unit: this.standardizeUnit(row.unit),
        value: parseFloat(row.value),
        periodDate: new Date(row.periodDate),
        releaseDate: new Date(row.releaseDate),
        source: 'history' as const,
        priorValue: row.priorValue ? parseFloat(row.priorValue) : undefined,
        monthlyChange: row.monthlyChange ? parseFloat(row.monthlyChange) : undefined,
        annualChange: row.annualChange ? parseFloat(row.annualChange) : undefined,
        zScore: row.zScore ? parseFloat(row.zScore) : undefined
      }));

      logger.info(`📊 [HISTORY TABLE] Retrieved ${indicators.length} records`);
      return indicators;
      
    } catch (error) {
      logger.error('❌ [HISTORY TABLE] Query failed:', error);
      return [];
    }
  }

  /**
   * Get data from current table with column mapping
   */
  private async getFromCurrentTable(
    seriesIds?: string[], 
    options: DataAccessOptions = {}
  ): Promise<UnifiedEconomicIndicator[]> {
    try {
      const whereClause = seriesIds && seriesIds.length > 0 ? 
        sql`WHERE series_id = ANY(${seriesIds})` : sql``;
      
      const result = await db.execute(sql`
        SELECT 
          series_id as "seriesId",
          metric,                   -- Already correct column name
          category,
          type,
          frequency,
          unit,
          value_numeric as "value", -- Column name mapping
          period_date as "periodDate",
          release_date as "releaseDate"
        FROM economic_indicators_current
        ${whereClause}
        ORDER BY series_id, period_date DESC
      `);

      const indicators: UnifiedEconomicIndicator[] = result.rows.map(row => ({
        seriesId: row.seriesId,
        metric: row.metric,
        category: row.category,
        type: row.type,
        frequency: row.frequency,
        unit: this.standardizeUnit(row.unit),
        value: parseFloat(row.value),
        periodDate: new Date(row.periodDate),
        releaseDate: new Date(row.releaseDate),
        source: 'current' as const
      }));

      logger.info(`📊 [CURRENT TABLE] Retrieved ${indicators.length} records`);
      return indicators;
      
    } catch (error) {
      logger.error('❌ [CURRENT TABLE] Query failed:', error);
      return [];
    }
  }

  /**
   * Merge data from both sources with intelligent deduplication
   */
  private mergeDataSources(
    historyData: UnifiedEconomicIndicator[],
    currentData: UnifiedEconomicIndicator[],
    options: DataAccessOptions
  ): UnifiedEconomicIndicator[] {
    const merged = new Map<string, UnifiedEconomicIndicator>();
    const { preferredSource = 'auto' } = options;

    // Add current data first (higher priority by default)
    currentData.forEach(indicator => {
      const key = `${indicator.seriesId}_${indicator.periodDate.getTime()}`;
      merged.set(key, indicator);
    });

    // Add history data, respecting preference
    historyData.forEach(indicator => {
      const key = `${indicator.seriesId}_${indicator.periodDate.getTime()}`;
      const existing = merged.get(key);
      
      if (!existing) {
        merged.set(key, indicator);
      } else {
        // Handle conflicts based on preference
        if (preferredSource === 'history' || 
           (preferredSource === 'auto' && this.shouldPreferHistory(indicator, existing))) {
          merged.set(key, indicator);
          logger.debug(`🔄 [MERGE] Preferring history for ${indicator.seriesId} ${indicator.periodDate}`);
        }
      }
    });

    const result = Array.from(merged.values()).sort((a, b) => 
      a.seriesId.localeCompare(b.seriesId) || b.periodDate.getTime() - a.periodDate.getTime()
    );

    logger.info(`🔄 [MERGE] Combined ${historyData.length} history + ${currentData.length} current = ${result.length} merged`);
    return result;
  }

  /**
   * Determine if history data should be preferred over current
   */
  private shouldPreferHistory(history: UnifiedEconomicIndicator, current: UnifiedEconomicIndicator): boolean {
    // Prefer history if it has more complete data
    const historyCompleteness = [
      history.priorValue,
      history.monthlyChange,
      history.annualChange,
      history.zScore
    ].filter(v => v !== undefined).length;
    
    const currentCompleteness = 0; // Current table has no additional fields
    
    return historyCompleteness > currentCompleteness;
  }

  /**
   * Normalize data values and detect inconsistencies
   */
  private normalizeData(indicators: UnifiedEconomicIndicator[]): UnifiedEconomicIndicator[] {
    return indicators.map(indicator => {
      const normalized = { ...indicator };
      
      // Apply value normalization based on detected patterns
      const normalizationResult = this.normalizeValue(
        indicator.value, 
        indicator.unit, 
        indicator.seriesId, 
        indicator.metric
      );
      
      if (normalizationResult.wasNormalized) {
        logger.info(`🔧 [NORMALIZE] ${indicator.seriesId}: ${indicator.value} → ${normalizationResult.value} (${normalizationResult.reason})`);
        normalized.value = normalizationResult.value;
      }
      
      return normalized;
    });
  }

  /**
   * Normalize individual values based on detected patterns
   */
  private normalizeValue(value: number, unit: string, seriesId: string, metric: string): {
    value: number;
    wasNormalized: boolean;
    reason: string;
  } {
    const metricLower = metric.toLowerCase();
    
    // Handle jobless claims scale normalization
    if ((seriesId === 'ICSA' || seriesId === 'CCSA') && unit === 'thousands') {
      if (value > 100000) {
        // Raw count → thousands
        return {
          value: Math.round(value / 1000),
          wasNormalized: true,
          reason: 'raw_count_to_thousands'
        };
      }
    }
    
    // Handle CPI index → percentage conversion
    if (metricLower.includes('cpi') && value > 100 && unit === 'percent') {
      // This might be index data mislabeled as percent
      logger.warn(`⚠️ [NORMALIZE] Suspicious CPI data: ${value} labeled as ${unit}`);
    }
    
    return {
      value,
      wasNormalized: false,
      reason: 'no_normalization_needed'
    };
  }

  /**
   * Standardize unit names for consistency
   */
  private standardizeUnit(unit: string): string {
    return this.unitStandardizationMap.get(unit) || unit.toLowerCase();
  }

  /**
   * Get data quality report for debugging
   */
  async getDataQualityReport(): Promise<{
    schemaInconsistencies: any[];
    unitInconsistencies: any[];
    valueScaleIssues: any[];
    summary: string;
  }> {
    try {
      // Check for schema inconsistencies
      const schemaCheck = await db.execute(sql`
        SELECT 
          h.series_id,
          COUNT(DISTINCT h.unit) as history_unit_variants,
          COUNT(DISTINCT c.unit) as current_unit_variants,
          h.unit as history_unit,
          c.unit as current_unit
        FROM economic_indicators_history h
        LEFT JOIN economic_indicators_current c ON h.series_id = c.series_id
        GROUP BY h.series_id, h.unit, c.unit
        HAVING COUNT(DISTINCT h.unit) > 1 OR h.unit != c.unit
        LIMIT 10
      `);

      // Check for value scale issues
      const valueScaleCheck = await db.execute(sql`
        SELECT 
          series_id,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          unit,
          COUNT(*) as record_count
        FROM economic_indicators_history
        WHERE series_id IN ('ICSA', 'CCSA', 'CPIAUCSL')
        GROUP BY series_id, unit
        ORDER BY series_id, avg_value DESC
      `);

      return {
        schemaInconsistencies: schemaCheck.rows,
        unitInconsistencies: schemaCheck.rows.filter(row => row.history_unit !== row.current_unit),
        valueScaleIssues: valueScaleCheck.rows,
        summary: `Found ${schemaCheck.rows.length} schema issues and ${valueScaleCheck.rows.length} value scale patterns`
      };
      
    } catch (error) {
      logger.error('❌ [QUALITY REPORT] Failed to generate report:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const unifiedEconomicDataAccess = new UnifiedEconomicDataAccess();