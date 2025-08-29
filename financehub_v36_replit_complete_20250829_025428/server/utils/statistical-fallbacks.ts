/**
 * Statistical fallback parameters and utilities
 * Provides market-realistic fallback values when historical data is insufficient
 */

import type { StatisticalFallbacks } from '../types/historical-data-types';

/**
 * Market-realistic statistical parameters for technical indicators
 * Based on extensive market analysis and industry standards
 */
export const MARKET_FALLBACKS: StatisticalFallbacks = {
  // RSI typically oscillates around 50 with standard deviation of ~15
  rsi: {
    mean: 50,
    stddev: 15
  },
  
  // MACD values typically center around 0 with stddev of ~1.03
  macd: {
    mean: 0,
    stddev: 1.03
  },
  
  // Bollinger %B should range 0-1 with mean of 0.5 and stddev of 0.25
  percentB: {
    mean: 0.5,
    stddev: 0.25
  }
};

/**
 * Symbol-specific fallback adjustments for different ETF characteristics
 */
export const SYMBOL_ADJUSTMENTS: Record<string, Partial<StatisticalFallbacks>> = {
  // SPY (S&P 500) - Large cap, stable
  SPY: {
    rsi: { mean: 50, stddev: 12 },
    macd: { mean: 0, stddev: 0.8 }
  },
  
  // XLE (Energy) - High volatility sector
  XLE: {
    rsi: { mean: 48, stddev: 18 },
    macd: { mean: 0, stddev: 1.5 }
  },
  
  // XLK (Technology) - Growth sector with higher volatility
  XLK: {
    rsi: { mean: 52, stddev: 16 },
    macd: { mean: 0, stddev: 1.2 }
  },
  
  // XLU (Utilities) - Defensive sector, lower volatility
  XLU: {
    rsi: { mean: 50, stddev: 10 },
    macd: { mean: 0, stddev: 0.6 }
  }
};

/**
 * Get fallback parameters for a specific symbol and indicator
 */
export function getFallbackParameters(
  symbol: string, 
  indicator: keyof StatisticalFallbacks
): { mean: number; stddev: number } {
  const symbolAdjustment = SYMBOL_ADJUSTMENTS[symbol]?.[indicator];
  const baseFallback = MARKET_FALLBACKS[indicator];
  
  return {
    mean: symbolAdjustment?.mean ?? baseFallback.mean,
    stddev: symbolAdjustment?.stddev ?? baseFallback.stddev
  };
}

/**
 * Generate realistic sample data for testing/fallback purposes
 */
export function generateRealisticSampleData(
  indicator: keyof StatisticalFallbacks,
  symbol: string,
  count: number = 30
): number[] {
  const params = getFallbackParameters(symbol, indicator);
  const data: number[] = [];
  
  // Generate data with some autocorrelation (more realistic)
  let previousValue = params.mean;
  
  for (let i = 0; i < count; i++) {
    // Add some momentum/trend behavior
    const randomComponent = (Math.random() - 0.5) * params.stddev * 2;
    const trendComponent = (previousValue - params.mean) * 0.1; // Mean reversion
    
    let value = params.mean + randomComponent - trendComponent;
    
    // Apply indicator-specific constraints
    switch (indicator) {
      case 'rsi':
        value = Math.max(0, Math.min(100, value));
        break;
      case 'percentB':
        value = Math.max(0, Math.min(1, value));
        break;
      // MACD can be any value, no constraints needed
    }
    
    data.push(value);
    previousValue = value;
  }
  
  return data;
}

/**
 * Validate if current value is within reasonable bounds for indicator
 */
export function validateIndicatorValue(
  value: number,
  indicator: keyof StatisticalFallbacks,
  symbol: string
): { valid: boolean; reason?: string; adjustedValue?: number } {
  switch (indicator) {
    case 'rsi':
      if (value < 0 || value > 100) {
        return {
          valid: false,
          reason: `RSI must be between 0-100, got ${value}`,
          adjustedValue: Math.max(0, Math.min(100, value))
        };
      }
      break;
      
    case 'percentB':
      if (value < 0 || value > 1) {
        return {
          valid: false,
          reason: `Bollinger %B must be between 0-1, got ${value}`,
          adjustedValue: Math.max(0, Math.min(1, value))
        };
      }
      break;
      
    case 'macd':
      // MACD can be any value, but extremely large values indicate issues
      if (Math.abs(value) > 50) {
        return {
          valid: false,
          reason: `MACD value ${value} is extremely large, possible calculation error`,
          adjustedValue: Math.sign(value) * 5 // Cap at reasonable level
        };
      }
      break;
  }
  
  return { valid: true };
}

/**
 * Calculate confidence score based on data quality factors
 */
export function calculateConfidenceScore(
  dataPoints: number,
  fallbackUsed: boolean,
  extremeValue: boolean,
  corruptionDetected: boolean
): number {
  let confidence = 1.0;
  
  // Reduce confidence based on data quantity
  if (dataPoints < 10) confidence *= 0.3;
  else if (dataPoints < 20) confidence *= 0.6;
  else if (dataPoints < 30) confidence *= 0.8;
  
  // Reduce confidence for fallback usage
  if (fallbackUsed) confidence *= 0.4;
  
  // Reduce confidence for extreme values
  if (extremeValue) confidence *= 0.7;
  
  // Significantly reduce confidence for corruption
  if (corruptionDetected) confidence *= 0.2;
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Get market-appropriate thresholds for trading signals
 */
export function getSignalThresholds(symbol: string): {
  buyThreshold: number;
  sellThreshold: number;
  neutralRange: [number, number];
} {
  // Adjust thresholds based on symbol volatility
  const isHighVolatility = ['XLE', 'XLK', 'XLY'].includes(symbol);
  const isLowVolatility = ['XLU', 'XLP'].includes(symbol);
  
  if (isHighVolatility) {
    return {
      buyThreshold: -2.0, // Require stronger signals for volatile assets
      sellThreshold: 2.0,
      neutralRange: [-1.0, 1.0]
    };
  } else if (isLowVolatility) {
    return {
      buyThreshold: -1.2, // More sensitive for stable assets
      sellThreshold: 1.2,
      neutralRange: [-0.8, 0.8]
    };
  }
  
  // Default thresholds for most ETFs
  return {
    buyThreshold: -1.5,
    sellThreshold: 1.5,
    neutralRange: [-1.0, 1.0]
  };
}