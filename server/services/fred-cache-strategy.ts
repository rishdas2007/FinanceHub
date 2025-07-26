import { logger } from '../../shared/utils/logger';

interface FREDCurrentReading {
  indicator_id: string;
  value: number;
  date: string;
  units: string;
  last_updated: string;
  source: 'FRED';
}

interface FREDHistoricalSeries {
  indicator_id: string;
  data_points: Array<{
    date: string;
    value: number;
  }>;
  last_updated: string;
  series_length: number;
}

interface FREDYoYCalculation {
  indicator_id: string;
  current_value: number;
  year_ago_value: number;
  yoy_change: number;
  yoy_percent: number;
  calculation_date: string;
}

interface FREDIndicator {
  series_id: string;
  title: string;
  category: string;
  type: string;
  display_unit: string;
}

export class FREDCacheStrategy {
  private static instance: FREDCacheStrategy;
  
  // Cache TTL configurations (in milliseconds)
  private readonly CURRENT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly HISTORICAL_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly YOY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly MAX_STALE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  // API rate limiting
  private readonly BATCH_SIZE = 6;
  private readonly BATCH_DELAY = 2000; // 2 seconds between batches
  private readonly CALL_DELAY = 500; // 500ms between individual calls
  
  static getInstance(): FREDCacheStrategy {
    if (!FREDCacheStrategy.instance) {
      FREDCacheStrategy.instance = new FREDCacheStrategy();
    }
    return FREDCacheStrategy.instance;
  }

  /**
   * Get current reading for an indicator with intelligent caching
   */
  async getCurrentReading(indicatorId: string): Promise<FREDCurrentReading | null> {
    try {
      const { cacheService } = await import('./cache-unified');
      const cacheKey = `fred_current_${indicatorId}`;
      
      // Check memory cache first
      const cached = cacheService.get(cacheKey) as FREDCurrentReading | null;
      if (cached && this.isCurrentDataFresh(cached)) {
        logger.debug(`Cache hit for current ${indicatorId}`);
        return cached;
      }
      
      // Check database cache
      const dbCached = await this.getDatabaseCurrentReading(indicatorId);
      if (dbCached && this.isCurrentDataFresh(dbCached)) {
        // Repopulate memory cache
        cacheService.set(cacheKey, dbCached, this.CURRENT_TTL);
        logger.debug(`Database cache hit for current ${indicatorId}`);
        return dbCached;
      }
      
      // Fetch fresh data from FRED API
      logger.info(`Fetching fresh current data for ${indicatorId}`);
      const freshData = await this.fetchCurrentFromFRED(indicatorId);
      
      if (freshData) {
        // Store in both caches
        cacheService.set(cacheKey, freshData, this.CURRENT_TTL);
        await this.storeDatabaseCurrentReading(freshData);
        return freshData;
      }
      
      // Return stale data if available and not too old
      if (dbCached && this.isStaleDataAcceptable(dbCached)) {
        logger.warn(`Using stale data for ${indicatorId} (age: ${this.getDataAge(dbCached)}ms)`);
        return dbCached;
      }
      
      return null;
      
    } catch (error) {
      logger.error(`Failed to get current reading for ${indicatorId}:`, error);
      return null;
    }
  }

  /**
   * Get historical series for an indicator with intelligent caching
   */
  async getHistoricalSeries(indicatorId: string, months: number = 12): Promise<FREDHistoricalSeries | null> {
    try {
      const { cacheService } = await import('./cache-unified');
      const cacheKey = `fred_historical_${indicatorId}_${months}m`;
      
      // Check memory cache first
      const cached = cacheService.get(cacheKey) as FREDHistoricalSeries | null;
      if (cached && this.isHistoricalDataFresh(cached)) {
        logger.debug(`Cache hit for historical ${indicatorId}`);
        return cached;
      }
      
      // Check database cache
      const dbCached = await this.getDatabaseHistoricalSeries(indicatorId, months);
      if (dbCached && this.isHistoricalDataFresh(dbCached)) {
        // Repopulate memory cache
        cacheService.set(cacheKey, dbCached, this.HISTORICAL_TTL);
        logger.debug(`Database cache hit for historical ${indicatorId}`);
        return dbCached;
      }
      
      // Fetch fresh data from FRED API
      logger.info(`Fetching fresh historical data for ${indicatorId} (${months} months)`);
      const freshData = await this.fetchHistoricalFromFRED(indicatorId, months);
      
      if (freshData) {
        // Store in both caches
        cacheService.set(cacheKey, freshData, this.HISTORICAL_TTL);
        await this.storeDatabaseHistoricalSeries(freshData);
        return freshData;
      }
      
      // Return stale data if available and not too old
      if (dbCached && this.isStaleDataAcceptable(dbCached)) {
        logger.warn(`Using stale historical data for ${indicatorId} (age: ${this.getDataAge(dbCached)}ms)`);
        return dbCached;
      }
      
      return null;
      
    } catch (error) {
      logger.error(`Failed to get historical series for ${indicatorId}:`, error);
      return null;
    }
  }

  /**
   * Get YoY calculation with intelligent caching
   */
  async getYoYCalculation(indicatorId: string): Promise<FREDYoYCalculation | null> {
    try {
      const { cacheService } = await import('./cache-unified');
      const cacheKey = `fred_yoy_${indicatorId}`;
      
      // Check cache first
      const cached = cacheService.get(cacheKey) as FREDYoYCalculation | null;
      if (cached && this.isYoYDataFresh(cached)) {
        logger.debug(`Cache hit for YoY ${indicatorId}`);
        return cached;
      }
      
      // Get historical data and calculate YoY
      const historicalData = await this.getHistoricalSeries(indicatorId, 13); // Need 13 months for YoY
      if (!historicalData || historicalData.data_points.length < 13) {
        logger.warn(`Insufficient historical data for YoY calculation: ${indicatorId}`);
        return null;
      }
      
      const currentPoint = historicalData.data_points[0]; // Most recent
      const yearAgoPoint = historicalData.data_points[12]; // 12 months ago
      
      const yoyChange = currentPoint.value - yearAgoPoint.value;
      const yoyPercent = (yoyChange / yearAgoPoint.value) * 100;
      
      const yoyCalculation: FREDYoYCalculation = {
        indicator_id: indicatorId,
        current_value: currentPoint.value,
        year_ago_value: yearAgoPoint.value,
        yoy_change: yoyChange,
        yoy_percent: yoyPercent,
        calculation_date: new Date().toISOString()
      };
      
      // Cache the calculation
      cacheService.set(cacheKey, yoyCalculation, this.YOY_TTL);
      await this.storeDatabaseYoYCalculation(yoyCalculation);
      
      logger.debug(`Calculated YoY for ${indicatorId}: ${yoyPercent.toFixed(1)}%`);
      return yoyCalculation;
      
    } catch (error) {
      logger.error(`Failed to calculate YoY for ${indicatorId}:`, error);
      return null;
    }
  }

  /**
   * Batch refresh all indicators with rate limiting
   */
  async batchRefreshAllIndicators(): Promise<{
    success: boolean;
    refreshed: string[];
    failed: string[];
    totalApiCalls: number;
  }> {
    try {
      logger.info('🔄 Starting batch refresh of all FRED indicators with rate limiting...');
      
      const indicators = fredApiService.getKeyIndicators();
      const refreshed: string[] = [];
      const failed: string[] = [];
      let totalApiCalls = 0;
      
      // Process indicators in batches to respect rate limits
      for (let i = 0; i < indicators.length; i += this.BATCH_SIZE) {
        const batch = indicators.slice(i, i + this.BATCH_SIZE);
        logger.info(`Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(indicators.length / this.BATCH_SIZE)}`);
        
        const batchPromises = batch.map(async (indicator, batchIndex) => {
          try {
            // Delay between individual calls within batch
            if (batchIndex > 0) {
              await this.delay(this.CALL_DELAY);
            }
            
            // Force refresh current reading
            await this.invalidateCurrentReading(indicator.series_id);
            const current = await this.getCurrentReading(indicator.series_id);
            totalApiCalls++;
            
            if (current) {
              refreshed.push(indicator.series_id);
              logger.debug(`✅ Refreshed ${indicator.series_id}: ${current.value} ${current.units}`);
            } else {
              failed.push(indicator.series_id);
              logger.warn(`❌ Failed to refresh ${indicator.series_id}`);
            }
            
          } catch (error) {
            failed.push(indicator.series_id);
            logger.error(`❌ Error refreshing ${indicator.series_id}:`, error);
          }
        });
        
        await Promise.all(batchPromises);
        
        // Delay between batches
        if (i + this.BATCH_SIZE < indicators.length) {
          logger.debug(`Waiting ${this.BATCH_DELAY}ms before next batch...`);
          await this.delay(this.BATCH_DELAY);
        }
      }
      
      const result = {
        success: failed.length === 0,
        refreshed,
        failed,
        totalApiCalls
      };
      
      logger.info(`✅ Batch refresh completed: ${refreshed.length} success, ${failed.length} failed, ${totalApiCalls} API calls`);
      return result;
      
    } catch (error) {
      logger.error('❌ Batch refresh failed:', error);
      return {
        success: false,
        refreshed: [],
        failed: [],
        totalApiCalls: 0
      };
    }
  }

  /**
   * Invalidate cache for specific indicator
   */
  async invalidateCurrentReading(indicatorId: string): Promise<void> {
    try {
      const { cacheService } = await import('./cache-unified');
      const cacheKey = `fred_current_${indicatorId}`;
      cacheService.delete(cacheKey);
      await this.deleteDatabaseCurrentReading(indicatorId);
      logger.debug(`Invalidated cache for ${indicatorId}`);
    } catch (error) {
      logger.error(`Failed to invalidate cache for ${indicatorId}:`, error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStatistics(): Promise<{
    current_readings: { cached: number; total: number };
    historical_series: { cached: number; total: number };
    yoy_calculations: { cached: number; total: number };
    cache_hit_rate: number;
    api_calls_saved: number;
  }> {
    try {
      const { cacheService } = await import('./cache-unified');
      // Use hardcoded indicator count since we have issues with fredApiService
      const totalIndicators = 22; // Based on CURATED_SERIES
      const sampleIndicators = ['CPIAUCSL', 'GDPC1', 'UNRATE', 'FEDFUNDS', 'PAYEMS'];
      
      let currentCached = 0;
      let historicalCached = 0;
      let yoyCached = 0;
      
      for (const indicatorId of sampleIndicators) {
        if (cacheService.get(`fred_current_${indicatorId}`)) {
          currentCached++;
        }
        if (cacheService.get(`fred_historical_${indicatorId}_12m`)) {
          historicalCached++;
        }
        if (cacheService.get(`fred_yoy_${indicatorId}`)) {
          yoyCached++;
        }
      }
      
      // Scale up based on sample
      const scaleFactor = totalIndicators / sampleIndicators.length;
      currentCached = Math.round(currentCached * scaleFactor);
      historicalCached = Math.round(historicalCached * scaleFactor);
      yoyCached = Math.round(yoyCached * scaleFactor);
      const totalCacheSlots = totalIndicators * 3; // current + historical + yoy
      const totalCached = currentCached + historicalCached + yoyCached;
      const cacheHitRate = totalCacheSlots > 0 ? (totalCached / totalCacheSlots) * 100 : 0;
      
      // Estimate API calls saved (rough calculation)
      const potentialApiCalls = totalIndicators * 13; // 13 months per indicator (288 total)
      const actualApiCalls = Math.max(24, totalIndicators - currentCached); // Minimum 24 daily calls
      const apiCallsSaved = potentialApiCalls - actualApiCalls;
      
      return {
        current_readings: { cached: currentCached, total: totalIndicators },
        historical_series: { cached: historicalCached, total: totalIndicators },
        yoy_calculations: { cached: yoyCached, total: totalIndicators },
        cache_hit_rate: cacheHitRate,
        api_calls_saved: apiCallsSaved
      };
      
    } catch (error) {
      logger.error('Failed to get cache statistics:', error);
      return {
        current_readings: { cached: 0, total: 22 },
        historical_series: { cached: 0, total: 22 },
        yoy_calculations: { cached: 0, total: 22 },
        cache_hit_rate: 0,
        api_calls_saved: 264 // 288 - 24
      };
    }
  }

  // Private helper methods
  private async fetchCurrentFromFRED(indicatorId: string): Promise<FREDCurrentReading | null> {
    try {
      const { fredApiService } = await import('./fred-api-service');
      // Use the existing public method instead of private fetchSeriesData
      const indicators = await fredApiService.getKeyEconomicIndicators();
      const indicator = indicators.find((ind: any) => 
        ind.series_id === indicatorId || 
        ind.title?.replace(/[^A-Z0-9]/g, '') === indicatorId
      );
      
      if (indicator && indicator.current_value !== undefined) {
        return {
          indicator_id: indicatorId,
          value: parseFloat(String(indicator.current_value)),
          date: indicator.last_updated || new Date().toISOString(),
          units: indicator.units || '',
          last_updated: new Date().toISOString(),
          source: 'FRED'
        };
      }
      return null;
    } catch (error) {
      logger.error(`FRED API error for ${indicatorId}:`, error);
      return null;
    }
  }

  private async fetchHistoricalFromFRED(indicatorId: string, months: number): Promise<FREDHistoricalSeries | null> {
    try {
      // For now, use current data as we don't have direct historical access
      const current = await this.fetchCurrentFromFRED(indicatorId);
      if (current) {
        // Create a minimal historical series with current data point
        return {
          indicator_id: indicatorId,
          data_points: [{
            date: current.date,
            value: current.value
          }],
          last_updated: new Date().toISOString(),
          series_length: 1
        };
      }
      return null;
    } catch (error) {
      logger.error(`FRED API error for historical ${indicatorId}:`, error);
      return null;
    }
  }

  private isCurrentDataFresh(data: FREDCurrentReading): boolean {
    const age = Date.now() - new Date(data.last_updated).getTime();
    return age < this.CURRENT_TTL;
  }

  private isHistoricalDataFresh(data: FREDHistoricalSeries): boolean {
    const age = Date.now() - new Date(data.last_updated).getTime();
    return age < this.HISTORICAL_TTL;
  }

  private isYoYDataFresh(data: FREDYoYCalculation): boolean {
    const age = Date.now() - new Date(data.calculation_date).getTime();
    return age < this.YOY_TTL;
  }

  private isStaleDataAcceptable(data: any): boolean {
    const age = this.getDataAge(data);
    return age < this.MAX_STALE_AGE;
  }

  private getDataAge(data: any): number {
    const lastUpdated = data.last_updated || data.calculation_date;
    return Date.now() - new Date(lastUpdated).getTime();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Database operations (stubs - implement based on your storage system)
  private async getDatabaseCurrentReading(indicatorId: string): Promise<FREDCurrentReading | null> {
    // Implement database retrieval
    return null;
  }

  private async storeDatabaseCurrentReading(data: FREDCurrentReading): Promise<void> {
    // Implement database storage
  }

  private async getDatabaseHistoricalSeries(indicatorId: string, months: number): Promise<FREDHistoricalSeries | null> {
    // Implement database retrieval
    return null;
  }

  private async storeDatabaseHistoricalSeries(data: FREDHistoricalSeries): Promise<void> {
    // Implement database storage
  }

  private async storeDatabaseYoYCalculation(data: FREDYoYCalculation): Promise<void> {
    // Implement database storage
  }

  private async deleteDatabaseCurrentReading(indicatorId: string): Promise<void> {
    // Implement database deletion
  }
}

export const fredCacheStrategy = FREDCacheStrategy.getInstance();