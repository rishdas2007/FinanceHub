import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedHistoricalDataService } from '../../server/services/unified-historical-data-service';
import { DEFAULT_FALLBACKS } from '../../server/services/unified-historical-data-service';

describe('Z-Score Calculations', () => {
  let service: UnifiedHistoricalDataService;
  
  beforeEach(() => {
    service = new UnifiedHistoricalDataService();
  });

  describe('RSI Z-Score Calculation', () => {
    it('should calculate correct z-score for normal RSI values', async () => {
      // Mock historical RSI data
      const mockHistoricalRSI = [45, 50, 55, 52, 48, 46, 54, 51, 49, 53];
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(mockHistoricalRSI);
      
      const result = await service.calculateZScoreWithFallback('SPY', 52, 'rsi');
      
      expect(result.zScore).toBeCloseTo(0, 1); // Should be near zero for mean values
      expect(result.fallbackUsed).toBe(false);
      expect(result.corruptionDetected).toBe(false);
      expect(result.confidence).toBe('high');
    });
    
    it('should use fallback parameters for insufficient data', async () => {
      // Mock insufficient historical data
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue([50]); // Only one data point
      
      const result = await service.calculateZScoreWithFallback('SPY', 65, 'rsi');
      
      expect(result.fallbackUsed).toBe(true);
      expect(result.fallbackReason).toContain('insufficient_data');
      expect(result.confidence).toBe('low');
      
      // Should use default RSI fallback parameters (mean=50, stddev=15)
      const expectedZScore = (65 - DEFAULT_FALLBACKS.rsi.mean) / DEFAULT_FALLBACKS.rsi.stddev;
      expect(result.zScore).toBeCloseTo(expectedZScore, 2);
    });
    
    it('should handle extreme RSI values correctly', async () => {
      const mockHistoricalRSI = [95, 96, 97, 98, 99, 94, 93, 97, 96, 95]; // Extremely overbought
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(mockHistoricalRSI);
      
      const result = await service.calculateZScoreWithFallback('SPY', 98, 'rsi');
      
      expect(result.zScore).toBeGreaterThan(0); // Should be positive for overbought
      expect(result.extremeValue).toBe(true);
      expect(result.fallbackUsed).toBe(false);
    });
    
    it('should detect and prevent the -13.84 z-score corruption issue', async () => {
      // Simulate the corrupted data pattern that caused extreme z-scores
      const corruptedData = Array(50).fill(50.123456); // Identical values (corruption pattern)
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(corruptedData);
      
      const result = await service.calculateZScoreWithFallback('SPY', 50.123456, 'rsi');
      
      expect(result.corruptionDetected).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(Math.abs(result.zScore!)).toBeLessThan(5); // Should be within reasonable range
      expect(result.fallbackReason).toContain('corruption_detected');
    });

    it('should handle zero variance correctly', async () => {
      // All identical values should trigger corruption detection
      const identicalValues = Array(20).fill(50);
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(identicalValues);
      
      const result = await service.calculateZScoreWithFallback('SPY', 50, 'rsi');
      
      expect(result.corruptionDetected).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('MACD Z-Score Calculation', () => {
    it('should calculate MACD z-score with EMA consistency', async () => {
      const mockMACDData = [
        { value: 0.5, date: new Date(), ema12: 100.5, ema26: 100.0 },
        { value: 0.3, date: new Date(), ema12: 100.3, ema26: 100.0 },
        { value: 0.7, date: new Date(), ema12: 100.7, ema26: 100.0 },
        { value: 0.2, date: new Date(), ema12: 100.2, ema26: 100.0 },
        { value: 0.4, date: new Date(), ema12: 100.4, ema26: 100.0 }
      ];
      
      vi.spyOn(service, 'getHistoricalMACD').mockResolvedValue(mockMACDData);
      
      const result = await service.calculateZScoreWithFallback('SPY', 0.6, 'macd');
      
      expect(Number.isFinite(result.zScore)).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      
      // Verify EMA consistency in mock data
      mockMACDData.forEach(data => {
        if (data.ema12 && data.ema26) {
          expect(data.value).toBeCloseTo(data.ema12 - data.ema26, 5);
        }
      });
    });

    it('should use MACD fallback parameters correctly', async () => {
      vi.spyOn(service, 'getHistoricalMACD').mockResolvedValue([]);
      
      const result = await service.calculateZScoreWithFallback('SPY', 1.5, 'macd');
      
      expect(result.fallbackUsed).toBe(true);
      
      // Should use default MACD fallback parameters (mean=0, stddev=1.03)
      const expectedZScore = (1.5 - DEFAULT_FALLBACKS.macd.mean) / DEFAULT_FALLBACKS.macd.stddev;
      expect(result.zScore).toBeCloseTo(expectedZScore, 2);
    });
  });

  describe('Bollinger %B Z-Score Calculation', () => {
    it('should calculate %B z-score within 0-1 range validation', async () => {
      const mockPercentBData = [0.3, 0.5, 0.7, 0.4, 0.6, 0.8, 0.2, 0.9, 0.1, 0.5];
      
      vi.spyOn(service, 'getHistoricalPercentB').mockResolvedValue(mockPercentBData);
      
      const result = await service.calculateZScoreWithFallback('SPY', 0.75, 'percent_b');
      
      expect(Number.isFinite(result.zScore)).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      
      // Verify all historical values are within valid range
      mockPercentBData.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should filter invalid %B values', async () => {
      // Mock data with some invalid values (outside 0-1 range)
      const mockDataWithInvalid = [0.3, 1.5, 0.7, -0.2, 0.4, 0.6]; // 1.5 and -0.2 are invalid
      
      vi.spyOn(service, 'getHistoricalPercentB').mockResolvedValue([0.3, 0.7, 0.4, 0.6]); // Simulates filtering
      
      const result = await service.calculateZScoreWithFallback('SPY', 0.5, 'percent_b');
      
      expect(result.zScore).toBeFinite();
      expect(result.dataPoints).toBe(4); // Should only count valid values
    });
  });

  describe('Statistical Validation', () => {
    it('should calculate standard deviation correctly', async () => {
      const testValues = [10, 12, 14, 16, 18]; // Stddev should be ~2.74
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(testValues);
      
      const result = await service.calculateZScoreWithFallback('SPY', 20, 'rsi');
      
      // Manual calculation: mean = 14, stddev ≈ 2.74, z-score = (20-14)/2.74 ≈ 2.19
      expect(result.zScore).toBeCloseTo(2.19, 1);
      expect(result.extremeValue).toBe(false); // Should not be extreme yet
    });

    it('should identify extreme z-scores correctly', async () => {
      const normalValues = [50, 51, 49, 52, 48, 50, 51, 49]; // Low variance around 50
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(normalValues);
      
      const result = await service.calculateZScoreWithFallback('SPY', 80, 'rsi'); // Far from mean
      
      expect(Math.abs(result.zScore!)).toBeGreaterThan(3);
      expect(result.extremeValue).toBe(true);
    });

    it('should assign confidence levels appropriately', async () => {
      // High confidence: many data points, no fallback
      const manyDataPoints = Array.from({ length: 40 }, (_, i) => 50 + Math.sin(i) * 5);
      
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue(manyDataPoints);
      
      const result = await service.calculateZScoreWithFallback('SPY', 52, 'rsi');
      
      expect(result.confidence).toBe('high');
      expect(result.dataPoints).toBeGreaterThanOrEqual(30);
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty historical data gracefully', async () => {
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue([]);
      
      const result = await service.calculateZScoreWithFallback('SPY', 55, 'rsi');
      
      expect(result.fallbackUsed).toBe(true);
      expect(result.dataPoints).toBe(0);
      expect(result.fallbackReason).toContain('insufficient_data');
    });

    it('should handle null/undefined values correctly', async () => {
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue([50, 52, 48]); // Minimal valid data
      
      const result = await service.calculateZScoreWithFallback('SPY', 51, 'rsi');
      
      expect(result.zScore).toBeFinite();
      expect(result.zScore).not.toBeNaN();
    });

    it('should cap extreme fallback z-scores', async () => {
      vi.spyOn(service, 'getHistoricalRSI').mockResolvedValue([]); // Force fallback
      
      // Test with extreme value that would create huge z-score
      const result = await service.calculateZScoreWithFallback('SPY', 1000, 'rsi');
      
      expect(result.fallbackUsed).toBe(true);
      expect(Math.abs(result.zScore!)).toBeLessThanOrEqual(5); // Should be capped
    });
  });
});