import { DataContractValidator } from '../../../shared/validation/data-contracts';
import { ETF_METRICS_CONTRACT, ETFMetric } from '../../../shared/validation/etf-contracts';
import { DataSufficiencyGates, DataSufficiencyResult } from './sufficiency-gates';
import { logger } from '../../utils/logger';

export interface ZScoreValidationResult {
  valid: boolean;
  confidence: number;
  recommendation: 'PROCEED' | 'DEGRADE' | 'SKIP';
  errors: string[];
  warnings: string[];
  sufficiency: DataSufficiencyResult;
  contractValidation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    metrics: Record<string, boolean>;
  };
}

/**
 * Enhanced Z-Score Service with Data Quality Validation
 * Integrates data contracts and sufficiency gates for reliable calculations
 */
export class ZScoreDataQualityValidator {
  private sufficiencyGates: DataSufficiencyGates;
  private contractValidator: DataContractValidator;

  constructor() {
    this.sufficiencyGates = new DataSufficiencyGates();
    this.contractValidator = new DataContractValidator();
  }

  /**
   * Validate data quality before Z-score calculation
   */
  async validateForZScoreCalculation(symbol: string, etfData?: ETFMetric): Promise<ZScoreValidationResult> {
    try {
      logger.info(`🔍 Starting Z-score data quality validation for ${symbol}`);

      const errors: string[] = [];
      const warnings: string[] = [];

      // Step 1: Check data sufficiency
      const sufficiency = await this.sufficiencyGates.checkZScoreCalculationReadiness(symbol);
      
      if (!sufficiency.sufficient) {
        errors.push(`Insufficient data for Z-score calculation: ${sufficiency.missingComponents.join(', ')}`);
      }

      if (sufficiency.confidence < 0.7) {
        warnings.push(`Low data confidence (${sufficiency.confidence.toFixed(2)}) for Z-score calculation`);
      }

      // Step 2: Validate ETF data contract if data is provided
      let contractValidation;
      if (etfData) {
        contractValidation = await this.contractValidator.validate(etfData, ETF_METRICS_CONTRACT);
        
        if (!contractValidation.valid) {
          errors.push(...contractValidation.errors.map(err => 
            `Contract validation error: ${err.field} - ${err.message}`
          ));
        }

        if (contractValidation.warnings.length > 0) {
          warnings.push(...contractValidation.warnings.map(warn => 
            `Contract validation warning: ${warn.field} - ${warn.message}`
          ));
        }
      }

      // Step 3: Additional business logic validation
      const businessValidation = this.validateBusinessLogic(symbol, etfData);
      errors.push(...businessValidation.errors);
      warnings.push(...businessValidation.warnings);

      // Step 4: Determine overall validation result
      const overallConfidence = this.calculateOverallConfidence(
        sufficiency.confidence,
        contractValidation?.confidence || 1.0,
        businessValidation.confidence
      );

      const valid = errors.length === 0 && sufficiency.sufficient;
      const recommendation = this.determineRecommendation(valid, overallConfidence, errors.length, warnings.length);

      const result: ZScoreValidationResult = {
        valid,
        confidence: overallConfidence,
        recommendation,
        errors,
        warnings,
        sufficiency,
        contractValidation
      };

      logger.info(`📊 Z-score validation complete for ${symbol}:`, {
        valid: result.valid,
        confidence: result.confidence,
        recommendation: result.recommendation,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });

      return result;

    } catch (error) {
      logger.error(`❌ Error in Z-score data quality validation for ${symbol}:`, error);
      return {
        valid: false,
        confidence: 0,
        recommendation: 'SKIP',
        errors: [`Validation error: ${error}`],
        warnings: [],
        sufficiency: {
          sufficient: false,
          missingComponents: ['validation-error'],
          confidence: 0,
          recommendation: 'SKIP',
          metadata: {
            historicalDataPoints: 0,
            technicalIndicatorsAvailable: 0,
            lastDataUpdate: null,
            dataQualityScore: 0
          }
        }
      };
    }
  }

  /**
   * Validate ETF metrics array for dashboard display
   */
  async validateETFMetricsArray(etfMetrics: ETFMetric[]): Promise<ZScoreValidationResult> {
    try {
      logger.info(`🔍 Validating ETF metrics array (${etfMetrics.length} items)`);

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate each ETF metric individually
      const individualValidations = await Promise.all(
        etfMetrics.map(async (etf) => {
          const validation = await this.validateForZScoreCalculation(etf.symbol, etf);
          return { symbol: etf.symbol, validation };
        })
      );

      // Aggregate results
      let totalConfidence = 0;
      let validCount = 0;

      for (const { symbol, validation } of individualValidations) {
        totalConfidence += validation.confidence;
        if (validation.valid) validCount++;

        if (validation.errors.length > 0) {
          errors.push(`${symbol}: ${validation.errors.join(', ')}`);
        }

        if (validation.warnings.length > 0) {
          warnings.push(`${symbol}: ${validation.warnings.join(', ')}`);
        }
      }

      const averageConfidence = etfMetrics.length > 0 ? totalConfidence / etfMetrics.length : 0;
      const validPercentage = etfMetrics.length > 0 ? validCount / etfMetrics.length : 0;

      // Array-level validations
      if (etfMetrics.length < 8) {
        warnings.push(`ETF coverage below recommended minimum (${etfMetrics.length}/12 major sector ETFs)`);
      }

      const majorETFs = ['SPY', 'XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLY', 'XLP', 'XLU', 'XLB', 'XLC', 'XLRE'];
      const presentSymbols = etfMetrics.map(etf => etf.symbol);
      const missingMajor = majorETFs.filter(symbol => !presentSymbols.includes(symbol));
      
      if (missingMajor.length > 0) {
        warnings.push(`Missing major ETFs: ${missingMajor.join(', ')}`);
      }

      const valid = errors.length === 0 && validPercentage >= 0.75; // At least 75% valid
      const recommendation = this.determineRecommendation(valid, averageConfidence, errors.length, warnings.length);

      const result: ZScoreValidationResult = {
        valid,
        confidence: averageConfidence,
        recommendation,
        errors,
        warnings,
        sufficiency: {
          sufficient: validPercentage >= 0.75,
          missingComponents: missingMajor,
          confidence: averageConfidence,
          recommendation,
          metadata: {
            historicalDataPoints: etfMetrics.length,
            technicalIndicatorsAvailable: validCount,
            lastDataUpdate: new Date().toISOString(),
            dataQualityScore: averageConfidence
          }
        }
      };

      logger.info(`📊 ETF metrics array validation complete:`, {
        totalItems: etfMetrics.length,
        validItems: validCount,
        validPercentage: validPercentage.toFixed(2),
        confidence: averageConfidence.toFixed(2),
        recommendation
      });

      return result;

    } catch (error) {
      logger.error(`❌ Error validating ETF metrics array:`, error);
      return {
        valid: false,
        confidence: 0,
        recommendation: 'SKIP',
        errors: [`Array validation error: ${error}`],
        warnings: [],
        sufficiency: {
          sufficient: false,
          missingComponents: ['array-validation-error'],
          confidence: 0,
          recommendation: 'SKIP',
          metadata: {
            historicalDataPoints: 0,
            technicalIndicatorsAvailable: 0,
            lastDataUpdate: null,
            dataQualityScore: 0
          }
        }
      };
    }
  }

  private validateBusinessLogic(symbol: string, etfData?: ETFMetric): {
    errors: string[];
    warnings: string[];
    confidence: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    if (!etfData) {
      return { errors, warnings, confidence: 0.8 }; // No data to validate, but not an error
    }

    // Business logic validations
    
    // 1. Z-score reasonableness
    if (etfData.compositeZ !== null && Math.abs(etfData.compositeZ) > 4) {
      warnings.push(`Extreme composite Z-score (${etfData.compositeZ}) - potential outlier`);
      confidence -= 0.1;
    }

    // 2. Signal consistency
    if (etfData.compositeZ !== null && etfData.signal) {
      const zscore = etfData.compositeZ;
      const signal = etfData.signal;

      if ((zscore > 1.5 && signal !== 'SELL') || 
          (zscore < -1.5 && signal !== 'BUY') || 
          (Math.abs(zscore) <= 1.0 && signal !== 'HOLD')) {
        warnings.push(`Signal (${signal}) inconsistent with Z-score (${zscore})`);
        confidence -= 0.15;
      }
    }

    // 3. Component availability
    const components = etfData.components;
    const availableComponents = [
      components.macdZ,
      components.rsiZ,
      components.bbZ,
      components.maGapZ,
      components.mom5dZ
    ].filter(c => c !== null && !isNaN(c as number));

    if (availableComponents.length < 2) {
      errors.push(`Insufficient technical components (${availableComponents.length}/5) for reliable Z-score`);
      confidence -= 0.3;
    } else if (availableComponents.length < 3) {
      warnings.push(`Limited technical components (${availableComponents.length}/5) - reduced reliability`);
      confidence -= 0.15;
    }

    // 4. Price reasonableness
    if (etfData.price < 1 || etfData.price > 1000) {
      warnings.push(`Unusual ETF price: $${etfData.price}`);
      confidence -= 0.05;
    }

    // 5. RSI bounds check
    if (etfData.components.rsi14 !== null && 
        (etfData.components.rsi14 < 0 || etfData.components.rsi14 > 100)) {
      errors.push(`RSI value (${etfData.components.rsi14}) outside valid range (0-100)`);
      confidence -= 0.2;
    }

    return {
      errors,
      warnings,
      confidence: Math.max(0, confidence)
    };
  }

  private calculateOverallConfidence(...confidences: number[]): number {
    if (confidences.length === 0) return 0;
    
    const validConfidences = confidences.filter(c => !isNaN(c) && c >= 0);
    if (validConfidences.length === 0) return 0;

    // Weighted average with emphasis on the lowest confidence
    const average = validConfidences.reduce((sum, c) => sum + c, 0) / validConfidences.length;
    const minimum = Math.min(...validConfidences);
    
    // Weight: 70% average, 30% minimum (to ensure we catch low confidence components)
    return Math.max(0, Math.min(1, average * 0.7 + minimum * 0.3));
  }

  private determineRecommendation(
    valid: boolean, 
    confidence: number, 
    errorCount: number, 
    warningCount: number
  ): 'PROCEED' | 'DEGRADE' | 'SKIP' {
    if (!valid || errorCount > 0) {
      return 'SKIP';
    }

    if (confidence >= 0.8 && warningCount <= 2) {
      return 'PROCEED';
    } else if (confidence >= 0.6 && warningCount <= 5) {
      return 'DEGRADE';
    } else {
      return 'SKIP';
    }
  }
}