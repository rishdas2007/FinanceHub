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
 * Volatility Regime Detection Service
 * Adjusts trading signals based on market volatility conditions
 */

export interface VolatilityRegime {
  regime: 'low' | 'normal' | 'high' | 'crisis';
  vixLevel: number;
  multiplier: number;
  description: string;
  timestamp: Date;
}

export class VolatilityRegimeDetector {
  private static instance: VolatilityRegimeDetector;
  
  // VIX-based volatility regime thresholds
  private readonly VIX_THRESHOLDS = {
    LOW: 15,      // Low volatility (complacent markets)
    NORMAL: 25,   // Normal volatility
    HIGH: 35,     // High volatility (stressed markets)
    CRISIS: 50    // Crisis volatility (market panic)
  };

  // Signal strength multipliers by volatility regime
  private readonly REGIME_MULTIPLIERS = {
    low: 0.7,     // Reduce signal strength in low vol (mean reversion likely)
    normal: 1.0,  // Standard signal strength
    high: 1.3,    // Increase signal strength in high vol (trends persist)
    crisis: 1.8   // Strong increase in crisis (momentum accelerates)
  };

  public static getInstance(): VolatilityRegimeDetector {
    if (!VolatilityRegimeDetector.instance) {
      VolatilityRegimeDetector.instance = new VolatilityRegimeDetector();
    }
    return VolatilityRegimeDetector.instance;
  }

  /**
   * Detect current volatility regime based on VIX level
   */
  detectVolatilityRegime(vixLevel: number): VolatilityRegime {
    let regime: VolatilityRegime['regime'];
    let description: string;

    if (vixLevel < this.VIX_THRESHOLDS.LOW) {
      regime = 'low';
      description = 'Low volatility - Mean reversion environment';
    } else if (vixLevel < this.VIX_THRESHOLDS.NORMAL) {
      regime = 'normal';
      description = 'Normal volatility - Balanced market conditions';
    } else if (vixLevel < this.VIX_THRESHOLDS.HIGH) {
      regime = 'high';
      description = 'High volatility - Stressed market conditions';
    } else {
      regime = 'crisis';
      description = 'Crisis volatility - Extreme market stress';
    }

    const multiplier = this.REGIME_MULTIPLIERS[regime];

    logger.debug('Volatility regime detected', {
      regime,
      vixLevel,
      multiplier,
      description
    });

    return {
      regime,
      vixLevel,
      multiplier,
      description,
      timestamp: new Date()
    };
  }

  /**
   * Adjust Z-Score signal strength based on volatility regime
   */
  adjustForVolatilityRegime(zScore: number, vixLevel: number): number {
    if (!isFinite(zScore) || zScore === null) return 0;

    const regime = this.detectVolatilityRegime(vixLevel);
    const adjustedScore = zScore * regime.multiplier;

    logger.debug('Z-Score volatility adjustment', {
      originalZScore: zScore.toFixed(3),
      vixLevel,
      regime: regime.regime,
      multiplier: regime.multiplier,
      adjustedZScore: adjustedScore.toFixed(3)
    });

    return adjustedScore;
  }

  /**
   * Get optimal signal thresholds based on volatility regime
   */
  getRegimeAdjustedThresholds(vixLevel: number): {
    buyThreshold: number;
    sellThreshold: number;
    strongBuyThreshold: number;
    strongSellThreshold: number;
  } {
    const regime = this.detectVolatilityRegime(vixLevel);
    
    // Base thresholds (statistically derived)
    const baseBuy = 1.0;
    const baseSell = -1.0;
    const baseStrongBuy = 1.96;
    const baseStrongSell = -1.96;

    // Adjust thresholds inversely to multiplier to maintain consistency
    const thresholdAdjustment = 1 / regime.multiplier;

    return {
      buyThreshold: baseBuy * thresholdAdjustment,
      sellThreshold: baseSell * thresholdAdjustment,
      strongBuyThreshold: baseStrongBuy * thresholdAdjustment,
      strongSellThreshold: baseStrongSell * thresholdAdjustment
    };
  }

  /**
   * Generate trading signal with volatility regime consideration
   */
  generateVolatilityAwareSignal(zScore: number, vixLevel: number): {
    signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    strength: number;
    regime: VolatilityRegime;
    rationale: string;
  } {
    if (!isFinite(zScore) || zScore === null) {
      return {
        signal: 'HOLD',
        strength: 0,
        regime: this.detectVolatilityRegime(vixLevel),
        rationale: 'Invalid Z-Score data'
      };
    }

    const regime = this.detectVolatilityRegime(vixLevel);
    const adjustedZScore = this.adjustForVolatilityRegime(zScore, vixLevel);
    const thresholds = this.getRegimeAdjustedThresholds(vixLevel);

    let signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    let rationale: string;

    if (adjustedZScore >= thresholds.strongBuyThreshold) {
      signal = 'STRONG_BUY';
      rationale = `Strong bullish signal (Z=${adjustedZScore.toFixed(2)}) in ${regime.regime} volatility regime`;
    } else if (adjustedZScore >= thresholds.buyThreshold) {
      signal = 'BUY';
      rationale = `Bullish signal (Z=${adjustedZScore.toFixed(2)}) in ${regime.regime} volatility regime`;
    } else if (adjustedZScore <= thresholds.strongSellThreshold) {
      signal = 'STRONG_SELL';
      rationale = `Strong bearish signal (Z=${adjustedZScore.toFixed(2)}) in ${regime.regime} volatility regime`;
    } else if (adjustedZScore <= thresholds.sellThreshold) {
      signal = 'SELL';
      rationale = `Bearish signal (Z=${adjustedZScore.toFixed(2)}) in ${regime.regime} volatility regime`;
    } else {
      signal = 'HOLD';
      rationale = `Neutral signal (Z=${adjustedZScore.toFixed(2)}) in ${regime.regime} volatility regime`;
    }

    return {
      signal,
      strength: Math.abs(adjustedZScore),
      regime,
      rationale
    };
  }
}