import { logger } from '../../shared/utils/logger';

/**
 * Gold Standard Data Quality Validator
 * Implements comprehensive data validation following best practices
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanedValue?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface DataQualityMetrics {
  totalRecords: number;
  validRecords: number;
  errorRate: number;
  outlierCount: number;
  missingValueCount: number;
}

export class DataQualityValidator {
  
  /**
   * Schema validation - ensure data conforms to expected types and structures
   */
  validateSchema(data: any, seriesId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!data.date || !data.value) {
      errors.push(`Missing required fields for ${seriesId}`);
      return { isValid: false, errors, warnings, confidence: 'low' };
    }
    
    // Validate date format
    const dateValue = new Date(data.date);
    if (isNaN(dateValue.getTime())) {
      errors.push(`Invalid date format: ${data.date}`);
    }
    
    // Validate numeric value
    const numericValue = parseFloat(data.value);
    if (isNaN(numericValue)) {
      errors.push(`Non-numeric value: ${data.value}`);
      return { isValid: false, errors, warnings, confidence: 'low' };
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cleanedValue: numericValue,
      confidence: warnings.length === 0 ? 'high' : 'medium'
    };
  }
  
  /**
   * Economic data quality checks - detect anomalies and outliers
   */
  validateEconomicData(value: number, seriesId: string, historicalValues: number[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Calculate statistical bounds
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Check for extreme outliers (beyond 3 standard deviations)
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore > 3) {
      warnings.push(`Extreme outlier detected for ${seriesId}: z-score = ${zScore.toFixed(2)}`);
    }
    
    // Economic-specific validations
    const economicValidation = this.validateEconomicBounds(value, seriesId);
    errors.push(...economicValidation.errors);
    warnings.push(...economicValidation.warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cleanedValue: value,
      confidence: errors.length === 0 && warnings.length === 0 ? 'high' : 
                  errors.length === 0 ? 'medium' : 'low'
    };
  }
  
  /**
   * Economic bounds validation - flag impossible values
   */
  private validateEconomicBounds(value: number, seriesId: string): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    switch (seriesId) {
      case 'UNRATE': // Unemployment Rate
        if (value < 0 || value > 100) {
          errors.push(`Invalid unemployment rate: ${value}% (must be 0-100%)`);
        }
        if (value > 25) {
          warnings.push(`Unusually high unemployment rate: ${value}%`);
        }
        break;
        
      case 'PAYEMS': // Nonfarm Payrolls (thousands)
        if (value < 0) {
          errors.push(`Negative employment impossible: ${value}K`);
        }
        if (value > 200000) {
          warnings.push(`Unusually high payroll number: ${value}K`);
        }
        break;
        
      case 'HOUST': // Housing Starts (thousands)
        if (value < 0) {
          errors.push(`Negative housing starts impossible: ${value}K`);
        }
        break;
        
      case 'CPIAUCSL': // CPI (index)
        if (value < 0) {
          errors.push(`Negative CPI impossible: ${value}`);
        }
        break;
    }
    
    return { errors, warnings };
  }
  
  /**
   * Missing value handling strategy
   */
  handleMissingValue(seriesId: string, previousValues: number[]): number | null {
    if (previousValues.length === 0) {
      logger.warn(`No historical data for imputation: ${seriesId}`);
      return null;
    }
    
    // For economic data, use simple forward-fill for most recent value
    // More sophisticated imputation can be added based on series characteristics
    const lastValue = previousValues[previousValues.length - 1];
    
    logger.info(`Imputed missing value for ${seriesId}: ${lastValue} (forward-fill)`);
    return lastValue;
  }
  
  /**
   * Generate data quality metrics report
   */
  generateQualityReport(validationResults: ValidationResult[]): DataQualityMetrics {
    const totalRecords = validationResults.length;
    const validRecords = validationResults.filter(r => r.isValid).length;
    const errorRate = ((totalRecords - validRecords) / totalRecords) * 100;
    const outlierCount = validationResults.filter(r => 
      r.warnings.some(w => w.includes('outlier'))
    ).length;
    const missingValueCount = validationResults.filter(r => 
      r.errors.some(e => e.includes('Missing'))
    ).length;
    
    return {
      totalRecords,
      validRecords,
      errorRate: Math.round(errorRate * 100) / 100,
      outlierCount,
      missingValueCount
    };
  }
}

export const dataQualityValidator = new DataQualityValidator();