import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { cacheService } from './cache-unified.js';

export interface EconomicHealthScore {
  overallScore: number;
  scoreBreakdown: {
    coreHealth: number;
    correlationHarmony: number;
    marketStress: number;
    confidence: number;
  };
  componentScores: {
    gdpHealth: number;
    employmentHealth: number;
    inflationStability: number;
    correlationAlignment: number;
    leadingConsistency: number;
    alertFrequency: number;
    regimeStability: number;
    dataQuality: number;
    sectorAlignment: number;
  };
  healthGrade: 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'CRITICAL';
  trendDirection: 'STRENGTHENING' | 'STABLE' | 'WEAKENING';
  monthlyChange: number;
  historicalPercentile: number;
  recessonProbability: number;
}

export class EconomicHealthCalculator {
  private cache = cacheService;

  private readonly SCORE_WEIGHTS = {
    // Core Economic Strength (40 points)
    gdpHealth: 15,
    employmentHealth: 15,
    inflationStability: 10,
    
    // Cross-Indicator Harmony (25 points)
    correlationAlignment: 15,
    leadingConsistency: 10,
    
    // Market Stress & Volatility (20 points)
    alertFrequency: 10,
    regimeStability: 10,
    
    // Forward-Looking Confidence (15 points)
    dataQuality: 8,
    sectorAlignment: 7
  };

  async calculateEconomicHealthScore(): Promise<EconomicHealthScore> {
    const cacheKey = 'economic-health-score';
    const cached = this.cache.get<EconomicHealthScore>(cacheKey);
    if (cached) return cached;

    logger.info('🧮 Calculating comprehensive Economic Health Score');

    try {
      // Calculate individual component scores
      const componentScores = await this.calculateComponentScores();
      
      // Calculate weighted overall score
      const overallScore = this.calculateWeightedScore(componentScores);
      
      // Calculate score breakdown by category
      const scoreBreakdown = this.calculateScoreBreakdown(componentScores);
      
      // Determine health grade and trend
      const healthGrade = this.determineHealthGrade(overallScore);
      const { trendDirection, monthlyChange } = await this.analyzeTrend();
      
      // Calculate historical context
      const historicalPercentile = await this.calculateHistoricalPercentile(overallScore);
      const recessonProbability = this.calculateRecessionProbability(overallScore, componentScores);

      const healthScore: EconomicHealthScore = {
        overallScore: Math.round(overallScore),
        scoreBreakdown,
        componentScores,
        healthGrade,
        trendDirection,
        monthlyChange,
        historicalPercentile,
        recessonProbability
      };

      // Cache for 30 minutes
      this.cache.set(cacheKey, healthScore, 30 * 60 * 1000);
      logger.info(`✅ Economic Health Score: ${Math.round(overallScore)}/100 (${healthGrade})`);

      return healthScore;

    } catch (error) {
      logger.error('Failed to calculate economic health score:', error);
      return this.getDefaultHealthScore();
    }
  }

  private async calculateComponentScores() {
    logger.info('📊 Calculating individual component scores');

    const [
      gdpHealth,
      employmentHealth,
      inflationStability,
      correlationAlignment,
      leadingConsistency,
      alertFrequency,
      regimeStability,
      dataQuality,
      sectorAlignment
    ] = await Promise.all([
      this.calculateGDPHealth(),
      this.calculateEmploymentHealth(),
      this.calculateInflationStability(),
      this.calculateCorrelationAlignment(),
      this.calculateLeadingConsistency(),
      this.calculateAlertFrequency(),
      this.calculateRegimeStability(),
      this.calculateDataQuality(),
      this.calculateSectorAlignment()
    ]);

    return {
      gdpHealth,
      employmentHealth,
      inflationStability,
      correlationAlignment,
      leadingConsistency,
      alertFrequency,
      regimeStability,
      dataQuality,
      sectorAlignment
    };
  }

  private async calculateGDPHealth(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT value, period_date
        FROM economicIndicatorsCurrent
        WHERE metric = 'GDP Growth Rate'
        ORDER BY period_date DESC
        LIMIT 4
      `);

      if (result.rows.length === 0) return 50; // Neutral default

      const values = result.rows.map(row => parseFloat((row as any).value)).filter(v => !isNaN(v));
      const currentGDP = values[0];
      
      // Calculate score based on GDP health
      let score = 50; // Base score
      
      // GDP level scoring
      if (currentGDP > 3.5) score += 40;      // Excellent growth
      else if (currentGDP > 2.5) score += 30; // Strong growth
      else if (currentGDP > 1.5) score += 20; // Moderate growth
      else if (currentGDP > 0) score += 10;   // Weak growth
      else if (currentGDP > -2) score -= 20;  // Mild recession
      else score -= 40;                       // Deep recession
      
      // Trend consistency bonus/penalty
      if (values.length >= 3) {
        const trend = this.calculateTrendConsistency(values.slice(0, 3));
        if (trend > 0.7) score += 10;      // Strong upward trend
        else if (trend < -0.7) score -= 10; // Strong downward trend
      }
      
      return Math.max(0, Math.min(100, score));

    } catch (error) {
      logger.warn('Failed to calculate GDP health:', error);
      return 50;
    }
  }

  private async calculateEmploymentHealth(): Promise<number> {
    try {
      const indicators = ['Unemployment Rate (Δ-adjusted)', 'Nonfarm Payrolls', 'Employment Population Ratio'];
      let totalScore = 0;
      let validScores = 0;

      for (const indicator of indicators) {
        const result = await db.execute(sql`
          SELECT value, period_date
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          ORDER BY period_date DESC
          LIMIT 3
        `);

        if (result.rows.length > 0) {
          const values = result.rows.map(row => parseFloat((row as any).value)).filter(v => !isNaN(v));
          const currentValue = values[0];
          let componentScore = 50;

          if (indicator.includes('Unemployment')) {
            // For unemployment delta (positive = improvement)
            if (currentValue > 1) componentScore = 85;      // Strong improvement
            else if (currentValue > 0) componentScore = 70; // Improvement  
            else if (currentValue > -0.5) componentScore = 45; // Slight deterioration
            else componentScore = 25;                       // Significant deterioration
          } else if (indicator.includes('Payrolls')) {
            // Nonfarm Payrolls (thousands)
            if (currentValue > 300) componentScore = 90;    // Strong job growth
            else if (currentValue > 150) componentScore = 75; // Good growth
            else if (currentValue > 50) componentScore = 55;  // Weak growth
            else if (currentValue > -50) componentScore = 35; // Slight decline
            else componentScore = 15;                         // Job losses
          } else if (indicator.includes('Employment Population')) {
            // Employment-Population Ratio
            if (currentValue > 61) componentScore = 85;     // Strong employment
            else if (currentValue > 59) componentScore = 70; // Good employment
            else if (currentValue > 57) componentScore = 50; // Average
            else componentScore = 30;                        // Weak employment
          }

          totalScore += componentScore;
          validScores++;
        }
      }

      return validScores > 0 ? Math.round(totalScore / validScores) : 50;

    } catch (error) {
      logger.warn('Failed to calculate employment health:', error);
      return 50;
    }
  }

  private async calculateInflationStability(): Promise<number> {
    try {
      const indicators = ['Core CPI (Δ-adjusted)', 'Core PCE Price Index (Δ-adjusted)'];
      let totalScore = 0;
      let validScores = 0;

      for (const indicator of indicators) {
        const result = await db.execute(sql`
          SELECT value, period_date
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          ORDER BY period_date DESC
          LIMIT 6
        `);

        if (result.rows.length >= 3) {
          const values = result.rows.map(row => parseFloat((row as any).value)).filter(v => !isNaN(v));
          const currentInflation = Math.abs(values[0]); // Absolute value for stability
          const volatility = this.calculateVolatility(values.slice(0, 6));
          
          let componentScore = 50;
          
          // Inflation level scoring (target around 2%)
          const distanceFromTarget = Math.abs(currentInflation - 2);
          if (distanceFromTarget < 0.5) componentScore = 90;      // Very stable
          else if (distanceFromTarget < 1) componentScore = 75;   // Stable
          else if (distanceFromTarget < 2) componentScore = 60;   // Moderate
          else if (distanceFromTarget < 3) componentScore = 40;   // Unstable
          else componentScore = 20;                               // Very unstable
          
          // Volatility penalty
          if (volatility > 1.5) componentScore -= 15;
          else if (volatility > 1) componentScore -= 10;
          else if (volatility > 0.5) componentScore -= 5;
          
          totalScore += Math.max(0, componentScore);
          validScores++;
        }
      }

      return validScores > 0 ? Math.round(totalScore / validScores) : 50;

    } catch (error) {
      logger.warn('Failed to calculate inflation stability:', error);
      return 50;
    }
  }

  private async calculateCorrelationAlignment(): Promise<number> {
    try {
      // Simulate correlation analysis - in production would use actual correlation data
      const expectedCorrelations = {
        'GDP-Employment': 0.75,    // Strong positive expected
        'GDP-Inflation': 0.45,     // Moderate positive expected
        'Employment-Inflation': 0.35 // Moderate positive expected
      };

      let alignmentScore = 0;
      let totalWeight = 0;

      // Mock current correlations - in production would calculate from actual data
      const currentCorrelations = {
        'GDP-Employment': 0.68,
        'GDP-Inflation': 0.42,
        'Employment-Inflation': 0.31
      };

      for (const [pair, expected] of Object.entries(expectedCorrelations)) {
        const current = currentCorrelations[pair as keyof typeof currentCorrelations];
        const deviation = Math.abs(current - expected);
        
        let pairScore = 100;
        if (deviation > 0.3) pairScore = 40;
        else if (deviation > 0.2) pairScore = 60;
        else if (deviation > 0.1) pairScore = 80;
        
        const weight = pair === 'GDP-Employment' ? 2 : 1; // GDP-Employment most important
        alignmentScore += pairScore * weight;
        totalWeight += weight;
      }

      return Math.round(alignmentScore / totalWeight);

    } catch (error) {
      logger.warn('Failed to calculate correlation alignment:', error);
      return 50;
    }
  }

  private async calculateLeadingConsistency(): Promise<number> {
    try {
      const leadingIndicators = ['10-Year Treasury Yield (Δ-adjusted)', 'Average Weekly Hours', 'Housing Starts'];
      let consistencyScore = 0;
      let validIndicators = 0;

      for (const indicator of leadingIndicators) {
        const result = await db.execute(sql`
          SELECT value, period_date
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          ORDER BY period_date DESC
          LIMIT 4
        `);

        if (result.rows.length >= 3) {
          const values = result.rows.map(row => parseFloat((row as any).value)).filter(v => !isNaN(v));
          const trend = this.calculateTrendConsistency(values.slice(0, 3));
          
          // Score based on trend strength and consistency
          let indicatorScore = 50 + (trend * 50); // Convert -1 to 1 range to 0-100
          indicatorScore = Math.max(0, Math.min(100, indicatorScore));
          
          consistencyScore += indicatorScore;
          validIndicators++;
        }
      }

      return validIndicators > 0 ? Math.round(consistencyScore / validIndicators) : 50;

    } catch (error) {
      logger.warn('Failed to calculate leading consistency:', error);
      return 50;
    }
  }

  private async calculateAlertFrequency(): Promise<number> {
    try {
      // Mock alert frequency calculation - in production would track actual alerts
      const alertsLast30Days = Math.floor(Math.random() * 15) + 5; // Mock: 5-20 alerts
      
      let score = 100;
      
      // Penalty for excessive alerts (indicates market stress)
      if (alertsLast30Days > 25) score = 20;      // Very high stress
      else if (alertsLast30Days > 20) score = 40; // High stress
      else if (alertsLast30Days > 15) score = 60; // Moderate stress
      else if (alertsLast30Days > 10) score = 80; // Low stress
      // else score = 100 (very low stress)
      
      return score;

    } catch (error) {
      logger.warn('Failed to calculate alert frequency:', error);
      return 50;
    }
  }

  private async calculateRegimeStability(): Promise<number> {
    try {
      // Mock regime stability - in production would use actual regime detector
      const regimeAge = 18; // Current regime is 18 months old
      const averageRegimeDuration = 24; // Average regime lasts 24 months
      
      let score = 50;
      
      // Score based on regime maturity
      const maturity = regimeAge / averageRegimeDuration;
      
      if (maturity < 0.3) score = 70;      // Early stage - stable
      else if (maturity < 0.6) score = 85; // Mid stage - very stable
      else if (maturity < 0.8) score = 75; // Mature - still stable
      else if (maturity < 1.0) score = 50; // Late stage - transition risk
      else score = 30;                     // Overdue - high transition risk
      
      return score;

    } catch (error) {
      logger.warn('Failed to calculate regime stability:', error);
      return 50;
    }
  }

  private async calculateDataQuality(): Promise<number> {
    try {
      // Calculate average data freshness and quality
      const keyIndicators = ['GDP Growth Rate', 'Unemployment Rate (Δ-adjusted)', 'Core CPI (Δ-adjusted)'];
      let totalQuality = 0;
      let validIndicators = 0;

      for (const indicator of keyIndicators) {
        const result = await db.execute(sql`
          SELECT period_date, value
          FROM economicIndicatorsCurrent
          WHERE metric = ${indicator}
          ORDER BY period_date DESC
          LIMIT 1
        `);

        if (result.rows.length > 0) {
          const row = result.rows[0] as any;
          const dataDate = new Date(row.period_date);
          const now = new Date();
          const daysOld = Math.floor((now.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let qualityScore = 100;
          
          // Penalize based on data age
          if (daysOld > 90) qualityScore = 40;      // Very stale
          else if (daysOld > 60) qualityScore = 60; // Stale
          else if (daysOld > 30) qualityScore = 80; // Somewhat fresh
          // else qualityScore = 100 (fresh)
          
          // Check for null/invalid values
          if (!row.value || isNaN(parseFloat(row.value))) {
            qualityScore *= 0.5; // Severe penalty for missing data
          }
          
          totalQuality += qualityScore;
          validIndicators++;
        }
      }

      return validIndicators > 0 ? Math.round(totalQuality / validIndicators) : 50;

    } catch (error) {
      logger.warn('Failed to calculate data quality:', error);
      return 50;
    }
  }

  private async calculateSectorAlignment(): Promise<number> {
    try {
      // Mock sector alignment calculation - in production would use actual sector correlation
      // Score based on how well economic indicators predict sector performance
      
      const sectorPredictionAccuracy = 0.73; // Mock: 73% accuracy
      
      let score = sectorPredictionAccuracy * 100;
      
      // Bonus for high accuracy
      if (sectorPredictionAccuracy > 0.8) score += 10;
      else if (sectorPredictionAccuracy > 0.7) score += 5;
      
      return Math.round(Math.min(100, score));

    } catch (error) {
      logger.warn('Failed to calculate sector alignment:', error);
      return 50;
    }
  }

  private calculateWeightedScore(componentScores: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [component, score] of Object.entries(componentScores)) {
      const weight = this.SCORE_WEIGHTS[component as keyof typeof this.SCORE_WEIGHTS] || 0;
      totalScore += (score as number) * (weight / 100); // Convert weight to decimal
      totalWeight += weight;
    }

    return (totalScore / totalWeight) * 100;
  }

  private calculateScoreBreakdown(componentScores: any) {
    return {
      coreHealth: Math.round(
        (componentScores.gdpHealth * this.SCORE_WEIGHTS.gdpHealth +
         componentScores.employmentHealth * this.SCORE_WEIGHTS.employmentHealth +
         componentScores.inflationStability * this.SCORE_WEIGHTS.inflationStability) / 100
      ),
      correlationHarmony: Math.round(
        (componentScores.correlationAlignment * this.SCORE_WEIGHTS.correlationAlignment +
         componentScores.leadingConsistency * this.SCORE_WEIGHTS.leadingConsistency) / 100
      ),
      marketStress: Math.round(
        (componentScores.alertFrequency * this.SCORE_WEIGHTS.alertFrequency +
         componentScores.regimeStability * this.SCORE_WEIGHTS.regimeStability) / 100
      ),
      confidence: Math.round(
        (componentScores.dataQuality * this.SCORE_WEIGHTS.dataQuality +
         componentScores.sectorAlignment * this.SCORE_WEIGHTS.sectorAlignment) / 100
      )
    };
  }

  private determineHealthGrade(score: number): 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'CRITICAL' {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'STRONG';
    if (score >= 55) return 'MODERATE';
    if (score >= 40) return 'WEAK';
    return 'CRITICAL';
  }

  private async analyzeTrend(): Promise<{ trendDirection: 'STRENGTHENING' | 'STABLE' | 'WEAKENING'; monthlyChange: number }> {
    // Mock trend analysis - in production would compare with historical scores
    const mockScores = [87, 84, 82, 85, 83]; // Last 5 months
    const currentScore = mockScores[0];
    const previousScore = mockScores[1];
    const monthlyChange = currentScore - previousScore;
    
    let trendDirection: 'STRENGTHENING' | 'STABLE' | 'WEAKENING';
    if (monthlyChange > 2) trendDirection = 'STRENGTHENING';
    else if (monthlyChange < -2) trendDirection = 'WEAKENING';
    else trendDirection = 'STABLE';
    
    return { trendDirection, monthlyChange };
  }

  private async calculateHistoricalPercentile(score: number): Promise<number> {
    // Mock historical percentile - in production would use actual historical data
    // Simulate that current score is in 85th percentile
    const mockPercentile = Math.min(95, Math.max(5, (score - 20) * 1.2));
    return Math.round(mockPercentile);
  }

  private calculateRecessionProbability(overallScore: number, componentScores: any): number {
    let probability = 0;
    
    // Base probability from overall score
    if (overallScore < 30) probability += 60;
    else if (overallScore < 45) probability += 35;
    else if (overallScore < 60) probability += 15;
    else if (overallScore < 75) probability += 5;
    
    // Additional factors
    if (componentScores.gdpHealth < 30) probability += 20;
    if (componentScores.employmentHealth < 35) probability += 15;
    if (componentScores.regimeStability < 40) probability += 10;
    
    return Math.min(85, Math.max(1, probability));
  }

  private calculateTrendConsistency(values: number[]): number {
    if (values.length < 2) return 0;
    
    let consistentDirections = 0;
    let totalDirections = 0;
    
    for (let i = 1; i < values.length; i++) {
      const direction = values[i-1] > values[i] ? 1 : -1;
      const nextDirection = i === values.length - 1 ? direction : (values[i] > values[i+1] ? 1 : -1);
      
      if (direction === nextDirection) consistentDirections++;
      totalDirections++;
    }
    
    return totalDirections > 0 ? (consistentDirections / totalDirections) * 2 - 1 : 0; // Scale to -1 to 1
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private getDefaultHealthScore(): EconomicHealthScore {
    return {
      overallScore: 50,
      scoreBreakdown: {
        coreHealth: 20,
        correlationHarmony: 12,
        marketStress: 10,
        confidence: 8
      },
      componentScores: {
        gdpHealth: 50,
        employmentHealth: 50,
        inflationStability: 50,
        correlationAlignment: 50,
        leadingConsistency: 50,
        alertFrequency: 50,
        regimeStability: 50,
        dataQuality: 50,
        sectorAlignment: 50
      },
      healthGrade: 'MODERATE',
      trendDirection: 'STABLE',
      monthlyChange: 0,
      historicalPercentile: 50,
      recessonProbability: 15
    };
  }
}