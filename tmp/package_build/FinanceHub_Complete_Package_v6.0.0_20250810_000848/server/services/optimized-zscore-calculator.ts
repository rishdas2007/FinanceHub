import { logger } from '../middleware/logging';

interface ZScoreStats {
  mean252: number;
  std252: number;
  mean756: number;
  std756: number;
}

interface CircularBuffer {
  data: number[];
  maxSize: number;
  currentIndex: number;
  size: number;
}

interface EnhancedZScoreResult {
  zScore: number;
  factorLoadings: {
    market: number;      // Beta to SPY
    momentum: number;    // Price momentum factor
    volatility: number;  // Volatility factor
    sector: number;      // Sector-relative performance
  };
  riskAdjustedSignal: number;
  confidence: number;
  timestamp: string;
}

interface ZScoreResult {
  symbol: string;
  zScore252: number;
  zScore756: number;
  enhanced: EnhancedZScoreResult;
  timestamp: string;
}

/**
 * Optimized Z-Score Calculator with advanced statistical methods
 * Implements Winsorization, regime-aware calculations, and multi-factor risk models
 */
export class OptimizedZScoreCalculator {
  private rollingBuffers: Map<string, CircularBuffer> = new Map();
  private precomputedStats: Map<string, ZScoreStats> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor() {
    logger.info('🧮 Initializing Optimized Z-Score Calculator with advanced statistical methods');
  }

  /**
   * Create circular buffer for efficient rolling calculations
   */
  private createCircularBuffer(maxSize: number): CircularBuffer {
    return {
      data: new Array(maxSize).fill(0),
      maxSize,
      currentIndex: 0,
      size: 0
    };
  }

  /**
   * Add value to circular buffer
   */
  private addToBuffer(buffer: CircularBuffer, value: number): void {
    buffer.data[buffer.currentIndex] = value;
    buffer.currentIndex = (buffer.currentIndex + 1) % buffer.maxSize;
    buffer.size = Math.min(buffer.size + 1, buffer.maxSize);
  }

  /**
   * Winsorize values to handle outliers (remove extreme values)
   */
  private winsorize(values: number[], percentile: number = 0.05): number[] {
    if (values.length === 0) return values;
    
    const sorted = [...values].sort((a, b) => a - b);
    const lowerIndex = Math.floor(values.length * percentile);
    const upperIndex = Math.floor(values.length * (1 - percentile));
    
    const lowerBound = sorted[lowerIndex];
    const upperBound = sorted[upperIndex];

    return values.map(val => Math.max(lowerBound, Math.min(upperBound, val)));
  }

  /**
   * Calculate Median Absolute Deviation (MAD) based z-score for high volatility periods
   */
  private calculateMADZScore(values: number[], currentValue: number): number {
    if (values.length < 2) return 0;

    const median = this.calculateMedian(values);
    const deviations = values.map(val => Math.abs(val - median));
    const mad = this.calculateMedian(deviations);
    
    // MAD z-score formula: (value - median) / (1.4826 * MAD)
    return mad > 0 ? (currentValue - median) / (1.4826 * mad) : 0;
  }

  /**
   * Calculate median of array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Calculate robust z-score with outlier protection
   */
  private calculateRobustZScore(values: number[], currentValue: number): number {
    if (values.length < 2) return 0;

    const winsorizedValues = this.winsorize(values, 0.05);
    const mean = winsorizedValues.reduce((sum, val) => sum + val, 0) / winsorizedValues.length;
    const variance = winsorizedValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (winsorizedValues.length - 1);
    const std = Math.sqrt(variance);
    
    return std > 0 ? (currentValue - mean) / std : 0;
  }

  /**
   * Regime-aware z-score calculation based on VIX levels
   */
  private calculateRegimeAwareZScore(values: number[], currentValue: number, vixLevel: number): number {
    if (vixLevel > 30) {
      // High volatility: Use MAD-based calculation
      return this.calculateMADZScore(values, currentValue);
    } else {
      // Normal volatility: Use robust z-score
      return this.calculateRobustZScore(values, currentValue);
    }
  }

  /**
   * Calculate factor loadings for multi-factor risk model
   */
  private calculateFactorLoadings(symbol: string, marketData: any): EnhancedZScoreResult['factorLoadings'] {
    // Simplified factor loading calculation
    // In production, this would use regression analysis against factor returns
    
    return {
      market: marketData.beta || 1.0,              // Beta to SPY
      momentum: marketData.momentum || 0.0,        // Price momentum factor
      volatility: marketData.volatility || 1.0,    // Volatility factor
      sector: marketData.sectorBeta || 1.0         // Sector-relative performance
    };
  }

  /**
   * Calculate enhanced z-score with multi-factor risk adjustment
   */
  async calculateEnhancedZScore(
    symbol: string, 
    historicalData: number[], 
    currentValue: number,
    marketData: any = {},
    vixLevel: number = 20
  ): Promise<EnhancedZScoreResult> {
    const startTime = Date.now();

    try {
      // Calculate regime-aware z-score
      const zScore = this.calculateRegimeAwareZScore(historicalData, currentValue, vixLevel);
      
      // Calculate factor loadings
      const factorLoadings = this.calculateFactorLoadings(symbol, marketData);
      
      // Calculate risk-adjusted signal
      const factorAdjustment = (
        factorLoadings.market * 0.4 +
        factorLoadings.momentum * 0.3 +
        factorLoadings.volatility * 0.2 +
        factorLoadings.sector * 0.1
      );
      
      const riskAdjustedSignal = zScore / Math.max(factorAdjustment, 0.5);
      
      // Calculate confidence based on data quality and regime stability
      const confidence = this.calculateConfidence(historicalData, vixLevel);

      const result: EnhancedZScoreResult = {
        zScore,
        factorLoadings,
        riskAdjustedSignal,
        confidence,
        timestamp: new Date().toISOString()
      };

      // Track performance metrics
      const duration = Date.now() - startTime;
      this.trackPerformance(symbol, duration);

      return result;

    } catch (error) {
      logger.error(`Enhanced z-score calculation failed for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate confidence score based on data quality and market regime
   */
  private calculateConfidence(historicalData: number[], vixLevel: number): number {
    if (historicalData.length < 50) return 30; // Low confidence with insufficient data
    
    // Base confidence on data completeness
    let confidence = Math.min(90, historicalData.length / 252 * 100);
    
    // Adjust for market regime
    if (vixLevel > 30) {
      confidence *= 0.8; // Lower confidence in high volatility periods
    } else if (vixLevel < 15) {
      confidence *= 1.1; // Higher confidence in stable periods
    }
    
    // Adjust for data consistency
    const winsorizedData = this.winsorize(historicalData, 0.1);
    const outlierRatio = 1 - (winsorizedData.filter((val, idx) => val === historicalData[idx]).length / historicalData.length);
    confidence *= (1 - outlierRatio * 0.5);
    
    return Math.max(20, Math.min(95, confidence));
  }

  /**
   * Track performance metrics for monitoring
   */
  private trackPerformance(symbol: string, duration: number): void {
    if (!this.performanceMetrics.has(symbol)) {
      this.performanceMetrics.set(symbol, []);
    }
    
    const metrics = this.performanceMetrics.get(symbol)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  /**
   * Get performance report for optimization recommendations
   */
  getPerformanceReport(): any {
    const report: any = {
      symbols: {},
      overall: {
        avgCalculationTime: 0,
        totalCalculations: 0
      }
    };

    let totalDuration = 0;
    let totalCalculations = 0;

    for (const [symbol, durations] of this.performanceMetrics) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      report.symbols[symbol] = {
        avgCalculationTime: avgDuration,
        maxCalculationTime: maxDuration,
        totalCalculations: durations.length
      };
      
      totalDuration += avgDuration * durations.length;
      totalCalculations += durations.length;
    }

    report.overall.avgCalculationTime = totalCalculations > 0 ? totalDuration / totalCalculations : 0;
    report.overall.totalCalculations = totalCalculations;

    return report;
  }

  /**
   * Update z-score incrementally (memory efficient)
   */
  updateZScoreIncremental(symbol: string, newValue: number, vixLevel: number = 20): ZScoreResult {
    // Get or create rolling buffer
    if (!this.rollingBuffers.has(symbol)) {
      this.rollingBuffers.set(symbol, this.createCircularBuffer(756)); // 3-year buffer
    }
    
    const buffer = this.rollingBuffers.get(symbol)!;
    this.addToBuffer(buffer, newValue);
    
    // Calculate z-scores using different time windows
    const data252 = buffer.data.slice(-252); // 1-year
    const data756 = buffer.data.slice(-756); // 3-year
    
    const zScore252 = this.calculateRegimeAwareZScore(data252, newValue, vixLevel);
    const zScore756 = this.calculateRegimeAwareZScore(data756, newValue, vixLevel);
    
    // Calculate enhanced metrics
    const enhanced: EnhancedZScoreResult = {
      zScore: zScore252,
      factorLoadings: {
        market: 1.0,
        momentum: 0.0,
        volatility: vixLevel / 20,
        sector: 1.0
      },
      riskAdjustedSignal: zScore252,
      confidence: this.calculateConfidence(data252, vixLevel),
      timestamp: new Date().toISOString()
    };
    
    return {
      symbol,
      zScore252,
      zScore756,
      enhanced,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const optimizedZScoreCalculator = new OptimizedZScoreCalculator();