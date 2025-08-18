/**
 * Integration tests for Economic Unit Formatting
 * Tests end-to-end formatting from database to frontend
 */

import { describe, it, expect } from 'vitest';
import { EconomicUnitFormatter } from '../../shared/formatters/economic-unit-formatter';

describe('Economic Unit Formatter', () => {
  describe('formatValue', () => {
    it('should format PCT_DECIMAL correctly', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 0.025,
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 1
      });
      
      expect(result).toBe('2.5%');
    });

    it('should format USD with scale hints', () => {
      const resultK = EconomicUnitFormatter.formatValue({
        value: 50000,
        standardUnit: 'USD',
        scaleHint: 'K',
        displayPrecision: 1
      });
      
      expect(resultK).toBe('$50.0K');

      const resultM = EconomicUnitFormatter.formatValue({
        value: 2500000,
        standardUnit: 'USD',
        scaleHint: 'M',
        displayPrecision: 1
      });
      
      expect(resultM).toBe('$2.5M');
    });

    it('should format COUNT with scale hints', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 15000,
        standardUnit: 'COUNT',
        scaleHint: 'K',
        displayPrecision: 1
      });
      
      expect(result).toBe('15.0K');
    });

    it('should format INDEX_PT with YoY change', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 294.2,
        standardUnit: 'INDEX_PT',
        scaleHint: 'NONE',
        displayPrecision: 1,
        transformCode: 'LEVEL',
        yoyChange: 2.7
      });
      
      expect(result).toBe('294.2 (2.7% YoY)');
    });

    it('should format INDEX_PT as YoY percentage', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 2.7,
        standardUnit: 'INDEX_PT',
        scaleHint: 'NONE',
        displayPrecision: 1,
        transformCode: 'YOY'
      });
      
      expect(result).toBe('2.7%');
    });

    it('should format HOURS correctly', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 34.5,
        standardUnit: 'HOURS',
        scaleHint: 'NONE',
        displayPrecision: 1
      });
      
      expect(result).toBe('34.5 hrs');
    });

    it('should format RATIO_DECIMAL correctly', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 0.632,
        standardUnit: 'RATIO_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 3
      });
      
      expect(result).toBe('0.632');
    });

    it('should handle null/undefined values', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: null as any,
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 1
      });
      
      expect(result).toBe('N/A');
    });

    it('should handle unknown standard units', () => {
      const result = EconomicUnitFormatter.formatValue({
        value: 123.45,
        standardUnit: 'UNKNOWN_UNIT' as any,
        scaleHint: 'NONE',
        displayPrecision: 2
      });
      
      expect(result).toBe('123.45');
    });
  });

  describe('getDisplayUnit', () => {
    it('should return correct display units', () => {
      expect(EconomicUnitFormatter.getDisplayUnit('PCT_DECIMAL', 'NONE')).toBe('%');
      expect(EconomicUnitFormatter.getDisplayUnit('USD', 'K')).toBe('K$');
      expect(EconomicUnitFormatter.getDisplayUnit('COUNT', 'M')).toBe('M');
      expect(EconomicUnitFormatter.getDisplayUnit('HOURS', 'NONE')).toBe('hrs');
    });
  });

  describe('formatIndicatorValue', () => {
    it('should format with full context', () => {
      const result = EconomicUnitFormatter.formatIndicatorValue(
        0.025,
        'CPIAUCSL',
        'PCT_DECIMAL',
        'NONE',
        1,
        'YOY'
      );
      
      expect(result).toBe('2.5%');
    });

    it('should handle validation errors gracefully', () => {
      const result = EconomicUnitFormatter.formatIndicatorValue(
        123.45,
        'TEST_SERIES',
        'INVALID_UNIT' as any,
        'NONE',
        2
      );
      
      expect(result).toBe('123.45'); // Fallback to generic formatting
    });
  });

  describe('validateParams', () => {
    it('should validate correct parameters', () => {
      const validParams = {
        value: 123,
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 2
      };
      
      expect(EconomicUnitFormatter.validateParams(validParams)).toBe(true);
    });

    it('should reject invalid parameters', () => {
      const invalidParams = {
        value: 123,
        standardUnit: 'INVALID_UNIT' as any,
        scaleHint: 'INVALID_SCALE' as any,
        displayPrecision: 2
      };
      
      expect(EconomicUnitFormatter.validateParams(invalidParams)).toBe(false);
    });
  });
});

describe('Standard Unit Implementation Integration', () => {
  it('should handle all standard unit types', () => {
    const standardUnits = ['PCT_DECIMAL', 'USD', 'COUNT', 'INDEX_PT', 'HOURS', 'RATIO_DECIMAL'];
    
    standardUnits.forEach(unit => {
      const result = EconomicUnitFormatter.formatValue({
        value: 100,
        standardUnit: unit,
        scaleHint: 'NONE',
        displayPrecision: 1
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it('should handle all scale hints', () => {
    const scaleHints = ['NONE', 'K', 'M', 'B'];
    
    scaleHints.forEach(scale => {
      const result = EconomicUnitFormatter.formatValue({
        value: 1000000,
        standardUnit: 'COUNT',
        scaleHint: scale,
        displayPrecision: 1
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  it('should maintain consistent precision formatting', () => {
    const precisions = [0, 1, 2, 3];
    
    precisions.forEach(precision => {
      const result = EconomicUnitFormatter.formatValue({
        value: 123.456789,
        standardUnit: 'RATIO_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: precision
      });
      
      const decimalPlaces = result.includes('.') ? result.split('.')[1].length : 0;
      expect(decimalPlaces).toBe(precision);
    });
  });
});

// Test data consistency scenarios
describe('Data Consistency Tests', () => {
  it('should handle edge case values', () => {
    const edgeCases = [0, -1, 0.0001, 999999999, -999999999];
    
    edgeCases.forEach(value => {
      const result = EconomicUnitFormatter.formatValue({
        value,
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 2
      });
      
      expect(result).toBeDefined();
      expect(result).not.toBe('N/A');
    });
  });

  it('should preserve data authenticity in formatting', () => {
    // Test that formatting doesn't change the underlying data meaning
    const originalValue = 2.75;
    const formatted = EconomicUnitFormatter.formatValue({
      value: originalValue,
      standardUnit: 'PCT_DECIMAL',
      scaleHint: 'NONE',
      displayPrecision: 2
    });
    
    // Should be "2.75%"
    expect(formatted).toBe('2.75%');
    
    // Extract numeric part and verify it matches original
    const numericPart = parseFloat(formatted.replace('%', ''));
    expect(numericPart).toBe(originalValue);
  });
});