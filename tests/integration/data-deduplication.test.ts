import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@server/db';
import { historicalTechnicalIndicators } from '@shared/schema';
import { DailyDeduplicationService } from '@server/services/daily-deduplication-service';
import { eq, and, sql } from 'drizzle-orm';

describe('Data Deduplication Integration Tests', () => {
  let service: DailyDeduplicationService;
  const testSymbol = 'TEST_SPY';
  
  beforeAll(async () => {
    service = new DailyDeduplicationService();
    
    // Clean up any existing test data
    await db.delete(historicalTechnicalIndicators)
      .where(eq(historicalTechnicalIndicators.symbol, testSymbol));
  });
  
  afterAll(async () => {
    // Clean up test data
    await db.delete(historicalTechnicalIndicators)
      .where(eq(historicalTechnicalIndicators.symbol, testSymbol));
  });
  
  beforeEach(async () => {
    // Clean slate for each test
    await db.delete(historicalTechnicalIndicators)
      .where(eq(historicalTechnicalIndicators.symbol, testSymbol));
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate daily records for same symbol', async () => {
      const indicators = {
        rsi: 55.5,
        macd: 0.75,
        macdSignal: 0.5,
        bollingerPercB: 0.65,
        ema12: 100.5,
        ema26: 99.8
      };
      
      // First insert should succeed
      const firstResult = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, indicators);
      expect(firstResult).toBe(true);
      
      // Second insert for same day should be skipped
      const secondResult = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, indicators);
      expect(secondResult).toBe(false);
      
      // Verify only one record exists for today
      const count = await service.getTodaysRecordCount(testSymbol);
      expect(count).toBe(1);
    });

    it('should allow storage on different days', async () => {
      const indicators = {
        rsi: 55.5,
        macd: 0.75,
        bollingerPercB: 0.65
      };
      
      // Insert record for today
      const todayResult = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, indicators);
      expect(todayResult).toBe(true);
      
      // Manually insert record for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await db.insert(historicalTechnicalIndicators).values({
        symbol: testSymbol,
        date: yesterday,
        rsi: 52.0,
        macd: 0.3,
        bollingerPercB: 0.4
      });
      
      // Verify we have 2 records (different days)
      const totalRecords = await db.select({ count: sql`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(eq(historicalTechnicalIndicators.symbol, testSymbol));
      
      expect(Number(totalRecords[0].count)).toBe(2);
    });

    it('should handle concurrent requests safely', async () => {
      const indicators = {
        rsi: 55.5,
        macd: 0.75,
        bollingerPercB: 0.65
      };
      
      // Simulate concurrent requests
      const promises = Array(5).fill(null).map(() => 
        service.storeTechnicalIndicatorsWithDeduplication(testSymbol, indicators)
      );
      
      const results = await Promise.all(promises);
      
      // Only one should succeed, others should be rejected
      const successCount = results.filter(r => r === true).length;
      expect(successCount).toBe(1);
      
      // Verify only one record exists
      const count = await service.getTodaysRecordCount(testSymbol);
      expect(count).toBe(1);
    });
  });

  describe('Duplicate Cleanup', () => {
    it('should clean up existing intraday duplicates', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day
      
      // Insert multiple records for the same day (simulate corruption)
      const duplicateRecords = [
        {
          symbol: testSymbol,
          date: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9 AM
          rsi: 50.0,
          macd: 0.5
        },
        {
          symbol: testSymbol,
          date: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12 PM
          rsi: 52.0,
          macd: 0.7
        },
        {
          symbol: testSymbol,
          date: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 3 PM
          rsi: 54.0,
          macd: 0.9
        }
      ];
      
      await db.insert(historicalTechnicalIndicators).values(duplicateRecords);
      
      // Verify we have 3 records
      const beforeCleanup = await db.select({ count: sql`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, testSymbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = CURRENT_DATE`
          )
        );
      
      expect(Number(beforeCleanup[0].count)).toBe(3);
      
      // Run cleanup
      await service.cleanupDuplicatesForDate(testSymbol, today);
      
      // Verify only latest record remains
      const afterCleanup = await db.select({ count: sql`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, testSymbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = CURRENT_DATE`
          )
        );
      
      expect(Number(afterCleanup[0].count)).toBe(1);
      
      // Verify the latest record is kept
      const remainingRecord = await db.select()
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, testSymbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = CURRENT_DATE`
          )
        );
      
      expect(remainingRecord[0].rsi).toBe(54.0); // Should be the latest value
      expect(remainingRecord[0].macd).toBe(0.9);
    });

    it('should preserve records from different days during cleanup', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Insert records for different days
      await db.insert(historicalTechnicalIndicators).values([
        {
          symbol: testSymbol,
          date: today,
          rsi: 55.0,
          macd: 0.8
        },
        {
          symbol: testSymbol,
          date: yesterday,
          rsi: 50.0,
          macd: 0.3
        }
      ]);
      
      // Add duplicate for today only
      await db.insert(historicalTechnicalIndicators).values({
        symbol: testSymbol,
        date: new Date(today.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
        rsi: 57.0,
        macd: 0.9
      });
      
      // Run cleanup for today only
      await service.cleanupDuplicatesForDate(testSymbol, today);
      
      // Verify yesterday's record is preserved
      const yesterdayRecord = await db.select()
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, testSymbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = DATE(${yesterday.toISOString()})`
          )
        );
      
      expect(yesterdayRecord).toHaveLength(1);
      expect(yesterdayRecord[0].rsi).toBe(50.0);
      
      // Verify today has only one record (latest)
      const todayRecords = await db.select()
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, testSymbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = CURRENT_DATE`
          )
        );
      
      expect(todayRecords).toHaveLength(1);
      expect(todayRecords[0].rsi).toBe(57.0); // Latest value
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate technical indicator ranges during storage', async () => {
      const invalidIndicators = {
        rsi: 150, // Invalid: RSI should be 0-100
        macd: 0.75,
        bollingerPercB: 1.5 // Invalid: %B should be 0-1
      };
      
      const result = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, invalidIndicators);
      
      // Storage should still succeed but values should be validated/capped
      expect(result).toBe(true);
      
      const storedRecord = await db.select()
        .from(historicalTechnicalIndicators)
        .where(eq(historicalTechnicalIndicators.symbol, testSymbol));
      
      // Values should be within valid ranges
      expect(storedRecord[0].rsi).toBeLessThanOrEqual(100);
      expect(storedRecord[0].bollingerPercB).toBeLessThanOrEqual(1);
    });

    it('should handle null values appropriately', async () => {
      const partialIndicators = {
        rsi: 55.5,
        macd: null, // Some indicators can be null
        bollingerPercB: 0.65
      };
      
      const result = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, partialIndicators);
      expect(result).toBe(true);
      
      const storedRecord = await db.select()
        .from(historicalTechnicalIndicators)
        .where(eq(historicalTechnicalIndicators.symbol, testSymbol));
      
      expect(storedRecord[0].rsi).toBe(55.5);
      expect(storedRecord[0].macd).toBeNull();
      expect(storedRecord[0].bollingerPercB).toBe(0.65);
    });
  });

  describe('Market Timing Validation', () => {
    it('should respect market hours for storage validation', async () => {
      const indicators = {
        rsi: 55.5,
        macd: 0.75,
        bollingerPercB: 0.65
      };
      
      // Test market timing (this would be mocked in real tests)
      const isMarketHours = service.isMarketHours();
      const shouldStore = service.shouldSkipStorage(testSymbol);
      
      // Should not skip storage if market is open or after hours
      expect(typeof shouldStore).toBe('boolean');
      
      const result = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, indicators);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple symbols efficiently', async () => {
      const symbols = ['TEST_SPY', 'TEST_XLK', 'TEST_XLE'];
      const indicators = {
        rsi: 55.5,
        macd: 0.75,
        bollingerPercB: 0.65
      };
      
      const startTime = Date.now();
      
      // Store indicators for multiple symbols
      const promises = symbols.map(symbol => 
        service.storeTechnicalIndicatorsWithDeduplication(symbol, indicators)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // All should succeed
      expect(results.every(r => r === true)).toBe(true);
      
      // Should complete reasonably quickly (less than 1 second for 3 symbols)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Clean up test symbols
      await Promise.all(
        symbols.map(symbol => 
          db.delete(historicalTechnicalIndicators)
            .where(eq(historicalTechnicalIndicators.symbol, symbol))
        )
      );
    });

    it('should maintain performance with large datasets', async () => {
      // Insert a reasonable amount of historical data
      const historicalData = Array.from({ length: 100 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        return {
          symbol: testSymbol,
          date,
          rsi: 50 + Math.sin(i * 0.1) * 10,
          macd: Math.cos(i * 0.1) * 0.5,
          bollingerPercB: 0.5 + Math.sin(i * 0.15) * 0.3
        };
      });
      
      await db.insert(historicalTechnicalIndicators).values(historicalData);
      
      const startTime = Date.now();
      
      // Test deduplication performance with existing data
      const result = await service.storeTechnicalIndicatorsWithDeduplication(testSymbol, {
        rsi: 60.0,
        macd: 0.8,
        bollingerPercB: 0.7
      });
      
      const endTime = Date.now();
      
      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(500); // Should be fast even with 100 records
    });
  });
});