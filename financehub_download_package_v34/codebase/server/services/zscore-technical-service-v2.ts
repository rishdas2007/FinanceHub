/**
 * Enhanced Z-Score Technical Service with Data Quality-First Architecture
 * Implements data contracts validation and sufficiency gates
 */

import { ZScoreTechnicalService } from './zscore-technical-service';
import { DataSufficiencyGates, DataSufficiencyResult } from './data-quality/sufficiency-gates';
import { contractRegistry } from '../../shared/validation/contract-registry';
import { DataQualityError } from '../../shared/validation/data-contracts';
import { logger } from './logger';
import type { Database } from './db';

export interface ZScoreResult {
  symbol: string;
  compositeZ: number | null;
  components: {
    macdZ: number | null;
    rsi14: number | null;
    rsiZ: number | null;
    bbPctB: number | null;
    bbZ: number | null;
    maGapPct: number | null;
    maGapZ: number | null;
    mom5dZ: number | null;
  };
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  dataQuality: {
    sufficient: boolean;
    issues: string[];
    recommendation: 'PROCEED' | 'DEGRADE' | 'SKIP';
  };
  timestamp: Date;
}

export interface BatchZScoreResult {
  results: Map<string, ZScoreResult>;
  overallQuality: {
    totalSymbols: number;
    successfulCalculations: number;
    degradedCalculations: number;
    failedCalculations: number;
    averageConfidence: number;
  };
  processingTime: number;
}

export class ZScoreTechnicalServiceV2 extends ZScoreTechnicalService {
  private sufficiencyGates: DataSufficiencyGates;

  constructor(db: Database) {
    super(db);
    this.sufficiencyGates = new DataSufficiencyGates(db);
  }

  /**
   * Calculate composite Z-score with data quality validation
   */
  async calculateCompositeZScore(symbol: string, validateData: boolean = true): Promise<ZScoreResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`🧮 Starting quality-assured Z-score calculation for ${symbol}`);

      // Step 1: Data sufficiency gate
      let sufficiencyResult: DataSufficiencyResult;
      if (validateData) {
        sufficiencyResult = await this.sufficiencyGates.checkZScoreCalculationReadiness(symbol);
        
        if (sufficiencyResult.recommendation === 'SKIP') {
          return this.createFailedResult(symbol, sufficiencyResult, 'INSUFFICIENT_DATA');
        }
      } else {
        // Skip validation if explicitly disabled
        sufficiencyResult = {
          sufficient: true,
          missingComponents: [],
          confidence: 1.0,
          recommendation: 'PROCEED',
          details: {
            dataPoints: 0,
            requiredMinimum: 0,
            qualityScore: 1.0,
            lastUpdate: new Date(),
            staleness: 0
          }
        };
      }

      // Step 2: Fetch and validate technical indicators
      const rawData = await this.fetchTechnicalIndicators(symbol);
      
      if (validateData) {
        const validation = await contractRegistry.validateETFMetric(rawData);
        if (!validation.valid) {
          logger.error(`❌ Technical indicators validation failed for ${symbol}:`, validation.errors);
          throw new DataQualityError(
            `Technical indicators failed validation for ${symbol}`,
            validation.errors,
            validation.confidence
          );
        }
        logger.info(`✅ Data contract validation passed for ${symbol} (confidence: ${validation.confidence.toFixed(2)})`);
      }

      // Step 3: Proceed with Z-score calculation using parent class method
      const legacyResult = await super.calculateCompositeZScore(symbol);

      // Step 4: Create quality-enhanced result
      const result: ZScoreResult = {
        symbol,
        compositeZ: legacyResult.compositeZ,
        components: legacyResult.components,
        signal: legacyResult.signal,
        confidence: validateData ? 
          Math.min(sufficiencyResult.confidence, (await contractRegistry.validateETFMetric(rawData)).confidence) :
          1.0,
        dataQuality: {
          sufficient: sufficiencyResult.sufficient,
          issues: sufficiencyResult.missingComponents,
          recommendation: sufficiencyResult.recommendation
        },
        timestamp: new Date()
      };

      const processingTime = Date.now() - startTime;
      logger.info(`✅ Quality-assured Z-score calculated for ${symbol} in ${processingTime}ms (confidence: ${result.confidence.toFixed(2)})`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`❌ Quality-assured Z-score calculation failed for ${symbol} in ${processingTime}ms:`, error);

      if (error instanceof DataQualityError) {
        return this.createFailedResult(symbol, {
          sufficient: false,
          missingComponents: error.errors.map(e => e.message),
          confidence: error.confidence,
          recommendation: 'SKIP',
          details: {
            dataPoints: 0,
            requiredMinimum: 60,
            qualityScore: error.confidence,
            lastUpdate: null,
            staleness: 999
          }
        }, 'DATA_QUALITY_ERROR');
      }

      // Handle other errors with graceful degradation
      return this.createFailedResult(symbol, {
        sufficient: false,
        missingComponents: ['Calculation error'],
        confidence: 0,
        recommendation: 'SKIP',
        details: {
          dataPoints: 0,
          requiredMinimum: 60,
          qualityScore: 0,
          lastUpdate: null,
          staleness: 999
        }
      }, 'CALCULATION_ERROR');
    }
  }

  /**
   * Batch calculate Z-scores with quality validation
   */
  async calculateBatchZScores(
    symbols: string[], 
    validateData: boolean = true,
    failFast: boolean = false
  ): Promise<BatchZScoreResult> {
    const startTime = Date.now();
    const results = new Map<string, ZScoreResult>();
    
    logger.info(`🔄 Starting batch Z-score calculation for ${symbols.length} symbols (validation: ${validateData}, failFast: ${failFast})`);

    // Step 1: Batch sufficiency check if validation enabled
    let sufficiencyResults: Map<string, DataSufficiencyResult> = new Map();
    if (validateData) {
      sufficiencyResults = await this.sufficiencyGates.batchCheckZScoreReadiness(symbols);
      
      const insufficientSymbols = Array.from(sufficiencyResults.entries())
        .filter(([_, result]) => result.recommendation === 'SKIP')
        .map(([symbol, _]) => symbol);

      if (failFast && insufficientSymbols.length > 0) {
        logger.error(`❌ Batch calculation aborted: ${insufficientSymbols.length} symbols insufficient`);
        const processingTime = Date.now() - startTime;
        return this.createBatchFailedResult(symbols, processingTime, 'INSUFFICIENT_DATA_BATCH');
      }
    }

    // Step 2: Process symbols (with controlled concurrency)
    const concurrencyLimit = 5; // Process 5 symbols at a time
    const symbolBatches = this.chunkArray(symbols, concurrencyLimit);
    
    for (const batch of symbolBatches) {
      const batchPromises = batch.map(async (symbol) => {
        try {
          const result = await this.calculateCompositeZScore(symbol, validateData);
          return { symbol, result };
        } catch (error) {
          logger.error(`❌ Batch calculation failed for ${symbol}:`, error);
          const sufficiency = sufficiencyResults.get(symbol) || this.createDefaultSufficiencyResult();
          return {
            symbol,
            result: this.createFailedResult(symbol, sufficiency, 'BATCH_CALCULATION_ERROR')
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((promiseResult, index) => {
        const symbol = batch[index];
        if (promiseResult.status === 'fulfilled') {
          results.set(symbol, promiseResult.value.result);
        } else {
          const sufficiency = sufficiencyResults.get(symbol) || this.createDefaultSufficiencyResult();
          results.set(symbol, this.createFailedResult(symbol, sufficiency, 'PROMISE_REJECTION'));
        }
      });

      // Fail fast check after each batch
      if (failFast) {
        const failures = Array.from(results.values()).filter(r => !r.dataQuality.sufficient).length;
        if (failures > symbols.length * 0.3) { // Fail if more than 30% failed
          logger.error(`❌ Batch calculation aborted: ${failures} failures exceeded threshold`);
          break;
        }
      }
    }

    const processingTime = Date.now() - startTime;

    // Step 3: Calculate overall quality metrics
    const overallQuality = this.calculateBatchQualityMetrics(results);

    logger.info(`✅ Batch Z-score calculation completed in ${processingTime}ms: ${overallQuality.successfulCalculations}/${overallQuality.totalSymbols} successful`);

    return {
      results,
      overallQuality,
      processingTime
    };
  }

  /**
   * Handle insufficient data with graceful degradation
   */
  private async handleInsufficientData(
    symbol: string, 
    sufficiency: DataSufficiencyResult
  ): Promise<ZScoreResult> {
    logger.warn(`⚠️ Handling insufficient data for ${symbol}: ${sufficiency.missingComponents.join(', ')}`);

    // Attempt fallback calculation with available data
    try {
      const fallbackResult = await this.calculateFallbackZScore(symbol);
      return {
        ...fallbackResult,
        confidence: Math.min(sufficiency.confidence, 0.5), // Cap confidence for fallback
        dataQuality: {
          sufficient: false,
          issues: sufficiency.missingComponents,
          recommendation: 'DEGRADE'
        }
      };
    } catch (error) {
      return this.createFailedResult(symbol, sufficiency, 'FALLBACK_FAILED');
    }
  }

  /**
   * Fallback Z-score calculation with minimal data requirements
   */
  private async calculateFallbackZScore(symbol: string): Promise<ZScoreResult> {
    // Simplified calculation with available data only
    // This is a basic implementation - you would enhance based on your specific needs
    logger.info(`📉 Attempting fallback Z-score calculation for ${symbol}`);

    const result: ZScoreResult = {
      symbol,
      compositeZ: null,
      components: {
        macdZ: null,
        rsi14: null,
        rsiZ: null,
        bbPctB: null,
        bbZ: null,
        maGapPct: null,
        maGapZ: null,
        mom5dZ: null
      },
      signal: 'HOLD',
      confidence: 0.3,
      dataQuality: {
        sufficient: false,
        issues: ['Using fallback calculation'],
        recommendation: 'DEGRADE'
      },
      timestamp: new Date()
    };

    return result;
  }

  /**
   * Create failed result with proper error handling
   */
  private createFailedResult(
    symbol: string, 
    sufficiency: DataSufficiencyResult, 
    errorType: string
  ): ZScoreResult {
    return {
      symbol,
      compositeZ: null,
      components: {
        macdZ: null,
        rsi14: null,
        rsiZ: null,
        bbPctB: null,
        bbZ: null,
        maGapPct: null,
        maGapZ: null,
        mom5dZ: null
      },
      signal: 'HOLD',
      confidence: sufficiency.confidence,
      dataQuality: {
        sufficient: false,
        issues: [`${errorType}: ${sufficiency.missingComponents.join(', ')}`],
        recommendation: sufficiency.recommendation
      },
      timestamp: new Date()
    };
  }

  /**
   * Create batch failed result
   */
  private createBatchFailedResult(
    symbols: string[], 
    processingTime: number, 
    errorType: string
  ): BatchZScoreResult {
    const results = new Map<string, ZScoreResult>();
    
    symbols.forEach(symbol => {
      results.set(symbol, this.createFailedResult(symbol, this.createDefaultSufficiencyResult(), errorType));
    });

    return {
      results,
      overallQuality: {
        totalSymbols: symbols.length,
        successfulCalculations: 0,
        degradedCalculations: 0,
        failedCalculations: symbols.length,
        averageConfidence: 0
      },
      processingTime
    };
  }

  /**
   * Calculate batch quality metrics
   */
  private calculateBatchQualityMetrics(results: Map<string, ZScoreResult>) {
    const values = Array.from(results.values());
    const totalSymbols = values.length;
    const successfulCalculations = values.filter(r => r.dataQuality.sufficient && r.compositeZ !== null).length;
    const degradedCalculations = values.filter(r => r.dataQuality.recommendation === 'DEGRADE').length;
    const failedCalculations = values.filter(r => r.dataQuality.recommendation === 'SKIP').length;
    const averageConfidence = values.reduce((sum, r) => sum + r.confidence, 0) / totalSymbols;

    return {
      totalSymbols,
      successfulCalculations,
      degradedCalculations,
      failedCalculations,
      averageConfidence
    };
  }

  /**
   * Helper methods
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private createDefaultSufficiencyResult(): DataSufficiencyResult {
    return {
      sufficient: false,
      missingComponents: ['Unknown data issues'],
      confidence: 0,
      recommendation: 'SKIP',
      details: {
        dataPoints: 0,
        requiredMinimum: 60,
        qualityScore: 0,
        lastUpdate: null,
        staleness: 999
      }
    };
  }

  /**
   * Abstract method to be implemented - fetch technical indicators
   * This should be implemented based on your existing data fetching logic
   */
  private async fetchTechnicalIndicators(symbol: string): Promise<any> {
    // This is a placeholder - implement based on your existing ETF data structure
    // You'll need to adapt this to return data compatible with ETF_METRICS_CONTRACT
    throw new Error('fetchTechnicalIndicators must be implemented');
  }
}