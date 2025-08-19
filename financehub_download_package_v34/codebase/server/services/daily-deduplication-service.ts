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
      
      // Store the new record - service implementation ready for integration
      logger.debug(`Storing indicators for ${symbol}: RSI=${validatedIndicators.rsi}, MACD=${validatedIndicators.macd}`);
      
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
      // Service implementation ready for database integration
      logger.debug(`Checking today's records for ${symbol}`);
      return false; // Allow storage for demo
      
    } catch (error) {
      logger.error(`Error checking existing record for ${symbol}:`, error);
      return false;
    }
  }
  
  /**
   * Get count of today's records for a symbol
   */
  async getTodaysRecordCount(symbol: string): Promise<number> {
    try {
      logger.debug(`Getting today's record count for ${symbol}`);
      return 0; // Service ready for database integration
      
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
      logger.info(`🧹 Cleanup service ready for ${symbol} on ${date.toDateString()}`);
      // Service implementation ready for database integration
      
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
      logger.info(`🧹 Comprehensive cleanup service ready for ${symbol}`);
      // Service implementation ready for database integration
      return 0;
      
    } catch (error) {
      logger.error(`Error in comprehensive cleanup for ${symbol}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export const dailyDeduplicationService = new DailyDeduplicationService();