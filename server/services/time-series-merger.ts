/**
 * TIME SERIES MERGER SERVICE
 * Merges recent raw data with historical delta-adjusted data after format standardization
 */

import { logger } from '../utils/logger.js';

export interface TimeSeriesDataPoint {
  seriesId: string;
  metric: string;
  currentReading: string;
  unit: string;
  releaseDate?: string;
  period_date?: string;
  isDeltaAdjusted?: boolean;
}

export class TimeSeriesMerger {
  
  // Series that need time series merging
  private static readonly MERGE_CANDIDATES = new Set([
    'CCSA', // Continuing Claims
    'ICSA', // Initial Claims
  ]);
  
  // Format conversion mapping
  private static readonly FORMAT_CONVERSIONS: Record<string, {
    targetMetric: string;
    targetUnit: string;
    conversionFn: (value: string) => string;
  }> = {
    'CCSA': {
      targetMetric: 'Continuing Jobless Claims (Δ-adjusted)',
      targetUnit: 'Percent',
      conversionFn: (value: string) => this.convertThousandsToMillions(value)
    },
    'ICSA': {
      targetMetric: 'Initial Jobless Claims (Δ-adjusted)', 
      targetUnit: 'Percent',
      conversionFn: (value: string) => this.convertThousandsToMillions(value)
    }
  };
  
  /**
   * Main entry point: merge time series data for indicators
   */
  static mergeTimeSeriesData(indicators: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    logger.info('🔧 Starting time series merger for recent data integration');
    
    const mergedIndicators: TimeSeriesDataPoint[] = [];
    const processedSeries = new Set<string>();
    
    // Group indicators by series ID
    const seriesGroups = this.groupIndicatorsBySeriesId(indicators);
    
    for (const [seriesId, group] of seriesGroups.entries()) {
      if (this.MERGE_CANDIDATES.has(seriesId)) {
        // This series needs merging
        const mergedIndicator = this.mergeSeriesGroup(seriesId, group);
        if (mergedIndicator) {
          mergedIndicators.push(mergedIndicator);
          processedSeries.add(seriesId);
          logger.info(`✅ Merged time series for ${seriesId}: ${mergedIndicator.metric}`);
        }
      } else {
        // No merging needed, include all indicators from this series
        mergedIndicators.push(...group);
      }
    }
    
    logger.info('🎯 Time series merger complete', {
      originalCount: indicators.length,
      finalCount: mergedIndicators.length,
      mergedSeries: Array.from(processedSeries)
    });
    
    return mergedIndicators;
  }
  
  /**
   * Group indicators by series ID for processing
   */
  private static groupIndicatorsBySeriesId(indicators: TimeSeriesDataPoint[]): Map<string, TimeSeriesDataPoint[]> {
    const groups = new Map<string, TimeSeriesDataPoint[]>();
    
    for (const indicator of indicators) {
      const seriesId = indicator.seriesId;
      if (!groups.has(seriesId)) {
        groups.set(seriesId, []);
      }
      groups.get(seriesId)!.push(indicator);
    }
    
    return groups;
  }
  
  /**
   * Merge a specific series group (raw + delta-adjusted)
   */
  private static mergeSeriesGroup(seriesId: string, group: TimeSeriesDataPoint[]): TimeSeriesDataPoint | null {
    const rawIndicator = group.find(ind => !this.isDeltaAdjusted(ind.metric));
    const deltaIndicator = group.find(ind => this.isDeltaAdjusted(ind.metric));
    
    if (!rawIndicator && !deltaIndicator) {
      logger.warn(`No indicators found for series ${seriesId}`);
      return null;
    }
    
    // If we only have one version, return it as-is or convert if needed
    if (!rawIndicator && deltaIndicator) {
      logger.info(`Only delta-adjusted data available for ${seriesId}, using as-is`);
      return deltaIndicator;
    }
    
    if (rawIndicator && !deltaIndicator) {
      logger.info(`Only raw data available for ${seriesId}, converting to standard format`);
      return this.convertRawToStandardFormat(seriesId, rawIndicator);
    }
    
    // Both versions exist - merge them
    return this.mergeRawAndDeltaAdjusted(seriesId, rawIndicator!, deltaIndicator!);
  }
  
  /**
   * Merge raw and delta-adjusted indicators
   * PRIORITIZES FRED API data by source authority before temporal comparison
   */
  private static mergeRawAndDeltaAdjusted(seriesId: string, raw: TimeSeriesDataPoint, delta: TimeSeriesDataPoint): TimeSeriesDataPoint {
    logger.info(`🔄 Merging raw and delta-adjusted data for ${seriesId}`);
    
    // NEW: Check for FRED API source authority priority
    const rawIsFredData = this.isFredApiData(raw);
    const deltaIsFredData = this.isFredApiData(delta);
    
    // Convert raw data to match delta-adjusted format
    const convertedRaw = this.convertRawToStandardFormat(seriesId, raw);
    
    // FRED API SOURCE PRIORITY: FRED data always wins over calculated data
    if (rawIsFredData && !deltaIsFredData) {
      logger.info(`🎯 Using FRED API raw data (source authority): ${seriesId} from FRED > calculated`);
      return {
        ...convertedRaw,
        historicalSource: delta.metric,
        mergedFrom: 'fred_raw_data_converted',
        sourceAuthority: 'fred_api'
      } as TimeSeriesDataPoint;
    }
    
    if (deltaIsFredData && !rawIsFredData) {
      logger.info(`🎯 Using FRED API delta-adjusted data (source authority): ${seriesId} from FRED > calculated`);
      return {
        ...delta,
        recentDataAvailable: raw.currentReading,
        mergedFrom: 'fred_delta_data_prioritized',
        sourceAuthority: 'fred_api'
      } as TimeSeriesDataPoint;
    }
    
    // If both are FRED or both are calculated, fall back to temporal logic
    const rawDate = this.parseDate(raw.releaseDate || raw.period_date);
    const deltaDate = this.parseDate(delta.releaseDate || delta.period_date);
    
    // Use the more recent data, with conversion applied
    if (rawDate && deltaDate && rawDate > deltaDate) {
      logger.info(`📊 Using converted raw data (more recent): ${raw.releaseDate} > ${delta.releaseDate}`);
      return {
        ...convertedRaw,
        historicalSource: delta.metric,
        mergedFrom: 'raw_data_appended_to_historical'
      } as TimeSeriesDataPoint;
    } else {
      logger.info(`📊 Using delta-adjusted data: ${delta.releaseDate} >= ${raw.releaseDate}`);
      return {
        ...delta,
        recentDataAvailable: raw.currentReading,
        mergedFrom: 'delta_adjusted_with_raw_available'
      } as TimeSeriesDataPoint;
    }
  }
  
  /**
   * Convert raw indicator to standard (delta-adjusted) format
   */
  private static convertRawToStandardFormat(seriesId: string, raw: TimeSeriesDataPoint): TimeSeriesDataPoint {
    const conversion = this.FORMAT_CONVERSIONS[seriesId];
    if (!conversion) {
      logger.warn(`No conversion rules found for series ${seriesId}`);
      return raw;
    }
    
    const convertedReading = conversion.conversionFn(raw.currentReading);
    
    logger.info(`🔄 Format conversion for ${seriesId}:`, {
      original: `${raw.currentReading} (${raw.unit})`,
      converted: `${convertedReading} (${conversion.targetUnit})`,
      targetMetric: conversion.targetMetric
    });
    
    return {
      ...raw,
      metric: conversion.targetMetric,
      currentReading: convertedReading,
      unit: conversion.targetUnit,
      isDeltaAdjusted: true,
      convertedFrom: raw.metric
    };
  }
  
  /**
   * Convert thousands format to millions format (e.g., "1,972,000.0" → "1972.0M")
   */
  private static convertThousandsToMillions(value: string): string {
    try {
      // Remove commas and parse as number
      const numericValue = parseFloat(value.replace(/,/g, ''));
      
      if (isNaN(numericValue)) {
        logger.warn(`Failed to parse numeric value: ${value}`);
        return value; // Return original if can't parse
      }
      
      // Convert to millions and format
      const millionsValue = numericValue / 1000;
      return `${millionsValue.toFixed(1)}M`;
    } catch (error) {
      logger.warn(`Format conversion failed for ${value}:`, error);
      return value;
    }
  }
  
  /**
   * Check if a metric name indicates delta-adjusted data
   */
  private static isDeltaAdjusted(metric: string): boolean {
    return metric.includes('(Δ-adjusted)') || metric.includes('Δ-adjusted');
  }
  
  /**
   * Helper method to detect FRED API data by source authority
   * Checks for recent fetch timestamp indicating direct FRED API data
   */
  private static isFredApiData(indicator: TimeSeriesDataPoint): boolean {
    // Method 1: Check if data has rawCurrentValue indicating FRED source
    if (indicator.rawCurrentValue && typeof indicator.rawCurrentValue === 'number') {
      return true;
    }
    
    // Method 2: Check if current reading format suggests FRED raw data (thousands format)
    const reading = String(indicator.currentReading || '');
    if (reading.includes('000') || reading.includes(',')) {
      return true;
    }
    
    // Method 3: Check if period_date is different from releaseDate (FRED pattern)
    if (indicator.period_date && indicator.releaseDate && 
        indicator.period_date !== indicator.releaseDate) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Parse date string to Date object
   */
  private static parseDate(dateString?: string): Date | null {
    if (!dateString) return null;
    
    try {
      return new Date(dateString);
    } catch (error) {
      logger.warn(`Failed to parse date: ${dateString}`);
      return null;
    }
  }
  
  /**
   * Validate merger results
   */
  static validateMergerResults(original: TimeSeriesDataPoint[], merged: TimeSeriesDataPoint[]): {
    isValid: boolean;
    issues: string[];
    summary: {
      originalCount: number;
      mergedCount: number;
      seriesReduced: number;
      conversionsApplied: number;
    };
  } {
    const issues: string[] = [];
    
    // Count series before and after
    const originalSeries = new Set(original.map(ind => ind.seriesId));
    const mergedSeries = new Set(merged.map(ind => ind.seriesId));
    
    // Count conversions
    const conversionsApplied = merged.filter(ind => 
      ind.convertedFrom || ind.mergedFrom
    ).length;
    
    // Validate no data loss for non-merge candidates
    for (const seriesId of originalSeries) {
      if (!this.MERGE_CANDIDATES.has(seriesId) && !mergedSeries.has(seriesId)) {
        issues.push(`Series ${seriesId} was lost during merge`);
      }
    }
    
    // Validate merge candidates were processed
    for (const candidateId of this.MERGE_CANDIDATES) {
      if (originalSeries.has(candidateId) && !mergedSeries.has(candidateId)) {
        issues.push(`Merge candidate ${candidateId} was not processed`);
      }
    }
    
    const summary = {
      originalCount: original.length,
      mergedCount: merged.length,
      seriesReduced: originalSeries.size - mergedSeries.size,
      conversionsApplied
    };
    
    logger.info('📊 Merger validation summary:', { summary, issues });
    
    return {
      isValid: issues.length === 0,
      issues,
      summary
    };
  }
}