import { db } from '../db';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import { logger } from '../utils/logger';

interface HistoricalEconomicIndicator {
  id?: number;
  metricName: string;
  seriesId: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: string;
  unit: string;
  frequency: string;
  value: number;
  periodDate: Date;
  releaseDate?: Date;
  forecast?: number;
  priorValue?: number;
  monthlyChange?: number;
  annualChange?: number;
  zScore12m?: number;
  threeMonthAnnualized?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EconomicIndicatorWithUpdate {
  metric: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: string;
  current: number;
  forecast: number;
  vsForecast: number;
  prior: number;
  vsPrior: number;
  zScore: number;
  yoyChange: number;
  threeMonthAnnualized: number;
  unit: string;
  frequency: string;
  dateOfRelease: string;
  nextRelease: string;
  lastUpdated?: string;
}

export class HistoricalEconomicIndicatorsService {
  private readonly FRED_API_KEY = process.env.FRED_API_KEY;
  private readonly FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

  // FRED series mapping - matches economic-indicators.ts
  private readonly fredSeriesMap: Record<string, {
    id: string;
    type: 'Leading' | 'Coincident' | 'Lagging';
    category: string;
    unit: string;
    frequency: string;
    forecast?: number;
  }> = {
    'GDP Growth Rate': {
      id: 'A191RL1Q225SBEA',
      type: 'Coincident',
      category: 'Growth',
      unit: 'percent',
      frequency: 'quarterly',
      forecast: 1.0
    },
    'CPI Year-over-Year': {
      id: 'CPIAUCSL',
      type: 'Lagging',
      category: 'Inflation',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 2.7
    },
    'Core CPI Year-over-Year': {
      id: 'CPILFESL',
      type: 'Lagging',
      category: 'Inflation',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 3.0
    },
    'PCE Price Index YoY': {
      id: 'PCEPI',
      type: 'Lagging',
      category: 'Inflation',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 2.2
    },
    'Manufacturing PMI': {
      id: 'NAPM',
      type: 'Leading',
      category: 'Growth',
      unit: 'index',
      frequency: 'monthly',
      forecast: 49.5
    },
    'Unemployment Rate': {
      id: 'UNRATE',
      type: 'Lagging',
      category: 'Labor',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 4.0
    },
    'Nonfarm Payrolls': {
      id: 'PAYEMS',
      type: 'Coincident',
      category: 'Labor',
      unit: 'thousands',
      frequency: 'monthly',
      forecast: 180
    },
    'Federal Funds Rate': {
      id: 'FEDFUNDS',
      type: 'Coincident',
      category: 'Monetary Policy',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 4.25
    },
    '10-Year Treasury Yield': {
      id: 'DGS10',
      type: 'Leading',
      category: 'Monetary Policy',
      unit: 'percent',
      frequency: 'daily',
      forecast: 4.25
    },
    'Consumer Confidence Index': {
      id: 'CSCICP03USM665S',
      type: 'Leading',
      category: 'Sentiment',
      unit: 'index',
      frequency: 'monthly',
      forecast: 93.5
    },
    'Michigan Consumer Sentiment': {
      id: 'UMCSENT',
      type: 'Leading',
      category: 'Sentiment',
      unit: 'index',
      frequency: 'monthly',
      forecast: 61.5
    },
    'Retail Sales MoM': {
      id: 'RSXFS',
      type: 'Coincident',
      category: 'Growth',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 0.1
    },
    'Industrial Production YoY': {
      id: 'INDPRO',
      type: 'Coincident',
      category: 'Growth',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 1.0
    },
    'Housing Starts': {
      id: 'HOUST',
      type: 'Leading',
      category: 'Growth',
      unit: 'thousands',
      frequency: 'monthly',
      forecast: 1350
    },
    'Building Permits': {
      id: 'PERMIT',
      type: 'Leading',
      category: 'Growth',
      unit: 'thousands',
      frequency: 'monthly',
      forecast: 1390
    },
    'Durable Goods Orders MoM': {
      id: 'DGORDER',
      type: 'Leading',
      category: 'Growth',
      unit: 'percent',
      frequency: 'monthly',
      forecast: 8.6
    },
    'Leading Economic Index': {
      id: 'USSLIND',
      type: 'Leading',
      category: 'Growth',
      unit: 'index',
      frequency: 'monthly',
      forecast: 99.0
    }
  };

  /**
   * Update historical data from FRED API for all indicators
   * Respects 120 requests/minute limit with proper rate limiting
   */
  async updateAllIndicators(): Promise<{ success: boolean; updatedCount: number; message: string }> {
    logger.info('🔄 Starting FRED historical data update for all indicators...');
    
    const startTime = Date.now();
    let updatedCount = 0;
    const errors: string[] = [];
    const batchSize = 5; // Process in small batches for rate limiting
    
    try {
      const indicatorEntries = Object.entries(this.fredSeriesMap);
      
      // Process in batches to respect API limits
      for (let i = 0; i < indicatorEntries.length; i += batchSize) {
        const batch = indicatorEntries.slice(i, i + batchSize);
        
        // Wait between batches to respect rate limits (120 req/min = 2 req/sec max)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        }
        
        await Promise.all(batch.map(async ([metricName, config]) => {
          try {
            const updated = await this.updateIndicatorFromFRED(metricName, config);
            if (updated) updatedCount++;
          } catch (error) {
            errors.push(`${metricName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            logger.error(`❌ Error updating ${metricName}:`, error);
          }
        }));
      }

      const duration = Date.now() - startTime;
      logger.info(`✅ FRED update completed: ${updatedCount} indicators updated in ${duration}ms`);

      return {
        success: true,
        updatedCount,
        message: `Successfully updated ${updatedCount} indicators from FRED API${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
      };

    } catch (error) {
      logger.error('❌ FRED batch update failed:', error);
      return {
        success: false,
        updatedCount,
        message: `FRED update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update a single indicator from FRED API
   */
  private async updateIndicatorFromFRED(
    metricName: string, 
    config: { id: string; type: 'Leading' | 'Coincident' | 'Lagging'; category: string; unit: string; frequency: string; forecast?: number }
  ): Promise<boolean> {
    try {
      // Fetch last 24 observations for calculations
      const observations = await this.fetchFredSeries(config.id, 24);
      
      if (!observations || observations.length === 0) {
        logger.warn(`⚠️  No data available for ${metricName} (${config.id})`);
        return false;
      }

      // Store all observations in database
      let storedCount = 0;
      for (const obs of observations) {
        const stored = await this.storeHistoricalData({
          metricName,
          seriesId: config.id,
          type: config.type,
          category: config.category,
          unit: config.unit,
          frequency: config.frequency,
          value: obs.value,
          periodDate: obs.date,
          releaseDate: obs.date,
          forecast: config.forecast
        });
        
        if (stored) storedCount++;
      }

      logger.info(`📊 Stored ${storedCount} historical records for ${metricName}`);
      return storedCount > 0;

    } catch (error) {
      logger.error(`❌ Failed to update ${metricName} from FRED:`, error);
      return false;
    }
  }

  /**
   * Fetch data from FRED API
   */
  private async fetchFredSeries(seriesId: string, limit: number = 24): Promise<{ date: Date; value: number }[]> {
    if (!this.FRED_API_KEY) {
      throw new Error('FRED_API_KEY not configured');
    }

    const response = await axios.get(this.FRED_BASE_URL, {
      params: {
        series_id: seriesId,
        api_key: this.FRED_API_KEY,
        file_type: 'json',
        sort_order: 'desc',
        limit,
      },
      timeout: 10000,
    });

    if (!response.data?.observations) {
      throw new Error('Invalid FRED API response format');
    }

    const observations: { date: Date; value: number }[] = [];
    
    for (const obs of response.data.observations) {
      if (obs.value !== '.' && !isNaN(parseFloat(obs.value))) {
        observations.push({
          date: new Date(obs.date),
          value: parseFloat(obs.value)
        });
      }
    }

    return observations.reverse(); // Return chronological order
  }

  /**
   * Store historical data point in database
   */
  private async storeHistoricalData(data: Omit<HistoricalEconomicIndicator, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      // Calculate additional metrics from historical data
      const historicalValues = await this.getHistoricalValues(data.seriesId, data.periodDate);
      const metrics = this.calculateMetrics(data.value, historicalValues, data.forecast);

      await db.execute(sql`
        INSERT INTO economic_indicators_history 
        (metric_name, series_id, type, category, unit, frequency, value, period_date, release_date, 
         forecast, prior_value, monthly_change, annual_change, z_score_12m, three_month_annualized, updated_at)
        VALUES 
        (${data.metricName}, ${data.seriesId}, ${data.type}, ${data.category}, ${data.unit}, 
         ${data.frequency}, ${data.value}, ${data.periodDate}, ${data.releaseDate}, 
         ${data.forecast}, ${metrics.priorValue}, ${metrics.monthlyChange}, ${metrics.annualChange}, 
         ${metrics.zScore12m}, ${metrics.threeMonthAnnualized}, CURRENT_TIMESTAMP)
        ON CONFLICT (series_id, period_date) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          forecast = EXCLUDED.forecast,
          prior_value = EXCLUDED.prior_value,
          monthly_change = EXCLUDED.monthly_change,
          annual_change = EXCLUDED.annual_change,
          z_score_12m = EXCLUDED.z_score_12m,
          three_month_annualized = EXCLUDED.three_month_annualized,
          updated_at = CURRENT_TIMESTAMP
      `);

      return true;
    } catch (error) {
      logger.error(`❌ Failed to store historical data for ${data.metricName}:`, error);
      return false;
    }
  }

  /**
   * Get historical values for metric calculations
   */
  private async getHistoricalValues(seriesId: string, currentDate: Date): Promise<number[]> {
    try {
      const result = await db.execute(sql`
        SELECT value 
        FROM economic_indicators_history 
        WHERE series_id = ${seriesId} 
          AND period_date <= ${currentDate}
        ORDER BY period_date DESC 
        LIMIT 24
      `);

      return result.rows.map((row: any) => parseFloat(row.value));
    } catch (error) {
      logger.error(`❌ Failed to get historical values for ${seriesId}:`, error);
      return [];
    }
  }

  /**
   * Calculate derived metrics (Z-score, YoY, 3M annualized, etc.)
   */
  private calculateMetrics(
    currentValue: number, 
    historicalValues: number[], 
    forecast?: number
  ): {
    priorValue: number | null;
    monthlyChange: number | null;
    annualChange: number | null;
    zScore12m: number | null;
    threeMonthAnnualized: number | null;
  } {
    const priorValue = historicalValues.length > 0 ? historicalValues[0] : null;
    const monthlyChange = priorValue ? ((currentValue - priorValue) / priorValue) * 100 : null;
    
    // Annual change (12 months back)
    const yearAgoValue = historicalValues.length >= 12 ? historicalValues[11] : null;
    const annualChange = yearAgoValue ? ((currentValue - yearAgoValue) / yearAgoValue) * 100 : null;

    // Z-score calculation (12-month rolling)
    let zScore12m: number | null = null;
    if (historicalValues.length >= 12) {
      const last12Values = historicalValues.slice(0, 12);
      const mean = last12Values.reduce((sum, val) => sum + val, 0) / last12Values.length;
      const stdDev = Math.sqrt(
        last12Values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / last12Values.length
      );
      
      if (stdDev > 0) {
        zScore12m = (currentValue - mean) / stdDev;
      }
    }

    // 3-month annualized rate
    let threeMonthAnnualized: number | null = null;
    if (historicalValues.length >= 3) {
      const threeMonthsAgo = historicalValues[2];
      if (threeMonthsAgo && threeMonthsAgo !== 0) {
        const threeMonthChange = (currentValue - threeMonthsAgo) / threeMonthsAgo;
        threeMonthAnnualized = threeMonthChange * 4 * 100; // Annualized percentage
      }
    }

    return {
      priorValue,
      monthlyChange,
      annualChange,
      zScore12m,
      threeMonthAnnualized
    };
  }

  /**
   * Get enhanced indicators with historical context
   */
  async getIndicatorsWithHistoricalContext(): Promise<EconomicIndicatorWithUpdate[]> {
    try {
      const indicators: EconomicIndicatorWithUpdate[] = [];
      
      for (const [metricName, config] of Object.entries(this.fredSeriesMap)) {
        // Get latest data from database
        const result = await db.execute(sql`
          SELECT * FROM economic_indicators_history 
          WHERE metric_name = ${metricName}
          ORDER BY period_date DESC 
          LIMIT 1
        `);

        if (result.rows.length > 0) {
          const row = result.rows[0] as any;
          
          // Check if updated today
          const today = new Date().toDateString();
          const lastUpdated = new Date(row.updated_at).toDateString() === today 
            ? new Date(row.updated_at).toISOString() 
            : undefined;

          indicators.push({
            metric: metricName,
            type: config.type,
            category: config.category,
            current: parseFloat(row.value),
            forecast: row.forecast || config.forecast || 0,
            vsForecast: row.forecast ? parseFloat(row.value) - row.forecast : 0,
            prior: row.prior_value || 0,
            vsPrior: row.prior_value ? parseFloat(row.value) - row.prior_value : 0,
            zScore: row.z_score_12m || 0,
            yoyChange: row.annual_change || 0,
            threeMonthAnnualized: row.three_month_annualized || 0,
            unit: config.unit,
            frequency: config.frequency,
            dateOfRelease: new Date(row.period_date).toISOString().split('T')[0],
            nextRelease: this.calculateNextRelease(config.frequency),
            lastUpdated
          });
        }
      }

      return indicators;
    } catch (error) {
      logger.error('❌ Failed to get indicators with historical context:', error);
      return [];
    }
  }

  /**
   * Calculate next release date based on frequency
   */
  private calculateNextRelease(frequency: string): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    
    switch (frequency.toLowerCase()) {
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString().split('T')[0];
      case 'monthly':
        return nextMonth.toISOString().split('T')[0];
      case 'quarterly':
        const nextQuarter = new Date(now.getFullYear(), now.getMonth() + 3, 15);
        return nextQuarter.toISOString().split('T')[0];
      default:
        return nextMonth.toISOString().split('T')[0];
    }
  }

  /**
   * Get historical data count for each indicator
   */
  async getHistoricalDataSummary(): Promise<{ metric: string; recordCount: number; earliestDate: string; latestDate: string }[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          metric_name,
          COUNT(*) as record_count,
          MIN(period_date) as earliest_date,
          MAX(period_date) as latest_date
        FROM economic_indicators_history 
        GROUP BY metric_name 
        ORDER BY record_count DESC
      `);

      return result.rows.map((row: any) => ({
        metric: row.metric_name,
        recordCount: parseInt(row.record_count),
        earliestDate: row.earliest_date,
        latestDate: row.latest_date
      }));
    } catch (error) {
      logger.error('❌ Failed to get historical data summary:', error);
      return [];
    }
  }
}

export const historicalEconomicIndicatorsService = new HistoricalEconomicIndicatorsService();