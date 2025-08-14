import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cacheService } from './cache-unified';

export type RegimeType = 'EXPANSION' | 'PEAK' | 'CONTRACTION' | 'TROUGH';

export interface EconomicRegime {
  regimeType: RegimeType;
  confidenceScore: number;
  regimeStartDate: Date;
  regimeDurationMonths: number;
  contributingIndicators: {
    indicator: string;
    currentValue: number;
    trendDirection: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    regimeContribution: number;
  }[];
  transitionProbabilities: {
    toExpansion: number;
    toPeak: number;
    toContraction: number;
    toTrough: number;
  };
  historicalContext: {
    averageRegimeDuration: number;
    similarRegimeCount: number;
    lastTransitionDate: Date | null;
  };
}

export class EconomicRegimeDetector {
  private cache = cacheService;
  
  private readonly REGIME_WEIGHTS = {
    gdp: 0.40,
    employment: 0.30,
    sentiment: 0.20,
    manufacturing: 0.10
  };

  private readonly REGIME_THRESHOLDS = {
    expansion: { min: 75, max: 100 },
    peak: { min: 50, max: 74 },
    contraction: { min: 25, max: 49 },
    trough: { min: 0, max: 24 }
  };

  async detectCurrentRegime(): Promise<EconomicRegime> {
    const cacheKey = 'current-economic-regime';
    const cached = this.cache.get<EconomicRegime>(cacheKey);
    if (cached) return cached;

    logger.info('🔍 Detecting current economic regime');

    try {
      // Get key economic indicators
      const keyIndicators = await this.getKeyRegimeIndicators();
      
      // Calculate regime score
      const regimeScore = await this.calculateRegimeScore(keyIndicators);
      
      // Determine regime type
      const regimeType = this.classifyRegime(regimeScore);
      
      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(keyIndicators, regimeScore);
      
      // Get historical context
      const historicalContext = await this.getHistoricalContext(regimeType);
      
      // Calculate transition probabilities
      const transitionProbabilities = await this.calculateTransitionProbabilities(regimeType, keyIndicators);
      
      // Get regime duration
      const { regimeStartDate, regimeDurationMonths } = await this.getRegimeDuration(regimeType);

      const regime: EconomicRegime = {
        regimeType,
        confidenceScore,
        regimeStartDate,
        regimeDurationMonths,
        contributingIndicators: keyIndicators,
        transitionProbabilities,
        historicalContext
      };

      // Cache for 2 hours
      this.cache.set(cacheKey, regime, 2 * 60 * 60 * 1000);
      logger.info(`✅ Detected economic regime: ${regimeType} (${confidenceScore.toFixed(1)}% confidence)`);
      
      return regime;

    } catch (error) {
      logger.error('Failed to detect economic regime:', error);
      return this.getDefaultRegime();
    }
  }

  private async getKeyRegimeIndicators() {
    const indicators = [
      'GDP Growth Rate',
      'Unemployment Rate (Δ-adjusted)',
      'Consumer Confidence',
      'Nonfarm Payrolls',
      'Manufacturing PMI',
      'Employment Population Ratio'
    ];

    const indicatorData = [];

    for (const indicator of indicators) {
      try {
        const result = await db.execute(sql`
          SELECT metric, value, period_date
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          ORDER BY period_date DESC
          LIMIT 6
        `);

        if (result.rows.length > 0) {
          const values = result.rows.map(row => parseFloat((row as any).value)).filter(v => !isNaN(v));
          const currentValue = values[0];
          const previousValues = values.slice(1);
          
          // Calculate trend direction
          const trendDirection = this.calculateTrendDirection(currentValue, previousValues);
          
          // Calculate regime contribution based on indicator type
          const regimeContribution = this.calculateRegimeContribution(indicator, currentValue, trendDirection);

          indicatorData.push({
            indicator,
            currentValue,
            trendDirection,
            regimeContribution
          });
        }
      } catch (error) {
        logger.warn(`Failed to get data for ${indicator}:`, error);
      }
    }

    return indicatorData;
  }

  private calculateTrendDirection(current: number, previous: number[]): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (previous.length === 0) return 'NEUTRAL';
    
    const recentAvg = previous.slice(0, 3).reduce((sum, val) => sum + val, 0) / Math.min(previous.length, 3);
    const change = (current - recentAvg) / Math.abs(recentAvg);
    
    if (change > 0.05) return 'POSITIVE';
    if (change < -0.05) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  private calculateRegimeContribution(indicator: string, value: number, trend: string): number {
    // Base contribution score (0-100)
    let contribution = 50; // Neutral baseline

    const indicatorLower = indicator.toLowerCase();

    if (indicatorLower.includes('gdp')) {
      // GDP Growth Rate logic
      if (value > 3) contribution = 85; // Strong growth
      else if (value > 2) contribution = 75; // Moderate growth  
      else if (value > 0) contribution = 60; // Weak growth
      else if (value > -2) contribution = 35; // Mild contraction
      else contribution = 15; // Deep recession
      
    } else if (indicatorLower.includes('unemployment')) {
      // Unemployment (delta-adjusted, so positive = good)
      if (value > 1) contribution = 80; // Improving employment
      else if (value > 0) contribution = 65; // Stable employment
      else if (value > -1) contribution = 45; // Slight deterioration
      else contribution = 25; // Rising unemployment
      
    } else if (indicatorLower.includes('confidence')) {
      // Consumer Confidence
      if (value > 110) contribution = 85; // High confidence
      else if (value > 100) contribution = 70; // Above average
      else if (value > 90) contribution = 55; // Below average
      else contribution = 30; // Low confidence
      
    } else if (indicatorLower.includes('payrolls')) {
      // Nonfarm Payrolls (thousands)
      if (value > 300) contribution = 80; // Strong job growth
      else if (value > 150) contribution = 70; // Moderate growth
      else if (value > 50) contribution = 55; // Weak growth
      else if (value > -50) contribution = 40; // Slight decline
      else contribution = 20; // Job losses
      
    } else if (indicatorLower.includes('pmi') || indicatorLower.includes('manufacturing')) {
      // Manufacturing PMI
      if (value > 55) contribution = 80; // Strong expansion
      else if (value > 50) contribution = 65; // Expansion
      else if (value > 45) contribution = 40; // Contraction
      else contribution = 25; // Deep contraction
    }

    // Adjust based on trend direction
    if (trend === 'POSITIVE') contribution = Math.min(100, contribution + 10);
    else if (trend === 'NEGATIVE') contribution = Math.max(0, contribution - 10);

    return contribution;
  }

  private async calculateRegimeScore(indicators: any[]): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    for (const indicator of indicators) {
      const indicatorLower = indicator.indicator.toLowerCase();
      let weight = 0.1; // Default weight

      if (indicatorLower.includes('gdp')) weight = this.REGIME_WEIGHTS.gdp;
      else if (indicatorLower.includes('unemployment') || indicatorLower.includes('payrolls') || indicatorLower.includes('employment')) {
        weight = this.REGIME_WEIGHTS.employment / 3; // Split employment weight
      } else if (indicatorLower.includes('confidence')) weight = this.REGIME_WEIGHTS.sentiment;
      else if (indicatorLower.includes('pmi') || indicatorLower.includes('manufacturing')) weight = this.REGIME_WEIGHTS.manufacturing;

      totalScore += indicator.regimeContribution * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 50;
  }

  private classifyRegime(score: number): RegimeType {
    if (score >= this.REGIME_THRESHOLDS.expansion.min) return 'EXPANSION';
    if (score >= this.REGIME_THRESHOLDS.peak.min) return 'PEAK';
    if (score >= this.REGIME_THRESHOLDS.contraction.min) return 'CONTRACTION';
    return 'TROUGH';
  }

  private calculateConfidenceScore(indicators: any[], regimeScore: number): number {
    // Base confidence from regime score clarity
    let confidence = 50;
    
    // Higher confidence if score is clearly in one regime
    const distanceFromBoundary = Math.min(
      Math.abs(regimeScore - 25), // Distance from contraction/trough boundary
      Math.abs(regimeScore - 50), // Distance from peak/contraction boundary  
      Math.abs(regimeScore - 75)  // Distance from expansion/peak boundary
    );
    
    confidence += distanceFromBoundary * 2; // Max boost of 50 points
    
    // Adjust based on data quality
    const validIndicators = indicators.filter(i => !isNaN(i.currentValue));
    const dataQualityBonus = (validIndicators.length / indicators.length) * 20;
    confidence += dataQualityBonus;
    
    // Trend consistency bonus
    const positiveCount = indicators.filter(i => i.trendDirection === 'POSITIVE').length;
    const negativeCount = indicators.filter(i => i.trendDirection === 'NEGATIVE').length;
    const trendConsistency = Math.abs(positiveCount - negativeCount) / indicators.length;
    confidence += trendConsistency * 15;
    
    return Math.min(95, Math.max(25, confidence));
  }

  private async getHistoricalContext(regimeType: RegimeType) {
    // Simplified historical analysis - in production would use more sophisticated data
    const historicalRegimes = {
      'EXPANSION': { averageDuration: 24, count: 8 },
      'PEAK': { averageDuration: 6, count: 8 },
      'CONTRACTION': { averageDuration: 11, count: 8 },
      'TROUGH': { averageDuration: 4, count: 8 }
    };

    const regimeData = historicalRegimes[regimeType];
    
    return {
      averageRegimeDuration: regimeData.averageDuration,
      similarRegimeCount: regimeData.count,
      lastTransitionDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Mock last transition
    };
  }

  private async calculateTransitionProbabilities(currentRegime: RegimeType, indicators: any[]) {
    // Base transition probabilities based on economic theory
    const baseTransitions = {
      'EXPANSION': { toExpansion: 0.70, toPeak: 0.25, toContraction: 0.05, toTrough: 0.00 },
      'PEAK': { toExpansion: 0.15, toPeak: 0.30, toContraction: 0.50, toTrough: 0.05 },
      'CONTRACTION': { toExpansion: 0.10, toPeak: 0.05, toContraction: 0.60, toTrough: 0.25 },
      'TROUGH': { toExpansion: 0.40, toPeak: 0.05, toContraction: 0.15, toTrough: 0.40 }
    };

    let probabilities = { ...baseTransitions[currentRegime] };
    
    // Adjust based on current indicator trends
    const positiveIndicators = indicators.filter(i => i.trendDirection === 'POSITIVE').length;
    const negativeIndicators = indicators.filter(i => i.trendDirection === 'NEGATIVE').length;
    
    const positiveWeight = positiveIndicators / indicators.length;
    const negativeWeight = negativeIndicators / indicators.length;
    
    // Adjust probabilities based on momentum
    if (positiveWeight > 0.6) {
      // Strong positive momentum
      probabilities.toExpansion += 0.15;
      probabilities.toContraction -= 0.10;
      probabilities.toTrough -= 0.05;
    } else if (negativeWeight > 0.6) {
      // Strong negative momentum
      probabilities.toContraction += 0.15;
      probabilities.toTrough += 0.10;
      probabilities.toExpansion -= 0.15;
      probabilities.toPeak -= 0.10;
    }
    
    // Normalize to ensure probabilities sum to 1
    const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
    Object.keys(probabilities).forEach(key => {
      probabilities[key as keyof typeof probabilities] /= total;
    });
    
    return probabilities;
  }

  private async getRegimeDuration(regimeType: RegimeType) {
    // Simplified - in production would track actual regime changes
    const estimatedStartDate = new Date();
    
    // Estimate regime start based on type (mock data)
    switch (regimeType) {
      case 'EXPANSION':
        estimatedStartDate.setMonth(estimatedStartDate.getMonth() - 18);
        return { regimeStartDate: estimatedStartDate, regimeDurationMonths: 18 };
      case 'PEAK':
        estimatedStartDate.setMonth(estimatedStartDate.getMonth() - 3);
        return { regimeStartDate: estimatedStartDate, regimeDurationMonths: 3 };
      case 'CONTRACTION':
        estimatedStartDate.setMonth(estimatedStartDate.getMonth() - 8);
        return { regimeStartDate: estimatedStartDate, regimeDurationMonths: 8 };
      case 'TROUGH':
        estimatedStartDate.setMonth(estimatedStartDate.getMonth() - 2);
        return { regimeStartDate: estimatedStartDate, regimeDurationMonths: 2 };
      default:
        return { regimeStartDate: estimatedStartDate, regimeDurationMonths: 12 };
    }
  }

  private getDefaultRegime(): EconomicRegime {
    return {
      regimeType: 'EXPANSION',
      confidenceScore: 50,
      regimeStartDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000),
      regimeDurationMonths: 12,
      contributingIndicators: [],
      transitionProbabilities: {
        toExpansion: 0.70,
        toPeak: 0.25,
        toContraction: 0.05,
        toTrough: 0.00
      },
      historicalContext: {
        averageRegimeDuration: 24,
        similarRegimeCount: 8,
        lastTransitionDate: null
      }
    };
  }

  async getRegimeHistory(months: number = 24): Promise<{ date: Date; regime: RegimeType; confidence: number }[]> {
    const cacheKey = `regime-history-${months}`;
    const cached = this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    // Mock historical regime data - in production would be stored in database
    const history = [];
    const now = new Date();
    
    for (let i = months; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      
      // Simplified regime pattern for demonstration
      let regime: RegimeType;
      let confidence: number;
      
      if (i > 20) {
        regime = 'EXPANSION';
        confidence = 85;
      } else if (i > 18) {
        regime = 'PEAK';
        confidence = 70;
      } else if (i > 12) {
        regime = 'CONTRACTION';
        confidence = 75;
      } else if (i > 6) {
        regime = 'TROUGH';
        confidence = 60;
      } else {
        regime = 'EXPANSION';
        confidence = 80;
      }
      
      history.push({ date, regime, confidence });
    }
    
    // Cache for 4 hours
    this.cache.set(cacheKey, history, 4 * 60 * 60 * 1000);
    return history;
  }
}