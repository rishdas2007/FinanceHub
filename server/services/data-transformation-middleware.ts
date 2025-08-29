/**
 * Data Transformation Middleware
 * 
 * Standardizes economic data transformations across the pipeline
 * Handles unit conversions, value scaling, and format standardization
 * 
 * @author Data Pipeline Standardization
 * @version 1.0.0
 * @since 2025-08-29
 */

import { logger } from '../../shared/utils/logger';

export interface EconomicDataPoint {
  seriesId: string;
  metric: string;
  value: number;
  unit: string;
  periodDate: Date;
  source?: string;
}

export interface TransformationResult {
  originalValue: number;
  transformedValue: number;
  originalUnit: string;
  standardizedUnit: string;
  transformationType: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface TransformationOptions {
  enforceUnitStandards?: boolean;
  normalizeValueScales?: boolean;
  validateTransformations?: boolean;
  logTransformations?: boolean;
}

export class DataTransformationMiddleware {
  private readonly UNIT_STANDARDS = new Map<string, string>([
    // Standardize all unit variations to lowercase canonical forms
    ['Thousands', 'thousands'],
    ['thousands', 'thousands'],
    ['Percent', 'percent'],
    ['percent', 'percent'],
    ['Index', 'index'],
    ['index', 'index'],
    ['Basis Points', 'basis_points'],
    ['basis_points', 'basis_points'],
    ['Dollars', 'dollars'],
    ['dollars', 'dollars']
  ]);

  private readonly VALUE_SCALE_PATTERNS = new Map<string, {
    expectedRange: [number, number];
    commonScales: string[];
    transformRule: (value: number) => { value: number; scale: string };
  }>([
    // Define expected patterns for different series
    ['ICSA', {
      expectedRange: [150, 500], // Expected range in thousands
      commonScales: ['raw_count', 'thousands'],
      transformRule: (value: number) => {
        if (value > 50000) return { value: Math.round(value / 1000), scale: 'raw_to_thousands' };
        return { value, scale: 'already_thousands' };
      }
    }],
    ['CCSA', {
      expectedRange: [1500, 2500], // Expected range in thousands  
      commonScales: ['raw_count', 'thousands'],
      transformRule: (value: number) => {
        if (value > 100000) return { value: Math.round(value / 1000), scale: 'raw_to_thousands' };
        return { value, scale: 'already_thousands' };
      }
    }],
    ['CPIAUCSL', {
      expectedRange: [1.5, 5.0], // Expected YoY percentage range
      commonScales: ['index_value', 'percentage'],
      transformRule: (value: number) => {
        if (value > 200) {
          // Likely index value, needs YoY calculation (not implemented here)
          return { value, scale: 'index_needs_yoy_calc' };
        }
        return { value, scale: 'already_percentage' };
      }
    }]
  ]);

  /**
   * Transform a batch of economic data points
   */
  async transformBatch(
    dataPoints: EconomicDataPoint[], 
    options: TransformationOptions = {}
  ): Promise<{ data: EconomicDataPoint[]; transformations: TransformationResult[] }> {
    logger.info(`🔄 [TRANSFORM BATCH] Processing ${dataPoints.length} data points`);
    
    const transformations: TransformationResult[] = [];
    const transformedData: EconomicDataPoint[] = [];
    
    for (const dataPoint of dataPoints) {
      const result = await this.transformSingle(dataPoint, options);
      transformations.push(result);
      
      // Apply transformation to data point
      const transformed: EconomicDataPoint = {
        ...dataPoint,
        value: result.transformedValue,
        unit: result.standardizedUnit
      };
      
      transformedData.push(transformed);
      
      if (options.logTransformations && result.transformationType !== 'none') {
        logger.info(`🔧 [TRANSFORM] ${dataPoint.seriesId}: ${result.originalValue} (${result.originalUnit}) → ${result.transformedValue} (${result.standardizedUnit}) [${result.transformationType}]`);
      }
    }
    
    const transformedCount = transformations.filter(t => t.transformationType !== 'none').length;
    logger.info(`✅ [TRANSFORM BATCH] Applied ${transformedCount} transformations to ${dataPoints.length} data points`);
    
    return { data: transformedData, transformations };
  }

  /**
   * Transform a single data point
   */
  private async transformSingle(
    dataPoint: EconomicDataPoint, 
    options: TransformationOptions
  ): Promise<TransformationResult> {
    const warnings: string[] = [];
    let transformedValue = dataPoint.value;
    let transformationType = 'none';
    let confidence: 'high' | 'medium' | 'low' = 'high';
    
    // Step 1: Standardize unit
    const standardizedUnit = this.standardizeUnit(dataPoint.unit);
    if (standardizedUnit !== dataPoint.unit) {
      transformationType = 'unit_standardization';
    }
    
    // Step 2: Apply value scale transformation if needed
    if (options.normalizeValueScales) {
      const scaleResult = this.normalizeValueScale(
        dataPoint.value, 
        dataPoint.seriesId, 
        dataPoint.metric,
        standardizedUnit
      );
      
      if (scaleResult.wasTransformed) {
        transformedValue = scaleResult.value;
        transformationType = scaleResult.transformationType;
        confidence = scaleResult.confidence;
        warnings.push(...scaleResult.warnings);
      }
    }
    
    // Step 3: Validate transformation
    if (options.validateTransformations) {
      const validationWarnings = this.validateTransformation(
        dataPoint.value, 
        transformedValue, 
        dataPoint.seriesId, 
        standardizedUnit
      );
      warnings.push(...validationWarnings);
      
      if (validationWarnings.length > 0) {
        confidence = 'low';
      }
    }
    
    return {
      originalValue: dataPoint.value,
      transformedValue,
      originalUnit: dataPoint.unit,
      standardizedUnit,
      transformationType,
      confidence,
      warnings
    };
  }

  /**
   * Standardize unit names to canonical form
   */
  private standardizeUnit(unit: string): string {
    return this.UNIT_STANDARDS.get(unit) || unit.toLowerCase();
  }

  /**
   * Normalize value scale based on series patterns
   */
  private normalizeValueScale(
    value: number, 
    seriesId: string, 
    metric: string,
    unit: string
  ): {
    value: number;
    wasTransformed: boolean;
    transformationType: string;
    confidence: 'high' | 'medium' | 'low';
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // Check if we have patterns for this series
    const pattern = this.VALUE_SCALE_PATTERNS.get(seriesId);
    if (!pattern) {
      return {
        value,
        wasTransformed: false,
        transformationType: 'none',
        confidence: 'high',
        warnings
      };
    }
    
    // Apply transformation rule
    const transformResult = pattern.transformRule(value);
    const wasTransformed = transformResult.value !== value;
    
    // Check if result is in expected range
    const [minExpected, maxExpected] = pattern.expectedRange;
    if (transformResult.value < minExpected || transformResult.value > maxExpected) {
      warnings.push(`Value ${transformResult.value} outside expected range [${minExpected}, ${maxExpected}] for ${seriesId}`);
    }
    
    return {
      value: transformResult.value,
      wasTransformed,
      transformationType: transformResult.scale,
      confidence: warnings.length > 0 ? 'medium' : 'high',
      warnings
    };
  }

  /**
   * Validate transformation results
   */
  private validateTransformation(
    originalValue: number, 
    transformedValue: number, 
    seriesId: string, 
    unit: string
  ): string[] {
    const warnings: string[] = [];
    
    // Check for suspicious transformations
    const transformationRatio = transformedValue / originalValue;
    
    // Flag very large changes (>100x or <0.01x)
    if (transformationRatio > 100 || transformationRatio < 0.01) {
      warnings.push(`Extreme transformation ratio: ${transformationRatio.toFixed(4)}x`);
    }
    
    // Check for unit consistency
    if (unit === 'thousands' && transformedValue > 10000) {
      warnings.push(`Value ${transformedValue} seems too large for unit 'thousands'`);
    }
    
    if (unit === 'percent' && transformedValue > 100) {
      warnings.push(`Value ${transformedValue} seems too large for unit 'percent'`);
    }
    
    return warnings;
  }

  /**
   * Generate standardized formatting rules
   */
  getFormattingRule(value: number, unit: string, seriesId: string): {
    formatted: string;
    rule: string;
  } {
    const standardUnit = this.standardizeUnit(unit);
    
    switch (standardUnit) {
      case 'thousands':
        if (seriesId === 'ICSA' || seriesId === 'CCSA') {
          return {
            formatted: Math.round(value) + 'K',
            rule: 'jobless_claims_thousands'
          };
        }
        return {
          formatted: value >= 1000 ? `${(value / 1000).toFixed(1)}M` : `${Math.round(value)}K`,
          rule: 'standard_thousands'
        };
        
      case 'percent':
        return {
          formatted: (value >= 0 ? '+' : '') + value.toFixed(1) + '%',
          rule: 'standard_percentage'
        };
        
      case 'index':
        return {
          formatted: value.toFixed(1),
          rule: 'index_value'
        };
        
      default:
        return {
          formatted: value.toLocaleString('en-US', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 2 
          }),
          rule: 'default_numeric'
        };
    }
  }

  /**
   * Get transformation statistics for monitoring
   */
  async getTransformationStats(): Promise<{
    totalTransformations: number;
    transformationTypes: Record<string, number>;
    warningCount: number;
    successRate: number;
  }> {
    // This would typically track statistics over time
    // For now, return placeholder stats
    return {
      totalTransformations: 0,
      transformationTypes: {},
      warningCount: 0,
      successRate: 1.0
    };
  }
}

// Export singleton instance
export const dataTransformationMiddleware = new DataTransformationMiddleware();