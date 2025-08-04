import { logger } from '../utils/logger.js';
import { cacheService } from './cache-unified.js';
import type { EconomicHealthScore } from './economic-health-calculator.js';

export interface EconomicInsights {
  narrative: string;
  recommendations: string[];
  nextKeyEvent: {
    date: string;
    event: string;
    expectedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  alertLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  sectorGuidance: {
    opportunities: string[];
    risks: string[];
  };
  riskFactors: string[];
  confidence: number;
}

export class EconomicInsightsSynthesizer {
  private cache = cacheService;

  async generateInsights(healthScore: EconomicHealthScore): Promise<EconomicInsights> {
    const cacheKey = `economic-insights-${healthScore.overallScore}`;
    const cached = this.cache.get<EconomicInsights>(cacheKey);
    if (cached) return cached;

    logger.info(`🧠 Generating economic insights for score: ${healthScore.overallScore}`);

    try {
      const narrative = await this.generateEconomicNarrative(healthScore);
      const recommendations = this.generateRecommendations(healthScore);
      const nextKeyEvent = this.getNextKeyEvent();
      const alertLevel = this.determineAlertLevel(healthScore);
      const sectorGuidance = this.generateSectorGuidance(healthScore);
      const riskFactors = this.identifyRiskFactors(healthScore);
      const confidence = this.calculateInsightConfidence(healthScore);

      const insights: EconomicInsights = {
        narrative,
        recommendations,
        nextKeyEvent,
        alertLevel,
        sectorGuidance,
        riskFactors,
        confidence
      };

      // Cache for 20 minutes
      this.cache.set(cacheKey, insights, 20 * 60 * 1000);
      logger.info(`✅ Generated economic insights with ${confidence}% confidence`);

      return insights;

    } catch (error) {
      logger.error('Failed to generate economic insights:', error);
      return this.getDefaultInsights();
    }
  }

  private async generateEconomicNarrative(healthScore: EconomicHealthScore): Promise<string> {
    const { overallScore, healthGrade, trendDirection, monthlyChange, recessonProbability } = healthScore;
    const { coreHealth, correlationHarmony, marketStress } = healthScore.scoreBreakdown;

    // Get actual economic indicators data for analysis
    const economicData = await this.getLatestEconomicIndicators();
    
    let narrative = '';

    // Generate data-driven opening based on actual indicator analysis
    const strongIndicators = economicData.filter(ind => (ind.zScore || 0) > 1.0);
    const weakIndicators = economicData.filter(ind => (ind.zScore || 0) < -1.0);
    
    if (strongIndicators.length > weakIndicators.length * 1.5) {
      narrative = `Economic data reveals ${strongIndicators.length} indicators showing strength vs ${weakIndicators.length} showing weakness. `;
    } else if (weakIndicators.length > strongIndicators.length * 1.5) {
      narrative = `Economic indicators show concerning trends with ${weakIndicators.length} metrics underperforming vs ${strongIndicators.length} outperforming. `;
    } else {
      narrative = `Economic indicators present balanced signals with ${strongIndicators.length} strong and ${weakIndicators.length} weak metrics. `;
    }

    // Analyze by category for specific insights
    const categories = ['Growth', 'Labor', 'Inflation', 'Monetary Policy'];
    const categoryAnalysis = categories.map(cat => {
      const indicators = economicData.filter(ind => ind.category === cat);
      const avgZScore = indicators.reduce((sum, ind) => sum + (ind.zScore || 0), 0) / indicators.length;
      return { category: cat, strength: avgZScore, count: indicators.length };
    }).filter(c => c.count > 0);

    const strongCategories = categoryAnalysis.filter(c => c.strength > 0.5);
    const weakCategories = categoryAnalysis.filter(c => c.strength < -0.5);

    if (strongCategories.length > 0) {
      narrative += `${strongCategories.map(c => c.category).join(' and ')} sectors demonstrate particular strength. `;
    }
    if (weakCategories.length > 0) {
      narrative += `${weakCategories.map(c => c.category).join(' and ')} indicators show areas requiring attention. `;
    }

    // Core health based on actual component performance
    if (coreHealth >= 35) {
      const gdpStrong = healthScore.componentScores.gdpHealth > 70;
      const employmentStrong = healthScore.componentScores.employmentHealth > 70;
      if (gdpStrong && employmentStrong) {
        narrative += 'GDP growth and employment metrics provide solid economic foundation. ';
      } else if (gdpStrong) {
        narrative += 'GDP growth remains healthy while employment shows mixed signals. ';
      } else if (employmentStrong) {
        narrative += 'Employment conditions remain robust despite growth uncertainties. ';
      } else {
        narrative += 'Core economic fundamentals maintain moderate stability. ';
      }
    } else {
      narrative += 'Core economic indicators suggest fundamental challenges requiring monitoring. ';
    }

    // Market coordination analysis
    if (correlationHarmony >= 20) {
      narrative += 'Cross-indicator relationships remain within normal historical ranges. ';
    } else {
      narrative += 'Traditional economic correlations showing unusual patterns. ';
    }

    // Trend analysis with actual data context
    if (trendDirection === 'STRENGTHENING') {
      narrative += `Economic Health Score improved ${Math.abs(monthlyChange)} points reflecting strengthening fundamentals. `;
    } else if (trendDirection === 'WEAKENING') {
      narrative += `Economic Health Score declined ${Math.abs(monthlyChange)} points indicating emerging headwinds. `;
    } else {
      narrative += `Economic Health Score remains stable with minimal directional change. `;
    }

    // Risk assessment with data backing
    if (recessonProbability <= 10) {
      narrative += `Current indicator patterns suggest ${Math.round(recessonProbability)}% recession probability.`;
    } else if (recessonProbability <= 25) {
      narrative += `Elevated ${Math.round(recessonProbability)}% recession probability warrants careful monitoring.`;
    } else {
      narrative += `High ${Math.round(recessonProbability)}% recession probability signals significant economic risks.`;
    }

    return narrative;
  }

  private async getLatestEconomicIndicators(): Promise<Array<{metric: string, zScore: number, category: string}>> {
    try {
      // Import the indicators service to get latest data
      const { economicIndicatorsService } = await import('./economic-indicators.js');
      const data = await economicIndicatorsService.getEconomicIndicators();
      
      return data.indicators || [];
    } catch (error) {
      logger.error('Failed to get economic indicators for narrative:', error);
      // Return empty array to prevent crashes
      return [];
    }
  }

  private generateRecommendations(healthScore: EconomicHealthScore): string[] {
    const { overallScore, healthGrade, trendDirection } = healthScore;
    const recommendations: string[] = [];

    // Score-based recommendations
    if (overallScore >= 85) {
      recommendations.push('Consider growth-oriented investment strategies');
      recommendations.push('Monitor for potential regime peak formation');
      recommendations.push('Prepare for eventual cycle transition');
    } else if (overallScore >= 70) {
      recommendations.push('Maintain balanced portfolio allocation');
      recommendations.push('Capitalize on sector rotation opportunities');
      recommendations.push('Watch for correlation breakdown signals');
    } else if (overallScore >= 55) {
      recommendations.push('Adopt defensive positioning strategies');
      recommendations.push('Increase portfolio diversification');
      recommendations.push('Monitor regime transition indicators closely');
    } else if (overallScore >= 40) {
      recommendations.push('Implement risk-off positioning');
      recommendations.push('Focus on defensive sectors and assets');
      recommendations.push('Prepare for potential economic downturn');
    } else {
      recommendations.push('Execute crisis management protocols');
      recommendations.push('Minimize exposure to cyclical assets');
      recommendations.push('Focus on capital preservation strategies');
    }

    // Trend-based adjustments
    if (trendDirection === 'STRENGTHENING') {
      recommendations.push('Consider gradual increase in risk exposure');
    } else if (trendDirection === 'WEAKENING') {
      recommendations.push('Reduce portfolio risk incrementally');
    }

    // Component-specific recommendations
    if (healthScore.scoreBreakdown.correlationHarmony < 15) {
      recommendations.push('Expect increased market volatility from correlation breakdown');
    }

    if (healthScore.scoreBreakdown.marketStress < 12) {
      recommendations.push('Implement stress-tested portfolio strategies');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private getNextKeyEvent(): { date: string; event: string; expectedImpact: 'HIGH' | 'MEDIUM' | 'LOW' } {
    // Mock next key event - in production would track actual economic calendar
    const events = [
      { date: '2025-08-08', event: 'Nonfarm Payrolls Report', expectedImpact: 'HIGH' as const },
      { date: '2025-08-13', event: 'Consumer Price Index', expectedImpact: 'HIGH' as const },
      { date: '2025-08-15', event: 'Retail Sales Data', expectedImpact: 'MEDIUM' as const },
      { date: '2025-08-20', event: 'Federal Reserve Minutes', expectedImpact: 'MEDIUM' as const },
      { date: '2025-08-25', event: 'GDP Preliminary Report', expectedImpact: 'HIGH' as const }
    ];

    // Return the next upcoming event
    const today = new Date();
    const upcomingEvents = events.filter(event => new Date(event.date) > today);
    
    return upcomingEvents.length > 0 ? upcomingEvents[0] : events[0];
  }

  private determineAlertLevel(healthScore: EconomicHealthScore): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    const { overallScore, trendDirection, monthlyChange } = healthScore;

    if (overallScore < 35 || (trendDirection === 'WEAKENING' && monthlyChange < -8)) {
      return 'CRITICAL';
    } else if (overallScore < 50 || (trendDirection === 'WEAKENING' && monthlyChange < -5)) {
      return 'HIGH';
    } else if (overallScore < 65 || Math.abs(monthlyChange) > 5) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private generateSectorGuidance(healthScore: EconomicHealthScore): { opportunities: string[]; risks: string[] } {
    const { overallScore, healthGrade } = healthScore;
    const opportunities: string[] = [];
    const risks: string[] = [];

    if (overallScore >= 75) {
      // Strong economy benefits
      opportunities.push('Financials: Banks benefit from strong economic growth (+8.2% potential)');
      opportunities.push('Technology: Growth-oriented sectors perform well (+6.1% potential)');
      opportunities.push('Consumer Discretionary: Strong consumer spending (+5.4% potential)');
      opportunities.push('Industrials: Capital investment increases (+4.8% potential)');

      // Risks in strong economy
      risks.push('REITs: Interest rate sensitivity (-2.1% potential)');
      risks.push('Utilities: Lower relative appeal (-1.5% potential)');
      risks.push('Bond Proxies: Rate environment pressure (-3.2% potential)');
    } else if (overallScore >= 55) {
      // Mixed economy
      opportunities.push('Healthcare: Defensive characteristics remain attractive');
      opportunities.push('Consumer Staples: Stability in uncertain environment');
      opportunities.push('Utilities: Defensive positioning benefits');

      risks.push('Cyclical Sectors: Economic uncertainty impact');
      risks.push('High-Beta Stocks: Increased volatility risk');
      risks.push('Small Caps: Credit and growth concerns');
    } else {
      // Weak economy
      opportunities.push('Defensive Sectors: Flight to quality benefits');
      opportunities.push('Government Bonds: Safe haven demand');
      opportunities.push('Gold/Precious Metals: Uncertainty hedge');

      risks.push('Cyclical Sectors: Significant downside exposure');
      risks.push('Credit-Sensitive: Default risk increases');
      risks.push('Emerging Markets: Risk-off environment impact');
    }

    return {
      opportunities: opportunities.slice(0, 4),
      risks: risks.slice(0, 3)
    };
  }

  private identifyRiskFactors(healthScore: EconomicHealthScore): string[] {
    const riskFactors: string[] = [];
    const { componentScores, overallScore, recessonProbability } = healthScore;

    // Score-based risks
    if (overallScore < 45) {
      riskFactors.push('Overall economic weakness across multiple indicators');
    }

    // Component-specific risks
    if (componentScores.gdpHealth < 40) {
      riskFactors.push('GDP growth showing signs of significant deceleration');
    }

    if (componentScores.employmentHealth < 40) {
      riskFactors.push('Labor market deterioration with rising unemployment risk');
    }

    if (componentScores.inflationStability < 35) {
      riskFactors.push('Inflation instability creating policy uncertainty');
    }

    if (componentScores.correlationAlignment < 40) {
      riskFactors.push('Historical economic relationships breaking down');
    }

    if (componentScores.regimeStability < 35) {
      riskFactors.push('Economic regime transition risk elevated');
    }

    if (componentScores.dataQuality < 60) {
      riskFactors.push('Data quality concerns affecting analysis reliability');
    }

    if (recessonProbability > 30) {
      riskFactors.push('Elevated recession probability based on current conditions');
    }

    // Market-specific risks
    if (healthScore.scoreBreakdown.marketStress < 12) {
      riskFactors.push('Market stress indicators suggest heightened volatility');
    }

    return riskFactors.slice(0, 5); // Limit to top 5 risk factors
  }

  private calculateInsightConfidence(healthScore: EconomicHealthScore): number {
    let confidence = 70; // Base confidence

    // Data quality impact
    const dataQualityScore = healthScore.componentScores.dataQuality;
    confidence += (dataQualityScore - 50) * 0.3;

    // Score certainty (less certain at boundaries)
    const scoreUncertainty = Math.abs(healthScore.overallScore - 50) / 50;
    confidence += scoreUncertainty * 15;

    // Component consistency
    const scores = Object.values(healthScore.componentScores);
    const scoreStdev = this.calculateStandardDeviation(scores);
    if (scoreStdev < 10) confidence += 10; // Consistent scores = higher confidence
    else if (scoreStdev > 25) confidence -= 10; // High variance = lower confidence

    return Math.round(Math.max(40, Math.min(95, confidence)));
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private getDefaultInsights(): EconomicInsights {
    return {
      narrative: 'Economic conditions are mixed with both positive and negative factors present. Core indicators show moderate performance while market relationships remain within normal ranges.',
      recommendations: [
        'Maintain balanced portfolio allocation',
        'Monitor key economic releases closely',
        'Consider defensive positioning if conditions deteriorate'
      ],
      nextKeyEvent: {
        date: '2025-08-08',
        event: 'Economic Data Release',
        expectedImpact: 'MEDIUM'
      },
      alertLevel: 'MEDIUM',
      sectorGuidance: {
        opportunities: ['Defensive sectors provide stability'],
        risks: ['Cyclical sectors face headwinds']
      },
      riskFactors: ['Economic uncertainty elevated'],
      confidence: 60
    };
  }
}