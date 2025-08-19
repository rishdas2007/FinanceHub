import { describe, it, expect } from 'vitest';
import { DailyDeduplicationService } from '../../server/services/daily-deduplication-service';

describe('Data Deduplication Service Tests', () => {
  const service = new DailyDeduplicationService();
  const testSymbol = 'TEST_SPY';

  describe('Service Creation', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DailyDeduplicationService);
    });

    it('should handle indicator validation', () => {
      const result = service.shouldSkipStorage(testSymbol);
      expect(typeof result).toBe('boolean');
    });

    it('should detect market hours', () => {
      const isMarketHours = service.isMarketHours();
      expect(typeof isMarketHours).toBe('boolean');
    });
  });

  describe('Async Operations', () => {
    it('should handle record count queries', async () => {
      const count = await service.getTodaysRecordCount(testSymbol);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle cleanup operations', async () => {
      const deletedCount = await service.cleanupAllDuplicates(testSymbol);
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle date-specific cleanup', async () => {
      await service.cleanupDuplicatesForDate(testSymbol, new Date());
      // Test passes if no errors thrown
      expect(true).toBe(true);
    });

    it('should store technical indicators', async () => {
      const indicators = {
        rsi: 55.5,
        macd: 0.75,
        bollingerPercentB: 0.65
      };
      
      const result = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, indicators);
      expect(typeof result).toBe('boolean');
    });
  });
});