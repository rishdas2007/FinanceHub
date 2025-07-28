import { db } from '../db';
import { economicIndicatorsHistory, fredUpdateLog } from '../../shared/schema';
import { eq, desc, and, max, sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import type { InsertEconomicIndicatorHistory, InsertFredUpdateLog } from '../../shared/schema';

export interface IndicatorRecord {
  seriesId: string;
  metric: string;
  category: string;
  type: string;
  frequency: string;
  valueNumeric: number;
  periodDateDesc: string;
  releaseDateDesc: string;
  periodDate: Date;
  releaseDate: Date;
  unit: string;
}

export interface UpdateResult {
  operation: 'insert' | 'update' | 'skip' | 'error';
  recordsProcessed: number;
  recordsStored: number;
  recordsSkipped: number;
  details: string;
}

export class EconomicDataStorageIncremental {
  
  /**
   * Store a new economic indicator record with duplicate prevention
   */
  async storeIndicatorRecord(
    record: IndicatorRecord, 
    sessionId: string
  ): Promise<UpdateResult> {
    try {
      // Check if record already exists (based on seriesId + periodDateDesc)
      const existingRecord = await db
        .select()
        .from(economicIndicatorsHistory)
        .where(
          and(
            eq(economicIndicatorsHistory.seriesId, record.seriesId),
            eq(economicIndicatorsHistory.periodDateDesc, record.periodDateDesc)
          )
        )
        .limit(1);

      if (existingRecord.length > 0) {
        // Log the skip operation
        await this.logFredUpdate({
          sessionId,
          seriesId: record.seriesId,
          operation: 'skip',
          periodDateDesc: record.periodDateDesc,
          valueNumeric: record.valueNumeric.toString(),
          outcome: 'duplicate',
          apiCallsUsed: 0,
          executionTime: 0
        });

        return {
          operation: 'skip',
          recordsProcessed: 1,
          recordsStored: 0,
          recordsSkipped: 1,
          details: `Record already exists for ${record.seriesId} on ${record.periodDateDesc}`
        };
      }

      // Insert new record
      const insertData: InsertEconomicIndicatorHistory = {
        seriesId: record.seriesId,
        metric: record.metric,
        category: record.category,
        type: record.type,
        frequency: record.frequency,
        valueNumeric: record.valueNumeric.toString(),
        periodDateDesc: record.periodDateDesc,
        releaseDateDesc: record.releaseDateDesc,
        periodDate: record.periodDate,
        releaseDate: record.releaseDate,
        unit: record.unit
      };

      await db.insert(economicIndicatorsHistory).values(insertData);

      // Log the successful insert
      await this.logFredUpdate({
        sessionId,
        seriesId: record.seriesId,
        operation: 'insert',
        periodDateDesc: record.periodDateDesc,
        valueNumeric: record.valueNumeric.toString(),
        outcome: 'success',
        apiCallsUsed: 1,
        executionTime: 0
      });

      return {
        operation: 'insert',
        recordsProcessed: 1,
        recordsStored: 1,
        recordsSkipped: 0,
        details: `Successfully inserted ${record.metric} for ${record.periodDateDesc}`
      };

    } catch (error) {
      // Log the error
      await this.logFredUpdate({
        sessionId,
        seriesId: record.seriesId,
        operation: 'insert',
        periodDateDesc: record.periodDateDesc,
        valueNumeric: record.valueNumeric.toString(),
        outcome: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        apiCallsUsed: 1,
        executionTime: 0
      });

      logger.error(`Failed to store indicator record for ${record.seriesId}:`, error);
      
      return {
        operation: 'error',
        recordsProcessed: 1,
        recordsStored: 0,
        recordsSkipped: 0,
        details: `Error storing record: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get latest period date for a specific series
   */
  async getLatestPeriodDate(seriesId: string): Promise<string | null> {
    try {
      const result = await db
        .select({
          periodDateDesc: economicIndicatorsHistory.periodDateDesc
        })
        .from(economicIndicatorsHistory)
        .where(eq(economicIndicatorsHistory.seriesId, seriesId))
        .orderBy(desc(economicIndicatorsHistory.periodDate))
        .limit(1);

      return result.length > 0 ? (result[0].periodDateDesc || null) : null;
    } catch (error) {
      logger.error(`Error getting latest period date for ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Get total count of records for a series
   */
  async getSeriesRecordCount(seriesId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(economicIndicatorsHistory)
        .where(eq(economicIndicatorsHistory.seriesId, seriesId));

      return result[0]?.count || 0;
    } catch (error) {
      logger.error(`Error getting record count for ${seriesId}:`, error);
      return 0;
    }
  }

  /**
   * Get update summary for a session
   */
  async getSessionSummary(sessionId: string): Promise<{
    totalOperations: number;
    successfulInserts: number;
    duplicatesSkipped: number;
    errors: number;
    seriesUpdated: string[];
  }> {
    try {
      const logs = await db
        .select()
        .from(fredUpdateLog)
        .where(eq(fredUpdateLog.sessionId, sessionId));

      const seriesUpdated = [...new Set(
        logs
          .filter(log => log.outcome === 'success')
          .map(log => log.seriesId)
      )];

      return {
        totalOperations: logs.length,
        successfulInserts: logs.filter(log => log.outcome === 'success').length,
        duplicatesSkipped: logs.filter(log => log.outcome === 'duplicate').length,
        errors: logs.filter(log => log.outcome === 'error').length,
        seriesUpdated
      };
    } catch (error) {
      logger.error(`Error getting session summary for ${sessionId}:`, error);
      return {
        totalOperations: 0,
        successfulInserts: 0,
        duplicatesSkipped: 0,
        errors: 0,
        seriesUpdated: []
      };
    }
  }

  /**
   * Log FRED update operation for tracking
   */
  private async logFredUpdate(logData: InsertFredUpdateLog): Promise<void> {
    try {
      await db.insert(fredUpdateLog).values({
        ...logData,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to log FRED update:', error);
      // Don't throw here as this is just logging
    }
  }

  /**
   * Validate economic indicator data before storage
   */
  validateIndicatorRecord(record: Partial<IndicatorRecord>): string[] {
    const errors: string[] = [];

    if (!record.seriesId || typeof record.seriesId !== 'string') {
      errors.push('seriesId is required and must be a string');
    }

    if (!record.metric || typeof record.metric !== 'string') {
      errors.push('metric is required and must be a string');
    }

    if (!record.category || typeof record.category !== 'string') {
      errors.push('category is required and must be a string');
    }

    if (!record.valueNumeric || typeof record.valueNumeric !== 'number' || isNaN(record.valueNumeric)) {
      errors.push('valueNumeric is required and must be a valid number');
    }

    if (!record.periodDateDesc || typeof record.periodDateDesc !== 'string') {
      errors.push('periodDateDesc is required and must be a string');
    }

    if (!record.periodDate || !(record.periodDate instanceof Date)) {
      errors.push('periodDate is required and must be a Date object');
    }

    return errors;
  }

  /**
   * Get latest update timestamp across all series
   */
  async getLastUpdateTimestamp(): Promise<Date | null> {
    try {
      const result = await db
        .select({
          lastUpdate: max(economicIndicatorsHistory.createdAt)
        })
        .from(economicIndicatorsHistory);

      return result[0]?.lastUpdate || null;
    } catch (error) {
      logger.error('Error getting last update timestamp:', error);
      return null;
    }
  }

  /**
   * Get all unique series IDs in the database
   */
  async getAllSeriesIds(): Promise<string[]> {
    try {
      const result = await db
        .selectDistinct({
          seriesId: economicIndicatorsHistory.seriesId
        })
        .from(economicIndicatorsHistory)
        .where(sql`${economicIndicatorsHistory.seriesId} IS NOT NULL`);

      return result.map(r => r.seriesId).filter(Boolean) as string[];
    } catch (error) {
      logger.error('Error getting all series IDs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const economicDataStorageIncremental = new EconomicDataStorageIncremental();