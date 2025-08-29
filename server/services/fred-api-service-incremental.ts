import axios from 'axios';
import { logger } from '../../shared/utils/logger';
import { db } from '../db';
import { economicIndicatorsHistory } from '../../shared/schema';
import { eq, desc, max, sql, and } from 'drizzle-orm';
import { DataQualityValidator } from './data-quality-validator';
import { dataLineageTracker } from './data-lineage-tracker';
import { economicDataTransformer } from './economic-data-transformer';

// FRED API Configuration with validation
function getValidFredApiKey(): string {
  const envKey = process.env.FRED_API_KEY;
  const fallbackKey = 'afa2c5a53a8116fe3a6c6fb339101ca1';
  
  // Validate environment key format (32 character alphanumeric lowercase)
  if (envKey && envKey.match(/^[a-z0-9]{32}$/)) {
    return envKey;
  }
  
  if (envKey && envKey.trim() !== '') {
    logger.warn('Invalid FRED_API_KEY format detected, using fallback key');
  }
  
  return fallbackKey;
}

const FRED_API_KEY = getValidFredApiKey();
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

// COMPREHENSIVE CURATED SERIES - All valid FRED series with historical data (39 indicators)
export const CURATED_SERIES = [
  // Top indicators by record count - High confidence historical data (29+ records)
  { id: 'DGS10', label: '10-Year Treasury Yield', type: 'Leading', category: 'Monetary Policy' },
  { id: 'T10Y2Y', label: 'Yield Curve (10yr-2yr)', type: 'Leading', category: 'Monetary Policy' },
  { id: 'CSCICP03USM665S', label: 'Consumer Confidence Index', type: 'Leading', category: 'Sentiment' },
  { id: 'FEDFUNDS', label: 'Federal Funds Rate', type: 'Leading', category: 'Monetary Policy' },
  { id: 'HOUST', label: 'Housing Starts', type: 'Leading', category: 'Growth' },
  { id: 'PAYEMS', label: 'Nonfarm Payrolls', type: 'Lagging', category: 'Labor', processAsChange: true },
  { id: 'UMCSENT', label: 'Michigan Consumer Sentiment', type: 'Leading', category: 'Sentiment' },
  { id: 'UNRATE', label: 'Unemployment Rate', type: 'Lagging', category: 'Labor' },
  
  // Medium record count indicators (18-21 records)
  { id: 'CCSA', label: 'Continuing Jobless Claims', type: 'Lagging', category: 'Labor' },
  { id: 'ICSA', label: 'Initial Jobless Claims', type: 'Leading', category: 'Labor' },
  { id: 'WPUSOP3000', label: 'Core PPI', type: 'Lagging', category: 'Inflation' },
  { id: 'PPIACO', label: 'Producer Price Index', type: 'Lagging', category: 'Inflation' },
  { id: 'PPIFIS', label: 'PPI Final Demand', type: 'Lagging', category: 'Inflation' },
  { id: 'PPIENG', label: 'PPI Energy', type: 'Leading', category: 'Inflation' },
  { id: 'PPIFGS', label: 'PPI Final Demand Goods', type: 'Lagging', category: 'Inflation' },
  { id: 'AWHAETP', label: 'Average Weekly Hours', type: 'Leading', category: 'Labor' },
  { id: 'BUSLOANS', label: 'Commercial & Industrial Loans', type: 'Coincident', category: 'Monetary Policy' },
  { id: 'CAPUTLG2211S', label: 'Capacity Utilization (Mfg)', type: 'Coincident', category: 'Growth' },
  { id: 'CES0500000003', label: 'Average Hourly Earnings', type: 'Lagging', category: 'Labor' },
  { id: 'CIVPART', label: 'Labor Force Participation Rate', type: 'Lagging', category: 'Labor' },
  { id: 'CPIAUCSL', label: 'CPI All Items', type: 'Lagging', category: 'Inflation' },
  { id: 'CPIENGSL', label: 'CPI Energy', type: 'Leading', category: 'Inflation' },
  { id: 'CPILFESL', label: 'Core CPI', type: 'Lagging', category: 'Inflation' },
  { id: 'CSUSHPINSA', label: 'Case-Shiller Home Price Index', type: 'Lagging', category: 'Growth' },
  { id: 'DSPIC96', label: 'Real Disposable Personal Income', type: 'Coincident', category: 'Growth' },
  { id: 'ECRST', label: 'E-commerce Retail Sales', type: 'Leading', category: 'Growth' },
  { id: 'EMRATIO', label: 'Employment Population Ratio', type: 'Lagging', category: 'Labor' },
  { id: 'EXHOSLUSM495S', label: 'Existing Home Sales', type: 'Coincident', category: 'Growth' },
  { id: 'HSN1F', label: 'New Home Sales', type: 'Leading', category: 'Growth' },
  { id: 'INDPRO', label: 'Industrial Production', type: 'Coincident', category: 'Growth' },
  { id: 'JTSHIR', label: 'JOLTS Hires', type: 'Coincident', category: 'Labor' },
  { id: 'JTSJOL', label: 'JOLTS Job Openings', type: 'Leading', category: 'Labor' },
  { id: 'MRTSSM44W72USN', label: 'Retail Sales Ex-Auto', type: 'Coincident', category: 'Growth' },
  { id: 'MSACSR', label: 'Months Supply of Homes', type: 'Lagging', category: 'Growth' },
  { id: 'NEWORDER', label: 'Consumer Durable Goods New Orders', type: 'Leading', category: 'Growth' },
  { id: 'PCEPI', label: 'PCE Price Index', type: 'Lagging', category: 'Inflation' },
  { id: 'PCEPILFE', label: 'Core PCE Price Index', type: 'Lagging', category: 'Inflation' },
  { id: 'PPIACO', label: 'PPI All Commodities', type: 'Leading', category: 'Inflation' },
  { id: 'PSAVERT', label: 'Personal Savings Rate', type: 'Leading', category: 'Growth' },
  { id: 'RSAFS', label: 'Retail Sales', type: 'Coincident', category: 'Growth' },
  { id: 'RSFOODSERV', label: 'Retail Sales: Food Services', type: 'Coincident', category: 'Growth' },
  { id: 'TTLCON', label: 'Total Construction Spending', type: 'Coincident', category: 'Growth' },
  { id: 'U6RATE', label: 'U-6 Unemployment Rate', type: 'Lagging', category: 'Labor' },
  
  // GDP Growth Rate - CRITICAL MISSING INDICATOR (15 records)
  { id: 'A191RL1Q225SBEA', label: 'GDP Growth Rate', type: 'Coincident', category: 'Growth' },
  
  // HIGH PRIORITY EXPANSION - Based on user's August 2025 economic indicators document
  // Successfully implemented indicators (4 working, 5 need alternative series IDs):
  { id: 'NHSUSSPT', label: 'New Home Sales - Units', type: 'Leading', category: 'Growth' },
  { id: 'MORTGAGE30US', label: '30-Year Fixed Rate Mortgage Average', type: 'Leading', category: 'Monetary Policy' },
  { id: 'TB1YR', label: '1-Year Treasury Constant Maturity Rate', type: 'Leading', category: 'Monetary Policy' },
  { id: 'CPILFENS', label: 'Consumer Price Index Core (NSA)', type: 'Lagging', category: 'Inflation' }
  
  // Note: Following series IDs were invalid and need correction:
  // - GDPCPIM (needs correct FRED ID for Real Final Sales to Private Domestic Purchasers)
  // - CCCI (needs correct FRED ID for Conference Board Consumer Confidence)  
  // - LEICONF (needs correct FRED ID for Leading Economic Index)
  // - CPINSA (needs correct FRED ID for CPI All Items NSA)
  // - MEDLISPRI (needs correct FRED ID for Median New Home Sale Price)
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
        .select({ periodDate: economicIndicatorsHistory.periodDate })
        .from(economicIndicatorsHistory)
        .where(eq(economicIndicatorsHistory.seriesId, seriesId))
        .orderBy(desc(economicIndicatorsHistory.periodDate))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const dateValue = result[0].periodDate;
      if (!dateValue) {
        return null;
      }

      // Try to handle different date formats defensively
      try {
        if (typeof dateValue === 'string') {
          // Validate string format (should be YYYY-MM-DD)
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
          }
          logger.warn(`Invalid date string format for ${seriesId}: ${dateValue}`);
          return null;
        } 
        
        if (dateValue instanceof Date) {
          // Check if Date object is valid
          if (isNaN(dateValue.getTime())) {
            logger.warn(`Invalid Date object for ${seriesId}`);
            return null;
          }
          return dateValue.toISOString().split('T')[0];
        }

        // If it's neither string nor Date, try to convert it
        const testDate = new Date(dateValue as any);
        if (isNaN(testDate.getTime())) {
          logger.warn(`Cannot convert date value for ${seriesId}:`, typeof dateValue);
          return null;
        }
        return testDate.toISOString().split('T')[0];

      } catch (conversionError) {
        logger.warn(`Date conversion error for ${seriesId}:`, conversionError);
        return null;
      }
    } catch (error) {
      logger.error(`Database query error for ${seriesId}:`, error);
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
      try {
        const startDate = new Date(latestDbDate);
        if (isNaN(startDate.getTime())) {
          logger.warn(`Invalid date for ${seriesId}: ${latestDbDate}`);
        } else {
          startDate.setDate(startDate.getDate() + 1);
          params.observation_start = startDate.toISOString().split('T')[0];
        }
      } catch (dateError) {
        logger.error(`Date parsing error for ${seriesId} with date ${latestDbDate}:`, dateError);
      }
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
      // For change-based processing, get more historical data to calculate changes
      const observations = seriesConfig.processAsChange 
        ? await this.fetchSeries(seriesId, { limit: 50, sort_order: 'desc' }).then(r => r.observations.filter(obs => obs.value !== '.' && obs.value !== null))
        : await this.fetchLatestObservations(seriesId);
      
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

      for (let i = 0; i < sortedObservations.length; i++) {
        const obs = sortedObservations[i];
        let numericValue = parseFloat(obs.value);
        if (isNaN(numericValue)) continue;

        // NEW: Apply economic data transformer for index-to-YoY conversion
        const transformedObs = await economicDataTransformer.processFredObservation(seriesId, obs);
        numericValue = transformedObs.value;

        // For PAYEMS, calculate month-over-month change in thousands (legacy processing)
        if (seriesConfig.processAsChange && seriesId === 'PAYEMS') {
          if (i === 0) {
            // Skip first observation for change-based metrics (no prior value to compare)
            continue;
          }
          const previousObs = sortedObservations[i - 1];
          const previousValue = parseFloat(previousObs.value);
          if (isNaN(previousValue)) continue;
          
          // Calculate change in thousands (PAYEMS is already in thousands)
          numericValue = numericValue - previousValue;
          logger.info(`📊 PAYEMS change calculated: ${previousValue}k → ${parseFloat(obs.value)}k = ${numericValue.toFixed(0)}k jobs change`);
        }

        // Check if this observation already exists using correct column names
        const obsDate = new Date(obs.date);
        const existing = await db
          .select()
          .from(economicIndicatorsHistory)
          .where(
            and(
              eq(economicIndicatorsHistory.seriesId, seriesId),
              eq(economicIndicatorsHistory.periodDate, obsDate)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          // Insert new observation using database column names that match the actual schema
          await db.insert(economicIndicatorsHistory).values({
            seriesId,
            metricName: seriesConfig.label,
            category: seriesConfig.category,
            type: seriesConfig.type,
            frequency: 'monthly', // Default for most FRED series
            value: numericValue,
            periodDate: new Date(obs.date),
            releaseDate: new Date(obs.realtime_start || obs.date),
            unit: transformedObs.dataType === 'yoy_percentage' ? 'Percent YoY' : 
                  (seriesConfig.processAsChange && seriesId === 'PAYEMS' ? 'Thousands' : 'Percent')
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