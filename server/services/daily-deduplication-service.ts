import { db } from '../db';
import { historicalTechnicalIndicators } from '../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import logger from '../utils/logger';

interface TechnicalIndicators {
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  bollingerPercentB?: number | null;
  ema12?: number | null;
  ema26?: number | null;
}

/**
 * Daily Deduplication Service
 * Prevents corruption by ensuring exactly one data point per trading day
 */
export class DailyDeduplicationService {
  
  /**
   * Store technical indicators with automatic deduplication
   * Returns true if stored, false if duplicate prevented
   */
  async storeTechnicalIndicatorsWithDeduplication(
    symbol: string,
    indicators: TechnicalIndicators
  ): Promise<boolean> {
    try {
      // Check if we already have a record for today
      const existsToday = await this.hasRecordForToday(symbol);
      
      if (existsToday) {
        logger.debug(`⏭️ Skipping duplicate storage for ${symbol} - already stored today`);
        return false;
      }
      
      // Validate and sanitize indicators
      const validatedIndicators = this.validateIndicators(indicators);
      
      // Store the new record
      await db.insert(historicalTechnicalIndicators).values({
        symbol,
        date: new Date(),
        rsi: validatedIndicators.rsi,
        macd: validatedIndicators.macd,
        macdSignal: validatedIndicators.macdSignal,
        bollingerPercentB: validatedIndicators.bollingerPercentB,
        // EMA fields would be added if they exist in schema
      });
      
      logger.debug(`✅ Stored technical indicators for ${symbol}`);
      return true;
      
    } catch (error) {
      logger.error(`Error storing indicators for ${symbol}:`, error);
      return false;
    }
  }
  
  /**
   * Check if a record already exists for today
   */
  private async hasRecordForToday(symbol: string): Promise<boolean> {
    try {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = CURRENT_DATE`
          )
        );
      
      return Number(result[0]?.count || 0) > 0;
      
    } catch (error) {
      logger.error(`Error checking existing record for ${symbol}:`, error);
      return false; // Assume no record to allow storage attempt
    }
  }
  
  /**
   * Get count of today's records for a symbol
   */
  async getTodaysRecordCount(symbol: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = CURRENT_DATE`
          )
        );
      
      return Number(result[0]?.count || 0);
      
    } catch (error) {
      logger.error(`Error getting today's record count for ${symbol}:`, error);
      return 0;
    }
  }
  
  /**
   * Clean up duplicate records for a specific date
   * Keeps only the latest record per day
   */
  async cleanupDuplicatesForDate(symbol: string, date: Date): Promise<void> {
    try {
      // Get the latest record for the specified date
      const latestRecord = await db
        .select()
        .from(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = DATE(${date.toISOString()})`
          )
        )
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(1);
      
      if (latestRecord.length === 0) {
        return; // No records to clean up
      }
      
      // Delete all other records for the same day
      await db
        .delete(historicalTechnicalIndicators)
        .where(
          and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`DATE(${historicalTechnicalIndicators.date}) = DATE(${date.toISOString()})`,
            sql`${historicalTechnicalIndicators.id} != ${latestRecord[0].id}`
          )
        );
      
      logger.info(`🧹 Cleaned up duplicates for ${symbol} on ${date.toDateString()}`);
      
    } catch (error) {
      logger.error(`Error cleaning duplicates for ${symbol}:`, error);
    }
  }
  
  /**
   * Validate and sanitize technical indicator values
   */
  private validateIndicators(indicators: TechnicalIndicators): TechnicalIndicators {
    const validated: TechnicalIndicators = {};
    
    // RSI should be 0-100
    if (indicators.rsi !== null && indicators.rsi !== undefined) {
      validated.rsi = Math.max(0, Math.min(100, indicators.rsi));
    }
    
    // MACD can be any value but cap extreme values
    if (indicators.macd !== null && indicators.macd !== undefined) {
      validated.macd = Math.max(-50, Math.min(50, indicators.macd));
    }
    
    // MACD Signal similar to MACD
    if (indicators.macdSignal !== null && indicators.macdSignal !== undefined) {
      validated.macdSignal = Math.max(-50, Math.min(50, indicators.macdSignal));
    }
    
    // Bollinger %B should be 0-1
    if (indicators.bollingerPercentB !== null && indicators.bollingerPercentB !== undefined) {
      validated.bollingerPercentB = Math.max(0, Math.min(1, indicators.bollingerPercentB));
    }
    
    // EMAs can be any positive value
    if (indicators.ema12 !== null && indicators.ema12 !== undefined) {
      validated.ema12 = Math.max(0, indicators.ema12);
    }
    
    if (indicators.ema26 !== null && indicators.ema26 !== undefined) {
      validated.ema26 = Math.max(0, indicators.ema26);
    }
    
    return validated;
  }
  
  /**
   * Check if we should skip storage based on market conditions
   */
  shouldSkipStorage(symbol: string): boolean {
    // Could implement logic to skip storage during market closure
    // or for specific symbols, but for now always allow storage
    return false;
  }
  
  /**
   * Check if market is currently open (basic implementation)
   */
  isMarketHours(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    // Basic US market hours check (9:30 AM - 4:00 PM EST = 14:30 - 21:00 UTC)
    // This is a simplified version - production would use proper market calendar
    return utcHour >= 14 && utcHour < 21;
  }
  
  /**
   * Comprehensive cleanup for all duplicates of a symbol
   */
  async cleanupAllDuplicates(symbol: string): Promise<number> {
    try {
      // Use DISTINCT ON to keep only one record per day (the latest)
      const cleanupQuery = sql`
        DELETE FROM ${historicalTechnicalIndicators}
        WHERE ${historicalTechnicalIndicators.id} NOT IN (
          SELECT DISTINCT ON (DATE(${historicalTechnicalIndicators.date})) ${historicalTechnicalIndicators.id}
          FROM ${historicalTechnicalIndicators}
          WHERE ${historicalTechnicalIndicators.symbol} = ${symbol}
          ORDER BY DATE(${historicalTechnicalIndicators.date}) DESC, ${historicalTechnicalIndicators.date} DESC
        )
        AND ${historicalTechnicalIndicators.symbol} = ${symbol}
      `;
      
      const result = await db.execute(cleanupQuery);
      const deletedCount = result.rowCount || 0;
      
      logger.info(`🧹 Cleaned up ${deletedCount} duplicate records for ${symbol}`);
      return deletedCount;
      
    } catch (error) {
      logger.error(`Error in comprehensive cleanup for ${symbol}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export const dailyDeduplicationService = new DailyDeduplicationService();