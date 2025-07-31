import { db } from '../db';
import { 
  economicIndicatorsCurrent, 
  economicIndicatorsHistorical, 
  economicIndicatorsYoY,
  fredCacheAudit,
  type EconomicIndicatorsCurrent,
  type EconomicIndicatorsHistorical,
  type EconomicIndicatorsYoY
} from '../../shared/schema/fred-cache-schema';
import { eq, and, lt } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import { nanoid } from 'nanoid';

export class FREDDatabaseCache {
  private static instance: FREDDatabaseCache;
  
  static getInstance(): FREDDatabaseCache {
    if (!FREDDatabaseCache.instance) {
      FREDDatabaseCache.instance = new FREDDatabaseCache();
    }
    return FREDDatabaseCache.instance;
  }

  /**
   * Store current reading in database
   */
  async storeCurrentReading(indicatorId: string, value: number, date: string, units: string): Promise<void> {
    try {
      const id = `current_${indicatorId}_${Date.now()}`;
      const expiryTimestamp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await db.insert(economicIndicatorsCurrent).values({
        id,
        indicator_id: indicatorId,
        value: value.toString(),
        date,
        units,
        expiry_timestamp: expiryTimestamp
      }).onConflictDoUpdate({
        target: economicIndicatorsCurrent.indicator_id,
        set: {
          value: value.toString(),
          date,
          units,
          last_updated: new Date(),
          expiry_timestamp: expiryTimestamp
        }
      });
      
      logger.debug(`Stored current reading for ${indicatorId}: ${value} ${units}`);
      
      // Log audit trail
      await this.logCacheOperation('set', 'current', indicatorId, true);
      
    } catch (error) {
      logger.error(`Failed to store current reading for ${indicatorId}:`, error);
      await this.logCacheOperation('set', 'current', indicatorId, false, String(error));
    }
  }

  /**
   * Get current reading from database
   */
  async getCurrentReading(indicatorId: string): Promise<EconomicIndicatorsCurrent | null> {
    try {
      const result = await db
        .select()
        .from(economicIndicatorsCurrent)
        .where(
          and(
            eq(economicIndicatorsCurrent.indicator_id, indicatorId),
            lt(new Date(), economicIndicatorsCurrent.expiry_timestamp)
          )
        )
        .limit(1);
      
      if (result.length > 0) {
        await this.logCacheOperation('get', 'current', indicatorId, true);
        return result[0];
      }
      
      await this.logCacheOperation('get', 'current', indicatorId, false, 'Not found or expired');
      return null;
      
    } catch (error) {
      logger.error(`Failed to get current reading for ${indicatorId}:`, error);
      await this.logCacheOperation('get', 'current', indicatorId, false, String(error));
      return null;
    }
  }

  /**
   * Store historical series in database
   */
  async storeHistoricalSeries(
    indicatorId: string, 
    dataPoints: Array<{ date: string; value: number }>
  ): Promise<void> {
    try {
      const id = `historical_${indicatorId}_${Date.now()}`;
      const expiryTimestamp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await db.insert(economicIndicatorsHistorical).values({
        id,
        indicator_id: indicatorId,
        data_points: JSON.stringify(dataPoints),
        series_length: dataPoints.length,
        expiry_timestamp: expiryTimestamp
      }).onConflictDoUpdate({
        target: economicIndicatorsHistorical.indicator_id,
        set: {
          data_points: JSON.stringify(dataPoints),
          series_length: dataPoints.length,
          last_updated: new Date(),
          expiry_timestamp: expiryTimestamp
        }
      });
      
      logger.debug(`Stored historical series for ${indicatorId}: ${dataPoints.length} data points`);
      await this.logCacheOperation('set', 'historical', indicatorId, true);
      
    } catch (error) {
      logger.error(`Failed to store historical series for ${indicatorId}:`, error);
      await this.logCacheOperation('set', 'historical', indicatorId, false, String(error));
    }
  }

  /**
   * Get historical series from database
   */
  async getHistoricalSeries(indicatorId: string): Promise<EconomicIndicatorsHistorical | null> {
    try {
      const result = await db
        .select()
        .from(economicIndicatorsHistorical)
        .where(
          and(
            eq(economicIndicatorsHistorical.indicator_id, indicatorId),
            lt(new Date(), economicIndicatorsHistorical.expiry_timestamp)
          )
        )
        .limit(1);
      
      if (result.length > 0) {
        await this.logCacheOperation('get', 'historical', indicatorId, true);
        return result[0];
      }
      
      await this.logCacheOperation('get', 'historical', indicatorId, false, 'Not found or expired');
      return null;
      
    } catch (error) {
      logger.error(`Failed to get historical series for ${indicatorId}:`, error);
      await this.logCacheOperation('get', 'historical', indicatorId, false, String(error));
      return null;
    }
  }

  /**
   * Store YoY calculation in database
   */
  async storeYoYCalculation(
    indicatorId: string,
    currentValue: number,
    yearAgoValue: number,
    yoyChange: number,
    yoyPercent: number
  ): Promise<void> {
    try {
      const id = `yoy_${indicatorId}_${Date.now()}`;
      const expiryTimestamp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await db.insert(economicIndicatorsYoY).values({
        id,
        indicator_id: indicatorId,
        current_value: currentValue.toString(),
        year_ago_value: yearAgoValue.toString(),
        yoy_change: yoyChange.toString(),
        yoy_percent: yoyPercent.toString(),
        expiry_timestamp: expiryTimestamp
      }).onConflictDoUpdate({
        target: economicIndicatorsYoY.indicator_id,
        set: {
          current_value: currentValue.toString(),
          year_ago_value: yearAgoValue.toString(),
          yoy_change: yoyChange.toString(),
          yoy_percent: yoyPercent.toString(),
          calculation_date: new Date(),
          expiry_timestamp: expiryTimestamp
        }
      });
      
      logger.debug(`Stored YoY calculation for ${indicatorId}: ${yoyPercent.toFixed(2)}%`);
      await this.logCacheOperation('set', 'yoy', indicatorId, true);
      
    } catch (error) {
      logger.error(`Failed to store YoY calculation for ${indicatorId}:`, error);
      await this.logCacheOperation('set', 'yoy', indicatorId, false, String(error));
    }
  }

  /**
   * Get YoY calculation from database
   */
  async getYoYCalculation(indicatorId: string): Promise<EconomicIndicatorsYoY | null> {
    try {
      const result = await db
        .select()
        .from(economicIndicatorsYoY)
        .where(
          and(
            eq(economicIndicatorsYoY.indicator_id, indicatorId),
            lt(new Date(), economicIndicatorsYoY.expiry_timestamp)
          )
        )
        .limit(1);
      
      if (result.length > 0) {
        await this.logCacheOperation('get', 'yoy', indicatorId, true);
        return result[0];
      }
      
      await this.logCacheOperation('get', 'yoy', indicatorId, false, 'Not found or expired');
      return null;
      
    } catch (error) {
      logger.error(`Failed to get YoY calculation for ${indicatorId}:`, error);
      await this.logCacheOperation('get', 'yoy', indicatorId, false, String(error));
      return null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(): Promise<{
    current: number;
    historical: number;
    yoy: number;
  }> {
    try {
      const now = new Date();
      
      const [currentDeleted, historicalDeleted, yoyDeleted] = await Promise.all([
        db.delete(economicIndicatorsCurrent)
          .where(lt(economicIndicatorsCurrent.expiry_timestamp, now)),
        db.delete(economicIndicatorsHistorical)
          .where(lt(economicIndicatorsHistorical.expiry_timestamp, now)),
        db.delete(economicIndicatorsYoY)
          .where(lt(economicIndicatorsYoY.expiry_timestamp, now))
      ]);
      
      const result = {
        current: currentDeleted.rowCount || 0,
        historical: historicalDeleted.rowCount || 0,
        yoy: yoyDeleted.rowCount || 0
      };
      
      if (result.current + result.historical + result.yoy > 0) {
        logger.info(`Cleaned up expired cache entries: ${JSON.stringify(result)}`);
      }
      
      return result;
      
    } catch (error) {
      logger.error('Failed to cleanup expired cache entries:', error);
      return { current: 0, historical: 0, yoy: 0 };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(): Promise<{
    total_entries: number;
    current_readings: number;
    historical_series: number;
    yoy_calculations: number;
    expired_entries: number;
  }> {
    try {
      const now = new Date();
      
      const [currentActive, currentExpired, historicalActive, historicalExpired, yoyActive, yoyExpired] = await Promise.all([
        db.select({ count: 'count(*)' }).from(economicIndicatorsCurrent)
          .where(lt(now, economicIndicatorsCurrent.expiry_timestamp)),
        db.select({ count: 'count(*)' }).from(economicIndicatorsCurrent)
          .where(lt(economicIndicatorsCurrent.expiry_timestamp, now)),
        db.select({ count: 'count(*)' }).from(economicIndicatorsHistorical)
          .where(lt(now, economicIndicatorsHistorical.expiry_timestamp)),
        db.select({ count: 'count(*)' }).from(economicIndicatorsHistorical)
          .where(lt(economicIndicatorsHistorical.expiry_timestamp, now)),
        db.select({ count: 'count(*)' }).from(economicIndicatorsYoY)
          .where(lt(now, economicIndicatorsYoY.expiry_timestamp)),
        db.select({ count: 'count(*)' }).from(economicIndicatorsYoY)
          .where(lt(economicIndicatorsYoY.expiry_timestamp, now))
      ]);
      
      const currentCount = parseInt(String((currentActive[0] as any)?.count || 0));
      const historicalCount = parseInt(String((historicalActive[0] as any)?.count || 0));
      const yoyCount = parseInt(String((yoyActive[0] as any)?.count || 0));
      const expiredCount = parseInt(String((currentExpired[0] as any)?.count || 0)) +
                          parseInt(String((historicalExpired[0] as any)?.count || 0)) +
                          parseInt(String((yoyExpired[0] as any)?.count || 0));
      
      return {
        total_entries: currentCount + historicalCount + yoyCount,
        current_readings: currentCount,
        historical_series: historicalCount,
        yoy_calculations: yoyCount,
        expired_entries: expiredCount
      };
      
    } catch (error) {
      logger.error('Failed to get cache statistics:', error);
      return {
        total_entries: 0,
        current_readings: 0,
        historical_series: 0,
        yoy_calculations: 0,
        expired_entries: 0
      };
    }
  }

  /**
   * Log cache operation for audit trail
   */
  private async logCacheOperation(
    operation: string,
    cacheType: string,
    indicatorId?: string,
    success: boolean = true,
    errorMessage?: string,
    apiCallsMade: number = 0,
    responseTimeMs?: number
  ): Promise<void> {
    try {
      await db.insert(fredCacheAudit).values({
        id: nanoid(),
        operation,
        cache_type: cacheType,
        indicator_id: indicatorId,
        success,
        api_calls_made: apiCallsMade,
        response_time_ms: responseTimeMs,
        error_message: errorMessage?.substring(0, 500) // Truncate to fit varchar limit
      });
    } catch (error) {
      // Don't log audit failures to avoid infinite loops
      console.error('Failed to log cache operation:', error);
    }
  }
}

export const fredDatabaseCache = FREDDatabaseCache.getInstance();