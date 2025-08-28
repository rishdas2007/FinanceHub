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
  
  // Preferred metric names for deduplicated series
  private static readonly PREFERRED_METRICS: Record<string, string> = {
    'CCSA': 'Continued Claims (Insured Unemployment)',
    'ICSA': 'Initial Claims'
  };
  
  /**
   * Filter out duplicate delta-adjusted versions
   */
  static deduplicateMetrics(indicators: any[]): any[] {
    logger.info('🔧 Running series deduplication filter');
    
    const filteredIndicators: any[] = [];
    const seenSeriesIds = new Set<string>();
    const removedDuplicates: string[] = [];
    
    for (const indicator of indicators) {
      const seriesId = indicator.seriesId;
      const metric = indicator.metric;
      
      // Check if this is a problematic duplicate
      if (this.SINGLE_VERSION_SERIES.has(seriesId)) {
        
        // If we've already seen this series ID, check which version to keep
        if (seenSeriesIds.has(seriesId)) {
          
          // Remove delta-adjusted versions (they contain "Δ-adjusted")
          if (metric.includes('(Δ-adjusted)') || metric.includes('Δ-adjusted')) {
            removedDuplicates.push(`${metric} (${seriesId})`);
            logger.info(`🗑️  Removing duplicate delta-adjusted: ${metric}`);
            continue; // Skip this duplicate
          }
          
          // If current entry is raw and we already have delta-adjusted, replace it
          const existingIndex = filteredIndicators.findIndex(
            (existing) => existing.seriesId === seriesId
          );
          
          if (existingIndex !== -1) {
            const existingMetric = filteredIndicators[existingIndex].metric;
            if (existingMetric.includes('(Δ-adjusted)')) {
              // Replace delta-adjusted with raw version
              filteredIndicators[existingIndex] = indicator;
              removedDuplicates.push(`${existingMetric} (${seriesId}) - replaced with raw`);
              logger.info(`🔄 Replaced delta-adjusted with raw: ${metric}`);
            }
          }
          
        } else {
          // First time seeing this series ID
          seenSeriesIds.add(seriesId);
          
          // Skip delta-adjusted versions if they come first
          if (metric.includes('(Δ-adjusted)') || metric.includes('Δ-adjusted')) {
            logger.info(`⏭️  Skipping delta-adjusted (waiting for raw): ${metric}`);
            continue;
          }
          
          filteredIndicators.push(indicator);
        }
        
      } else {
        // Not a problematic series, include as-is
        filteredIndicators.push(indicator);
      }
    }
    
    if (removedDuplicates.length > 0) {
      logger.info('✅ Deduplication complete:', {
        originalCount: indicators.length,
        finalCount: filteredIndicators.length,
        removedDuplicates
      });
    }
    
    return filteredIndicators;
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