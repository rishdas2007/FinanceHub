import { logger } from '../middleware/logging';
import { db } from '../db';

interface FredDataOptions {
  startDate?: string;
  endDate?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

/**
 * FRED Data Service
 * Simplified service for fetching and storing FRED economic indicators
 */
export class FredDataService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.stlouisfed.org/fred';

  constructor() {
    this.apiKey = process.env.FRED_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('⚠️ FRED API key not configured');
    }
  }

  async fetchAndStoreIndicator(seriesId: string, options: FredDataOptions = {}): Promise<void> {
    if (!this.apiKey) {
      throw new Error('FRED API key not configured');
    }

    try {
      logger.info(`📊 Fetching FRED data for ${seriesId}`);

      const { startDate, endDate } = options;
      const url = new URL(`${this.baseUrl}/series/observations`);
      url.searchParams.set('series_id', seriesId);
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('file_type', 'json');
      
      if (startDate) url.searchParams.set('observation_start', startDate);
      if (endDate) url.searchParams.set('observation_end', endDate);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.observations || !Array.isArray(data.observations)) {
        throw new Error('Invalid FRED API response format');
      }

      // Store the observations
      let storedCount = 0;
      for (const observation of data.observations) {
        if (observation.value && observation.value !== '.') {
          await this.storeObservation(seriesId, observation);
          storedCount++;
        }
      }

      logger.info(`✅ Stored ${storedCount} observations for ${seriesId}`);
    } catch (error) {
      logger.error(`❌ Error fetching FRED data for ${seriesId}:`, error);
      throw error;
    }
  }

  private async storeObservation(seriesId: string, observation: any): Promise<void> {
    try {
      // Get series info for metric name
      const metricName = await this.getSeriesName(seriesId);
      
      await db.execute(`
        INSERT INTO economic_indicators_current 
        (metric_name, value, date, series_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (metric_name, date) DO UPDATE SET
          value = EXCLUDED.value
      `, [
        metricName,
        parseFloat(observation.value),
        observation.date,
        seriesId
      ]);
    } catch (error) {
      logger.error(`❌ Error storing observation for ${seriesId}:`, error);
    }
  }

  private async getSeriesName(seriesId: string): Promise<string> {
    // Simple mapping for common series
    const seriesNames: Record<string, string> = {
      'CCSA': 'Continuing Jobless Claims',
      'ICSA': 'Initial Jobless Claims', 
      'PAYEMS': 'Nonfarm Payrolls',
      'CPIAUCSL': 'CPI All Items',
      'CPILFESL': 'Core CPI',
      'MORTGAGE30US': '30-Year Mortgage Rate',
      'DEXUSEU': 'US Dollar Index',
      'GASREGCOVW': 'Gasoline Prices',
      'RSAFS': 'Retail Sales',
      'HOUST': 'Housing Starts'
    };

    return seriesNames[seriesId] || seriesId;
  }

  async getAvailableSeries(): Promise<string[]> {
    return [
      'CCSA', 'ICSA', 'PAYEMS', 'CPIAUCSL', 'CPILFESL',
      'MORTGAGE30US', 'DEXUSEU', 'GASREGCOVW', 'RSAFS', 'HOUST'
    ];
  }
}

export const fredDataService = new FredDataService();