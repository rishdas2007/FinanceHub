import { describe, it, expect } from 'vitest';
import { StandardTechnicalIndicatorsService } from '../../../server/services/standard-technical-indicators';

describe('Technical Indicators Validation', () => {
  const service = StandardTechnicalIndicatorsService.getInstance();

  // Test data: Sample prices for validation
  const testPrices = [
    // 30 days of sample price data for validation
    440.50, 441.20, 442.10, 441.80, 440.90, 441.45, 442.30, 441.95, 440.85, 441.60,
    442.45, 441.70, 440.95, 441.80, 442.60, 441.40, 440.70, 441.95, 442.80, 441.20,
    440.50, 441.85, 443.10, 441.65, 440.35, 442.05, 443.40, 441.90, 440.60, 442.20,
    // Additional data for MACD calculation (need 61+ points)
    443.50, 442.10, 440.80, 442.30, 444.15, 442.60, 441.25, 442.85, 444.70, 442.95,
    441.40, 443.05, 445.20, 443.15, 441.60, 443.40, 445.85, 443.70, 442.05, 443.90,
    446.25, 444.10, 442.45, 444.20, 446.90, 444.55, 442.85, 444.65, 447.30, 444.95,
    443.20
  ];

  it('should calculate RSI within valid bounds', () => {
    const rsi = service['calculateStandardRSI'](testPrices, 14);
    expect(rsi).not.toBeNull();
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it('should calculate MACD with signal line', () => {
    const result = service['calculateStandardMACD'](testPrices);
    expect(result.macd).not.toBeNull();
    expect(result.signal).not.toBeNull();
    expect(result.histogram).not.toBeNull();
  });

  it('should calculate Bollinger %B within valid bounds', () => {
    const bollinger = service['calculateStandardBollinger'](testPrices, 20, 2);
    expect(bollinger.percent_b).not.toBeNull();
    expect(bollinger.percent_b).toBeGreaterThanOrEqual(0);
    expect(bollinger.percent_b).toBeLessThanOrEqual(1);
  });

  it('should return null for insufficient data', () => {
    const shortPrices = [440.50, 441.20, 442.10];
    
    const rsi = service['calculateStandardRSI'](shortPrices, 14);
    const macd = service['calculateStandardMACD'](shortPrices);
    const bollinger = service['calculateStandardBollinger'](shortPrices, 20, 2);
    
    expect(rsi).toBeNull();
    expect(macd.macd).toBeNull();
    expect(bollinger.percent_b).toBeNull();
  });

  it('should calculate consistent Z-scores', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const zScore = service['calculateZScore'](values, 5.5, 5);
    
    expect(zScore).not.toBeNull();
    expect(Math.abs(zScore!)).toBeLessThan(2); // Should be reasonable Z-score
  });
});