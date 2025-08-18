import { db } from '../db';
import { historicalTechnicalIndicators } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
const logger = console;

/**
 * Daily Deduplication Service
 * Ensures exactly one data point per trading day for all ETF metrics
 * Prevents database corruption from multiple intraday calculations
 */
export class DailyDeduplicationService {
  
  /**
   * Check if we already have data for today for a given symbol
   * Returns true if data exists (should skip storage), false if we should store
   */
  async shouldSkipStorage(symbol: string): Promise<boolean> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      const existingRecords = await db
        .select({ count: sql<number>`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          sql`DATE(${historicalTechnicalIndicators.date}) = DATE(${startOfDay})`
        ));
      
      const recordCount = existingRecords[0]?.count || 0;
      
      if (recordCount > 0) {
        logger.log(`📅 Daily data already exists for ${symbol} on ${startOfDay.toDateString()}, skipping storage`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error(`❌ Error checking daily data for ${symbol}:`, error);
      return false; // If we can't check, allow storage
    }
  }
  
  /**
   * Store technical indicators with daily deduplication logic
   * Ensures only one record per symbol per trading day
   */
  async storeTechnicalIndicatorsWithDeduplication(
    symbol: string,
    indicators: {
      rsi?: number;
      macd?: number;
      macdSignal?: number;
      percentB?: number;
      atr?: number;
      priceChange?: number;
      maTrend?: number;
    }
  ): Promise<boolean> {
    try {
      // Check if we should skip storage due to existing daily data
      const shouldSkip = await this.shouldSkipStorage(symbol);
      if (shouldSkip) {
        return false; // Storage skipped
      }
      
      // Store the data since we don't have any for today
      const now = new Date();
      
      await db.insert(historicalTechnicalIndicators).values({
        symbol,
        date: now,
        rsi: indicators.rsi ? indicators.rsi.toString() : null,
        macd: indicators.macd ? indicators.macd.toString() : null,
        macdSignal: indicators.macdSignal ? indicators.macdSignal.toString() : null,
        percentB: indicators.percentB ? indicators.percentB.toString() : null,
        atr: indicators.atr ? indicators.atr.toString() : null,
        priceChange: indicators.priceChange ? indicators.priceChange.toString() : null,
        maTrend: indicators.maTrend ? indicators.maTrend.toString() : null,
      });
      
      logger.log(`✅ Stored daily technical indicators for ${symbol} on ${now.toDateString()}`);
      return true; // Storage successful
      
    } catch (error) {
      logger.error(`❌ Error storing deduplicated technical indicators for ${symbol}:`, error);
      return false;
    }
  }
  
  /**
   * Clean up any existing duplicate records for today
   * Keeps only the most recent record per symbol per day
   */
  async cleanupDuplicatesForToday(symbols?: string[]): Promise<void> {
    const symbolsToClean = symbols || [
      'SPY', 'XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY'
    ];
    
    for (const symbol of symbolsToClean) {
      try {
        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        
        // Find all records for today
        const todaysRecords = await db
          .select()
          .from(historicalTechnicalIndicators)
          .where(and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = DATE(${startOfDay})`
          ))
          .orderBy(desc(historicalTechnicalIndicators.date));
        
        if (todaysRecords.length > 1) {
          logger.warn(`🧹 Found ${todaysRecords.length} duplicate records for ${symbol} today, cleaning up`);
          
          // Keep the most recent record, delete the rest
          const [keepRecord, ...deleteRecords] = todaysRecords;
          
          for (const record of deleteRecords) {
            await db
              .delete(historicalTechnicalIndicators)
              .where(and(
                eq(historicalTechnicalIndicators.symbol, symbol),
                eq(historicalTechnicalIndicators.date, record.date)
              ));
          }
          
          logger.info(`✅ Cleaned up ${deleteRecords.length} duplicate records for ${symbol}, kept latest at ${keepRecord.date.toISOString()}`);
        }
        
      } catch (error) {
        logger.error(`❌ Error cleaning duplicates for ${symbol}:`, error);
      }
    }
  }
  
  /**
   * Get the current record count for today
   * Useful for monitoring and verification
   */
  async getTodaysRecordCount(symbol: string): Promise<number> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          sql`DATE(${historicalTechnicalIndicators.date}) = DATE(${startOfDay})`
        ));
      
      return result[0]?.count || 0;
      
    } catch (error) {
      logger.error(`❌ Error getting record count for ${symbol}:`, error);
      return 0;
    }
  }
  
  /**
   * Verify daily deduplication across all ETFs
   * Returns a summary of record counts per symbol for today
   */
  async verifyDailyDeduplication(): Promise<{ [symbol: string]: number }> {
    const symbols = ['SPY', 'XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY'];
    const results: { [symbol: string]: number } = {};
    
    for (const symbol of symbols) {
      results[symbol] = await this.getTodaysRecordCount(symbol);
    }
    
    const totalRecords = Object.values(results).reduce((sum, count) => sum + count, 0);
    const symbolsWithMultiple = Object.entries(results).filter(([_, count]) => count > 1);
    
    logger.info(`📊 Daily Deduplication Verification:`);
    logger.info(`  Total records today: ${totalRecords}`);
    logger.info(`  Symbols with multiple records: ${symbolsWithMultiple.length}`);
    
    if (symbolsWithMultiple.length > 0) {
      logger.warn(`⚠️ Symbols with duplicates:`, symbolsWithMultiple);
    } else {
      logger.info(`✅ All symbols have exactly one data point per trading day`);
    }
    
    return results;
  }
  
  /**
   * Market-aware storage decision
   * Only allows storage during market hours or at market close
   * Prevents multiple storage calls throughout the day
   */
  async isStorageAllowed(): Promise<{ allowed: boolean; reason: string }> {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Market hours: 9:30 AM - 4:00 PM ET (converted to local time)
    const marketOpen = 9 * 60 + 30; // 9:30 AM in minutes
    const marketClose = 16 * 60; // 4:00 PM in minutes
    const currentMinutes = hour * 60 + minute;
    
    // Allow storage during market hours or within 1 hour after close
    const afterHoursLimit = marketClose + 60; // 5:00 PM
    
    if (currentMinutes >= marketOpen && currentMinutes <= afterHoursLimit) {
      return { allowed: true, reason: 'Within market hours or after-hours period' };
    } else {
      return { 
        allowed: false, 
        reason: `Outside trading hours (${hour}:${minute.toString().padStart(2, '0')}). Market: 9:30 AM - 5:00 PM ET` 
      };
    }
  }
}

// Export singleton instance
export const dailyDeduplicationService = new DailyDeduplicationService();