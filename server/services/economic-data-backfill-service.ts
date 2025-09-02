import { db } from '../db/index.js';
import { economicIndicatorsCurrent, economicIndicatorsHistory } from '../../shared/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import fetch from 'node-fetch';

interface FREDApiResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

interface EconomicSeriesConfig {
  series_id: string;
  metric: string;
  category: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  frequency: string;
  unit: string;
  priority: number; // 1 = highest priority
}

/**
 * Comprehensive Economic Data Backfill Service
 * Addresses critical gaps in July-August 2025 economic data collection
 */
export class EconomicDataBackfillService {
  private readonly FRED_API_KEY = process.env.FRED_API_KEY;
  private readonly BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
  
  // Priority economic indicators with confirmed missing data in July-August 2025
  private readonly CRITICAL_INDICATORS: EconomicSeriesConfig[] = [
    // Highest Priority - Weekly/Daily Updates
    {
      series_id: 'T10Y2Y',
      metric: '10Y-2Y Treasury Spread',
      category: 'Monetary Policy',
      type: 'Leading',
      frequency: 'Daily',
      unit: '%',
      priority: 1
    },
    {
      series_id: 'DGS10',
      metric: '10-Year Treasury Yield',
      category: 'Monetary Policy',
      type: 'Leading',
      frequency: 'Daily',
      unit: '%',
      priority: 1
    },
    {
      series_id: 'ICSA',
      metric: 'Initial Claims',
      category: 'Labor',
      type: 'Leading',
      frequency: 'Weekly',
      unit: 'Thousands',
      priority: 1
    },
    {
      series_id: 'CCSA',
      metric: 'Continued Claims (Insured Unemployment)',
      category: 'Labor',
      type: 'Leading',
      frequency: 'Weekly',
      unit: 'Thousands',
      priority: 1
    },
    
    // High Priority - Monthly Updates
    {
      series_id: 'CPIAUCSL',
      metric: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average',
      category: 'Inflation',
      type: 'Lagging',
      frequency: 'Monthly',
      unit: 'Index',
      priority: 2
    },
    {
      series_id: 'CPILFESL',
      metric: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy in U.S. City Average',
      category: 'Inflation',
      type: 'Lagging',
      frequency: 'Monthly',
      unit: 'Index',
      priority: 2
    },
    {
      series_id: 'UNRATE',
      metric: 'Unemployment Rate',
      category: 'Labor',
      type: 'Lagging',
      frequency: 'Monthly',
      unit: '%',
      priority: 2
    },
    {
      series_id: 'PAYEMS',
      metric: 'All Employees, Total Nonfarm',
      category: 'Labor',
      type: 'Coincident',
      frequency: 'Monthly',
      unit: 'Thousands',
      priority: 2
    },
    {
      series_id: 'FEDFUNDS',
      metric: 'Federal Funds Effective Rate',
      category: 'Monetary Policy',
      type: 'Leading',
      frequency: 'Monthly',
      unit: '%',
      priority: 2
    },
    {
      series_id: 'PPIACO',
      metric: 'Producer Price Index: All Commodities',
      category: 'Inflation',
      type: 'Leading',
      frequency: 'Monthly',
      unit: 'Index',
      priority: 2
    },
    
    // Medium Priority - Additional Coverage
    {
      series_id: 'INDPRO',
      metric: 'Industrial Production Index',
      category: 'Production',
      type: 'Coincident',
      frequency: 'Monthly',
      unit: 'Index',
      priority: 3
    },
    {
      series_id: 'HOUST',
      metric: 'Housing Starts: Total: New Privately Owned Housing Units Started',
      category: 'Housing',
      type: 'Leading',
      frequency: 'Monthly',
      unit: 'Thousands of Units',
      priority: 3
    },
    {
      series_id: 'UMCSENT',
      metric: 'University of Michigan: Consumer Sentiment',
      category: 'Sentiment',
      type: 'Leading',
      frequency: 'Monthly',
      unit: 'Index',
      priority: 3
    },
    {
      series_id: 'RSXFS',
      metric: 'Advance Retail Sales: Retail Trade',
      category: 'Consumption',
      type: 'Coincident',
      frequency: 'Monthly',
      unit: 'Millions of Dollars',
      priority: 3
    }
  ];

  constructor() {
    if (!this.FRED_API_KEY) {
      logger.error('⚠️  FRED_API_KEY not found in environment variables');
      throw new Error('FRED_API_KEY is required for economic data backfill');
    }
  }

  /**
   * Run comprehensive backfill for July-August 2025 missing data
   */
  async runCriticalBackfill(): Promise<{
    success: boolean;
    indicatorsProcessed: number;
    recordsInserted: number;
    errors: string[];
  }> {
    logger.info('🚀 Starting Critical Economic Data Backfill for July-August 2025');
    
    const results = {
      success: true,
      indicatorsProcessed: 0,
      recordsInserted: 0,
      errors: [] as string[]
    };

    // Focus on July 1 - August 31, 2025 period with gaps
    const startDate = '2025-07-01';
    const endDate = '2025-08-31';

    // Process indicators in priority order
    const sortedIndicators = this.CRITICAL_INDICATORS.sort((a, b) => a.priority - b.priority);

    for (const indicator of sortedIndicators) {
      try {
        logger.info(`📊 Processing ${indicator.metric} (${indicator.series_id})`);
        
        const records = await this.fetchAndProcessIndicator(indicator, startDate, endDate);
        if (records > 0) {
          results.recordsInserted += records;
          logger.info(`✅ Inserted ${records} records for ${indicator.series_id}`);
        } else {
          logger.warn(`⚠️  No new records for ${indicator.series_id}`);
        }
        
        results.indicatorsProcessed++;
        
        // Rate limiting - respect FRED API limits
        await this.delay(200); // 200ms between requests
        
      } catch (error) {
        const errorMsg = `Failed to process ${indicator.series_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg);
        results.errors.push(errorMsg);
        results.success = false;
      }
    }

    logger.info(`🎯 Backfill Complete: ${results.recordsInserted} records inserted for ${results.indicatorsProcessed} indicators`);
    
    if (results.errors.length > 0) {
      logger.warn(`⚠️  ${results.errors.length} errors encountered during backfill`);
    }

    return results;
  }

  /**
   * Fetch data from FRED API and insert into database
   */
  private async fetchAndProcessIndicator(
    indicator: EconomicSeriesConfig,
    startDate: string,
    endDate: string
  ): Promise<number> {
    
    // Check existing data to avoid duplicates
    const existingRecords = await db
      .select()
      .from(economicIndicatorsCurrent)
      .where(
        and(
          eq(economicIndicatorsCurrent.seriesId, indicator.series_id),
          gte(economicIndicatorsCurrent.periodDate, new Date(startDate)),
          lte(economicIndicatorsCurrent.periodDate, new Date(endDate))
        )
      );

    if (existingRecords.length > 0) {
      logger.info(`📋 Found ${existingRecords.length} existing records for ${indicator.series_id}, skipping duplicates`);
    }

    // Fetch from FRED API
    const url = `${this.BASE_URL}?series_id=${indicator.series_id}&api_key=${this.FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as FREDApiResponse;
    
    if (!data.observations || data.observations.length === 0) {
      logger.warn(`📭 No observations returned for ${indicator.series_id}`);
      return 0;
    }

    // Filter out existing dates and invalid values
    const existingDates = new Set(existingRecords.map((r: any) => r.periodDate?.toISOString().split('T')[0]));
    
    const newObservations = data.observations.filter(obs => {
      const obsDate = obs.date;
      const obsValue = obs.value;
      
      return !existingDates.has(obsDate) && obsValue !== '.' && obsValue !== '' && !isNaN(parseFloat(obsValue));
    });

    if (newObservations.length === 0) {
      return 0;
    }

    // Insert new records
    let insertedCount = 0;
    for (const obs of newObservations) {
      try {
        const periodDate = new Date(obs.date);
        const numericValue = parseFloat(obs.value);
        
        // Insert into current indicators table
        await db.insert(economicIndicatorsCurrent).values({
          seriesId: indicator.series_id,
          metric: indicator.metric,
          category: indicator.category,
          type: indicator.type,
          frequency: indicator.frequency,
          valueNumeric: numericValue,
          periodDateDesc: obs.date,
          releaseDateDesc: obs.date, // Use period date as approximation
          periodDate: periodDate,
          releaseDate: periodDate,
          unit: indicator.unit,
          isLatest: true, // Will be updated by regular maintenance
          updatedAt: new Date()
        });

        // Also insert into history table for complete record
        await db.insert(economicIndicatorsHistory).values({
          metricName: indicator.metric,
          seriesId: indicator.series_id,
          type: indicator.type,
          category: indicator.category,
          unit: indicator.unit,
          frequency: indicator.frequency,
          value: numericValue,
          periodDate: periodDate,
          releaseDate: periodDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        insertedCount++;
        
      } catch (insertError) {
        logger.error(`Failed to insert observation for ${indicator.series_id} on ${obs.date}:`, insertError);
      }
    }

    return insertedCount;
  }

  /**
   * Update latest flags after backfill
   */
  async updateLatestFlags(): Promise<void> {
    logger.info('🔄 Updating latest flags for economic indicators');
    
    try {
      // Reset all latest flags first
      await db.update(economicIndicatorsCurrent)
        .set({ isLatest: false });

      // Get latest record for each series
      for (const indicator of this.CRITICAL_INDICATORS) {
        const latestRecord = await db
          .select()
          .from(economicIndicatorsCurrent)
          .where(eq(economicIndicatorsCurrent.seriesId, indicator.series_id))
          .orderBy(desc(economicIndicatorsCurrent.periodDate))
          .limit(1);

        if (latestRecord.length > 0) {
          await db.update(economicIndicatorsCurrent)
            .set({ isLatest: true })
            .where(eq(economicIndicatorsCurrent.id, latestRecord[0].id));
        }
      }

      logger.info('✅ Latest flags updated successfully');
    } catch (error) {
      logger.error('Failed to update latest flags:', error);
      throw error;
    }
  }

  /**
   * Generate backfill summary report
   */
  async generateBackfillReport(): Promise<{
    totalIndicators: number;
    coveragePeriod: string;
    recordsByCategory: Record<string, number>;
    latestDates: Record<string, string>;
  }> {
    const report = {
      totalIndicators: this.CRITICAL_INDICATORS.length,
      coveragePeriod: 'July 1, 2025 - August 31, 2025',
      recordsByCategory: {} as Record<string, number>,
      latestDates: {} as Record<string, string>
    };

    // Count records by category
    for (const category of ['Monetary Policy', 'Labor', 'Inflation', 'Housing', 'Production', 'Sentiment']) {
      const count = await db.select()
        .from(economicIndicatorsCurrent)
        .where(
          and(
            eq(economicIndicatorsCurrent.category, category),
            gte(economicIndicatorsCurrent.periodDate, new Date('2025-07-01')),
            lte(economicIndicatorsCurrent.periodDate, new Date('2025-08-31'))
          )
        );
      
      report.recordsByCategory[category] = count.length;
    }

    // Get latest dates for each indicator
    for (const indicator of this.CRITICAL_INDICATORS.slice(0, 5)) { // Top 5 for summary
      const latest = await db.select()
        .from(economicIndicatorsCurrent)
        .where(eq(economicIndicatorsCurrent.seriesId, indicator.series_id))
        .orderBy(desc(economicIndicatorsCurrent.periodDate))
        .limit(1);

      if (latest.length > 0 && latest[0].periodDate) {
        report.latestDates[indicator.series_id] = latest[0].periodDate.toISOString().split('T')[0];
      }
    }

    return report;
  }

  /**
   * Utility delay function for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default EconomicDataBackfillService;