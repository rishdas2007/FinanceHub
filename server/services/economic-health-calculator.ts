import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { cacheService } from './cache-unified.js';
import { EconomicInsightClassifier } from './economic-insight-classifier.js';

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
    // Enhanced Multi-Dimensional Components
    signalClarity: number;
    crossIndicatorHarmony: number;
    conflictResolution: number;
    forwardLookingAccuracy: number;
    // Traditional Components
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
  private insightClassifier = new EconomicInsightClassifier();

  // Enhanced Multi-Dimensional Score Weights (100 points total)
  private readonly ENHANCED_SCORE_WEIGHTS = {
    // Core Economic Strength (30 points) - reduced from 40
    gdpHealth: 12,
    employmentHealth: 12,
    inflationStability: 6,

    // Multi-Dimensional Signal Analysis (35 points) - NEW
    signalClarity: 9,           // 25% of 35 - How definitively indicators point in direction
    crossIndicatorHarmony: 12,  // 35% of 35 - Level-trend alignment across economy
    conflictResolution: 7,      // 20% of 35 - Handling mixed economic signals
    forwardLookingAccuracy: 7,  // 20% of 35 - Predictive capability with leading indicators

    // Market Stress & Volatility (20 points)
    alertFrequency: 10,
    regimeStability: 10,

    // Data Quality & Confidence (15 points)
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
    logger.info('📊 Calculating enhanced multi-dimensional component scores');

    const [
      gdpHealth,
      employmentHealth,
      inflationStability,
      signalClarity,
      crossIndicatorHarmony,
      conflictResolution,
      forwardLookingAccuracy,
      alertFrequency,
      regimeStability,
      dataQuality,
      sectorAlignment
    ] = await Promise.all([
      this.calculateGDPHealth(),
      this.calculateEmploymentHealth(),
      this.calculateInflationStability(),
      this.calculateSignalClarity(),
      this.calculateCrossIndicatorHarmony(),
      this.calculateConflictResolution(),
      this.calculateForwardLookingAccuracy(),
      this.calculateEnhancedAlertFrequency(),
      this.calculateRegimeStability(),
      this.calculateDataQuality(),
      this.calculateSectorAlignment()
    ]);

    return {
      gdpHealth,
      employmentHealth,
      inflationStability,
      signalClarity,
      crossIndicatorHarmony,
      conflictResolution,
      forwardLookingAccuracy,
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
      // Calculate actual correlations from economic data
      const indicators = {
        gdp: 'GDP Growth Rate',
        unemployment: 'Unemployment Rate (Δ-adjusted)', 
        inflation: 'Core CPI (Δ-adjusted)'
      };

      // Get last 12 months of data for correlation analysis
      const correlationData: { [key: string]: number[] } = {};
      
      for (const [key, metric] of Object.entries(indicators)) {
        const result = await db.execute(sql`
          SELECT value 
          FROM economicIndicatorsCurrent 
          WHERE metric = ${metric}
          ORDER BY period_date DESC 
          LIMIT 12
        `);
        
        if (result.rows.length >= 6) { // Need at least 6 data points
          correlationData[key] = result.rows
            .map(row => parseFloat((row as any).value))
            .filter(v => !isNaN(v))
            .reverse(); // Chronological order
        }
      }

      // Calculate correlations if we have sufficient data
      if (Object.keys(correlationData).length >= 2) {
        const expectedCorrelations = {
          'GDP-Employment': -0.75,    // GDP growth should correlate with lower unemployment
          'GDP-Inflation': 0.45,      // GDP growth moderately correlates with inflation
          'Employment-Inflation': -0.35 // Lower unemployment correlates with higher inflation
        };

        let alignmentScore = 0;
        let totalWeight = 0;
        let validPairs = 0;

        // GDP-Employment correlation (invert unemployment for proper correlation)
        if (correlationData.gdp && correlationData.unemployment) {
          const gdpValues = correlationData.gdp;
          const unemploymentValues = correlationData.unemployment.map(v => -v); // Invert for correlation
          const correlation = this.calculatePearsonCorrelation(gdpValues, unemploymentValues);
          
          const expected = expectedCorrelations['GDP-Employment'];
          const deviation = Math.abs(correlation - expected);
          
          let pairScore = 100;
          if (deviation > 0.4) pairScore = 30;
          else if (deviation > 0.3) pairScore = 50;
          else if (deviation > 0.2) pairScore = 70;
          else if (deviation > 0.1) pairScore = 85;
          
          alignmentScore += pairScore * 2; // Higher weight for GDP-Employment
          totalWeight += 2;
          validPairs++;
        }

        // GDP-Inflation correlation
        if (correlationData.gdp && correlationData.inflation) {
          const correlation = this.calculatePearsonCorrelation(correlationData.gdp, correlationData.inflation);
          const expected = expectedCorrelations['GDP-Inflation'];
          const deviation = Math.abs(correlation - expected);
          
          let pairScore = 100;
          if (deviation > 0.4) pairScore = 30;
          else if (deviation > 0.3) pairScore = 50;
          else if (deviation > 0.2) pairScore = 70;
          else if (deviation > 0.1) pairScore = 85;
          
          alignmentScore += pairScore * 1;
          totalWeight += 1;
          validPairs++;
        }

        return validPairs > 0 ? Math.round(alignmentScore / totalWeight) : 75;
      }

      // Fallback if insufficient data
      return 75;

    } catch (error) {
      logger.warn('Failed to calculate correlation alignment:', error);
      return 75;
    }
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
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
      // Calculate actual statistical alerts from economic data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Count indicators with significant z-scores (>|1.5|) as alerts
      const result = await db.execute(sql`
        SELECT COUNT(*) as alert_count
        FROM economicIndicatorsCurrent 
        WHERE period_date >= ${thirtyDaysAgo.toISOString().split('T')[0]}
        AND (
          ABS(CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL)) > 1.5
          OR ABS(CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL)) > 2.0
        )
      `);
      
      const alertsLast30Days = result.rows.length > 0 ? parseInt((result.rows[0] as any).alert_count) || 0 : 0;
      
      let score = 100;
      
      // Penalty for excessive alerts (indicates market stress)
      if (alertsLast30Days > 25) score = 20;      // Very high stress
      else if (alertsLast30Days > 20) score = 40; // High stress  
      else if (alertsLast30Days > 15) score = 60; // Moderate stress
      else if (alertsLast30Days > 10) score = 80; // Low stress
      // else score = 100 (very low stress)
      
      logger.info(`Alert frequency: ${alertsLast30Days} alerts in last 30 days, score: ${score}`);
      return score;

    } catch (error) {
      logger.warn('Failed to calculate alert frequency:', error);
      return 75; // Default to moderate score
    }
  }

  private async calculateRegimeStability(): Promise<number> {
    try {
      // Calculate regime stability based on VIX and economic indicator volatility patterns
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Get VIX data for volatility regime analysis
      const vixResult = await db.execute(sql`
        SELECT value, created_at
        FROM market_sentiment 
        WHERE metric = 'VIX'
          AND created_at >= ${sixMonthsAgo.toISOString()}
        ORDER BY created_at DESC
        LIMIT 120
      `);
      
      if (vixResult.rows.length >= 30) {
        const vixValues = vixResult.rows
          .map(row => parseFloat((row as any).value))
          .filter(v => !isNaN(v));
          
        // Calculate volatility regime characteristics
        const avgVix = vixValues.reduce((a, b) => a + b, 0) / vixValues.length;
        const vixStdDev = Math.sqrt(vixValues.reduce((sq, v) => sq + Math.pow(v - avgVix, 2), 0) / vixValues.length);
        
        // Detect regime changes by looking for sustained shifts in volatility
        const recentVix = vixValues.slice(0, 30); // Last 30 days
        const earlierVix = vixValues.slice(30, 60); // Previous 30 days
        
        const recentAvg = recentVix.reduce((a, b) => a + b, 0) / recentVix.length;
        const earlierAvg = earlierVix.reduce((a, b) => a + b, 0) / earlierVix.length;
        
        // Calculate regime stability score
        let score = 85; // Base stability score
        
        // Penalty for high volatility
        if (avgVix > 25) score -= 20;        // High volatility regime
        else if (avgVix > 20) score -= 10;   // Moderate volatility
        
        // Penalty for regime instability (large shifts)
        const regimeShift = Math.abs(recentAvg - earlierAvg);
        if (regimeShift > 8) score -= 25;     // Major regime change
        else if (regimeShift > 5) score -= 15; // Moderate regime change
        else if (regimeShift > 3) score -= 5;  // Minor regime change
        
        // Penalty for excessive volatility in volatility
        const volatilityOfVolatility = vixStdDev / avgVix;
        if (volatilityOfVolatility > 0.4) score -= 15;
        else if (volatilityOfVolatility > 0.3) score -= 8;
        
        logger.info(`Regime stability: VIX avg=${avgVix.toFixed(1)}, shift=${regimeShift.toFixed(1)}, score=${Math.max(20, score)}`);
        return Math.max(20, Math.min(100, score));
      }
      
      // Fallback: use economic indicator stability if VIX data insufficient
      const keyIndicators = ['GDP Growth Rate', 'Core CPI (Δ-adjusted)', 'Unemployment Rate (Δ-adjusted)'];
      let stabilitySum = 0;
      let validIndicators = 0;
      
      for (const indicator of keyIndicators) {
        const result = await db.execute(sql`
          SELECT ABS(CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL)) as z_score_abs
          FROM economicIndicatorsCurrent 
          WHERE metric = ${indicator}
          ORDER BY period_date DESC 
          LIMIT 6
        `);
        
        if (result.rows.length >= 3) {
          const zScores = result.rows.map(row => parseFloat((row as any).z_score_abs)).filter(z => !isNaN(z));
          const avgZScore = zScores.reduce((a, b) => a + b, 0) / zScores.length;
          
          // Lower average z-scores indicate more stability
          let indicatorStability = 85;
          if (avgZScore > 2.5) indicatorStability = 30;
          else if (avgZScore > 2.0) indicatorStability = 50;
          else if (avgZScore > 1.5) indicatorStability = 70;
          
          stabilitySum += indicatorStability;
          validIndicators++;
        }
      }
      
      return validIndicators > 0 ? Math.round(stabilitySum / validIndicators) : 75;

    } catch (error) {
      logger.warn('Failed to calculate regime stability:', error);
      return 75;
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
      // Calculate alignment between economic indicators and sector performance
      const sectors = ['XLF', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE', 'XTN', 'XBI'];
      const keyEconomicIndicators = ['GDP Growth Rate', 'Core CPI (Δ-adjusted)', 'Unemployment Rate (Δ-adjusted)'];
      
      let alignmentSum = 0;
      let validAlignments = 0;
      
      // Get recent economic indicator directions (positive/negative z-scores)
      const economicSignals: { [key: string]: number } = {};
      
      for (const indicator of keyEconomicIndicators) {
        const result = await db.execute(sql`
          SELECT CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score
          FROM economicIndicatorsCurrent 
          WHERE metric = ${indicator}
          ORDER BY period_date DESC 
          LIMIT 1
        `);
        
        if (result.rows.length > 0) {
          const zScore = parseFloat((result.rows[0] as any).z_score);
          if (!isNaN(zScore)) {
            economicSignals[indicator] = zScore;
          }
        }
      }
      
      // Get recent sector performance (last 5 days vs previous 5 days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      for (const sector of sectors.slice(0, 6)) { // Focus on major sectors for efficiency
        const recentResult = await db.execute(sql`
          SELECT AVG(CAST(close AS DECIMAL)) as avg_price
          FROM stock_data 
          WHERE symbol = ${sector}
            AND timestamp >= ${fiveDaysAgo.toISOString()}
        `);
        
        const earlierResult = await db.execute(sql`
          SELECT AVG(CAST(close AS DECIMAL)) as avg_price
          FROM stock_data 
          WHERE symbol = ${sector}
            AND timestamp >= ${tenDaysAgo.toISOString()}
            AND timestamp < ${fiveDaysAgo.toISOString()}
        `);
        
        if (recentResult.rows.length > 0 && earlierResult.rows.length > 0) {
          const recentPrice = parseFloat((recentResult.rows[0] as any).avg_price);
          const earlierPrice = parseFloat((earlierResult.rows[0] as any).avg_price);
          
          if (!isNaN(recentPrice) && !isNaN(earlierPrice) && earlierPrice > 0) {
            const sectorPerformance = (recentPrice - earlierPrice) / earlierPrice;
            
            // Calculate expected performance based on economic signals
            let expectedDirection = 0;
            
            // GDP positive should benefit most sectors
            if (economicSignals['GDP Growth Rate']) {
              expectedDirection += economicSignals['GDP Growth Rate'] * 0.4;
            }
            
            // Unemployment improvement (negative z-score) should benefit sectors
            if (economicSignals['Unemployment Rate (Δ-adjusted)']) {
              expectedDirection -= economicSignals['Unemployment Rate (Δ-adjusted)'] * 0.3;
            }
            
            // Inflation effects vary by sector - simplified approach
            if (economicSignals['Core CPI (Δ-adjusted)']) {
              // Moderate inflation can be positive for some sectors, negative for utilities/bonds
              const inflationImpact = sector === 'XLU' ? -0.2 : 0.1;
              expectedDirection += economicSignals['Core CPI (Δ-adjusted)'] * inflationImpact;
            }
            
            // Score alignment between expected and actual performance
            const expectedSign = expectedDirection > 0 ? 1 : (expectedDirection < 0 ? -1 : 0);
            const actualSign = sectorPerformance > 0.01 ? 1 : (sectorPerformance < -0.01 ? -1 : 0);
            
            let alignmentScore = 50; // Neutral baseline
            
            if (expectedSign === actualSign && expectedSign !== 0) {
              // Perfect directional alignment
              alignmentScore = 85 + Math.min(15, Math.abs(expectedDirection) * 10);
            } else if (expectedSign === 0 || actualSign === 0) {
              // One neutral, one directional - partial alignment
              alignmentScore = 65;
            } else {
              // Opposite directions - misalignment
              alignmentScore = 35 - Math.min(15, Math.abs(expectedDirection) * 5);
            }
            
            alignmentSum += alignmentScore;
            validAlignments++;
          }
        }
      }
      
      const finalScore = validAlignments > 0 ? Math.round(alignmentSum / validAlignments) : 70;
      logger.info(`Sector alignment: ${validAlignments} sectors analyzed, average score: ${finalScore}`);
      return Math.max(30, Math.min(100, finalScore));

    } catch (error) {
      logger.warn('Failed to calculate sector alignment:', error);
      return 70;
    }
  }

  private calculateWeightedScore(componentScores: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [component, score] of Object.entries(componentScores)) {
      const weight = this.ENHANCED_SCORE_WEIGHTS[component as keyof typeof this.ENHANCED_SCORE_WEIGHTS] || 0;
      totalScore += (score as number) * (weight / 100); // Convert weight to decimal
      totalWeight += weight;
    }

    return (totalScore / totalWeight) * 100;
  }

  private calculateScoreBreakdown(componentScores: any) {
    return {
      coreHealth: Math.round(
        (componentScores.gdpHealth * this.ENHANCED_SCORE_WEIGHTS.gdpHealth +
         componentScores.employmentHealth * this.ENHANCED_SCORE_WEIGHTS.employmentHealth +
         componentScores.inflationStability * this.ENHANCED_SCORE_WEIGHTS.inflationStability) / 
        (this.ENHANCED_SCORE_WEIGHTS.gdpHealth + this.ENHANCED_SCORE_WEIGHTS.employmentHealth + this.ENHANCED_SCORE_WEIGHTS.inflationStability)
      ),
      correlationHarmony: Math.round(
        (componentScores.signalClarity * this.ENHANCED_SCORE_WEIGHTS.signalClarity +
         componentScores.crossIndicatorHarmony * this.ENHANCED_SCORE_WEIGHTS.crossIndicatorHarmony +
         componentScores.conflictResolution * this.ENHANCED_SCORE_WEIGHTS.conflictResolution +
         componentScores.forwardLookingAccuracy * this.ENHANCED_SCORE_WEIGHTS.forwardLookingAccuracy) / 
        (this.ENHANCED_SCORE_WEIGHTS.signalClarity + this.ENHANCED_SCORE_WEIGHTS.crossIndicatorHarmony + 
         this.ENHANCED_SCORE_WEIGHTS.conflictResolution + this.ENHANCED_SCORE_WEIGHTS.forwardLookingAccuracy)
      ),
      marketStress: Math.round(
        (componentScores.alertFrequency * this.ENHANCED_SCORE_WEIGHTS.alertFrequency +
         componentScores.regimeStability * this.ENHANCED_SCORE_WEIGHTS.regimeStability) / 
        (this.ENHANCED_SCORE_WEIGHTS.alertFrequency + this.ENHANCED_SCORE_WEIGHTS.regimeStability)
      ),
      confidence: Math.round(
        (componentScores.dataQuality * this.ENHANCED_SCORE_WEIGHTS.dataQuality +
         componentScores.sectorAlignment * this.ENHANCED_SCORE_WEIGHTS.sectorAlignment) / 
        (this.ENHANCED_SCORE_WEIGHTS.dataQuality + this.ENHANCED_SCORE_WEIGHTS.sectorAlignment)
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
        coreHealth: 15,
        correlationHarmony: 17,
        marketStress: 10,
        confidence: 8
      },
      componentScores: {
        gdpHealth: 50,
        employmentHealth: 50,
        inflationStability: 50,
        // Enhanced Multi-Dimensional Components
        signalClarity: 50,
        crossIndicatorHarmony: 50,
        conflictResolution: 50,
        forwardLookingAccuracy: 50,
        // Traditional Components
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

  // Enhanced Multi-Dimensional Signal Analysis Methods

  /**
   * Signal Clarity (25% weight): How definitively indicators point in direction
   * Measures: Z-score magnitude distribution, signal-to-noise ratio, confidence intervals
   */
  private async calculateSignalClarity(): Promise<number> {
    try {
      // Get all current economic indicators with z-scores
      const result = await db.execute(sql`
        SELECT 
          metric,
          CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score,
          CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL) as delta_z_score
        FROM economicIndicatorsCurrent 
        WHERE CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) != 0
        OR CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL) != 0
      `);

      if (result.rows.length === 0) return 50;

      // Extract z-scores and analyze signal clarity
      const indicators = result.rows.map(row => ({
        metric: (row as any).metric,
        zScore: parseFloat((row as any).z_score) || 0,
        deltaZScore: parseFloat((row as any).delta_z_score) || 0
      }));

      // Calculate signal clarity metrics
      let claritySum = 0;
      let validSignals = 0;

      for (const indicator of indicators) {
        const primarySignal = Math.abs(indicator.zScore);
        const deltaSignal = Math.abs(indicator.deltaZScore);
        
        // Use EconomicInsightClassifier to get signal strength
        const insights = await this.insightClassifier.classifyEconomicInsight(indicator.metric, {
          zScore: indicator.zScore,
          deltaZScore: indicator.deltaZScore,
          currentValue: 0, // Not needed for signal clarity
          historicalMean: 0,
          category: 'Growth' // Will be determined by classifier
        });

        // Score based on signal magnitude and confidence
        let signalScore = 0;
        
        // Primary signal strength (0-100)
        if (primarySignal > 2.5) signalScore += 40;      // Very strong signal
        else if (primarySignal > 2.0) signalScore += 35; // Strong signal
        else if (primarySignal > 1.5) signalScore += 25; // Moderate signal
        else if (primarySignal > 1.0) signalScore += 15; // Weak signal
        else if (primarySignal > 0.5) signalScore += 5;  // Noise level

        // Delta signal consistency (0-30)
        const signalAlignment = primarySignal > 0 && deltaSignal > 0 ? 
          Math.min(primarySignal, deltaSignal) / Math.max(primarySignal, deltaSignal) : 0;
        signalScore += signalAlignment * 30;

        // Confidence bonus from classifier (0-30)
        signalScore += insights.confidence * 30;

        claritySum += signalScore;
        validSignals++;
      }

      const averageClarity = validSignals > 0 ? claritySum / validSignals : 50;
      
      logger.info(`Signal Clarity: ${validSignals} indicators, average clarity: ${averageClarity.toFixed(1)}`);
      return Math.max(0, Math.min(100, Math.round(averageClarity)));

    } catch (error) {
      logger.warn('Failed to calculate signal clarity:', error);
      return 50;
    }
  }

  /**
   * Cross-Indicator Harmony (35% weight): Level-trend alignment across economy
   * Measures: Multi-dimensional classification consistency, economic coherence
   */
  private async calculateCrossIndicatorHarmony(): Promise<number> {
    try {
      // Get key economic indicators by category
      const keyIndicators = {
        'Growth': ['GDP Growth Rate', 'Retail Sales', 'Housing Starts'],
        'Labor': ['Unemployment Rate (Δ-adjusted)', 'Nonfarm Payrolls', 'Employment Population Ratio'],
        'Inflation': ['Core CPI (Δ-adjusted)', 'Core PCE Price Index (Δ-adjusted)'],
        'Monetary Policy': ['Federal Funds Rate (Δ-adjusted)', '10-Year Treasury Yield (Δ-adjusted)']
      };

      const categoryInsights: { [key: string]: any[] } = {};
      
      // Classify insights for each category
      for (const [category, metrics] of Object.entries(keyIndicators)) {
        categoryInsights[category] = [];
        
        for (const metric of metrics) {
          const result = await db.execute(sql`
            SELECT 
              metric,
              value,
              CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score,
              CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL) as delta_z_score
            FROM economicIndicatorsCurrent 
            WHERE metric = ${metric}
            ORDER BY period_date DESC 
            LIMIT 1
          `);

          if (result.rows.length > 0) {
            const row = result.rows[0] as any;
            const insights = await this.insightClassifier.classifyEconomicInsight(metric, {
              zScore: parseFloat(row.z_score) || 0,
              deltaZScore: parseFloat(row.delta_z_score) || 0,
              currentValue: parseFloat(row.value) || 0,
              historicalMean: 0,
              category: category as any
            });
            
            categoryInsights[category].push(insights);
          }
        }
      }

      // Calculate harmony within and across categories
      let totalHarmony = 0;
      let validCategories = 0;

      for (const [category, insights] of Object.entries(categoryInsights)) {
        if (insights.length >= 2) {
          // Within-category harmony
          const directions = insights.map(insight => 
            insight.levelSignal === 'positive' ? 1 : 
            insight.levelSignal === 'negative' ? -1 : 0
          );
          
          const trendDirections = insights.map(insight => 
            insight.trendSignal === 'improving' ? 1 : 
            insight.trendSignal === 'deteriorating' ? -1 : 0
          );

          // Calculate directional consistency
          const levelConsistency = this.calculateDirectionalConsistency(directions);
          const trendConsistency = this.calculateDirectionalConsistency(trendDirections);
          
          // Average confidence within category
          const avgConfidence = insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;
          
          const categoryHarmony = (levelConsistency + trendConsistency) / 2 * 100 * (0.7 + 0.3 * avgConfidence);
          totalHarmony += categoryHarmony;
          validCategories++;
        }
      }

      // Cross-category harmony bonus
      let crossCategoryBonus = 0;
      if (validCategories >= 3) {
        // Check for logical economic relationships
        const growthPositive = this.getCategoryDirection(categoryInsights['Growth']);
        const laborPositive = this.getCategoryDirection(categoryInsights['Labor']);
        const inflationDirection = this.getCategoryDirection(categoryInsights['Inflation']);
        
        // Growth and employment should generally align
        if (growthPositive !== null && laborPositive !== null && growthPositive === laborPositive) {
          crossCategoryBonus += 10;
        }
        
        // Moderate inflation with growth is healthy
        if (growthPositive === 1 && inflationDirection !== null && Math.abs(inflationDirection) <= 1) {
          crossCategoryBonus += 5;
        }
      }

      const finalHarmony = validCategories > 0 ? 
        Math.min(100, (totalHarmony / validCategories) + crossCategoryBonus) : 50;

      logger.info(`Cross-Indicator Harmony: ${validCategories} categories, harmony: ${finalHarmony.toFixed(1)}`);
      return Math.max(0, Math.min(100, Math.round(finalHarmony)));

    } catch (error) {
      logger.warn('Failed to calculate cross-indicator harmony:', error);
      return 50;
    }
  }

  /**
   * Conflict Resolution (20% weight): Handling mixed economic signals
   * Measures: Signal contradiction detection, resolution quality, confidence weighting
   */
  private async calculateConflictResolution(): Promise<number> {
    try {
      // Get all indicators with meaningful signals
      const result = await db.execute(sql`
        SELECT 
          metric,
          value,
          CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score,
          CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL) as delta_z_score
        FROM economicIndicatorsCurrent 
        WHERE ABS(CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL)) > 0.5
        OR ABS(CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL)) > 0.5
      `);

      if (result.rows.length < 3) return 50;

      const conflicts: any[] = [];
      const allInsights: any[] = [];

      // Classify all indicators and identify conflicts
      for (const row of result.rows) {
        const metric = (row as any).metric;
        const insights = await this.insightClassifier.classifyEconomicInsight(metric, {
          zScore: parseFloat((row as any).z_score) || 0,
          deltaZScore: parseFloat((row as any).delta_z_score) || 0,
          currentValue: parseFloat((row as any).value) || 0,
          historicalMean: 0,
          category: this.determineCategory(metric)
        });
        
        allInsights.push({ metric, ...insights });
      }

      // Identify contradictory signals
      for (let i = 0; i < allInsights.length; i++) {
        for (let j = i + 1; j < allInsights.length; j++) {
          const insight1 = allInsights[i];
          const insight2 = allInsights[j];
          
          // Check for level-trend conflicts within same indicator
          if (insight1.metric === insight2.metric) continue;
          
          // Check for cross-indicator conflicts in related categories
          const isConflict = this.detectSignalConflict(insight1, insight2);
          if (isConflict) {
            conflicts.push({
              indicator1: insight1.metric,
              indicator2: insight2.metric,
              type: isConflict,
              severity: this.calculateConflictSeverity(insight1, insight2)
            });
          }
        }
      }

      // Calculate conflict resolution score
      let resolutionScore = 100;
      
      if (conflicts.length > 0) {
        // Penalty based on number and severity of conflicts
        const totalSeverity = conflicts.reduce((sum, conflict) => sum + conflict.severity, 0);
        const avgSeverity = totalSeverity / conflicts.length;
        
        // Base penalty for conflicts
        resolutionScore -= conflicts.length * 5;
        
        // Additional penalty for severity
        resolutionScore -= avgSeverity * 20;
        
        // Bonus for having mixed signals with high confidence (sophisticated economy)
        const highConfidenceConflicts = conflicts.filter(c => 
          allInsights.find(i => i.metric === c.indicator1)?.confidence > 0.7 &&
          allInsights.find(i => i.metric === c.indicator2)?.confidence > 0.7
        );
        
        if (highConfidenceConflicts.length > 0) {
          resolutionScore += Math.min(15, highConfidenceConflicts.length * 3);
        }
      }

      logger.info(`Conflict Resolution: ${conflicts.length} conflicts detected, resolution score: ${resolutionScore}`);
      return Math.max(20, Math.min(100, Math.round(resolutionScore)));

    } catch (error) {
      logger.warn('Failed to calculate conflict resolution:', error);
      return 50;
    }
  }

  /**
   * Forward-Looking Accuracy (20% weight): Predictive capability with leading indicators
   * Measures: Leading indicator performance, trend prediction accuracy, regime forecasting
   */
  private async calculateForwardLookingAccuracy(): Promise<number> {
    try {
      const leadingIndicators = [
        '10-Year Treasury Yield (Δ-adjusted)',
        'Average Weekly Hours',
        'Housing Starts',
        'Michigan Consumer Sentiment',
        'Yield Curve (10yr-2yr)'
      ];

      let accuracySum = 0;
      let validPredictions = 0;

      for (const indicator of leadingIndicators) {
        // Get historical data for trend analysis
        const result = await db.execute(sql`
          SELECT 
            value,
            period_date,
            CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score,
            CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL) as delta_z_score
          FROM economicIndicatorsCurrent 
          WHERE metric = ${indicator}
          ORDER BY period_date DESC 
          LIMIT 6
        `);

        if (result.rows.length >= 4) {
          const values = result.rows.map(row => ({
            value: parseFloat((row as any).value),
            date: (row as any).period_date,
            zScore: parseFloat((row as any).z_score) || 0,
            deltaZScore: parseFloat((row as any).delta_z_score) || 0
          })).reverse(); // Chronological order

          // Calculate prediction accuracy metrics
          const currentInsight = await this.insightClassifier.classifyEconomicInsight(indicator, {
            zScore: values[values.length - 1].zScore,
            deltaZScore: values[values.length - 1].deltaZScore,
            currentValue: values[values.length - 1].value,
            historicalMean: 0,
            category: this.determineCategory(indicator)
          });

          // Assess trend prediction capability
          const trendAccuracy = this.assessTrendPredictionAccuracy(values);
          
          // Assess signal stability for forecasting
          const signalStability = this.calculateSignalStability(values);
          
          // Combined accuracy score
          const indicatorAccuracy = (
            trendAccuracy * 0.4 +           // 40% trend prediction
            signalStability * 0.3 +         // 30% signal stability  
            currentInsight.confidence * 0.3  // 30% current signal confidence
          ) * 100;

          accuracySum += indicatorAccuracy;
          validPredictions++;
        }
      }

      // Calculate regime forecasting capability
      const regimeForecast = await this.calculateRegimeForecastingCapability();
      
      const finalAccuracy = validPredictions > 0 ? 
        (accuracySum / validPredictions) * 0.8 + regimeForecast * 0.2 : 50;

      logger.info(`Forward-Looking Accuracy: ${validPredictions} indicators, accuracy: ${finalAccuracy.toFixed(1)}`);
      return Math.max(0, Math.min(100, Math.round(finalAccuracy)));

    } catch (error) {
      logger.warn('Failed to calculate forward-looking accuracy:', error);
      return 50;
    }
  }

  /**
   * Enhanced Alert Frequency - replaces the basic alert frequency with more sophisticated analysis
   */
  private async calculateEnhancedAlertFrequency(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get all significant alerts with categories
      const result = await db.execute(sql`
        SELECT 
          metric,
          CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score,
          CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL) as delta_z_score,
          period_date
        FROM economicIndicatorsCurrent 
        WHERE period_date >= ${thirtyDaysAgo.toISOString().split('T')[0]}
        AND (
          ABS(CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL)) > 1.5
          OR ABS(CAST(COALESCE(NULLIF(delta_z_score, ''), '0') AS DECIMAL)) > 2.0
        )
      `);

      // Categorize alerts by severity and type
      const alerts = {
        critical: 0,    // |z-score| > 2.5
        high: 0,        // |z-score| > 2.0
        moderate: 0,    // |z-score| > 1.5
        byCategory: {} as { [key: string]: number }
      };

      for (const row of result.rows) {
        const zScore = Math.abs(parseFloat((row as any).z_score) || 0);
        const deltaZScore = Math.abs(parseFloat((row as any).delta_z_score) || 0);
        const maxScore = Math.max(zScore, deltaZScore);
        
        if (maxScore > 2.5) alerts.critical++;
        else if (maxScore > 2.0) alerts.high++;
        else alerts.moderate++;

        // Categorize by economic category
        const category = this.determineCategory((row as any).metric);
        alerts.byCategory[category] = (alerts.byCategory[category] || 0) + 1;
      }

      // Calculate sophisticated stress score
      let stressScore = 100;
      
      // Critical alerts have exponential impact
      stressScore -= alerts.critical * 15;
      stressScore -= alerts.high * 8;
      stressScore -= alerts.moderate * 3;
      
      // Broad-based stress penalty (alerts across multiple categories)
      const categoriesAffected = Object.keys(alerts.byCategory).length;
      if (categoriesAffected > 3) stressScore -= (categoriesAffected - 3) * 5;
      
      // Concentration bonus (if alerts are concentrated in one area, less systemic)
      const maxCategoryAlerts = Math.max(...Object.values(alerts.byCategory));
      const totalAlerts = alerts.critical + alerts.high + alerts.moderate;
      if (totalAlerts > 0 && maxCategoryAlerts / totalAlerts > 0.7) {
        stressScore += 10; // Concentrated stress is better than broad-based
      }

      const finalScore = Math.max(10, Math.min(100, stressScore));
      
      logger.info(`Enhanced Alert Frequency: ${totalAlerts} alerts (${alerts.critical} critical), score: ${finalScore}`);
      return finalScore;

    } catch (error) {
      logger.warn('Failed to calculate enhanced alert frequency:', error);
      return 75;
    }
  }

  // Helper methods for multi-dimensional analysis

  private calculateDirectionalConsistency(directions: number[]): number {
    if (directions.length < 2) return 0.5;
    
    const nonZeroDirections = directions.filter(d => d !== 0);
    if (nonZeroDirections.length === 0) return 0.5;
    
    const positiveCount = nonZeroDirections.filter(d => d > 0).length;
    const negativeCount = nonZeroDirections.filter(d => d < 0).length;
    
    return Math.max(positiveCount, negativeCount) / nonZeroDirections.length;
  }

  private getCategoryDirection(insights: any[]): number | null {
    if (!insights || insights.length === 0) return null;
    
    const directions = insights.map(insight => 
      insight.levelSignal === 'positive' ? 1 : 
      insight.levelSignal === 'negative' ? -1 : 0
    );
    
    const sum = directions.reduce((a, b) => a + b, 0);
    return sum / directions.length;
  }

  private determineCategory(metric: string): 'Growth' | 'Labor' | 'Inflation' | 'Monetary Policy' | 'Sentiment' {
    if (metric.includes('GDP') || metric.includes('Retail') || metric.includes('Housing') || metric.includes('Construction') || metric.includes('Income')) {
      return 'Growth';
    }
    if (metric.includes('Unemployment') || metric.includes('Payrolls') || metric.includes('Employment') || metric.includes('JOLTS') || metric.includes('Labor Force')) {
      return 'Labor';
    }
    if (metric.includes('CPI') || metric.includes('PCE') || metric.includes('PPI') || metric.includes('Inflation')) {
      return 'Inflation';
    }
    if (metric.includes('Treasury') || metric.includes('Federal Funds') || metric.includes('Yield')) {
      return 'Monetary Policy';
    }
    return 'Sentiment';
  }

  private detectSignalConflict(insight1: any, insight2: any): string | null {
    // Check for directional conflicts between related indicators
    if (insight1.levelSignal === 'positive' && insight2.levelSignal === 'negative') {
      if (this.areRelatedIndicators(insight1.metric, insight2.metric)) {
        return 'directional_conflict';
      }
    }
    
    // Check for level-trend conflicts within indicator
    if (insight1.levelSignal === 'positive' && insight1.trendSignal === 'deteriorating') {
      return 'level_trend_conflict';
    }
    
    return null;
  }

  private areRelatedIndicators(metric1: string, metric2: string): boolean {
    // Define economically related indicator pairs
    const relatedPairs = [
      ['GDP Growth Rate', 'Unemployment Rate'],
      ['Nonfarm Payrolls', 'Unemployment Rate'],
      ['Core CPI', 'Federal Funds Rate'],
      ['Housing Starts', '10-Year Treasury Yield']
    ];
    
    return relatedPairs.some(pair => 
      (pair[0] === metric1 && pair[1] === metric2) ||
      (pair[0] === metric2 && pair[1] === metric1)
    );
  }

  private calculateConflictSeverity(insight1: any, insight2: any): number {
    // Base severity on confidence levels and signal strength
    const avgConfidence = (insight1.confidence + insight2.confidence) / 2;
    const signalStrength = Math.max(
      Math.abs(insight1.zScore || 0),
      Math.abs(insight2.zScore || 0)
    );
    
    return avgConfidence * (signalStrength / 3); // Normalize to 0-1 range
  }

  private assessTrendPredictionAccuracy(values: any[]): number {
    if (values.length < 4) return 0.5;
    
    // Calculate how well trends predicted subsequent movements
    let accuracySum = 0;
    let predictions = 0;
    
    for (let i = 2; i < values.length - 1; i++) {
      const prevTrend = values[i].value - values[i-1].value;
      const actualNext = values[i+1].value - values[i].value;
      
      // Check if trend direction predicted next movement
      const trendDirection = prevTrend > 0 ? 1 : (prevTrend < 0 ? -1 : 0);
      const actualDirection = actualNext > 0 ? 1 : (actualNext < 0 ? -1 : 0);
      
      if (trendDirection === actualDirection && trendDirection !== 0) {
        accuracySum += 1;
      } else if (trendDirection === 0 || actualDirection === 0) {
        accuracySum += 0.5;
      }
      
      predictions++;
    }
    
    return predictions > 0 ? accuracySum / predictions : 0.5;
  }

  private calculateSignalStability(values: any[]): number {
    if (values.length < 3) return 0.5;
    
    // Calculate volatility of z-scores
    const zScores = values.map(v => v.zScore);
    const volatility = this.calculateVolatility(zScores);
    
    // Lower volatility = higher stability
    if (volatility < 0.5) return 0.9;
    if (volatility < 1.0) return 0.7;
    if (volatility < 1.5) return 0.5;
    if (volatility < 2.0) return 0.3;
    return 0.1;
  }

  private async calculateRegimeForecastingCapability(): Promise<number> {
    try {
      // Use VIX trend and yield curve to assess regime forecasting
      const vixResult = await db.execute(sql`
        SELECT value, created_at
        FROM market_sentiment 
        WHERE metric = 'VIX'
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      if (vixResult.rows.length >= 5) {
        const vixValues = vixResult.rows.map(row => parseFloat((row as any).value)).filter(v => !isNaN(v));
        const trendConsistency = this.calculateTrendConsistency(vixValues);
        
        // Higher trend consistency = better forecasting capability
        return Math.max(30, Math.min(90, 50 + trendConsistency * 40));
      }
      
      return 50;
    } catch (error) {
      return 50;
    }
  }
}