import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../utils/logger';
import { cacheService } from './cache-unified';
import { EconomicInsightClassifier } from './economic-insight-classifier';

// New "Economic Pulse" Score Interfaces
export interface DataQualityMetrics {
  freshness: number; // Days since latest data
  completeness: number; // % of indicators with recent data
  revision_risk: number; // How much could revisions change score
}

export interface HealthScoreResult {
  score: number;
  confidence: number; // 0-100
  range: [number, number]; // 95% confidence interval
  dataQuality: DataQualityMetrics;
  keyDrivers: string[]; // Top 3 factors moving the score
  riskFactors: string[]; // What could go wrong
}

export interface WeightStructure {
  growthMomentum: number;
  financialStress: number;
  laborHealth: number;
  inflationTrajectory: number;
  policyEffectiveness: number;
  economicExpectations: number;
}

export interface ComponentScores {
  growthMomentum: number;
  financialStress: number;
  laborHealth: number;
  inflationTrajectory: number;
  policyEffectiveness: number;
  economicExpectations: number;
}

// Layer breakdown for transparency (2-layer system using only reliable data)
export interface LayerBreakdown {
  coreEconomicMomentum: number; // 75% weight (increased from 60%)
  inflationPolicyBalance: number; // 25% weight (unchanged)
  forwardLookingConfidence: number; // 0% weight (removed - was 15%)
}

export interface EconomicHealthScore {
  overallScore: number;
  layerBreakdown: LayerBreakdown;
  componentScores: ComponentScores;
  weights: WeightStructure;
  result: HealthScoreResult;
  regime: 'expansion' | 'slowdown' | 'recession' | 'recovery';
}

export class EconomicHealthCalculator {
  private cache = cacheService;
  private insightClassifier = new EconomicInsightClassifier();

  // Revised weights for the 2-layer Economic Pulse Score (using only reliable data sources)
  private readonly BASE_WEIGHTS: WeightStructure = {
    // Layer 1: Core Economic Momentum (75% - increased from 60%)
    growthMomentum: 0.30,        // Increased from 0.25 (FRED: HOUST, TTLCON, GDP)
    financialStress: 0.25,       // Increased from 0.20 (VIX, Fed Funds, Treasury) 
    laborHealth: 0.20,           // Increased from 0.15 (FRED: EMRATIO, PAYEMS, UNRATE)
    
    // Layer 2: Inflation & Policy Balance (25% - unchanged)
    inflationTrajectory: 0.15,   // Unchanged (FRED: CPILFESL, PCEPILFE, PPILFE)
    policyEffectiveness: 0.10,   // Unchanged (FRED: FEDFUNDS, M2SL)
    
    // Layer 3: REMOVED - Forward-Looking Confidence (0% - was 15%)
    economicExpectations: 0.00   // Removed - unreliable Consumer Confidence data
  };

  async calculateEconomicHealthScore(): Promise<EconomicHealthScore> {
    const cacheKey = 'economic-pulse-score';
    const cached = this.cache.get<EconomicHealthScore>(cacheKey);
    if (cached) return cached;

    logger.info('🧮 Calculating Economic Pulse Score with 3-layer validation-driven approach');

    try {
      // Step 1: Detect current economic regime
      const regime = await this.detectEconomicRegime();
      
      // Step 2: Calculate dynamic weights based on regime and data quality
      const weights = this.calculateDynamicWeights(regime);
      
      // Step 3: Calculate the 6 core component scores
      const componentScores = await this.calculateCoreComponents();
      
      // Step 4: Calculate layer breakdowns
      const layerBreakdown = this.calculateLayerBreakdown(componentScores, weights);
      
      // Step 5: Calculate weighted overall score with confidence intervals
      const result = await this.calculateHealthScoreResult(componentScores, weights);

      const healthScore: EconomicHealthScore = {
        overallScore: result.score,
        layerBreakdown,
        componentScores,
        weights,
        result,
        regime
      };

      this.cache.set(cacheKey, healthScore, 60 * 10); // Cache for 10 minutes
      logger.info(`Economic Pulse Score: ${result.score} (confidence: ${result.confidence}%)`);
      
      return healthScore;

    } catch (error) {
      logger.warn('Failed to calculate Economic Pulse Score:', error);
      return this.getDefaultEconomicPulseScore();
    }
  }

  // NEW ECONOMIC PULSE METHODOLOGY IMPLEMENTATION

  /**
   * Detect current economic regime for dynamic weight adjustment
   */
  private async detectEconomicRegime(): Promise<'expansion' | 'slowdown' | 'recession' | 'recovery'> {
    try {
      const result = await db.execute(sql`
        SELECT metric, value,
               CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score
        FROM economic_indicators_current 
        WHERE metric IN ('GDP Growth Rate', 'Unemployment Rate (Δ-adjusted)', 'Employment Population Ratio')
        ORDER BY period_date DESC
      `);

      let recessonSignals = 0;
      let slowdownSignals = 0;
      let expansionSignals = 0;

      for (const row of result.rows) {
        const metric = (row as any).metric;
        const zScore = parseFloat((row as any).z_score) || 0;
        const value = parseFloat((row as any).value) || 0;

        if (metric === 'GDP Growth Rate') {
          if (value < 0) recessonSignals += 2;
          else if (value < 1.5) slowdownSignals += 1;
          else if (value > 3.0) expansionSignals += 1;
        }
        
        if (metric === 'Unemployment Rate (Δ-adjusted)') {
          if (zScore > 1.5) recessonSignals += 1; // Rising unemployment
          else if (zScore < -1.5) expansionSignals += 1; // Falling unemployment
        }
      }

      if (recessonSignals >= 2) return 'recession';
      if (slowdownSignals >= 2) return 'slowdown';
      if (expansionSignals >= 1) return 'expansion';
      return 'expansion'; // Default to expansion
      
    } catch (error) {
      logger.warn('Failed to detect economic regime:', error);
      return 'expansion';
    }
  }

  /**
   * Calculate dynamic weights based on regime and data quality
   */
  private calculateDynamicWeights(regime: string): WeightStructure {
    const weights = { ...this.BASE_WEIGHTS };

    // Adjust based on economic regime
    if (regime === 'slowdown') {
      weights.financialStress += 0.05; // Increase from 20% to 25%
      weights.economicExpectations += 0.05; // Increase from 15% to 20%
      weights.growthMomentum -= 0.05; // Decrease from 25% to 20%
      weights.inflationTrajectory -= 0.05; // Decrease from 15% to 10%
    }

    return this.normalizeWeights(weights);
  }

  private normalizeWeights(weights: WeightStructure): WeightStructure {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const normalized: WeightStructure = {} as WeightStructure;
    
    for (const [key, value] of Object.entries(weights)) {
      normalized[key as keyof WeightStructure] = value / total;
    }
    
    return normalized;
  }

  /**
   * Calculate the 6 core component scores
   */
  private async calculateCoreComponents(): Promise<ComponentScores> {
    logger.info('📊 Calculating 6 core Economic Pulse components');

    const [
      growthMomentum,
      financialStress,
      laborHealth,
      inflationTrajectory,
      policyEffectiveness,
      economicExpectations
    ] = await Promise.all([
      this.calculateGrowthMomentum(),
      this.calculateFinancialStress(),
      this.calculateLaborHealth(),
      this.calculateInflationTrajectory(),
      this.calculatePolicyEffectiveness(),
      this.calculateEconomicExpectations()
    ]);

    return {
      growthMomentum,
      financialStress,
      laborHealth,
      inflationTrajectory,
      policyEffectiveness,
      economicExpectations
    };
  }

  /**
   * Calculate layer breakdowns for transparency (2-layer system using reliable data)
   */
  private calculateLayerBreakdown(components: ComponentScores, weights: WeightStructure): LayerBreakdown {
    // Layer 1: Core Economic Momentum (75% total weight)
    const coreEconomicMomentum = 
      components.growthMomentum * (weights.growthMomentum / 0.75) +
      components.financialStress * (weights.financialStress / 0.75) +
      components.laborHealth * (weights.laborHealth / 0.75);

    // Layer 2: Inflation & Policy Balance (25% total weight) 
    const inflationPolicyBalance = 
      components.inflationTrajectory * (weights.inflationTrajectory / 0.25) +
      components.policyEffectiveness * (weights.policyEffectiveness / 0.25);

    // Layer 3: REMOVED - Forward-Looking Confidence (0% weight)
    const forwardLookingConfidence = 0; // No longer using unreliable Consumer Confidence data

    return {
      coreEconomicMomentum: Math.round(coreEconomicMomentum),
      inflationPolicyBalance: Math.round(inflationPolicyBalance),
      forwardLookingConfidence: Math.round(forwardLookingConfidence)
    };
  }

  /**
   * Calculate final health score result with confidence intervals
   */
  private async calculateHealthScoreResult(components: ComponentScores, weights: WeightStructure): Promise<HealthScoreResult> {
    // Calculate weighted score
    const score = Math.round(
      components.growthMomentum * weights.growthMomentum +
      components.financialStress * weights.financialStress +
      components.laborHealth * weights.laborHealth +
      components.inflationTrajectory * weights.inflationTrajectory +
      components.policyEffectiveness * weights.policyEffectiveness +
      components.economicExpectations * weights.economicExpectations
    );

    // Calculate confidence and data quality
    const dataQuality = await this.assessDataQuality();
    const confidence = this.calculateConfidence(components, dataQuality);
    const range = this.calculateConfidenceInterval(score, confidence);

    // Identify key drivers and risk factors
    const keyDrivers = this.identifyKeyDrivers(components, weights);
    const riskFactors = this.identifyRiskFactors(components);

    return {
      score,
      confidence,
      range,
      dataQuality,
      keyDrivers,
      riskFactors
    };
  }

  // LAYER 1: CORE ECONOMIC MOMENTUM (60%)

  /**
   * A. Growth Momentum (25%): 3-quarter GDP trend + employment momentum + consumption health
   */
  private async calculateGrowthMomentum(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT metric, value_numeric as value, period_date,
               CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score
        FROM economic_indicators_current 
        WHERE metric IN ('GDP Growth Rate', 'Employment Population Ratio', 'Retail Sales')
        ORDER BY period_date DESC
      `);

      let score = 50;
      let indicators = 0;

      for (const row of result.rows) {
        const metric = (row as any).metric;
        const value = parseFloat((row as any).value) || 0;

        if (metric === 'GDP Growth Rate') {
          score += this.scorePercentileRange(value, [0, 1.5, 2.5, 3.5, 5.0]) * 0.4;
          indicators++;
        }
        
        if (metric === 'Employment Population Ratio') {
          const percentile = this.calculateHistoricalPercentileForValue(value, 'employment');
          score += this.convertPercentileToScore(percentile) * 0.35;
          indicators++;
        }
        
        if (metric === 'Retail Sales') {
          const monthlyGrowth = value;
          if (monthlyGrowth > 0.5) score += 10;
          else if (monthlyGrowth > 0) score += 5;
          else if (monthlyGrowth < -0.5) score -= 10;
          indicators++;
        }
      }

      return Math.max(0, Math.min(100, Math.round(score / Math.max(1, indicators))));
    } catch (error) {
      logger.warn('Failed to calculate growth momentum:', error);
      return 50;
    }
  }

  /**
   * B. Financial Stress Indicator (20%): Yield curve + VIX + credit spreads
   */
  private async calculateFinancialStress(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT metric, value_numeric as value
        FROM economic_indicators_current 
        WHERE metric IN ('Yield Curve (10yr-2yr)', 'VIX', '10-Year Treasury Yield (Δ-adjusted)')
        ORDER BY period_date DESC
      `);

      let stressScore = 100; // Start with low stress (good)
      
      for (const row of result.rows) {
        const metric = (row as any).metric;
        const value = parseFloat((row as any).value) || 0;

        if (metric === 'Yield Curve (10yr-2yr)') {
          if (value < -0.5) stressScore -= 30; // Deep inversion = high stress
          else if (value < 0) stressScore -= 15; // Any inversion = stress
          else if (value > 2.0) stressScore += 10; // Steep curve = low stress
        }
        
        if (metric === 'VIX') {
          if (value > 30) stressScore -= 25; // High fear
          else if (value > 20) stressScore -= 10; // Moderate fear
          else if (value < 15) stressScore += 5; // Complacency
        }
      }

      return Math.max(0, Math.min(100, stressScore));
    } catch (error) {
      logger.warn('Failed to calculate financial stress:', error);
      return 70; // Moderate stress default
    }
  }

  /**
   * C. Labor Market Health (15%): JOLTS ratio + layoff trends + quit rate
   */
  private async calculateLaborHealth(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT metric, value_numeric as value,
               CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score
        FROM economic_indicators_current 
        WHERE metric IN ('Unemployment Rate (Δ-adjusted)', 'Nonfarm Payrolls', 'Employment Population Ratio')
        ORDER BY period_date DESC
      `);

      let score = 50;
      let indicators = 0;

      for (const row of result.rows) {
        const metric = (row as any).metric;
        const zScore = parseFloat((row as any).z_score) || 0;
        const value = parseFloat((row as any).value) || 0;

        if (metric === 'Unemployment Rate (Δ-adjusted)') {
          // Lower unemployment is better (inverted scoring)
          if (zScore < -1.5) score += 20; // Strongly falling unemployment
          else if (zScore < -0.5) score += 10; // Modestly falling
          else if (zScore > 1.5) score -= 20; // Rising unemployment
          indicators++;
        }
        
        if (metric === 'Nonfarm Payrolls') {
          const monthlyJobs = value; // Monthly change in thousands
          if (monthlyJobs > 250) score += 15; // Strong job growth
          else if (monthlyJobs > 100) score += 10; // Moderate growth
          else if (monthlyJobs < 0) score -= 15; // Job losses
          indicators++;
        }
        
        if (metric === 'Employment Population Ratio') {
          // Use trend analysis for employment ratio
          if (zScore > 1.0) score += 15; // Rising employment ratio
          else if (zScore < -1.0) score -= 10; // Falling ratio
          indicators++;
        }
      }

      return Math.max(0, Math.min(100, Math.round(score / Math.max(1, indicators))));
    } catch (error) {
      logger.warn('Failed to calculate labor health:', error);
      return 50;
    }
  }

  // LAYER 2: INFLATION & POLICY BALANCE (25%)

  /**
   * D. Inflation Trajectory (15%): Core inflation trend + breadth + expectations
   */
  private async calculateInflationTrajectory(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT metric, value_numeric as value,
               CAST(COALESCE(NULLIF(z_score, ''), '0') AS DECIMAL) as z_score
        FROM economic_indicators_current 
        WHERE metric IN ('Core CPI (Δ-adjusted)', 'Core PCE Price Index (Δ-adjusted)')
        ORDER BY period_date DESC
      `);

      let score = 50;
      
      for (const row of result.rows) {
        const metric = (row as any).metric;
        const value = parseFloat((row as any).value) || 0;

        if (metric === 'Core CPI (Δ-adjusted)' || metric === 'Core PCE Price Index (Δ-adjusted)') {
          // Target zone scoring (2% +/- 0.5% is optimal)
          if (value >= 1.5 && value <= 2.5) {
            score += 25; // In target range
          } else if (value >= 1.0 && value <= 3.0) {
            score += 10; // Close to target
          } else if (value > 4.0) {
            score -= 25; // High inflation
          } else if (value < 0.5) {
            score -= 15; // Deflation risk
          }
          break; // Use first available measure
        }
      }

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      logger.warn('Failed to calculate inflation trajectory:', error);
      return 50;
    }
  }

  /**
   * E. Policy Effectiveness (10%): Fed policy stance + fiscal impact
   */
  private async calculatePolicyEffectiveness(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT metric, value_numeric as value
        FROM economic_indicators_current 
        WHERE metric IN ('Federal Funds Rate (Δ-adjusted)', '10-Year Treasury Yield (Δ-adjusted)')
        ORDER BY period_date DESC
      `);

      let score = 50;
      
      for (const row of result.rows) {
        const metric = (row as any).metric;
        const value = parseFloat((row as any).value) || 0;

        if (metric === 'Federal Funds Rate (Δ-adjusted)') {
          // Assess appropriateness of current rate level
          if (value >= 2.0 && value <= 5.0) {
            score += 15; // Normal policy range
          } else if (value > 5.0) {
            score += 5; // Restrictive but controlled
          } else if (value < 1.0) {
            score -= 10; // Too accommodative risk
          }
        }
      }

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      logger.warn('Failed to calculate policy effectiveness:', error);
      return 55;
    }
  }

  // LAYER 3: FORWARD-LOOKING CONFIDENCE (15%)

  /**
   * F. Economic Expectations (REMOVED): Was 15% weight, now 0%
   * Consumer Confidence data is unreliable and not consistently available via FRED API
   */
  private async calculateEconomicExpectations(): Promise<number> {
    // No longer calculate economic expectations due to unreliable data sources
    // Consumer Confidence Index and Business Survey data are not consistently available
    logger.info('📊 Economic Expectations calculation skipped - using reliable FRED data only');
    return 0; // Return 0 as this component is removed from scoring
  }

  // SUPPORTING METHODS FOR NEW METHODOLOGY

  private async assessDataQuality(): Promise<DataQualityMetrics> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as total_indicators,
               COUNT(CASE WHEN period_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as fresh_indicators
        FROM economic_indicators_current
      `);

      const row = result.rows[0] as any;
      const total = parseInt(row.total_indicators) || 1;
      const fresh = parseInt(row.fresh_indicators) || 0;
      
      return {
        freshness: Math.max(1, 30 - Math.floor(Date.now() / (1000 * 60 * 60 * 24)) + 30), // Days since latest
        completeness: Math.round((fresh / total) * 100),
        revision_risk: 5 // Standard revision risk
      };
    } catch (error) {
      logger.warn('Failed to assess data quality:', error);
      return { freshness: 15, completeness: 80, revision_risk: 8 };
    }
  }

  private calculateConfidence(components: ComponentScores, dataQuality: DataQualityMetrics): number {
    // Base confidence from data quality
    let confidence = dataQuality.completeness * 0.6;
    
    // Adjust for data freshness
    if (dataQuality.freshness < 7) confidence += 20;
    else if (dataQuality.freshness < 15) confidence += 10;
    else confidence -= 10;
    
    // Assess component agreement
    const values = Object.values(components);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance < 100) confidence += 10; // Low variance = high agreement
    else if (variance > 400) confidence -= 15; // High variance = low agreement

    return Math.max(30, Math.min(95, Math.round(confidence)));
  }

  private calculateConfidenceInterval(score: number, confidence: number): [number, number] {
    const margin = (100 - confidence) / 10; // Lower confidence = wider interval
    return [
      Math.max(0, Math.round(score - margin)),
      Math.min(100, Math.round(score + margin))
    ];
  }

  private identifyKeyDrivers(components: ComponentScores, weights: WeightStructure): string[] {
    const contributions = Object.entries(components).map(([key, value]) => ({
      component: key,
      impact: (value - 50) * weights[key as keyof WeightStructure],
      absImpact: Math.abs((value - 50) * weights[key as keyof WeightStructure])
    }));

    return contributions
      .sort((a, b) => b.absImpact - a.absImpact)
      .slice(0, 3)
      .map(item => {
        const direction = item.impact > 0 ? '+' : '';
        return `${this.formatComponentName(item.component)}: ${direction}${item.impact.toFixed(1)} points`;
      });
  }

  private identifyRiskFactors(components: ComponentScores): string[] {
    const risks: string[] = [];
    
    if (components.financialStress < 40) {
      risks.push('Elevated financial market stress detected');
    }
    
    if (components.inflationTrajectory < 35) {
      risks.push('Inflation trajectory concerning for economic stability');
    }
    
    if (components.laborHealth < 40) {
      risks.push('Labor market showing signs of weakness');
    }
    
    if (components.economicExpectations < 40) {
      risks.push('Consumer/business sentiment below historical norms');
    }

    return risks.slice(0, 3); // Top 3 risks
  }

  private scorePercentileRange(value: number, thresholds: number[]): number {
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (value >= thresholds[i]) {
        return 90 + (i * 2); // 90-100 range
      }
    }
    return Math.max(0, 50 + (value / thresholds[0]) * 40); // 0-50 range
  }

  private calculateHistoricalPercentileForValue(value: number, indicator: string): number {
    // Simplified percentile calculation - in production would use historical database
    const ranges = {
      'employment': { min: 58, max: 64, target: 61 },
      'gdp': { min: -3, max: 6, target: 2.5 },
      'inflation': { min: -1, max: 8, target: 2.0 }
    };
    
    const range = ranges[indicator as keyof typeof ranges] || ranges.gdp;
    return Math.max(0, Math.min(100, ((value - range.min) / (range.max - range.min)) * 100));
  }

  private convertPercentileToScore(percentile: number): number {
    if (percentile >= 80) return 90 + (percentile - 80) * 0.5;
    if (percentile >= 60) return 70 + (percentile - 60);
    if (percentile >= 40) return 50 + (percentile - 40);
    if (percentile >= 20) return 30 + (percentile - 20);
    return percentile * 1.5;
  }

  private formatComponentName(component: string): string {
    const names = {
      growthMomentum: 'Growth Momentum',
      financialStress: 'Financial Stress',
      laborHealth: 'Labor Health',
      inflationTrajectory: 'Inflation Trajectory', 
      policyEffectiveness: 'Policy Effectiveness',
      economicExpectations: 'Economic Expectations'
    };
    return names[component as keyof typeof names] || component;
  }

  private getDefaultEconomicPulseScore(): EconomicHealthScore {
    return {
      overallScore: 50,
      layerBreakdown: {
        coreEconomicMomentum: 50,
        inflationPolicyBalance: 50,
        forwardLookingConfidence: 50
      },
      componentScores: {
        growthMomentum: 50,
        financialStress: 50,
        laborHealth: 50,
        inflationTrajectory: 50,
        policyEffectiveness: 50,
        economicExpectations: 50
      },
      weights: this.BASE_WEIGHTS,
      result: {
        score: 50,
        confidence: 50,
        range: [45, 55],
        dataQuality: {
          freshness: 10,
          completeness: 80,
          revision_risk: 5
        },
        keyDrivers: ['Insufficient economic data'],
        riskFactors: ['Data quality limitations']
      },
      regime: 'expansion'
    };
  }
}