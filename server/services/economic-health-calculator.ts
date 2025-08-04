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