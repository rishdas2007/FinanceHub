import { db } from '../db.js';
import { stockData, technicalIndicators, InsertStockData, InsertTechnicalIndicators } from '../../shared/schema';
import { logger } from '../utils/logger';
import { DATABASE_CONFIG } from '../../shared/config/constants';

export class BulkDataService {
  /**
   * Bulk insert stock data with batch processing to avoid memory issues
   */
  static async bulkInsertStockData(data: InsertStockData[]): Promise<number> {
    if (data.length === 0) return 0;

    const batchSize = DATABASE_CONFIG.BULK_INSERT_SIZE;
    const batches = this.chunkArray(data, batchSize);
    let totalInserted = 0;

    logger.info('Starting bulk stock data insert', {
      totalRecords: data.length,
      batchSize,
      batchCount: batches.length
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Processing batch ${i + 1}/${batches.length}`, { batchSize: batch.length });

        const results = await db
          .insert(stockData)
          .values(batch)
          .onConflictDoUpdate({
            target: [stockData.symbol, stockData.timestamp],
            set: {
              price: batch[0].price,
              volume: batch[0].volume,
              updatedAt: new Date()
            }
          })
          .returning({ id: stockData.id });

        totalInserted += results.length;
        
        // Add small delay between batches to avoid overwhelming the database
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      logger.info('Bulk stock data insert completed', {
        totalInserted,
        totalRequested: data.length,
        successRate: (totalInserted / data.length) * 100
      });

      return totalInserted;
    } catch (error) {
      logger.error('Bulk stock data insert failed', {
        error: error instanceof Error ? error.message : String(error),
        totalRecords: data.length,
        batchCount: batches.length
      });
      throw error;
    }
  }

  /**
   * Bulk insert technical indicators with conflict resolution
   */
  static async bulkInsertTechnicalIndicators(data: InsertTechnicalIndicators[]): Promise<number> {
    if (data.length === 0) return 0;

    const batchSize = DATABASE_CONFIG.BULK_INSERT_SIZE;
    const batches = this.chunkArray(data, batchSize);
    let totalInserted = 0;

    logger.info('Starting bulk technical indicators insert', {
      totalRecords: data.length,
      batchSize,
      batchCount: batches.length
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        const results = await db
          .insert(technicalIndicators)
          .values(batch)
          .onConflictDoUpdate({
            target: [technicalIndicators.symbol, technicalIndicators.timestamp],
            set: {
              rsi: batch[0].rsi,
              macd: batch[0].macd,
              macdSignal: batch[0].macdSignal,
              macdHistogram: batch[0].macdHistogram,
              updatedAt: new Date()
            }
          })
          .returning({ id: technicalIndicators.id });

        totalInserted += results.length;
        
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      logger.info('Bulk technical indicators insert completed', {
        totalInserted,
        totalRequested: data.length
      });

      return totalInserted;
    } catch (error) {
      logger.error('Bulk technical indicators insert failed', {
        error: error instanceof Error ? error.message : String(error),
        totalRecords: data.length
      });
      throw error;
    }
  }

  /**
   * Generic method to process any bulk operation with batching
   */
  static async processBulkOperation<T, R>(
    data: T[],
    operation: (batch: T[]) => Promise<R[]>,
    batchSize = DATABASE_CONFIG.BULK_INSERT_SIZE
  ): Promise<R[]> {
    if (data.length === 0) return [];

    const batches = this.chunkArray(data, batchSize);
    const results: R[] = [];

    logger.info('Starting bulk operation', {
      totalRecords: data.length,
      batchSize,
      batchCount: batches.length
    });

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await operation(batch);
      results.push(...batchResults);
      
      // Add delay between batches
      if (i < batches.length - 1) {
        await this.delay(50);
      }
    }

    logger.info('Bulk operation completed', {
      totalProcessed: results.length,
      totalRequested: data.length
    });

    return results;
  }

  /**
   * Chunk array into smaller arrays of specified size
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Add delay between operations to avoid overwhelming database
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get bulk operation statistics
   */
  static async getBulkOperationStats() {
    try {
      const [stockCount] = await db
        .select({ count: stockData.id })
        .from(stockData);

      const [indicatorCount] = await db
        .select({ count: technicalIndicators.id })
        .from(technicalIndicators);

      return {
        stockDataRecords: stockCount?.count || 0,
        technicalIndicatorRecords: indicatorCount?.count || 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get bulk operation stats', { error });
      return {
        stockDataRecords: 0,
        technicalIndicatorRecords: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Failed to retrieve stats'
      };
    }
  }
}