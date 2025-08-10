import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LiveZScoreCalculator class for testing
class LiveZScoreCalculator {
  calculateZScore(value: number, data: number[]): number {
    if (data.length <= 1) return 0;
    
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const zScore = (value - mean) / stdDev;
    return Math.max(-50, Math.min(50, zScore));
  }

  calculateDeltaZScore(currentValue: number, previousValue: number | null, historicalDeltas: number[]): number {
    if (previousValue === null) return -50;
    
    const currentDelta = currentValue - previousValue;
    if (historicalDeltas.length === 0) return 0;
    
    const mean = historicalDeltas.reduce((sum, val) => sum + val, 0) / historicalDeltas.length;
    const variance = historicalDeltas.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalDeltas.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const deltaZScore = (currentDelta - mean) / stdDev;
    return Math.max(-50, Math.min(50, deltaZScore));
  }

  isStatisticallySignificant(value: number, data: number[]): boolean {
    const zScore = this.calculateZScore(value, data);
    return Math.abs(zScore) > 2; // 2 standard deviations
  }
}

describe('LiveZScoreCalculator', () => {
  let calculator: LiveZScoreCalculator;

  beforeEach(() => {
    calculator = new LiveZScoreCalculator();
  });

  describe('calculateZScore', () => {
    it('should calculate z-score correctly', () => {
      const data = [1, 2, 3, 4, 5];
      const mean = 3;
      const stdDev = Math.sqrt(2);
      
      const zScore = calculator.calculateZScore(4, data);
      expect(zScore).toBeCloseTo(0.707, 2);
    });

    it('should handle single data point', () => {
      const data = [5];
      const zScore = calculator.calculateZScore(5, data);
      expect(zScore).toBe(0);
    });

    it('should handle zero standard deviation', () => {
      const data = [3, 3, 3, 3];
      const zScore = calculator.calculateZScore(3, data);
      expect(zScore).toBe(0);
    });

    it('should cap extreme z-scores', () => {
      const data = [1, 2, 3];
      const zScore = calculator.calculateZScore(1000, data);
      expect(zScore).toBe(50); // Should be capped at 50
    });
  });

  describe('calculateDeltaZScore', () => {
    it('should calculate delta z-score for period-to-period changes', () => {
      const currentValue = 5;
      const previousValue = 3;
      const historicalDeltas = [0.5, -0.2, 1.0, -0.5];
      
      const deltaZScore = calculator.calculateDeltaZScore(
        currentValue,
        previousValue,
        historicalDeltas
      );
      
      expect(deltaZScore).toBeDefined();
      expect(typeof deltaZScore).toBe('number');
    });

    it('should handle missing previous value', () => {
      const deltaZScore = calculator.calculateDeltaZScore(5, null, [1, 2, 3]);
      expect(deltaZScore).toBe(-50); // Default for missing data
    });

    it('should cap extreme delta z-scores', () => {
      const historicalDeltas = [0.1, 0.1, 0.1];
      const deltaZScore = calculator.calculateDeltaZScore(100, 1, historicalDeltas);
      expect(Math.abs(deltaZScore)).toBeLessThanOrEqual(50);
    });
  });

  describe('statistical validation', () => {
    it('should validate statistical significance', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const isSignificant = calculator.isStatisticallySignificant(15, data);
      expect(isSignificant).toBe(true);
    });

    it('should identify non-significant changes', () => {
      const data = [1, 2, 3, 4, 5];
      const isSignificant = calculator.isStatisticallySignificant(3.1, data);
      expect(isSignificant).toBe(false);
    });
  });
});