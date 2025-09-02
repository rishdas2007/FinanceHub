import { logger } from '../utils/logger.js';

/**
 * Contextual Economic Directionality Service
 * Provides context-dependent directionality instead of static mappings
 */

export interface EconomicContext {
  inflationRegime: 'low' | 'moderate' | 'high';
  growthRegime: 'recession' | 'recovery' | 'expansion' | 'peak';
  marketCycle: 'bull' | 'bear' | 'transitional';
  vixLevel: number;
  timestamp: Date;
}

export interface DirectionalityResult {
  directionality: number; // -1 to +1
  confidence: number; // 0 to 1
  rationale: string;
  context: EconomicContext;
}

export class ContextualEconomicDirectionality {
  private static instance: ContextualEconomicDirectionality;
  
  // Base static directionality for non-context-dependent indicators
  private readonly BASE_DIRECTIONALITY: Record<string, number> = {
    // Always positive indicators
    'GDP Growth Rate': 1,
    'Nonfarm Payrolls': 1,
    'Housing Starts': 1,
    'Durable Goods Orders': 1,
    'Industrial Production': 1,
    'Retail Sales': 1,
    'Consumer Confidence Index': 1,
    'Manufacturing PMI': 1,
    
    // Always negative indicators
    'Unemployment Rate': -1,
    'Initial Jobless Claims': -1,
    'Continuing Jobless Claims': -1,
    'U-6 Unemployment Rate': -1,
    
    // Context-dependent indicators (handled by special logic)
    'Federal Funds Rate': 0,
    'Personal Savings Rate': 0,
    '10-Year Treasury Yield': 0,
    'CPI All Items': 0,
    'Core CPI': 0,
    'PCE Price Index': 0,
    'Core PCE Price Index': 0,
    'PPI All Commodities': 0,
    'Core PPI': 0,
  };

  public static getInstance(): ContextualEconomicDirectionality {
    if (!ContextualEconomicDirectionality.instance) {
      ContextualEconomicDirectionality.instance = new ContextualEconomicDirectionality();
    }
    return ContextualEconomicDirectionality.instance;
  }

  /**
   * Get contextual directionality for economic indicators
   */
  getContextualDirectionality(metric: string, currentValue: number, historicalPercentile: number, vixLevel: number = 20): DirectionalityResult {
    const context = this.determineEconomicContext(vixLevel, currentValue, metric);
    
    // Check if indicator has context-dependent logic
    if (this.isContextDependent(metric)) {
      return this.calculateContextualDirectionality(metric, currentValue, historicalPercentile, context);
    }
    
    // Use base directionality for non-context-dependent indicators
    const baseDirectionality = this.BASE_DIRECTIONALITY[metric] || 0;
    
    return {
      directionality: baseDirectionality,
      confidence: 0.9,
      rationale: `Static directionality: ${baseDirectionality > 0 ? 'Positive' : baseDirectionality < 0 ? 'Negative' : 'Neutral'}`,
      context
    };
  }

  /**
   * Determine current economic context
   */
  private determineEconomicContext(vixLevel: number, currentValue: number, metric: string): EconomicContext {
    // Determine inflation regime
    let inflationRegime: EconomicContext['inflationRegime'] = 'moderate';
    if (metric.includes('CPI') || metric.includes('PCE') || metric.includes('PPI')) {
      inflationRegime = currentValue > 4 ? 'high' : currentValue < 2 ? 'low' : 'moderate';
    }

    // Determine growth regime based on various indicators
    let growthRegime: EconomicContext['growthRegime'] = 'expansion';
    if (metric === 'GDP Growth Rate') {
      growthRegime = currentValue < 0 ? 'recession' : currentValue < 1 ? 'recovery' : currentValue > 3 ? 'peak' : 'expansion';
    }

    // Market cycle based on VIX
    const marketCycle: EconomicContext['marketCycle'] = 
      vixLevel > 30 ? 'bear' : vixLevel < 15 ? 'bull' : 'transitional';

    return {
      inflationRegime,
      growthRegime,
      marketCycle,
      vixLevel,
      timestamp: new Date()
    };
  }

  /**
   * Check if indicator requires context-dependent logic
   */
  private isContextDependent(metric: string): boolean {
    const contextDependentMetrics = [
      'Federal Funds Rate',
      'Personal Savings Rate',
      '10-Year Treasury Yield',
      'CPI All Items',
      'Core CPI',
      'PCE Price Index',
      'Core PCE Price Index',
      'PPI All Commodities',
      'Core PPI'
    ];
    
    return contextDependentMetrics.includes(metric);
  }

  /**
   * Calculate context-dependent directionality
   */
  private calculateContextualDirectionality(metric: string, currentValue: number, historicalPercentile: number, context: EconomicContext): DirectionalityResult {
    let directionality = 0;
    let confidence = 0.8;
    let rationale = '';

    switch (metric) {
      case 'Federal Funds Rate':
        if (context.inflationRegime === 'high') {
          directionality = 1; // Rate increases are good when fighting inflation
          rationale = 'Fed rate increases are positive during high inflation periods';
        } else if (context.growthRegime === 'recession') {
          directionality = -1; // Rate increases are bad during recession
          rationale = 'Fed rate increases are negative during recession periods';
        } else {
          directionality = -0.5; // Generally negative for growth
          rationale = 'Fed rate increases generally negative for economic growth';
        }
        break;

      case 'Personal Savings Rate':
        if (context.growthRegime === 'recession' || context.marketCycle === 'bear') {
          directionality = 1; // High savings rate is good during recession
          rationale = 'High savings rate provides stability during economic stress';
        } else if (context.growthRegime === 'expansion') {
          directionality = -0.5; // High savings rate can limit consumption during expansion
          rationale = 'High savings rate may limit consumption during expansion';
        } else {
          directionality = 0.2; // Generally slightly positive
          rationale = 'Personal savings provide economic resilience';
        }
        break;

      case '10-Year Treasury Yield':
        if (context.inflationRegime === 'high') {
          directionality = 0.5; // Rising yields reflect inflation expectations
          rationale = 'Rising yields reflect healthy inflation expectations adjustment';
        } else if (context.growthRegime === 'recession') {
          directionality = -1; // Rising yields bad during recession
          rationale = 'Rising yields increase borrowing costs during recession';
        } else {
          directionality = -0.3; // Generally negative for growth
          rationale = 'Rising yields increase borrowing costs';
        }
        break;

      default:
        // Inflation indicators
        if (metric.includes('CPI') || metric.includes('PCE') || metric.includes('PPI')) {
          if (context.inflationRegime === 'low' && currentValue < 1.5) {
            directionality = 1; // Some inflation is good when too low
            rationale = 'Moderate inflation increase positive when below target';
          } else if (context.inflationRegime === 'high') {
            directionality = -1; // High inflation is bad
            rationale = 'High inflation erodes purchasing power';
          } else {
            directionality = -0.5; // Generally negative above 2%
            rationale = 'Inflation above target generally negative';
          }
        }
        break;
    }

    logger.debug('Contextual directionality calculated', {
      metric,
      currentValue,
      context: context.inflationRegime,
      directionality,
      rationale
    });

    return {
      directionality,
      confidence,
      rationale,
      context
    };
  }

  /**
   * Get batch directionality for multiple indicators
   */
  async getBatchDirectionality(indicators: Array<{
    metric: string;
    currentValue: number;
    historicalPercentile: number;
  }>, vixLevel: number = 20): Promise<Map<string, DirectionalityResult>> {
    const results = new Map<string, DirectionalityResult>();
    
    for (const indicator of indicators) {
      const result = this.getContextualDirectionality(
        indicator.metric,
        indicator.currentValue,
        indicator.historicalPercentile,
        vixLevel
      );
      results.set(indicator.metric, result);
    }
    
    return results;
  }
}