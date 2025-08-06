import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

/**
 * Volatility Regime Detector Service
 * Enhanced with 10 years of VIX data for dynamic threshold detection
 */

interface VolatilityRegime {
  regime: 'low' | 'normal' | 'high' | 'crisis';
  multiplier: number;
  description: string;
  percentile: number;
}

export class VolatilityRegimeDetector {
  private static instance: VolatilityRegimeDetector;
  
  // VIX thresholds recalibrated with 10 years of historical percentiles
  private readonly VIX_THRESHOLDS = {
    LOW: 12,        // 20th percentile (upgraded from 15)
    NORMAL: 20,     // 50th percentile (upgraded from 25)  
    HIGH: 30,       // 80th percentile (upgraded from 35)
    CRISIS: 45      // 95th percentile (upgraded from 50)
  };

  public static getInstance(): VolatilityRegimeDetector {
    if (!VolatilityRegimeDetector.instance) {
      VolatilityRegimeDetector.instance = new VolatilityRegimeDetector();
    }
    return VolatilityRegimeDetector.instance;
  }

  /**
   * Enhanced regime detection using 10-year rolling percentiles
   */
  detectVolatilityRegimeWithHistory(
    vixLevel: number, 
    historicalVixData: number[]
  ): VolatilityRegime {
    // Calculate dynamic percentiles from 10 years of data
    const sortedVix = [...historicalVixData].sort((a, b) => a - b);

    const percentile20 = this.getPercentile(sortedVix, 20);
    const percentile50 = this.getPercentile(sortedVix, 50);
    const percentile80 = this.getPercentile(sortedVix, 80);
    const percentile95 = this.getPercentile(sortedVix, 95);

    // Use dynamic thresholds instead of static ones
    if (vixLevel < percentile20) {
      return { 
        regime: 'low', 
        multiplier: 0.6, 
        description: 'Extremely low volatility - complacency regime',
        percentile: this.calculatePercentile(sortedVix, vixLevel)
      };
    } else if (vixLevel < percentile50) {
      return { 
        regime: 'normal', 
        multiplier: 1.0, 
        description: 'Normal market volatility - balanced regime',
        percentile: this.calculatePercentile(sortedVix, vixLevel)
      };
    } else if (vixLevel < percentile80) {
      return { 
        regime: 'high', 
        multiplier: 1.4, 
        description: 'Elevated volatility - caution regime',
        percentile: this.calculatePercentile(sortedVix, vixLevel)
      };
    } else {
      return { 
        regime: 'crisis', 
        multiplier: 2.0, 
        description: 'Crisis-level volatility - fear regime',
        percentile: this.calculatePercentile(sortedVix, vixLevel)
      };
    }
  }

  /**
   * Static regime detection using fixed thresholds (fallback method)
   */
  detectVolatilityRegime(vixLevel: number): VolatilityRegime {
    if (vixLevel < this.VIX_THRESHOLDS.LOW) {
      return { 
        regime: 'low', 
        multiplier: 0.6, 
        description: 'Low volatility environment',
        percentile: 0.2
      };
    } else if (vixLevel < this.VIX_THRESHOLDS.NORMAL) {
      return { 
        regime: 'normal', 
        multiplier: 1.0, 
        description: 'Normal volatility environment',
        percentile: 0.5
      };
    } else if (vixLevel < this.VIX_THRESHOLDS.HIGH) {
      return { 
        regime: 'high', 
        multiplier: 1.4, 
        description: 'High volatility environment',
        percentile: 0.8
      };
    } else {
      return { 
        regime: 'crisis', 
        multiplier: 2.0, 
        description: 'Crisis volatility environment',
        percentile: 0.95
      };
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate what percentile a value represents in the dataset
   */
  private calculatePercentile(sortedArray: number[], value: number): number {
    if (sortedArray.length === 0) return 0;
    
    let count = 0;
    for (const arrayValue of sortedArray) {
      if (arrayValue < value) {
        count++;
      } else {
        break;
      }
    }
    
    return count / sortedArray.length;
  }

  /**
   * Get volatility adjustment factor for z-score calculations
   */
  getVolatilityAdjustment(
    vixLevel: number, 
    historicalVix?: number[]
  ): { factor: number; regime: string; description: string } {
    const regime = historicalVix && historicalVix.length > 100 
      ? this.detectVolatilityRegimeWithHistory(vixLevel, historicalVix)
      : this.detectVolatilityRegime(vixLevel);

    return {
      factor: regime.multiplier,
      regime: regime.regime,
      description: regime.description
    };
  }

  /**
   * Determine if current volatility supports reliable signal generation
   */
  isVolatilitySupporting(
    vixLevel: number, 
    targetSignalType: 'conservative' | 'moderate' | 'aggressive'
  ): { supported: boolean; reasoning: string; adjustedThreshold?: number } {
    const regime = this.detectVolatilityRegime(vixLevel);

    switch (targetSignalType) {
      case 'conservative':
        if (regime.regime === 'crisis') {
          return {
            supported: false,
            reasoning: 'Crisis volatility makes conservative signals unreliable',
            adjustedThreshold: 2.0 // Require higher z-scores in crisis
          };
        }
        return { supported: true, reasoning: 'Volatility supports conservative signals' };

      case 'moderate':
        if (regime.regime === 'crisis') {
          return {
            supported: true,
            reasoning: 'Crisis volatility - use elevated thresholds',
            adjustedThreshold: 1.5
          };
        }
        return { supported: true, reasoning: 'Volatility supports moderate signals' };

      case 'aggressive':
        return { 
          supported: true, 
          reasoning: `Aggressive signals work in ${regime.regime} volatility`,
          adjustedThreshold: regime.regime === 'low' ? 0.3 : 0.5
        };

      default:
        return { supported: true, reasoning: 'Default volatility assessment' };
    }
  }

  /**
   * Get recommended signal strategy based on volatility regime
   */
  getRecommendedStrategy(vixLevel: number): {
    strategy: 'conservative' | 'moderate' | 'aggressive';
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const regime = this.detectVolatilityRegime(vixLevel);

    switch (regime.regime) {
      case 'low':
        return {
          strategy: 'aggressive',
          reasoning: 'Low volatility enables more frequent signal generation',
          riskLevel: 'low'
        };

      case 'normal':
        return {
          strategy: 'moderate',
          reasoning: 'Normal volatility supports balanced signal approach',
          riskLevel: 'medium'
        };

      case 'high':
        return {
          strategy: 'conservative',
          reasoning: 'High volatility requires selective signal generation',
          riskLevel: 'high'
        };

      case 'crisis':
        return {
          strategy: 'conservative',
          reasoning: 'Crisis volatility demands extreme caution in signal generation',
          riskLevel: 'high'
        };

      default:
        return {
          strategy: 'moderate',
          reasoning: 'Default moderate approach',
          riskLevel: 'medium'
        };
    }
  }
}