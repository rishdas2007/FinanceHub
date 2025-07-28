import axios from 'axios';
import { logger } from '../../shared/utils/logger';
import { db } from '../db';
import { economicIndicatorsHistory } from '../../shared/schema';
import { eq, desc, max, sql } from 'drizzle-orm';

// FRED API Configuration
const FRED_API_KEY = process.env.FRED_API_KEY || 'afa2c5a53a8116fe3a6c6fb339101ca1';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

// CURATED SERIES MAPPING - Complete 46+ indicator configuration
export const CURATED_SERIES = [
  // Growth Indicators (25)
  { id: 'GDPC1', label: 'GDP Growth Rate', type: 'Leading', category: 'Growth' },
  { id: 'DSPIC96', label: 'Real Disposable Personal Income', type: 'Coincident', category: 'Growth' },
  { id: 'RSXFS', label: 'Retail Sales Ex-Auto', type: 'Coincident', category: 'Growth' },
  { id: 'ECOMSA', label: 'E-commerce Retail Sales', type: 'Leading', category: 'Growth' },
  { id: 'HOUST', label: 'Housing Starts', type: 'Leading', category: 'Growth' },
  { id: 'HSN1F', label: 'New Home Sales', type: 'Leading', category: 'Growth' },
  { id: 'EXHOSLUSM495S', label: 'Existing Home Sales', type: 'Coincident', category: 'Growth' },
  { id: 'MSACSR', label: 'Months Supply of Homes', type: 'Lagging', category: 'Growth' },
  { id: 'PERMIT', label: 'Building Permits', type: 'Leading', category: 'Growth' },
  { id: 'INDPRO', label: 'Industrial Production YoY', type: 'Coincident', category: 'Growth' },
  { id: 'CAPUTLG2211S', label: 'Capacity Utilization', type: 'Coincident', category: 'Growth' },
  { id: 'NEWORDER', label: 'New Orders', type: 'Leading', category: 'Growth' },
  { id: 'DGORDER', label: 'Durable Goods Orders', type: 'Leading', category: 'Growth' },
  { id: 'RRSFS', label: 'Retail Sales', type: 'Coincident', category: 'Growth' },
  { id: 'RSFSDIVR', label: 'Retail Sales: Food Services', type: 'Coincident', category: 'Growth' },
  { id: 'MANEMP', label: 'Manufacturing Employment', type: 'Lagging', category: 'Growth' },
  { id: 'AWHMAN', label: 'Manufacturing Hours', type: 'Coincident', category: 'Growth' },
  { id: 'ISRATIO', label: 'Inventories to Sales Ratio', type: 'Lagging', category: 'Growth' },
  { id: 'TLRESCONS', label: 'Total Construction Spending', type: 'Coincident', category: 'Growth' },
  { id: 'USPHCI', label: 'Personal Consumption Expenditures', type: 'Coincident', category: 'Growth' },
  { id: 'PSAVERT', label: 'Personal Saving Rate', type: 'Leading', category: 'Growth' },
  { id: 'UMCSENT', label: 'Consumer Sentiment', type: 'Leading', category: 'Sentiment' },
  { id: 'USALOLITONOSTSAM', label: 'Leading Economic Index', type: 'Leading', category: 'Growth' },
  { id: 'USGRECM', label: 'Recession Indicator', type: 'Coincident', category: 'Growth' },
  { id: 'SPASTT01USM661N', label: 'S&P Global Manufacturing PMI', type: 'Leading', category: 'Growth' },

  // Inflation Indicators (8)
  { id: 'CPIAUCSL', label: 'CPI All Items', type: 'Lagging', category: 'Inflation' },
  { id: 'CPILFESL', label: 'Core CPI', type: 'Lagging', category: 'Inflation' },
  { id: 'PCEPI', label: 'PCE Price Index YoY', type: 'Lagging', category: 'Inflation' },
  { id: 'PCEPILFE', label: 'Core PCE Price Index', type: 'Lagging', category: 'Inflation' },
  { id: 'PPIFIS', label: 'PPI Final Demand', type: 'Leading', category: 'Inflation' },
  { id: 'PPIFES', label: 'Core PPI', type: 'Leading', category: 'Inflation' },
  { id: 'GASREGCOVW', label: 'Gasoline Prices', type: 'Leading', category: 'Inflation' },
  { id: 'DEXUSEU', label: 'US Dollar Index', type: 'Leading', category: 'Inflation' },

  // Labor Market (11)
  { id: 'UNRATE', label: 'Unemployment Rate', type: 'Lagging', category: 'Labor' },
  { id: 'PAYEMS', label: 'Nonfarm Payrolls', type: 'Lagging', category: 'Labor' },
  { id: 'ICSA', label: 'Initial Jobless Claims', type: 'Leading', category: 'Labor' },
  { id: 'CCSA', label: 'Continuing Jobless Claims', type: 'Lagging', category: 'Labor' },
  { id: 'JTSJOL', label: 'JOLTS Job Openings', type: 'Leading', category: 'Labor' },
  { id: 'JTSQUL', label: 'JOLTS Quits', type: 'Leading', category: 'Labor' },
  { id: 'JTSHIL', label: 'JOLTS Hires', type: 'Coincident', category: 'Labor' },
  { id: 'CIVPART', label: 'Labor Force Participation', type: 'Lagging', category: 'Labor' },
  { id: 'AHETPI', label: 'Average Hourly Earnings', type: 'Lagging', category: 'Labor' },
  { id: 'AWOTMAN', label: 'Average Weekly Hours', type: 'Leading', category: 'Labor' },
  { id: 'USEPUINDXM', label: 'Employment to Population Ratio', type: 'Lagging', category: 'Labor' },

  // Monetary Policy (5)
  { id: 'FEDFUNDS', label: 'Federal Funds Rate', type: 'Leading', category: 'Monetary Policy' },
  { id: 'TB10Y', label: '10-Year Treasury', type: 'Leading', category: 'Monetary Policy' },
  { id: 'TB3M', label: '3-Month Treasury', type: 'Leading', category: 'Monetary Policy' },
  { id: 'T10Y2Y', label: 'Yield Curve (10yr-2yr)', type: 'Leading', category: 'Monetary Policy' },
  { id: 'MORTGAGE30US', label: '30-Year Mortgage Rate', type: 'Leading', category: 'Monetary Policy' },

  // Sentiment (2)
  { id: 'UMCSENT', label: 'Consumer Sentiment', type: 'Leading', category: 'Sentiment' },
  { id: 'USSLIND', label: 'Consumer Confidence Index', type: 'Leading', category: 'Sentiment' }
];

export interface FredDataPoint {
  date: string;
  value: string;
  realtime_start?: string;
  realtime_end?: string;
}

export interface FredSeriesResponse {
  observations: FredDataPoint[];
  units?: string;
  title?: string;
  frequency?: string;
  seasonal_adjustment?: string;
}

export interface FredUpdateResult {
  seriesId: string;
  newDataPoints: number;
  latestPeriod: string;
  latestValue: string;
  operation: 'inserted' | 'updated' | 'skipped';
  error?: string;
}

export class FredApiServiceIncremental {
  private apiKey: string;
  private baseUrl: string;
  private requestCount: number = 0;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || FRED_API_KEY;
    this.baseUrl = FRED_BASE_URL;
  }

  /**
   * Health check - verify FRED API connectivity with minimal API call
   */
  async healthCheck(): Promise<{ status: string; details: string; apiCallsUsed: number }> {
    try {
      const testResponse = await this.fetchSeries('CPIAUCSL', { limit: 1 });
      return {
        status: 'healthy',
        details: `FRED API accessible. Test series: ${testResponse.title || 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average'}`,
        apiCallsUsed: 1
      };
    } catch (error) {
      logger.error('FRED API health check failed:', error);
      return {
        status: 'unhealthy',
        details: `FRED API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        apiCallsUsed: 0
      };
    }
  }

  /**
   * Get latest observation date for a series from our database
   */
  private async getLatestDatabaseDate(seriesId: string): Promise<string | null> {
    try {
      const result = await db
        .select({ periodDateDesc: economicIndicatorsHistory.periodDateDesc })
        .from(economicIndicatorsHistory)
        .where(eq(economicIndicatorsHistory.seriesId, seriesId))
        .orderBy(desc(economicIndicatorsHistory.periodDate))
        .limit(1);

      return result.length > 0 ? (result[0].periodDateDesc || null) : null;
    } catch (error) {
      logger.error(`Error getting latest date for ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Fetch latest observations for a series since last database update
   */
  private async fetchLatestObservations(seriesId: string): Promise<FredDataPoint[]> {
    const latestDbDate = await this.getLatestDatabaseDate(seriesId);
    
    // If no data in database, fetch last 3 observations for safety
    // If data exists, fetch observations since latest date
    const params: any = {
      limit: latestDbDate ? 10 : 3, // Get more recent data if we have historical data
      sort_order: 'desc'
    };

    if (latestDbDate) {
      // Add 1 day to avoid duplicate fetching of the latest date
      const startDate = new Date(latestDbDate);
      startDate.setDate(startDate.getDate() + 1);
      params.observation_start = startDate.toISOString().split('T')[0];
    }

    const response = await this.fetchSeries(seriesId, params);
    this.requestCount++;

    // Filter out any "." values (missing data)
    return response.observations.filter(obs => obs.value !== '.' && obs.value !== null);
  }

  /**
   * Core FRED API fetch method with error handling and rate limiting
   */
  private async fetchSeries(seriesId: string, params: any = {}): Promise<FredSeriesResponse> {
    const url = `${this.baseUrl}/series/observations`;
    const requestParams = {
      series_id: seriesId,
      api_key: this.apiKey,
      file_type: 'json',
      ...params
    };

    try {
      logger.info(`🔍 Fetching FRED series ${seriesId} with params:`, requestParams);
      
      const response = await axios.get(url, { 
        params: requestParams,
        timeout: 10000 // 10 second timeout
      });

      if (!response.data || !response.data.observations) {
        throw new Error(`Invalid response format for series ${seriesId}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new Error(`Invalid series ID or parameters for ${seriesId}: ${error.response.data?.error_message || 'Bad request'}`);
        } else if (error.response?.status === 403) {
          throw new Error(`API rate limit exceeded or invalid API key for ${seriesId}`);
        } else if (error.response?.status === 404) {
          throw new Error(`Series ${seriesId} not found`);
        }
      }
      
      throw new Error(`FRED API error for ${seriesId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process incremental updates for all curated series
   */
  async performIncrementalUpdate(sessionId: string): Promise<{
    success: boolean;
    message: string;
    newDataPoints: number;
    sessionId: string;
    apiCallsUsed: number;
    results: FredUpdateResult[];
  }> {
    const startTime = Date.now();
    this.requestCount = 0;
    const results: FredUpdateResult[] = [];
    let totalNewDataPoints = 0;

    logger.info(`🔄 Starting FRED incremental update session: ${sessionId}`);

    try {
      // Process each curated series
      for (const series of CURATED_SERIES) {
        try {
          const result = await this.updateSingleSeries(series.id, series, sessionId);
          results.push(result);
          totalNewDataPoints += result.newDataPoints;

          // Add small delay to respect rate limits (100 requests per 60 seconds)
          await new Promise(resolve => setTimeout(resolve, 650)); // ~92 requests per minute
          
        } catch (error) {
          const errorResult: FredUpdateResult = {
            seriesId: series.id,
            newDataPoints: 0,
            latestPeriod: '',
            latestValue: '',
            operation: 'skipped',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          results.push(errorResult);
          logger.error(`❌ Error updating series ${series.id}:`, error);
        }
      }

      const executionTime = Date.now() - startTime;
      const successfulUpdates = results.filter(r => !r.error).length;

      logger.info(`✅ FRED incremental update completed: ${successfulUpdates}/${CURATED_SERIES.length} series successful, ${totalNewDataPoints} new data points, ${this.requestCount} API calls, ${executionTime}ms`);

      return {
        success: true,
        message: `Successfully processed ${totalNewDataPoints} new data points from ${successfulUpdates}/${CURATED_SERIES.length} series`,
        newDataPoints: totalNewDataPoints,
        sessionId,
        apiCallsUsed: this.requestCount,
        results
      };

    } catch (error) {
      logger.error('❌ FRED incremental update failed:', error);
      return {
        success: false,
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        newDataPoints: totalNewDataPoints,
        sessionId,
        apiCallsUsed: this.requestCount,
        results
      };
    }
  }

  /**
   * Update a single series with latest observations
   */
  private async updateSingleSeries(
    seriesId: string, 
    seriesConfig: typeof CURATED_SERIES[0], 
    sessionId: string
  ): Promise<FredUpdateResult> {
    try {
      const observations = await this.fetchLatestObservations(seriesId);
      
      if (observations.length === 0) {
        return {
          seriesId,
          newDataPoints: 0,
          latestPeriod: '',
          latestValue: '',
          operation: 'skipped'
        };
      }

      let newDataPoints = 0;
      let latestPeriod = '';
      let latestValue = '';

      // Process observations in chronological order (oldest first)
      const sortedObservations = observations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const obs of sortedObservations) {
        const numericValue = parseFloat(obs.value);
        if (isNaN(numericValue)) continue;

        // Check if this observation already exists
        const existing = await db
          .select()
          .from(economicIndicatorsHistory)
          .where(
            sql`${economicIndicatorsHistory.seriesId} = ${seriesId} AND ${economicIndicatorsHistory.periodDateDesc} = ${obs.date}`
          )
          .limit(1);

        if (existing.length === 0) {
          // Insert new observation
          await db.insert(economicIndicatorsHistory).values({
            seriesId,
            metric: seriesConfig.label,
            category: seriesConfig.category,
            type: seriesConfig.type,
            frequency: 'monthly', // Default for most FRED series
            valueNumeric: numericValue.toString() as string,
            periodDateDesc: obs.date,
            releaseDateDesc: obs.realtime_start || obs.date,
            periodDate: new Date(obs.date),
            releaseDate: new Date(obs.realtime_start || obs.date),
            unit: 'Percent' // Default unit, could be enhanced with FRED series metadata
          });

          newDataPoints++;
          latestPeriod = obs.date;
          latestValue = obs.value;
        }
      }

      return {
        seriesId,
        newDataPoints,
        latestPeriod,
        latestValue,
        operation: newDataPoints > 0 ? 'inserted' : 'skipped'
      };

    } catch (error) {
      throw new Error(`Failed to update series ${seriesId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get API usage statistics
   */
  getApiUsage(): { requestCount: number; rateLimitStatus: string } {
    return {
      requestCount: this.requestCount,
      rateLimitStatus: this.requestCount > 90 ? 'approaching_limit' : 'normal'
    };
  }
}

// Export singleton instance
export const fredApiServiceIncremental = new FredApiServiceIncremental();