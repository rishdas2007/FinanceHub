import { db } from '../db';
import { stockData, StockData, InsertStockData } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { DATABASE_CONFIG } from '../../shared/config/constants';
import { logger } from '../utils/logger';

export interface IStockDataRepository {
  findBySymbol(symbol: string): Promise<StockData[]>;
  findBySymbolAndDateRange(symbol: string, startDate: Date, endDate: Date): Promise<StockData[]>;
  findLatestBySymbol(symbol: string): Promise<StockData | null>;
  bulkInsert(data: InsertStockData[]): Promise<StockData[]>;
  create(data: InsertStockData): Promise<StockData>;
  delete(id: number): Promise<void>;
}

export class StockDataRepository implements IStockDataRepository {
  async findBySymbol(symbol: string): Promise<StockData[]> {
    try {
      return await db
        .select()
        .from(stockData)
        .where(eq(stockData.symbol, symbol))
        .orderBy(desc(stockData.timestamp));
    } catch (error) {
      logger.error('Failed to find stock data by symbol', { symbol, error });
      throw error;
    }
  }

  async findBySymbolAndDateRange(
    symbol: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<StockData[]> {
    try {
      return await db
        .select()
        .from(stockData)
        .where(
          and(
            eq(stockData.symbol, symbol),
            gte(stockData.timestamp, startDate),
            lte(stockData.timestamp, endDate)
          )
        )
        .orderBy(desc(stockData.timestamp));
    } catch (error) {
      logger.error('Failed to find stock data by date range', { 
        symbol, startDate, endDate, error 
      });
      throw error;
    }
  }

  async findLatestBySymbol(symbol: string): Promise<StockData | null> {
    try {
      const [latest] = await db
        .select()
        .from(stockData)
        .where(eq(stockData.symbol, symbol))
        .orderBy(desc(stockData.timestamp))
        .limit(1);
      
      return latest || null;
    } catch (error) {
      logger.error('Failed to find latest stock data', { symbol, error });
      throw error;
    }
  }

  async bulkInsert(data: InsertStockData[]): Promise<StockData[]> {
    if (data.length === 0) return [];

    const batches = this.chunkArray(data, DATABASE_CONFIG.BULK_INSERT_SIZE);
    const results: StockData[] = [];

    try {
      for (const batch of batches) {
        logger.info('Executing bulk insert', { 
          batchSize: batch.length, 
          totalBatches: batches.length 
        });

        const batchResults = await db
          .insert(stockData)
          .values(batch)
          .onConflictDoNothing()
          .returning();

        results.push(...batchResults);
      }

      logger.info('Bulk insert completed', { 
        totalInserted: results.length,
        totalRequested: data.length 
      });

      return results;
    } catch (error) {
      logger.error('Bulk insert failed', { 
        batchCount: batches.length, 
        totalRecords: data.length, 
        error 
      });
      throw error;
    }
  }

  async create(data: InsertStockData): Promise<StockData> {
    try {
      const [created] = await db
        .insert(stockData)
        .values(data)
        .returning();

      return created;
    } catch (error) {
      logger.error('Failed to create stock data', { data, error });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await db
        .delete(stockData)
        .where(eq(stockData.id, id));
    } catch (error) {
      logger.error('Failed to delete stock data', { id, error });
      throw error;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}