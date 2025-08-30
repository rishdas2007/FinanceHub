import { sql } from 'drizzle-orm';
import { db } from '../db';
import { economicCalendar, econDerivedMetrics, type InsertEconomicCalendar } from '../../shared/schema';
import { logger } from '../../shared/utils/logger';
import { optimizedEconomicQueries } from './optimized-economic-queries';

// FRED Series Mapping - 30 most important economic indicators
export const FRED_SERIES_MAP = {
  // Growth (7 indicators)
  'GDP': { name: 'Gross Domestic Product', category: 'Growth', frequency: 'quarterly', unit: 'Billions of Dollars' },
  'GDPC1': { name: 'Real GDP', category: 'Growth', frequency: 'quarterly', unit: 'Billions of Chained 2017 Dollars' },
  'INDPRO': { name: 'Industrial Production Index', category: 'Growth', frequency: 'monthly', unit: 'Index 2017=100' },
  'RSAFS': { name: 'Retail Sales', category: 'Growth', frequency: 'monthly', unit: 'Millions of Dollars' },
  'BUSINV': { name: 'Business Inventories', category: 'Growth', frequency: 'monthly', unit: 'Millions of Dollars' },
  'TCU': { name: 'Capacity Utilization', category: 'Growth', frequency: 'monthly', unit: 'Percent of Capacity' },
  
  // Inflation (5 indicators)
  'CPIAUCSL': { name: 'Consumer Price Index', category: 'Inflation', frequency: 'monthly', unit: 'Index 1982-84=100' },
  'PPIFIS': { name: 'Producer Price Index', category: 'Inflation', frequency: 'monthly', unit: 'Index Dec 2009=100' },
  'PCEPI': { name: 'PCE Price Index', category: 'Inflation', frequency: 'monthly', unit: 'Index 2012=100' },
  'DCOILWTICO': { name: 'WTI Crude Oil Price', category: 'Inflation', frequency: 'daily', unit: 'Dollars per Barrel' },
  'DEXUSEU': { name: 'US Dollar to Euro Exchange Rate', category: 'Inflation', frequency: 'daily', unit: 'US Dollars to One Euro' },
  
  // Labor (6 indicators)
  'UNRATE': { name: 'Unemployment Rate', category: 'Labor', frequency: 'monthly', unit: 'Percent' },
  'PAYEMS': { name: 'Nonfarm Payrolls', category: 'Labor', frequency: 'monthly', unit: 'Thousands of Persons' },
  'CIVPART': { name: 'Labor Force Participation Rate', category: 'Labor', frequency: 'monthly', unit: 'Percent' },
  'AHETPI': { name: 'Average Hourly Earnings', category: 'Labor', frequency: 'monthly', unit: 'Dollars per Hour' },
  'JOLTSTSJOR': { name: 'Job Openings', category: 'Labor', frequency: 'monthly', unit: 'Thousands' },
  'ICSA': { name: 'Initial Claims', category: 'Labor', frequency: 'weekly', unit: 'Thousands' },
  
  // Housing (5 indicators)
  'HOUST': { name: 'Housing Starts', category: 'Housing', frequency: 'monthly', unit: 'Thousands of Units' },
  'PERMIT': { name: 'Building Permits', category: 'Housing', frequency: 'monthly', unit: 'Thousands of Units' },
  'EXHOSLUSM495S': { name: 'Existing Home Sales', category: 'Housing', frequency: 'monthly', unit: 'Thousands of Units' },
  'CSUSHPISA': { name: 'Case-Shiller Home Price Index', category: 'Housing', frequency: 'monthly', unit: 'Index Jan 2000=100' },
  'RRVRUSQ156N': { name: 'Rental Vacancy Rate', category: 'Housing', frequency: 'quarterly', unit: 'Percent' },
  
  // Finance & Markets (3 indicators)
  'FEDFUNDS': { name: 'Federal Funds Rate', category: 'Finance', frequency: 'monthly', unit: 'Percent' },
  'DGS10': { name: '10-Year Treasury Constant Maturity Rate', category: 'Finance', frequency: 'daily', unit: 'Percent' },
  'DGS2': { name: '2-Year Treasury Constant Maturity Rate', category: 'Finance', frequency: 'daily', unit: 'Percent' },
  
  // Consumption & Confidence (4 indicators)
  'PCE': { name: 'Personal Consumption Expenditures', category: 'Consumption', frequency: 'monthly', unit: 'Billions of Dollars' },
  'UMCSENT': { name: 'Consumer Sentiment Index', category: 'Consumption', frequency: 'monthly', unit: 'Index 1966:Q1=100' },
  'CONCCONF': { name: 'Consumer Confidence Index', category: 'Consumption', frequency: 'monthly', unit: 'Index 1985=100' },
  'RSCCN': { name: 'Retail Sales: Clothing and Clothing Accessories', category: 'Consumption', frequency: 'monthly', unit: 'Millions of Dollars' },
  
  // Government & Fiscal (2 indicators)
  'GFDEBTN': { name: 'Total Public Debt', category: 'Government', frequency: 'quarterly', unit: 'Millions of Dollars' },
  'FYFSGDA188S': { name: 'Federal Surplus or Deficit', category: 'Government', frequency: 'annual', unit: 'Billions of Dollars' },
  
  // Trade (2 indicators)
  'BOPGSTB': { name: 'Trade Balance: Goods and Services', category: 'Trade', frequency: 'monthly', unit: 'Millions of Dollars' },
  'BOPBCAQ027S': { name: 'Current Account Balance', category: 'Trade', frequency: 'quarterly', unit: 'Millions of Dollars' },
} as const;

interface FredDataPoint {
  date: string;
  value: string | null;
}

interface FredApiResponse {
  observations: FredDataPoint[];
}

export class EconomicCalendarService {
  private readonly FRED_API_KEY = process.env.FRED_API_KEY;
  private readonly FRED_BASE_URL = 'https://api.stlouisfed.org/fred';
  private readonly RATE_LIMIT_DELAY = 500; // 500ms = 120 requests/minute

  constructor() {
    if (!this.FRED_API_KEY) {
      throw new Error('FRED_API_KEY environment variable is required');
    }
  }

  /**
   * Throttle requests to stay within FRED API rate limit of 120 requests/minute
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch data from FRED API with proper error handling
   */
  private async fetchFromFred(seriesId: string, startDate?: string, endDate?: string): Promise<FredDataPoint[]> {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: this.FRED_API_KEY!,
      file_type: 'json',
      limit: '100000', // FRED limit is 100K records per request
    });

    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);

    const url = `${this.FRED_BASE_URL}/series/observations?${params}`;
    
    try {
      logger.info(`📡 Fetching FRED data for ${seriesId} from ${startDate || 'beginning'} to ${endDate || 'present'}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 429) {
          logger.warn(`⚠️ Rate limit hit for ${seriesId}, waiting 60 seconds...`);
          await this.sleep(60000); // Wait 1 minute on rate limit
          return this.fetchFromFred(seriesId, startDate, endDate); // Retry
        }
        throw new Error(`FRED API error ${response.status}: ${response.statusText}`);
      }

      const data: FredApiResponse = await response.json();
      
      if (!data.observations) {
        logger.warn(`⚠️ No observations found for ${seriesId}`);
        return [];
      }

      // Filter out null values and invalid dates
      const validData = data.observations.filter(point => 
        point.value !== null && 
        point.value !== '.' && 
        !isNaN(parseFloat(point.value))
      );

      logger.info(`✅ Fetched ${validData.length} valid data points for ${seriesId}`);
      return validData;
      
    } catch (error) {
      logger.error(`❌ Failed to fetch FRED data for ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate variance and percentage change
   */
  private calculateVariance(current: number, previous?: number): { variance: number | null, variancePercent: number | null } {
    if (previous === undefined || previous === null) {
      return { variance: null, variancePercent: null };
    }

    const variance = current - previous;
    const variancePercent = previous !== 0 ? (variance / previous) * 100 : null;

    return { variance, variancePercent };
  }

  /**
   * Process and store FRED data for a single series
   */
  async processSeries(seriesId: string, startDate?: string, endDate?: string): Promise<void> {
    const seriesInfo = FRED_SERIES_MAP[seriesId as keyof typeof FRED_SERIES_MAP];
    if (!seriesInfo) {
      throw new Error(`Unknown series ID: ${seriesId}`);
    }

    // Throttle to respect rate limits
    await this.sleep(this.RATE_LIMIT_DELAY);

    try {
      const fredData = await this.fetchFromFred(seriesId, startDate, endDate);
      
      if (fredData.length === 0) {
        logger.warn(`⚠️ No data available for ${seriesId}`);
        return;
      }

      // Sort data by date to ensure proper ordering for variance calculation
      fredData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const calendarEntries: InsertEconomicCalendar[] = [];

      for (let i = 0; i < fredData.length; i++) {
        const currentPoint = fredData[i];
        const previousPoint = i > 0 ? fredData[i - 1] : undefined;
        
        const currentValue = parseFloat(currentPoint.value!);
        const previousValue = previousPoint ? parseFloat(previousPoint.value!) : undefined;
        
        const { variance, variancePercent } = this.calculateVariance(currentValue, previousValue);

        const entry: InsertEconomicCalendar = {
          seriesId,
          metricName: seriesInfo.name,
          category: seriesInfo.category,
          releaseDate: new Date(currentPoint.date), // Use observation date as release date for historical data
          periodDate: new Date(currentPoint.date),
          actualValue: currentValue.toString(),
          previousValue: previousValue?.toString() || null,
          variance: variance?.toString() || null,
          variancePercent: variancePercent?.toString() || null,
          unit: seriesInfo.unit,
          frequency: seriesInfo.frequency,
          seasonalAdjustment: null, // Will be populated from FRED metadata if available
        };

        calendarEntries.push(entry);
      }

      // Batch insert to database
      if (calendarEntries.length > 0) {
        await db.insert(economicCalendar)
          .values(calendarEntries)
          .onConflictDoUpdate({
            target: [economicCalendar.seriesId, economicCalendar.periodDate],
            set: {
              actualValue: sql.raw('EXCLUDED.actual_value'),
              previousValue: sql.raw('EXCLUDED.previous_value'),
              variance: sql.raw('EXCLUDED.variance'),
              variancePercent: sql.raw('EXCLUDED.variance_percent'),
              updatedAt: sql.raw('NOW()'),
            }
          });

        logger.info(`✅ Processed ${calendarEntries.length} entries for ${seriesId} (${seriesInfo.name})`);
      }

    } catch (error) {
      logger.error(`❌ Failed to process series ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Process all series with proper throttling
   */
  async processAllSeries(startDate?: string, endDate?: string): Promise<void> {
    const seriesIds = Object.keys(FRED_SERIES_MAP);
    logger.info(`🚀 Starting to process ${seriesIds.length} economic series`);
    
    let processedCount = 0;
    const totalCount = seriesIds.length;

    for (const seriesId of seriesIds) {
      try {
        processedCount++;
        logger.info(`📊 Processing ${seriesId} (${processedCount}/${totalCount})`);
        
        await this.processSeries(seriesId, startDate, endDate);
        
        // Log progress every 5 series
        if (processedCount % 5 === 0) {
          const progress = Math.round((processedCount / totalCount) * 100);
          logger.info(`📈 Progress: ${progress}% complete (${processedCount}/${totalCount})`);
        }
        
      } catch (error) {
        logger.error(`❌ Failed to process ${seriesId}, continuing with next series:`, error);
        // Continue with other series even if one fails
      }
    }

    logger.info(`✅ Completed processing all economic series. Processed: ${processedCount}/${totalCount}`);
  }

  /**
   * Get economic calendar data with filtering options
   * OPTIMIZED VERSION - Uses materialized views and strategic caching
   */
  async getCalendarData(options: {
    startDate?: string;
    endDate?: string;
    category?: string;
    frequency?: string;
    mode?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    data: any[];
    total: number;
    page: number;
    totalPages: number;
    executionTime?: number;
    fromCache?: boolean;
    optimization?: string;
  }> {
    const { startDate, endDate, category, frequency, mode = 'all', limit = 100, offset = 0 } = options;

    try {
      // Create cache key for this query
      const cacheKey = `ec_${mode}_${JSON.stringify({startDate, endDate, category, frequency, limit, offset})}`;
      
      let result: any;
      
      if (mode === 'latest') {
        // Use optimized latest query with caching
        result = await optimizedEconomicQueries.getCachedQuery(
          cacheKey,
          () => optimizedEconomicQueries.getLatestEconomicData({
            startDate, endDate, category, frequency, limit, offset
          }),
          15 // 15 minute cache for latest data
        );
        
        // For pagination, we need total count
        // Use a simplified count query on the materialized view
        const countQuery = sql`
          SELECT COUNT(*) as count 
          FROM mv_economic_calendar_latest
          WHERE 1=1
          ${category ? sql`AND category = ${category}` : sql``}
          ${frequency ? sql`AND frequency = ${frequency}` : sql``}
          ${startDate ? sql`AND release_date >= ${startDate}` : sql``}
          ${endDate ? sql`AND release_date <= ${endDate}` : sql``}
        `;
        
        const countResult = await db.execute(countQuery);
        const total = parseInt(countResult.rows[0]?.count as string || '0');
        
        return {
          data: result.data || [],
          total,
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
          executionTime: result.executionTime,
          fromCache: result.fromCache,
          optimization: result.optimization
        };
        
      } else if (mode === 'timeline') {
        // Use optimized timeline query
        result = await optimizedEconomicQueries.getCachedQuery(
          cacheKey,
          () => optimizedEconomicQueries.getTimelineEconomicData({
            startDate, endDate, category, frequency, limit, offset
          }),
          30 // 30 minute cache for timeline data
        );
        
        // Timeline mode returns aggregated data, so total = data.length
        return {
          data: result.data || [],
          total: result.data?.length || 0,
          page: 1, // Timeline is typically single page
          totalPages: 1,
          executionTime: result.executionTime,
          fromCache: result.fromCache,
          optimization: result.optimization
        };
        
      } else {
        // Fallback to original implementation for 'all' mode with optimizations
        const startTime = Date.now();
        
        let query = sql`
          SELECT 
            ec.series_id as "seriesId",
            ec.metric_name as "metricName",
            ec.category,
            ec.release_date as "releaseDate",
            ec.period_date as "periodDate",
            ec.actual_value as "actualValue",
            ec.previous_value as "previousValue",
            ec.variance,
            ec.variance_percent as "variancePercent",
            ec.unit,
            ec.frequency,
            ec.seasonal_adjustment as "seasonalAdjustment"
          FROM economic_calendar ec
          WHERE 1=1
        `;

        // Add filters
        if (startDate) query = sql`${query} AND release_date >= ${startDate}`;
        if (endDate) query = sql`${query} AND release_date <= ${endDate}`;
        if (category) query = sql`${query} AND category = ${category}`;
        if (frequency) query = sql`${query} AND frequency = ${frequency}`;

        // Get total count for pagination
        const countQuery = sql`SELECT COUNT(*) as count FROM (${query}) as filtered_data`;
        const countResult = await db.execute(countQuery);
        const total = parseInt(countResult.rows[0]?.count as string || '0');

        // Add ordering and pagination
        query = sql`${query} 
          ORDER BY release_date DESC, metric_name ASC 
          LIMIT ${limit} OFFSET ${offset}`;

        const queryResult = await db.execute(query);
        const executionTime = Date.now() - startTime;

        return {
          data: queryResult.rows,
          total,
          page: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
          executionTime,
          fromCache: false,
          optimization: 'standard_with_indexes'
        };
      }

    } catch (error) {
      logger.error('❌ Failed to get calendar data:', error);
      throw error;
    }
  }

  /**
   * Get recent releases (last 30 days) - OPTIMIZED
   */
  async getRecentReleases(): Promise<any[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      // Use optimized query with caching
      const result = await optimizedEconomicQueries.getCachedQuery(
        'recent_releases',
        () => optimizedEconomicQueries.getLatestEconomicData({
          startDate: thirtyDaysAgo,
          limit: 50
        }),
        10 // 10 minute cache for recent data
      );

      return result.data || [];
    } catch (error) {
      logger.error('❌ Failed to get recent releases with optimization, falling back:', error);
      // Fallback to standard query
      const result = await this.getCalendarData({
        startDate: thirtyDaysAgo,
        limit: 50
      });
      return result.data;
    }
  }

  /**
   * Get data for a specific category - OPTIMIZED
   */
  async getByCategory(category: string): Promise<any[]> {
    try {
      // Use optimized category query
      const result = await optimizedEconomicQueries.getCachedQuery(
        `category_${category}`,
        () => optimizedEconomicQueries.getCategoryEconomicData(category, {
          limit: 100,
          includeSignals: true
        }),
        20 // 20 minute cache for category data
      );

      return result.data || [];
    } catch (error) {
      logger.error(`❌ Failed to get category ${category} with optimization, falling back:`, error);
      // Fallback to standard query
      const result = await this.getCalendarData({
        category,
        limit: 100
      });
      return result.data;
    }
  }

  /**
   * Get critical economic indicators - NEW OPTIMIZED METHOD
   */
  async getCriticalIndicators(): Promise<any[]> {
    try {
      const result = await optimizedEconomicQueries.getCachedQuery(
        'critical_indicators',
        () => optimizedEconomicQueries.getCriticalIndicators(),
        5 // 5 minute cache for critical data
      );

      return result.data || [];
    } catch (error) {
      logger.error('❌ Failed to get critical indicators:', error);
      throw error;
    }
  }

  /**
   * Get investment signals - NEW METHOD
   */
  async getInvestmentSignals(options: {
    signalType?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    minStrength?: number;
    categories?: string[];
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      const cacheKey = `investment_signals_${JSON.stringify(options)}`;
      const result = await optimizedEconomicQueries.getCachedQuery(
        cacheKey,
        () => optimizedEconomicQueries.getInvestmentSignals(options),
        15 // 15 minute cache for signals
      );

      return result.data || [];
    } catch (error) {
      logger.error('❌ Failed to get investment signals:', error);
      throw error;
    }
  }

  /**
   * Get performance statistics - NEW METHOD
   */
  async getPerformanceStats(hours: number = 24) {
    try {
      return await optimizedEconomicQueries.getPerformanceStats(hours);
    } catch (error) {
      logger.error('❌ Failed to get performance stats:', error);
      return { period_hours: hours, statistics: [] };
    }
  }

  /**
   * Refresh materialized views - NEW METHOD
   */
  async refreshCache() {
    try {
      const result = await optimizedEconomicQueries.refreshMaterializedView();
      await optimizedEconomicQueries.cleanCache();
      
      logger.info('✅ Cache refresh completed successfully');
      return result;
    } catch (error) {
      logger.error('❌ Failed to refresh cache:', error);
      throw error;
    }
  }
}

export const economicCalendarService = new EconomicCalendarService();