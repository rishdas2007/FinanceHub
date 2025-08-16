import { logger } from '../../shared/utils/logger';

export interface ValidationResult {
  isValid: boolean;
  expectedRange: [number, number];
  correctedValue?: number;
  issue?: string;
}

export class EconomicDataValidator {
  
  /**
   * Validate inflation indicators for reasonable YoY percentage ranges
   */
  validateInflationIndicator(seriesId: string, value: number): ValidationResult {
    // If CPI/PPI/PCE value > 50, it's likely raw index data that needs YoY transformation
    if (['CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'PPIACO', 'PPIFIS', 'PPIENG'].includes(seriesId)) {
      if (value > 50) {
        return {
          isValid: false,
          expectedRange: [-2, 15], // Reasonable YoY inflation range (-2% to 15%)
          issue: `Value ${value} is likely raw index level, not YoY percentage. Series needs YoY transformation.`
        };
      }
      
      // Even for processed values, check for extreme outliers
      if (Math.abs(value) > 25) {
        return {
          isValid: false,
          expectedRange: [-2, 15],
          issue: `Value ${value}% is outside reasonable inflation range. Check data source.`
        };
      }
    }
    
    return { 
      isValid: true, 
      expectedRange: [-2, 15] 
    };
  }
  
  /**
   * Validate employment/jobs indicators
   */
  validateEmploymentIndicator(seriesId: string, value: number): ValidationResult {
    // Employment counts should be reasonable
    if (['PAYEMS', 'ICSA', 'CCSA'].includes(seriesId)) {
      // Raw employment counts are in thousands - if we see small percentages, it's likely already YoY
      if (Math.abs(value) < 50 && Math.abs(value) > 0.1) {
        return {
          isValid: true,
          expectedRange: [-10, 20] // Employment YoY change range
        };
      }
      
      // Very large numbers indicate raw counts that need YoY calculation
      if (value > 1000) {
        return {
          isValid: false,
          expectedRange: [-10, 20],
          issue: `Value ${value} appears to be raw employment count, not YoY percentage`
        };
      }
    }
    
    return { 
      isValid: true, 
      expectedRange: [-10, 20] 
    };
  }
  
  /**
   * Validate interest rate indicators
   */
  validateRateIndicator(seriesId: string, value: number): ValidationResult {
    if (['UNRATE', 'FEDFUNDS', 'DGS10', 'MORTGAGE30US'].includes(seriesId)) {
      // Interest rates should be reasonable percentages (0-20%)
      if (value < 0 || value > 25) {
        return {
          isValid: false,
          expectedRange: [0, 20],
          issue: `Interest rate ${value}% is outside normal range`
        };
      }
    }
    
    return { 
      isValid: true, 
      expectedRange: [0, 20] 
    };
  }
  
  /**
   * Comprehensive validation for any economic indicator
   */
  validateIndicator(seriesId: string, value: number, metric?: string): ValidationResult {
    // Try series-specific validation first
    if (['CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'PPIACO', 'PPIFIS', 'PPIENG'].includes(seriesId)) {
      return this.validateInflationIndicator(seriesId, value);
    }
    
    if (['PAYEMS', 'ICSA', 'CCSA'].includes(seriesId)) {
      return this.validateEmploymentIndicator(seriesId, value);
    }
    
    if (['UNRATE', 'FEDFUNDS', 'DGS10', 'MORTGAGE30US'].includes(seriesId)) {
      return this.validateRateIndicator(seriesId, value);
    }
    
    // Fallback to metric-based validation
    if (metric) {
      const metricLower = metric.toLowerCase();
      
      if (metricLower.includes('cpi') || metricLower.includes('ppi') || metricLower.includes('pce')) {
        return this.validateInflationIndicator(seriesId, value);
      }
      
      if (metricLower.includes('payroll') || metricLower.includes('employment') || metricLower.includes('claims')) {
        return this.validateEmploymentIndicator(seriesId, value);
      }
      
      if (metricLower.includes('rate') || metricLower.includes('yield')) {
        return this.validateRateIndicator(seriesId, value);
      }
    }
    
    // Generic validation for unknown indicators
    return { 
      isValid: true, 
      expectedRange: [-100, 100] 
    };
  }
  
  /**
   * Batch validate multiple indicators and log issues
   */
  validateBatch(indicators: Array<{ seriesId: string; value: number; metric?: string }>): Array<ValidationResult> {
    const results: ValidationResult[] = [];
    let issueCount = 0;
    
    for (const indicator of indicators) {
      const result = this.validateIndicator(indicator.seriesId, indicator.value, indicator.metric);
      results.push(result);
      
      if (!result.isValid) {
        issueCount++;
        logger.warn(`Data validation issue for ${indicator.seriesId}: ${result.issue}`);
      }
    }
    
    logger.info(`✅ Validated ${indicators.length} economic indicators, found ${issueCount} issues`);
    return results;
  }
}

export const economicDataValidator = new EconomicDataValidator();