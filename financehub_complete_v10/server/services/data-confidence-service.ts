import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cacheService } from './cache-unified';

export interface DataConfidence {
  indicator: string;
  confidenceScore: number;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  lastUpdated: Date;
  dataFreshness: number; // hours since last update
  sourcesCount: number;
  validationsPassed: number;
  totalValidations: number;
  anomalyScore: number;
  reliabilityIndex: number;
}

export interface HistoricalContext {
  indicator: string;
  currentValue: number;
  historicalPercentile: number;
  twelveMonthAverage: number;
  volatilityMeasure: number;
  trenDirection: 'UPWARD' | 'DOWNWARD' | 'SIDEWAYS';
  cyclicalPosition: 'PEAK' | 'TROUGH' | 'EXPANSION' | 'CONTRACTION';
  seasonalAdjustment: number;
  contextualRanking: 'EXTREMELY_HIGH' | 'HIGH' | 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE' | 'LOW' | 'EXTREMELY_LOW';
}

export class DataConfidenceService {
  private cache = cacheService;
  
  private readonly CONFIDENCE_WEIGHTS = {
    dataFreshness: 0.25,
    sourceReliability: 0.20,
    validationScore: 0.20,
    anomalyScore: 0.15,
    historicalConsistency: 0.20
  };

  async calculateDataConfidence(indicators: string[]): Promise<DataConfidence[]> {
    const cacheKey = `data-confidence-${indicators.join('-')}`;
    const cached = this.cache.get<DataConfidence[]>(cacheKey);
    if (cached) return cached;

    logger.info(`📊 Calculating data confidence for ${indicators.length} indicators`);
    
    const confidenceScores: DataConfidence[] = [];

    for (const indicator of indicators) {
      try {
        // Get latest data point
        const latestDataResult = await db.execute(sql`
          SELECT metric, value, period_date, updated_at
          FROM economicIndicatorsCurrent 
          WHERE metric = ${indicator}
          ORDER BY period_date DESC
          LIMIT 1
        `);

        if (latestDataResult.rows.length === 0) {
          confidenceScores.push(this.createLowConfidenceScore(indicator));
          continue;
        }

        const latestData = latestDataResult.rows[0] as any;
        
        // Calculate freshness (hours since last update)
        const dataFreshness = this.calculateDataFreshness(latestData.updated_at || latestData.period_date);
        
        // Get historical data for validation
        const historicalResult = await db.execute(sql`
          SELECT value, period_date
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          AND period_date >= ${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)}
          ORDER BY period_date DESC
          LIMIT 24
        `);

        const historicalData = historicalResult.rows as any[];
        
        // Calculate validation scores
        const validationsPassed = this.performDataValidations(latestData, historicalData);
        const totalValidations = 5; // Total number of validation checks
        
        // Calculate anomaly score
        const anomalyScore = this.calculateAnomalyScore(parseFloat(latestData.value), historicalData);
        
        // Calculate reliability index
        const reliabilityIndex = this.calculateReliabilityIndex(indicator, historicalData);
        
        // Calculate final confidence score
        const confidenceScore = this.calculateFinalConfidenceScore({
          dataFreshness,
          validationsPassed,
          totalValidations,
          anomalyScore,
          reliabilityIndex
        });

        confidenceScores.push({
          indicator,
          confidenceScore,
          dataQuality: this.getDataQualityRating(confidenceScore),
          lastUpdated: new Date(latestData.updated_at || latestData.period_date),
          dataFreshness,
          sourcesCount: 1, // FRED is primary source
          validationsPassed,
          totalValidations,
          anomalyScore,
          reliabilityIndex
        });

      } catch (error) {
        logger.warn(`Failed to calculate confidence for ${indicator}:`, error);
        confidenceScores.push(this.createLowConfidenceScore(indicator));
      }
    }

    // Cache for 30 minutes
    this.cache.set(cacheKey, confidenceScores, 30 * 60 * 1000);
    logger.info(`✅ Calculated confidence scores for ${confidenceScores.length} indicators`);
    
    return confidenceScores;
  }

  async generateHistoricalContext(indicators: string[]): Promise<HistoricalContext[]> {
    const cacheKey = `historical-context-${indicators.join('-')}`;
    const cached = this.cache.get<HistoricalContext[]>(cacheKey);
    if (cached) return cached;

    logger.info(`📈 Generating historical context for ${indicators.length} indicators`);
    
    const contextualData: HistoricalContext[] = [];

    for (const indicator of indicators) {
      try {
        // Get current and historical data
        const historicalResult = await db.execute(sql`
          SELECT value, period_date
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          AND period_date >= ${new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000)}
          ORDER BY period_date DESC
          LIMIT 24
        `);

        const historicalData = historicalResult.rows as any[];
        
        if (historicalData.length < 12) {
          contextualData.push(this.createMinimalContext(indicator));
          continue;
        }

        const currentValue = parseFloat(historicalData[0].value);
        const values = historicalData.map(row => parseFloat(row.value)).filter(v => !isNaN(v));
        
        // Calculate historical percentile
        const historicalPercentile = this.calculatePercentile(currentValue, values);
        
        // Calculate 12-month average
        const twelveMonthAverage = values.slice(0, 12).reduce((sum, val) => sum + val, 0) / Math.min(values.length, 12);
        
        // Calculate volatility
        const volatilityMeasure = this.calculateVolatility(values);
        
        // Determine trend direction
        const trendDirection = this.determineTrendDirection(values.slice(0, 6));
        
        // Determine cyclical position
        const cyclicalPosition = this.determineCyclicalPosition(currentValue, values, historicalPercentile);
        
        // Calculate seasonal adjustment (simplified)
        const seasonalAdjustment = this.calculateSeasonalAdjustment(historicalData);
        
        // Determine contextual ranking
        const contextualRanking = this.getContextualRanking(historicalPercentile);

        contextualData.push({
          indicator,
          currentValue,
          historicalPercentile,
          twelveMonthAverage,
          volatilityMeasure,
          trenDirection: trendDirection,
          cyclicalPosition,
          seasonalAdjustment,
          contextualRanking
        });

      } catch (error) {
        logger.warn(`Failed to generate context for ${indicator}:`, error);
        contextualData.push(this.createMinimalContext(indicator));
      }
    }

    // Cache for 2 hours
    this.cache.set(cacheKey, contextualData, 2 * 60 * 60 * 1000);
    logger.info(`✅ Generated historical context for ${contextualData.length} indicators`);
    
    return contextualData;
  }

  private calculateDataFreshness(lastUpdate: string | Date): number {
    const updateTime = new Date(lastUpdate).getTime();
    const now = Date.now();
    return Math.round((now - updateTime) / (1000 * 60 * 60)); // hours
  }

  private performDataValidations(latestData: any, historicalData: any[]): number {
    let validations = 0;
    
    // Validation 1: Value is numeric
    if (!isNaN(parseFloat(latestData.value))) validations++;
    
    // Validation 2: Value is within reasonable range
    if (historicalData.length > 0) {
      const values = historicalData.map(row => parseFloat(row.value)).filter(v => !isNaN(v));
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
      
      if (Math.abs(parseFloat(latestData.value) - mean) <= 3 * stdDev) validations++;
    } else {
      validations++; // Give benefit of doubt if no historical data
    }
    
    // Validation 3: Date is recent (within 90 days)
    const dataDate = new Date(latestData.period_date);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    if (dataDate >= ninetyDaysAgo) validations++;
    
    // Validation 4: No null/undefined values
    if (latestData.value !== null && latestData.value !== undefined) validations++;
    
    // Validation 5: Consistent with recent trend
    if (historicalData.length >= 3) {
      const recentValues = historicalData.slice(0, 3).map(row => parseFloat(row.value));
      const avgRecent = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const currentVal = parseFloat(latestData.value);
      
      // Allow for reasonable variation (within 50% of recent average)
      if (Math.abs(currentVal - avgRecent) <= Math.abs(avgRecent * 0.5)) validations++;
    } else {
      validations++; // Give benefit of doubt
    }
    
    return validations;
  }

  private calculateAnomalyScore(currentValue: number, historicalData: any[]): number {
    if (historicalData.length < 5) return 0.1; // Low anomaly if insufficient data
    
    const values = historicalData.map(row => parseFloat(row.value)).filter(v => !isNaN(v));
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    const zScore = Math.abs((currentValue - mean) / stdDev);
    
    // Convert z-score to anomaly score (0-1, where 0 is normal, 1 is highly anomalous)
    return Math.min(zScore / 3, 1);
  }

  private calculateReliabilityIndex(indicator: string, historicalData: any[]): number {
    if (historicalData.length < 6) return 0.5;
    
    const values = historicalData.map(row => parseFloat(row.value)).filter(v => !isNaN(v));
    
    // Calculate coefficient of variation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const coefficientOfVariation = stdDev / Math.abs(mean);
    
    // Lower CV = higher reliability
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private calculateFinalConfidenceScore(factors: {
    dataFreshness: number;
    validationsPassed: number;
    totalValidations: number;
    anomalyScore: number;
    reliabilityIndex: number;
  }): number {
    const freshnessScore = Math.max(0, 1 - factors.dataFreshness / 168); // 1 week = full freshness
    const validationScore = factors.validationsPassed / factors.totalValidations;
    const anomalyPenalty = 1 - factors.anomalyScore;
    const reliabilityScore = factors.reliabilityIndex;
    
    const finalScore = (
      freshnessScore * this.CONFIDENCE_WEIGHTS.dataFreshness +
      validationScore * this.CONFIDENCE_WEIGHTS.validationScore +
      anomalyPenalty * this.CONFIDENCE_WEIGHTS.anomalyScore +
      reliabilityScore * this.CONFIDENCE_WEIGHTS.historicalConsistency +
      0.85 * this.CONFIDENCE_WEIGHTS.sourceReliability // FRED is reliable
    );
    
    return Math.min(Math.max(finalScore, 0), 1);
  }

  private getDataQualityRating(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 0.8) return 'HIGH';
    if (score >= 0.6) return 'MEDIUM';
    return 'LOW';
  }

  private calculatePercentile(value: number, values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i-1]) / values[i-1]);
    }
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private determineTrendDirection(recentValues: number[]): 'UPWARD' | 'DOWNWARD' | 'SIDEWAYS' {
    if (recentValues.length < 3) return 'SIDEWAYS';
    
    const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
    const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / Math.abs(firstAvg);
    
    if (change > 0.05) return 'UPWARD';
    if (change < -0.05) return 'DOWNWARD';
    return 'SIDEWAYS';
  }

  private determineCyclicalPosition(current: number, values: number[], percentile: number): 'PEAK' | 'TROUGH' | 'EXPANSION' | 'CONTRACTION' {
    if (percentile >= 90) return 'PEAK';
    if (percentile <= 10) return 'TROUGH';
    
    // Simple trend analysis for expansion/contraction
    const recentTrend = this.determineTrendDirection(values.slice(0, 6));
    if (recentTrend === 'UPWARD') return 'EXPANSION';
    if (recentTrend === 'DOWNWARD') return 'CONTRACTION';
    
    return percentile > 50 ? 'EXPANSION' : 'CONTRACTION';
  }

  private calculateSeasonalAdjustment(historicalData: any[]): number {
    // Simplified seasonal adjustment - would need more sophisticated analysis in production
    const currentMonth = new Date().getMonth();
    const seasonalFactors = [0.95, 0.98, 1.02, 1.05, 1.03, 1.01, 0.97, 0.96, 1.01, 1.04, 1.02, 0.99];
    return seasonalFactors[currentMonth] || 1.0;
  }

  private getContextualRanking(percentile: number): HistoricalContext['contextualRanking'] {
    if (percentile >= 95) return 'EXTREMELY_HIGH';
    if (percentile >= 80) return 'HIGH';
    if (percentile >= 60) return 'ABOVE_AVERAGE';
    if (percentile >= 40) return 'AVERAGE';
    if (percentile >= 20) return 'BELOW_AVERAGE';
    if (percentile >= 5) return 'LOW';
    return 'EXTREMELY_LOW';
  }

  private createLowConfidenceScore(indicator: string): DataConfidence {
    return {
      indicator,
      confidenceScore: 0.3,
      dataQuality: 'LOW',
      lastUpdated: new Date(),
      dataFreshness: 999,
      sourcesCount: 0,
      validationsPassed: 0,
      totalValidations: 5,
      anomalyScore: 0.8,
      reliabilityIndex: 0.2
    };
  }

  private createMinimalContext(indicator: string): HistoricalContext {
    return {
      indicator,
      currentValue: 0,
      historicalPercentile: 50,
      twelveMonthAverage: 0,
      volatilityMeasure: 0,
      trenDirection: 'SIDEWAYS',
      cyclicalPosition: 'EXPANSION',
      seasonalAdjustment: 1.0,
      contextualRanking: 'AVERAGE'
    };
  }
}