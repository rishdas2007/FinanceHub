import { dailyDeduplicationService } from './daily-deduplication-service';
import { db } from '../db';
import { historicalTechnicalIndicators } from '@shared/schema';
const logger = console;

/**
 * ETF Data Collection Service with Daily Deduplication
 * Ensures exactly one data point per trading day for all ETF metrics
 * Integrates with existing data collection workflows
 */
export class ETFDataCollectionService {
  private readonly ETF_SYMBOLS = [
    'SPY', 'XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY'
  ];

  /**
   * Collect and store ETF technical indicators with daily deduplication
   * This is the main method to replace existing direct storage calls
   */
  async collectAndStoreETFData(
    symbol: string,
    technicalIndicators: {
      rsi?: number;
      macd?: number;
      macdSignal?: number;
      percentB?: number;
      atr?: number;
      priceChange?: number;
      maTrend?: number;
    }
  ): Promise<{ stored: boolean; reason: string }> {
    try {
      // Step 1: Check if storage is allowed based on market timing
      const { allowed, reason } = await dailyDeduplicationService.isStorageAllowed();
      if (!allowed) {
        logger.info(`⏰ Storage not allowed for ${symbol}: ${reason}`);
        return { stored: false, reason: `Market timing: ${reason}` };
      }

      // Step 2: Check if we already have data for today
      const shouldSkip = await dailyDeduplicationService.shouldSkipStorage(symbol);
      if (shouldSkip) {
        logger.info(`📅 Daily data already exists for ${symbol}, skipping storage`);
        return { stored: false, reason: 'Daily data already exists' };
      }

      // Step 3: Validate the technical indicators
      const validatedIndicators = this.validateTechnicalIndicators(technicalIndicators);
      if (!validatedIndicators.isValid) {
        logger.warn(`⚠️ Invalid technical indicators for ${symbol}: ${validatedIndicators.reason}`);
        return { stored: false, reason: `Data validation failed: ${validatedIndicators.reason}` };
      }

      // Step 4: Store with deduplication protection
      const stored = await dailyDeduplicationService.storeTechnicalIndicatorsWithDeduplication(
        symbol,
        technicalIndicators
      );

      if (stored) {
        logger.info(`✅ Successfully stored daily technical indicators for ${symbol}`);
        return { stored: true, reason: 'Successfully stored new daily data' };
      } else {
        logger.warn(`❌ Failed to store technical indicators for ${symbol}`);
        return { stored: false, reason: 'Storage operation failed' };
      }

    } catch (error) {
      logger.error(`💥 Error collecting ETF data for ${symbol}:`, error);
      return { stored: false, reason: `Error: ${String(error)}` };
    }
  }

  /**
   * Batch collection for multiple ETFs with deduplication
   * Processes all ETF symbols with proper error handling
   */
  async batchCollectETFData(
    etfDataMap: Map<string, {
      rsi?: number;
      macd?: number;
      macdSignal?: number;
      percentB?: number;
      atr?: number;
      priceChange?: number;
      maTrend?: number;
    }>
  ): Promise<{
    successful: string[];
    skipped: string[];
    failed: string[];
    summary: { stored: number; skipped: number; failed: number };
  }> {
    const results = {
      successful: [] as string[],
      skipped: [] as string[],
      failed: [] as string[],
    };

    logger.info(`🚀 Starting batch ETF data collection for ${etfDataMap.size} symbols`);

    // Process each ETF with deduplication
    for (const [symbol, indicators] of etfDataMap) {
      try {
        const result = await this.collectAndStoreETFData(symbol, indicators);
        
        if (result.stored) {
          results.successful.push(symbol);
        } else if (result.reason.includes('already exists') || result.reason.includes('Market timing')) {
          results.skipped.push(symbol);
        } else {
          results.failed.push(symbol);
        }
      } catch (error) {
        logger.error(`💥 Batch processing error for ${symbol}:`, String(error));
        results.failed.push(symbol);
      }
    }

    const summary = {
      stored: results.successful.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
    };

    logger.info(`📊 Batch collection complete: ${summary.stored} stored, ${summary.skipped} skipped, ${summary.failed} failed`);

    return { ...results, summary };
  }

  /**
   * Daily cleanup and verification routine
   * Should be run once per day to ensure data integrity
   */
  async performDailyMaintenance(): Promise<{
    cleanupPerformed: boolean;
    duplicatesFound: number;
    verificationPassed: boolean;
    recordCounts: { [symbol: string]: number };
  }> {
    try {
      logger.info('🧹 Starting daily maintenance routine');

      // Step 1: Clean up any duplicates that may have slipped through
      await dailyDeduplicationService.cleanupDuplicatesForToday(this.ETF_SYMBOLS);

      // Step 2: Verify daily deduplication across all ETFs
      const verificationResults = await dailyDeduplicationService.verifyDailyDeduplication();
      
      // Step 3: Check for any remaining duplicates
      const duplicateSymbols = Object.entries(verificationResults).filter(([_, count]) => count > 1);
      const duplicatesFound = duplicateSymbols.length;

      const verificationPassed = duplicatesFound === 0;

      if (verificationPassed) {
        logger.info('✅ Daily maintenance completed - all ETFs have exactly one data point per trading day');
      } else {
        logger.warn(`⚠️ Daily maintenance found ${duplicatesFound} symbols with duplicate records`);
        duplicateSymbols.forEach(([symbol, count]) => {
          logger.warn(`   ${symbol}: ${count} records (expected: 1)`);
        });
      }

      return {
        cleanupPerformed: true,
        duplicatesFound,
        verificationPassed,
        recordCounts: verificationResults,
      };

    } catch (error) {
      logger.error('💥 Error during daily maintenance:', String(error));
      return {
        cleanupPerformed: false,
        duplicatesFound: -1,
        verificationPassed: false,
        recordCounts: {},
      };
    }
  }

  /**
   * Validate technical indicators before storage
   * Ensures data quality and prevents storage of invalid data
   */
  private validateTechnicalIndicators(indicators: {
    rsi?: number;
    macd?: number;
    macdSignal?: number;
    percentB?: number;
    atr?: number;
    priceChange?: number;
    maTrend?: number;
  }): { isValid: boolean; reason: string } {
    // Check if we have at least some data
    const values = Object.values(indicators).filter(v => v !== null && v !== undefined);
    if (values.length === 0) {
      return { isValid: false, reason: 'No valid technical indicator values provided' };
    }

    // Validate RSI range (0-100)
    if (indicators.rsi !== undefined && (indicators.rsi < 0 || indicators.rsi > 100)) {
      return { isValid: false, reason: `Invalid RSI value: ${indicators.rsi} (must be 0-100)` };
    }

    // Validate Bollinger %B range (should be around 0-1, but can exceed slightly)
    if (indicators.percentB !== undefined && (indicators.percentB < -0.5 || indicators.percentB > 1.5)) {
      return { isValid: false, reason: `Invalid Bollinger %B value: ${indicators.percentB} (expected range: 0-1)` };
    }

    // Validate ATR (should be positive)
    if (indicators.atr !== undefined && indicators.atr < 0) {
      return { isValid: false, reason: `Invalid ATR value: ${indicators.atr} (must be positive)` };
    }

    // Additional validation for extreme values
    for (const [key, value] of Object.entries(indicators)) {
      if (value !== undefined && !isFinite(value)) {
        return { isValid: false, reason: `Invalid ${key} value: ${value} (must be finite)` };
      }
    }

    return { isValid: true, reason: 'All validations passed' };
  }

  /**
   * Get current status of daily deduplication across all ETFs
   * Useful for monitoring and debugging
   */
  async getDeduplicationStatus(): Promise<{
    totalETFs: number;
    etfsWithTodaysData: number;
    etfsWithDuplicates: number;
    detailedCounts: { [symbol: string]: number };
    isHealthy: boolean;
  }> {
    try {
      const verificationResults = await dailyDeduplicationService.verifyDailyDeduplication();
      
      const etfsWithData = Object.values(verificationResults).filter(count => count > 0).length;
      const etfsWithDuplicates = Object.values(verificationResults).filter(count => count > 1).length;
      
      return {
        totalETFs: this.ETF_SYMBOLS.length,
        etfsWithTodaysData: etfsWithData,
        etfsWithDuplicates,
        detailedCounts: verificationResults,
        isHealthy: etfsWithDuplicates === 0,
      };
    } catch (error) {
      logger.error('💥 Error getting deduplication status:', String(error));
      return {
        totalETFs: this.ETF_SYMBOLS.length,
        etfsWithTodaysData: 0,
        etfsWithDuplicates: -1,
        detailedCounts: {},
        isHealthy: false,
      };
    }
  }
}

// Export singleton instance
export const etfDataCollectionService = new ETFDataCollectionService();