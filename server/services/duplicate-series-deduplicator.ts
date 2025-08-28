import { logger } from '../../shared/utils/logger';

/**
 * Duplicate Series Deduplication Service
 * Removes conflicting series IDs and standardizes economic indicators
 */

export class DuplicateSeriesDeduplicator {
  
  // Series IDs that should only have ONE version (raw, not delta-adjusted)
  private static readonly SINGLE_VERSION_SERIES = new Set([
    'CCSA', // Continuing Claims - keep raw version only
    'ICSA', // Initial Claims - keep raw version only
  ]);
  
  // Preferred metric names for deduplicated series (delta-adjusted format)
  private static readonly PREFERRED_METRICS: Record<string, string> = {
    'CCSA': 'Continuing Jobless Claims (Δ-adjusted)',
    'ICSA': 'Initial Jobless Claims (Δ-adjusted)'
  };
  
  /**
   * Transform raw versions to match delta-adjusted format and remove duplicates
   */
  static deduplicateMetrics(indicators: any[]): any[] {
    logger.info('🔧 Running series deduplication filter - preferring delta-adjusted format');
    
    const filteredIndicators: any[] = [];
    const processedSeries = new Set<string>();
    const removedDuplicates: string[] = [];
    const transformedIndicators: string[] = [];
    
    // First pass: collect all delta-adjusted versions
    for (const indicator of indicators) {
      const seriesId = indicator.seriesId;
      const metric = indicator.metric;
      
      if (this.SINGLE_VERSION_SERIES.has(seriesId)) {
        // If this is a delta-adjusted version, keep it and mark series as processed
        if (metric.includes('(Δ-adjusted)') || metric.includes('Δ-adjusted')) {
          filteredIndicators.push(indicator);
          processedSeries.add(seriesId);
          logger.info(`✅ Keeping delta-adjusted version: ${metric}`);
        }
      } else {
        // Not a problematic series, include as-is
        filteredIndicators.push(indicator);
      }
    }
    
    // Second pass: handle raw versions for series that don't have delta-adjusted
    for (const indicator of indicators) {
      const seriesId = indicator.seriesId;
      const metric = indicator.metric;
      
      if (this.SINGLE_VERSION_SERIES.has(seriesId) && !processedSeries.has(seriesId)) {
        // This is a raw version and we don't have delta-adjusted for this series
        if (!metric.includes('(Δ-adjusted)') && !metric.includes('Δ-adjusted')) {
          // Transform raw to delta-adjusted format
          const transformedIndicator = this.transformToStandardFormat(indicator);
          filteredIndicators.push(transformedIndicator);
          processedSeries.add(seriesId);
          transformedIndicators.push(`${metric} → ${transformedIndicator.metric}`);
          logger.info(`🔄 Transformed raw to delta-adjusted: ${metric} → ${transformedIndicator.metric}`);
        }
      }
    }
    
    // Third pass: mark removed duplicates
    for (const indicator of indicators) {
      const seriesId = indicator.seriesId;
      const metric = indicator.metric;
      
      if (this.SINGLE_VERSION_SERIES.has(seriesId)) {
        // If this is a raw version and we have processed this series (either kept delta-adjusted or transformed)
        if (!metric.includes('(Δ-adjusted)') && !metric.includes('Δ-adjusted') && processedSeries.has(seriesId)) {
          removedDuplicates.push(`${metric} (${seriesId}) - raw version removed in favor of delta-adjusted`);
        }
      }
    }
    
    logger.info('✅ Deduplication complete', {
      originalCount: indicators.length,
      finalCount: filteredIndicators.length,
      removedCount: removedDuplicates.length,
      transformedCount: transformedIndicators.length
    });
    
    if (removedDuplicates.length > 0) {
      logger.info('Removed duplicates:', removedDuplicates);
    }
    
    if (transformedIndicators.length > 0) {
      logger.info('Transformed indicators:', transformedIndicators);
    }
    
    return filteredIndicators;
  }
  
  /**
   * Transform raw indicators to match delta-adjusted format
   */
  private static transformToStandardFormat(indicator: any): any {
    const seriesId = indicator.seriesId;
    
    if (seriesId === 'CCSA') {
      return {
        ...indicator,
        metric: 'Continuing Jobless Claims (Δ-adjusted)',
        unit: 'Percent',
        currentReading: this.convertToMillionsFormat(indicator.currentReading)
      };
    }
    
    if (seriesId === 'ICSA') {
      return {
        ...indicator,
        metric: 'Initial Jobless Claims (Δ-adjusted)',
        unit: 'Percent', 
        currentReading: this.convertToMillionsFormat(indicator.currentReading)
      };
    }
    
    return indicator;
  }
  
  /**
   * Convert thousands format to millions format (e.g., "1,972,000.0" → "1972.0M")
   */
  private static convertToMillionsFormat(currentReading: string): string {
    try {
      // Remove commas and parse as number
      const numericValue = parseFloat(currentReading.replace(/,/g, ''));
      
      if (isNaN(numericValue)) {
        return currentReading; // Return original if can't parse
      }
      
      // Convert to millions and format
      const millionsValue = numericValue / 1000;
      return `${millionsValue.toFixed(1)}M`;
    } catch (error) {
      logger.warn(`Failed to convert ${currentReading} to millions format:`, error);
      return currentReading;
    }
  }
  
  /**
   * Validate series IDs for uniqueness
   */
  static validateSeriesUniqueness(indicators: any[]): { isValid: boolean; duplicates: string[] } {
    const seriesMap = new Map<string, string[]>();
    
    for (const indicator of indicators) {
      const seriesId = indicator.seriesId;
      const metric = indicator.metric;
      
      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, []);
      }
      seriesMap.get(seriesId)!.push(metric);
    }
    
    const duplicates: string[] = [];
    for (const [seriesId, metrics] of seriesMap.entries()) {
      if (metrics.length > 1) {
        duplicates.push(`${seriesId}: ${metrics.join(', ')}`);
      }
    }
    
    return {
      isValid: duplicates.length === 0,
      duplicates
    };
  }
  
  /**
   * Generate validation report
   */
  static generateValidationReport(indicators: any[]): void {
    const validation = this.validateSeriesUniqueness(indicators);
    
    if (validation.isValid) {
      logger.info('✅ Series ID validation passed - no duplicates found');
    } else {
      logger.warn('⚠️  Series ID validation failed - duplicates found:', validation.duplicates);
    }
    
    // Log series summary
    const seriesCount = new Set(indicators.map(i => i.seriesId)).size;
    logger.info(`📊 Series summary: ${indicators.length} indicators using ${seriesCount} unique series IDs`);
  }
}