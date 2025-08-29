import { z } from 'zod';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { historicalTechnicalIndicators } from '../../shared/schema';
import logger from '../utils/logger';

// Statistical fallback parameters
export const DEFAULT_FALLBACKS = {
  rsi: { mean: 50, stddev: 15 },
  macd: { mean: 0, stddev: 1.03 },
  percentB: { mean: 0.5, stddev: 0.25 }
} as const;

export interface ZScoreResult {
  zScore: number | null;
  fallbackUsed: boolean;
  fallbackReason?: string;
  extremeValue: boolean;
  corruptionDetected: boolean;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface MACDData {
  value: number;
  date: Date;
  ema12?: number;
  ema26?: number;
}

export interface HistoricalDataOptions {
  deduplicated?: boolean;
  period?: number;
  fallback?: boolean;
  minDataPoints?: number;
}

/**
 * Unified Historical Data Service
 * Consolidates all historical data operations with configurable deduplication
 * and statistical analysis capabilities.
 */
export class UnifiedHistoricalDataService {
  constructor(
    private useDeduplication: boolean = true,
    private fallbackParams = DEFAULT_FALLBACKS
  ) {}

  /**
   * Get historical MACD values with unified logic
   */
  async getHistoricalMACD(
    symbol: string, 
    options: HistoricalDataOptions = {}
  ): Promise<MACDData[]> {
    const {
      deduplicated = this.useDeduplication,
      period = 90,
      minDataPoints = 10
    } = options;

    try {
      let query = db
        .select({
          value: historicalTechnicalIndicators.macd,
          date: historicalTechnicalIndicators.date,
          ema12: sql`NULL`,
          ema26: sql`NULL`
        })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`${historicalTechnicalIndicators.macd} IS NOT NULL`
          )
        )
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(period);

      // Apply deduplication if requested
      if (deduplicated) {
        query = db
          .selectDistinctOn([sql`DATE(${historicalTechnicalIndicators.date})`], {
            value: historicalTechnicalIndicators.macd,
            date: historicalTechnicalIndicators.date,
            ema12: sql`NULL`,
            ema26: sql`NULL`
          })
          .from(historicalTechnicalIndicators)
          .where(
            and(
              eq(historicalTechnicalIndicators.symbol, symbol),
              sql`${historicalTechnicalIndicators.macd} IS NOT NULL`
            )
          )
          .orderBy(
            sql`DATE(${historicalTechnicalIndicators.date}) DESC`,
            desc(historicalTechnicalIndicators.date)
          )
          .limit(period);
      }

      const results = await query;
      
      return results
        .filter(r => r.value !== null)
        .map(r => ({
          value: Number(r.value),
          date: r.date,
          ema12: r.ema12 ? Number(r.ema12) : undefined,
          ema26: r.ema26 ? Number(r.ema26) : undefined
        }));

    } catch (error) {
      logger.error(`Error fetching historical MACD for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get historical RSI values
   */
  async getHistoricalRSI(
    symbol: string, 
    options: HistoricalDataOptions = {}
  ): Promise<number[]> {
    const {
      deduplicated = this.useDeduplication,
      period = 90
    } = options;

    try {
      let query = db
        .select({ value: historicalTechnicalIndicators.rsi })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`${historicalTechnicalIndicators.rsi} IS NOT NULL`
          )
        )
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(period);

      if (deduplicated) {
        query = db
          .selectDistinctOn([sql`DATE(${historicalTechnicalIndicators.date})`], {
            value: historicalTechnicalIndicators.rsi
          })
          .from(historicalTechnicalIndicators)
          .where(
            and(
              eq(historicalTechnicalIndicators.symbol, symbol),
              sql`${historicalTechnicalIndicators.rsi} IS NOT NULL`
            )
          )
          .orderBy(
            sql`DATE(${historicalTechnicalIndicators.date}) DESC`,
            desc(historicalTechnicalIndicators.date)
          )
          .limit(period);
      }

      const results = await query;
      return results
        .filter(r => r.value !== null)
        .map(r => Number(r.value));

    } catch (error) {
      logger.error(`Error fetching historical RSI for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get historical Bollinger %B values
   */
  async getHistoricalPercentB(
    symbol: string, 
    options: HistoricalDataOptions = {}
  ): Promise<number[]> {
    const {
      deduplicated = this.useDeduplication,
      period = 90
    } = options;

    try {
      let query = db
        .select({ value: historicalTechnicalIndicators.bollingerPercentB })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`${historicalTechnicalIndicators.bollingerPercentB} IS NOT NULL`
          )
        )
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(period);

      if (deduplicated) {
        query = db
          .selectDistinctOn([sql`DATE(${historicalTechnicalIndicators.date})`], {
            value: historicalTechnicalIndicators.bollingerPercentB
          })
          .from(historicalTechnicalIndicators)
          .where(
            and(
              eq(historicalTechnicalIndicators.symbol, symbol),
              sql`${historicalTechnicalIndicators.bollingerPercentB} IS NOT NULL`,
              sql`${historicalTechnicalIndicators.bollingerPercentB} >= 0`,
              sql`${historicalTechnicalIndicators.bollingerPercentB} <= 1`
            )
          )
          .orderBy(
            sql`DATE(${historicalTechnicalIndicators.date}) DESC`,
            desc(historicalTechnicalIndicators.date)
          )
          .limit(period);
      }

      const results = await query;
      return results
        .filter(r => r.value !== null && Number(r.value) >= 0 && Number(r.value) <= 1)
        .map(r => Number(r.value));

    } catch (error) {
      logger.error(`Error fetching historical %B for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate Z-Score with comprehensive validation and fallback handling
   */
  async calculateZScoreWithFallback(
    symbol: string,
    currentValue: number,
    indicator: 'rsi' | 'macd' | 'percent_b',
    options: HistoricalDataOptions = {}
  ): Promise<ZScoreResult> {
    const { minDataPoints = 10 } = options;
    
    let historicalValues: number[] = [];
    
    // Get historical data based on indicator type
    switch (indicator) {
      case 'rsi':
        historicalValues = await this.getHistoricalRSI(symbol, options);
        break;
      case 'macd':
        const macdData = await this.getHistoricalMACD(symbol, options);
        historicalValues = macdData.map(d => d.value);
        break;
      case 'percent_b':
        historicalValues = await this.getHistoricalPercentB(symbol, options);
        break;
    }

    // Validate data quality
    const validationResult = this.validateHistoricalData(historicalValues, currentValue);
    
    if (validationResult.corruptionDetected || historicalValues.length < minDataPoints) {
      return this.calculateFallbackZScore(symbol, currentValue, indicator, {
        dataPoints: historicalValues.length,
        reason: validationResult.corruptionDetected ? 'corruption_detected' : 'insufficient_data'
      });
    }

    // Calculate z-score from historical data
    const zScore = this.calculateZScore(currentValue, historicalValues);
    
    return {
      zScore,
      fallbackUsed: false,
      extremeValue: Math.abs(zScore) > 3,
      corruptionDetected: false,
      dataPoints: historicalValues.length,
      confidence: this.getConfidenceLevel(historicalValues.length, Math.abs(zScore))
    };
  }

  /**
   * Validate historical data for corruption patterns
   */
  private validateHistoricalData(values: number[], currentValue: number) {
    if (values.length === 0) {
      return { corruptionDetected: false, reason: 'no_data' };
    }

    // Check for identical values (corruption pattern)
    const uniqueValues = new Set(values);
    if (uniqueValues.size === 1 && values.length > 5) {
      return { corruptionDetected: true, reason: 'identical_values' };
    }

    // Check for unrealistic variance
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    
    if (variance < 0.001 && values.length > 10) {
      return { corruptionDetected: true, reason: 'no_variance' };
    }

    return { corruptionDetected: false };
  }

  /**
   * Calculate standard z-score
   */
  private calculateZScore(value: number, historicalValues: number[]): number {
    if (historicalValues.length < 2) return 0;

    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (historicalValues.length - 1);
    const stddev = Math.sqrt(variance);

    if (stddev === 0) return 0;
    return (value - mean) / stddev;
  }

  /**
   * Calculate fallback z-score using market-realistic parameters
   */
  private calculateFallbackZScore(
    symbol: string,
    currentValue: number,
    indicator: 'rsi' | 'macd' | 'percent_b',
    context: { dataPoints: number; reason: string }
  ): ZScoreResult {
    const fallback = this.fallbackParams[indicator === 'percent_b' ? 'percentB' : indicator];
    const zScore = (currentValue - fallback.mean) / fallback.stddev;

    logger.warn(`⚠️ Using ${indicator.toUpperCase()} fallback for ${symbol}: mean=${fallback.mean}, stddev=${fallback.stddev}, Z=${zScore.toFixed(4)}`);

    return {
      zScore: Math.max(-5, Math.min(5, zScore)), // Cap extreme values
      fallbackUsed: true,
      fallbackReason: context.reason,
      extremeValue: Math.abs(zScore) > 2,
      corruptionDetected: context.reason === 'corruption_detected',
      dataPoints: context.dataPoints,
      confidence: 'low'
    };
  }

  /**
   * Determine confidence level based on data quality
   */
  private getConfidenceLevel(dataPoints: number, absZScore: number): 'high' | 'medium' | 'low' {
    if (dataPoints >= 30 && absZScore <= 3) return 'high';
    if (dataPoints >= 15 && absZScore <= 4) return 'medium';
    return 'low';
  }

  /**
   * Get realistic fallback parameters for symbol
   */
  getRealisticMACDFallback(symbol: string): number[] {
    // Market-realistic MACD values based on symbol characteristics
    const baseValues = symbol === 'SPY' ? 
      [0.5, 0.8, 1.2, 0.9, 0.3, -0.2, 0.1, 0.7, 1.1, 0.6] :
      [0.3, 0.6, 0.9, 0.4, 0.1, -0.1, 0.2, 0.5, 0.8, 0.4];
    
    return baseValues;
  }

  getRealisticRSIFallback(): number[] {
    return [45, 52, 58, 49, 46, 53, 51, 48, 55, 47]; // Realistic RSI range
  }

  getRealisticBBFallback(): number[] {
    return [0.4, 0.6, 0.7, 0.5, 0.3, 0.8, 0.6, 0.4, 0.9, 0.5]; // Realistic %B range
  }
}

// Export singleton instance
export const unifiedHistoricalDataService = new UnifiedHistoricalDataService();