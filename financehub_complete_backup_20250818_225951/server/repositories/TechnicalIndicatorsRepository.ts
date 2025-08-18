import { db } from '../db.js';
import { technicalIndicators, TechnicalIndicators, InsertTechnicalIndicators } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { DATABASE_CONFIG } from '../../shared/config/constants';
import { logger } from '../utils/logger';

export interface ITechnicalIndicatorsRepository {
  findBySymbol(symbol: string): Promise<TechnicalIndicators[]>;
  findBySymbolAndDateRange(symbol: string, startDate: Date, endDate: Date): Promise<TechnicalIndicators[]>;
  findLatestBySymbol(symbol: string): Promise<TechnicalIndicators | null>;
  bulkInsert(data: InsertTechnicalIndicators[]): Promise<TechnicalIndicators[]>;
  create(data: InsertTechnicalIndicators): Promise<TechnicalIndicators>;
}

export class TechnicalIndicatorsRepository implements ITechnicalIndicatorsRepository {
  async findBySymbol(symbol: string): Promise<TechnicalIndicators[]> {
    try {
      return await db
        .select()
        .from(technicalIndicators)
        .where(eq(technicalIndicators.symbol, symbol))
        .orderBy(desc(technicalIndicators.timestamp));
    } catch (error) {
      logger.error('Failed to find technical indicators by symbol', { symbol, error });
      throw error;
    }
  }

  async findBySymbolAndDateRange(
    symbol: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<TechnicalIndicators[]> {
    try {
      return await db
        .select()
        .from(technicalIndicators)
        .where(
          and(
            eq(technicalIndicators.symbol, symbol),
            gte(technicalIndicators.timestamp, startDate),
            lte(technicalIndicators.timestamp, endDate)
          )
        )
        .orderBy(desc(technicalIndicators.timestamp));
    } catch (error) {
      logger.error('Failed to find technical indicators by date range', { 
        symbol, startDate, endDate, error 
      });
      throw error;
    }
  }

  async findLatestBySymbol(symbol: string): Promise<TechnicalIndicators | null> {
    try {
      const [latest] = await db
        .select()
        .from(technicalIndicators)
        .where(eq(technicalIndicators.symbol, symbol))
        .orderBy(desc(technicalIndicators.timestamp))
        .limit(1);
      
      return latest || null;
    } catch (error) {
      logger.error('Failed to find latest technical indicators', { symbol, error });
      throw error;
    }
  }

  async bulkInsert(data: InsertTechnicalIndicators[]): Promise<TechnicalIndicators[]> {
    if (data.length === 0) return [];

    const batches = this.chunkArray(data, DATABASE_CONFIG.BULK_INSERT_SIZE);
    const results: TechnicalIndicators[] = [];

    try {
      for (const batch of batches) {
        logger.info('Executing bulk insert for technical indicators', { 
          batchSize: batch.length, 
          totalBatches: batches.length 
        });

        const batchResults = await db
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
          .returning();

        results.push(...batchResults);
      }

      logger.info('Bulk insert completed for technical indicators', { 
        totalInserted: results.length,
        totalRequested: data.length 
      });

      return results;
    } catch (error) {
      logger.error('Bulk insert failed for technical indicators', { 
        batchCount: batches.length, 
        totalRecords: data.length, 
        error 
      });
      throw error;
    }
  }

  async create(data: InsertTechnicalIndicators): Promise<TechnicalIndicators> {
    try {
      const [created] = await db
        .insert(technicalIndicators)
        .values(data)
        .returning();

      return created;
    } catch (error) {
      logger.error('Failed to create technical indicator', { data, error });
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