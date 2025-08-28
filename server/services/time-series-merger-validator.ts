/**
 * TIME SERIES MERGER VALIDATOR
 * Validation service to test assumptions before implementation
 */

import { logger } from '../utils/logger.js';

export class TimeSeriesMergerValidator {
  
  /**
   * Validate data format assumptions for CCSA/ICSA series
   */
  static validateFormatAssumptions(indicators: any[]) {
    logger.info('🔍 Validating time series format assumptions...');
    
    const ccsaRaw = indicators.find(ind => ind.seriesId === 'CCSA' && !ind.metric.includes('Δ-adjusted'));
    const ccsaDelta = indicators.find(ind => ind.seriesId === 'CCSA' && ind.metric.includes('Δ-adjusted'));
    const icsaRaw = indicators.find(ind => ind.seriesId === 'ICSA' && !ind.metric.includes('Δ-adjusted'));
    const icsaDelta = indicators.find(ind => ind.seriesId === 'ICSA' && ind.metric.includes('Δ-adjusted'));
    
    const validationResults = {
      ccsaFormats: this.analyzeFormatDifferences(ccsaRaw, ccsaDelta, 'CCSA'),
      icsaFormats: this.analyzeFormatDifferences(icsaRaw, icsaDelta, 'ICSA'),
      conversionFeasibility: null as any,
      temporalOverlap: null as any,
      dataIntegrity: null as any
    };
    
    // Test format conversion feasibility
    validationResults.conversionFeasibility = this.testFormatConversion(ccsaRaw, ccsaDelta);
    
    // Analyze temporal characteristics
    validationResults.temporalOverlap = this.analyzeTemporalCharacteristics(ccsaRaw, ccsaDelta);
    
    // Data integrity assessment
    validationResults.dataIntegrity = this.assessDataIntegrity(indicators);
    
    logger.info('✅ Format validation complete', validationResults);
    return validationResults;
  }
  
  /**
   * Analyze format differences between raw and delta-adjusted versions
   */
  private static analyzeFormatDifferences(raw: any, delta: any, seriesId: string) {
    if (!raw || !delta) {
      return {
        status: 'missing_data',
        raw: raw ? 'present' : 'missing',
        delta: delta ? 'present' : 'missing'
      };
    }
    
    return {
      seriesId,
      raw: {
        metric: raw.metric,
        currentReading: raw.currentReading,
        unit: raw.unit,
        format: this.detectFormat(raw.currentReading)
      },
      delta: {
        metric: delta.metric,
        currentReading: delta.currentReading,
        unit: delta.unit,
        format: this.detectFormat(delta.currentReading)
      },
      formatDifference: this.compareFormats(raw.currentReading, delta.currentReading),
      unitDifference: raw.unit !== delta.unit ? { raw: raw.unit, delta: delta.unit } : 'same'
    };
  }
  
  /**
   * Detect data format pattern
   */
  private static detectFormat(value: string): string {
    if (/^\d{1,3}(,\d{3})*\.\d+$/.test(value)) return 'thousands_with_commas';
    if (/^\d+\.\d+M$/.test(value)) return 'millions_with_M_suffix';
    if (/^\d+\.\d+%$/.test(value)) return 'percentage';
    if (/^\d+\.\d+$/.test(value)) return 'decimal_number';
    return 'unknown_format';
  }
  
  /**
   * Compare format compatibility
   */
  private static compareFormats(rawValue: string, deltaValue: string) {
    const rawFormat = this.detectFormat(rawValue);
    const deltaFormat = this.detectFormat(deltaValue);
    
    const conversionNeeded = rawFormat !== deltaFormat;
    const conversionPath = conversionNeeded ? `${rawFormat} → ${deltaFormat}` : 'no_conversion_needed';
    
    return {
      conversionNeeded,
      conversionPath,
      rawFormat,
      deltaFormat,
      complexity: this.assessConversionComplexity(rawFormat, deltaFormat)
    };
  }
  
  /**
   * Assess conversion complexity
   */
  private static assessConversionComplexity(rawFormat: string, deltaFormat: string): string {
    const conversionMatrix: Record<string, Record<string, string>> = {
      'thousands_with_commas': {
        'millions_with_M_suffix': 'simple_division_1000',
        'percentage': 'complex_needs_baseline',
        'decimal_number': 'remove_commas_parse'
      },
      'millions_with_M_suffix': {
        'thousands_with_commas': 'simple_multiplication_1000',
        'percentage': 'complex_needs_baseline'
      }
    };
    
    return conversionMatrix[rawFormat]?.[deltaFormat] || 'unknown_conversion';
  }
  
  /**
   * Test actual format conversion
   */
  private static testFormatConversion(raw: any, delta: any) {
    if (!raw || !delta) return { status: 'insufficient_data' };
    
    try {
      // Test conversion: thousands with commas → millions with M suffix
      const rawValue = raw.currentReading; // e.g., "1,972,000.0"
      const deltaValue = delta.currentReading; // e.g., "1953.0M"
      
      // Convert raw to delta format
      const numericRaw = parseFloat(rawValue.replace(/,/g, ''));
      const convertedToMillions = (numericRaw / 1000).toFixed(1) + 'M';
      
      // Calculate conversion accuracy
      const deltaNumeric = parseFloat(deltaValue.replace('M', ''));
      const convertedNumeric = parseFloat(convertedToMillions.replace('M', ''));
      const accuracyPercentage = (1 - Math.abs(deltaNumeric - convertedNumeric) / deltaNumeric) * 100;
      
      return {
        status: 'success',
        originalRaw: rawValue,
        convertedRaw: convertedToMillions,
        deltaValue: deltaValue,
        accuracyPercentage: accuracyPercentage.toFixed(2) + '%',
        conversionViable: accuracyPercentage > 95 // 95% accuracy threshold
      };
    } catch (error) {
      return {
        status: 'conversion_failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Analyze temporal characteristics (would need historical data access)
   */
  private static analyzeTemporalCharacteristics(raw: any, delta: any) {
    return {
      assumption: 'Raw data contains more recent timestamps than delta-adjusted data',
      verification: 'Would require historical data analysis',
      recommendation: 'Implement temporal validation in merger service'
    };
  }
  
  /**
   * Assess overall data integrity
   */
  private static assessDataIntegrity(indicators: any[]) {
    const duplicateCount = indicators.filter(ind => 
      ind.seriesId === 'CCSA' || ind.seriesId === 'ICSA'
    ).length;
    
    return {
      duplicateSeriesCount: duplicateCount,
      integrityStatus: duplicateCount === 4 ? 'expected_duplicates' : 'unexpected_count',
      recommendation: duplicateCount === 4 ? 'proceed_with_merger' : 'investigate_data_source'
    };
  }
  
  /**
   * Generate validation summary and recommendations
   */
  static generateValidationSummary(validationResults: any) {
    logger.info('📊 Time Series Merger Validation Summary:');
    logger.info('CCSA Conversion:', validationResults.ccsaFormats?.formatDifference);
    logger.info('ICSA Conversion:', validationResults.icsaFormats?.formatDifference);
    logger.info('Conversion Test:', validationResults.conversionFeasibility);
    logger.info('Data Integrity:', validationResults.dataIntegrity);
    
    const recommendations = [];
    
    if (validationResults.conversionFeasibility?.conversionViable) {
      recommendations.push('✅ Format conversion is viable with high accuracy');
    } else {
      recommendations.push('⚠️ Format conversion needs refinement');
    }
    
    if (validationResults.dataIntegrity?.integrityStatus === 'expected_duplicates') {
      recommendations.push('✅ Data integrity is as expected');
    } else {
      recommendations.push('⚠️ Unexpected data structure detected');
    }
    
    logger.info('Recommendations:', recommendations);
    return recommendations;
  }
}