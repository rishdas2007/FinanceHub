import { comprehensiveFredApiService } from './comprehensive-fred-api.js';
import { db } from '../db.js';
import { economicTimeSeries, historicalContextSnapshots, dataQualityLog } from '../../shared/schema.js';
import { sql, desc, eq, and, gte, lte } from 'drizzle-orm';

export class HistoricalDataAccumulator {
  private static instance: HistoricalDataAccumulator;

  static getInstance(): HistoricalDataAccumulator {
    if (!HistoricalDataAccumulator.instance) {
      HistoricalDataAccumulator.instance = new HistoricalDataAccumulator();
    }
    return HistoricalDataAccumulator.instance;
  }

  async accumulateDailyReadings(): Promise<void> {
    console.log('📊 Starting daily economic data accumulation...');
    const startTime = Date.now();
    
    try {
      // Get latest FRED indicators
      const fredIndicators = await comprehensiveFredApiService.getComprehensiveEconomicIndicators();
      
      let recordsProcessed = 0;
      let recordsStored = 0;
      let recordsSkipped = 0;

      for (const indicator of fredIndicators) {
        recordsProcessed++;
        
        try {
          // Check if we already have this reading for this period
          const existing = await db
            .select()
            .from(economicTimeSeries)
            .where(and(
              eq(economicTimeSeries.seriesId, indicator.seriesId),
              eq(economicTimeSeries.periodDate, new Date(indicator.latestDate))
            ))
            .limit(1);

          if (existing.length > 0) {
            // Update if value changed (revisions happen)
            const existingRecord = existing[0];
            const cleanValue = this.parseNumericValue(indicator.latestValue);
            const existingValue = parseFloat(existingRecord.value);
            
            if (Math.abs(cleanValue - existingValue) > 0.0001) { // Allow for small floating point differences
              await this.updateExistingRecord(existingRecord.id, indicator);
              recordsStored++;
              console.log(`📈 Updated ${indicator.title}: ${indicator.latestValue} (revision)`);
            } else {
              recordsSkipped++;
            }
          } else {
            // Store new reading
            await this.storeNewReading(indicator);
            recordsStored++;
            console.log(`💾 Stored ${indicator.title}: ${indicator.latestValue}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${indicator.title}:`, error);
          recordsSkipped++;
        }
      }

      // Create daily context snapshot for AI
      await this.createContextSnapshot();

      // Log data quality metrics
      await this.logDataQuality({
        operation: 'store',
        seriesId: 'all_indicators',
        recordsProcessed,
        recordsStored,
        recordsSkipped,
        executionTime: Date.now() - startTime,
        status: 'success'
      });

      console.log(`✅ Daily accumulation complete: ${recordsStored} stored, ${recordsSkipped} skipped`);
    } catch (error) {
      console.error('❌ Daily accumulation failed:', error);
      
      await this.logDataQuality({
        operation: 'store',
        seriesId: 'all_indicators',
        recordsProcessed: 0,
        recordsStored: 0,
        recordsSkipped: 0,
        executionTime: Date.now() - startTime,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private parseNumericValue(value: string): number {
    // Remove non-numeric characters except decimal points and negative signs
    const cleaned = value.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  }

  private async storeNewReading(indicator: any): Promise<void> {
    const numericValue = this.parseNumericValue(indicator.latestValue);
    
    await db.insert(economicTimeSeries).values({
      seriesId: indicator.seriesId,
      indicator: indicator.title,
      value: numericValue.toString(),
      valueFormatted: indicator.latestValue,
      category: indicator.category,
      importance: indicator.importance,
      frequency: indicator.frequency,
      units: indicator.units,
      releaseDate: new Date(), // When we got the data
      periodDate: new Date(indicator.latestDate), // What period it represents
      previousValue: indicator.previousValue ? this.parseNumericValue(indicator.previousValue).toString() : null,
      monthlyChange: indicator.monthlyChange ? this.parseNumericValue(indicator.monthlyChange).toString() : null,
      annualChange: indicator.annualChange ? this.parseNumericValue(indicator.annualChange).toString() : null,
      dataSource: 'fred'
    });
  }

  private async updateExistingRecord(id: number, indicator: any): Promise<void> {
    const numericValue = this.parseNumericValue(indicator.latestValue);
    
    await db.update(economicTimeSeries)
      .set({
        value: numericValue.toString(),
        valueFormatted: indicator.latestValue,
        monthlyChange: indicator.monthlyChange ? this.parseNumericValue(indicator.monthlyChange).toString() : null,
        annualChange: indicator.annualChange ? this.parseNumericValue(indicator.annualChange).toString() : null,
        createdAt: new Date() // Track when revision occurred
      })
      .where(eq(economicTimeSeries.id, id));
  }

  private async createContextSnapshot(): Promise<void> {
    console.log('📸 Creating daily economic context snapshot...');
    
    try {
      // Get latest readings for key indicators
      const latestReadings = await this.getLatestReadingsForSnapshot();
      
      await db.insert(historicalContextSnapshots).values({
        snapshotDate: new Date(),
        cpi: latestReadings.cpi?.toString(),
        cpiChange: latestReadings.cpiChange?.toString(),
        coreCpi: latestReadings.coreCpi?.toString(),
        unemployment: latestReadings.unemployment?.toString(),
        payrolls: latestReadings.payrolls?.toString(),
        retailSales: latestReadings.retailSales?.toString(),
        housingStarts: latestReadings.housingStarts?.toString(),
        fedFunds: latestReadings.fedFunds?.toString(),
        inflationTrend: this.analyzeInflationTrend(latestReadings),
        employmentTrend: this.analyzeEmploymentTrend(latestReadings),
        housingTrend: this.analyzeHousingTrend(latestReadings),
        overallSentiment: this.calculateOverallSentiment(latestReadings)
      });
      
      console.log('✅ Context snapshot created');
    } catch (error) {
      console.error('❌ Error creating context snapshot:', error);
    }
  }

  private async getLatestReadingsForSnapshot(): Promise<any> {
    // Helper to get latest reading for a series
    const getLatest = async (seriesId: string) => {
      const result = await db
        .select()
        .from(economicTimeSeries)
        .where(eq(economicTimeSeries.seriesId, seriesId))
        .orderBy(desc(economicTimeSeries.periodDate))
        .limit(1);
      return result[0]?.value ? parseFloat(result[0].value) : null;
    };

    return {
      cpi: await getLatest('CPIAUCSL'),
      cpiChange: await this.getMonthlyChange('CPIAUCSL'),
      coreCpi: await getLatest('CPILFESL'),
      unemployment: await getLatest('UNRATE'),
      payrolls: await getLatest('PAYEMS'),
      retailSales: await this.getMonthlyChange('RSAFS'),
      housingStarts: await getLatest('HOUST'),
      fedFunds: await getLatest('FEDFUNDS')
    };
  }

  private async getMonthlyChange(seriesId: string): Promise<number | null> {
    const recent = await db
      .select()
      .from(economicTimeSeries)
      .where(eq(economicTimeSeries.seriesId, seriesId))
      .orderBy(desc(economicTimeSeries.periodDate))
      .limit(2);

    if (recent.length < 2) return null;

    const current = parseFloat(recent[0].value);
    const previous = parseFloat(recent[1].value);
    
    return ((current - previous) / previous) * 100;
  }

  private analyzeInflationTrend(readings: any): string {
    if (!readings.cpiChange) return 'stable';
    if (readings.cpiChange > 0.3) return 'rising';
    if (readings.cpiChange < -0.1) return 'falling';
    return 'stable';
  }

  private analyzeEmploymentTrend(readings: any): string {
    if (!readings.unemployment) return 'stable';
    // Logic would compare to previous months - simplified for now
    return 'stable';
  }

  private analyzeHousingTrend(readings: any): string {
    if (!readings.housingStarts) return 'stable';
    // Logic would compare to previous months - simplified for now
    return 'stable';
  }

  private calculateOverallSentiment(readings: any): string {
    // Composite sentiment based on key indicators
    let score = 0;
    let factors = 0;

    if (readings.unemployment && readings.unemployment < 4.0) { score += 1; factors++; }
    if (readings.cpiChange && readings.cpiChange < 3.0) { score += 1; factors++; }
    if (readings.payrolls && readings.payrolls > 150) { score += 1; factors++; }

    if (factors === 0) return 'neutral';
    const average = score / factors;
    
    if (average > 0.7) return 'positive';
    if (average < 0.3) return 'negative';
    return 'neutral';
  }

  // Historical Context Query Methods for AI
  async getHistoricalContext(indicator: string, months: number = 12): Promise<any[]> {
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - months);
    
    const results = await db
      .select({
        value: economicTimeSeries.value,
        valueFormatted: economicTimeSeries.valueFormatted,
        periodDate: economicTimeSeries.periodDate,
        monthlyChange: economicTimeSeries.monthlyChange,
        annualChange: economicTimeSeries.annualChange
      })
      .from(economicTimeSeries)
      .where(and(
        eq(economicTimeSeries.indicator, indicator),
        gte(economicTimeSeries.periodDate, monthsAgo)
      ))
      .orderBy(desc(economicTimeSeries.periodDate));

    return results;
  }

  async getPercentileRanking(indicator: string, currentValue: number, months: number = 36): Promise<number> {
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - months);
    
    const historicalValues = await db
      .select({ value: economicTimeSeries.value })
      .from(economicTimeSeries)
      .where(and(
        eq(economicTimeSeries.indicator, indicator),
        gte(economicTimeSeries.periodDate, monthsAgo)
      ));

    if (historicalValues.length === 0) return 50; // Default to 50th percentile if no data

    const values = historicalValues.map(h => parseFloat(h.value)).sort((a, b) => a - b);
    const belowCount = values.filter(v => v < currentValue).length;
    
    return (belowCount / values.length) * 100;
  }

  async getYearOverYearComparison(indicator: string): Promise<{ current: number, yearAgo: number, change: number } | null> {
    const now = new Date();
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    
    // Get current reading
    const current = await db
      .select()
      .from(economicTimeSeries)
      .where(eq(economicTimeSeries.indicator, indicator))
      .orderBy(desc(economicTimeSeries.periodDate))
      .limit(1);

    // Get reading from approximately one year ago (within 2 months)
    const yearAgoStart = new Date(yearAgo);
    yearAgoStart.setMonth(yearAgoStart.getMonth() - 1);
    const yearAgoEnd = new Date(yearAgo);
    yearAgoEnd.setMonth(yearAgoEnd.getMonth() + 1);

    const historical = await db
      .select()
      .from(economicTimeSeries)
      .where(and(
        eq(economicTimeSeries.indicator, indicator),
        gte(economicTimeSeries.periodDate, yearAgoStart),
        lte(economicTimeSeries.periodDate, yearAgoEnd)
      ))
      .orderBy(desc(economicTimeSeries.periodDate))
      .limit(1);

    if (current.length === 0 || historical.length === 0) return null;

    const currentValue = parseFloat(current[0].value);
    const historicalValue = parseFloat(historical[0].value);
    const change = currentValue - historicalValue;

    return {
      current: currentValue,
      yearAgo: historicalValue,
      change
    };
  }

  private async logDataQuality(logData: {
    operation: string;
    seriesId: string;
    recordsProcessed: number;
    recordsStored: number;
    recordsSkipped: number;
    executionTime: number;
    status: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await db.insert(dataQualityLog).values({
        operation: logData.operation,
        seriesId: logData.seriesId,
        recordsProcessed: logData.recordsProcessed,
        recordsStored: logData.recordsStored,
        recordsSkipped: logData.recordsSkipped,
        executionTime: logData.executionTime,
        status: logData.status,
        errorMessage: logData.errorMessage
      });
    } catch (error) {
      console.error('❌ Failed to log data quality metrics:', error);
    }
  }

  async backfillHistoricalData(months: number = 24): Promise<void> {
    console.log(`📊 Starting historical data backfill for ${months} months...`);
    const startTime = Date.now();
    
    try {
      // This would require FRED API calls with date ranges
      // For now, we'll focus on daily accumulation and let it build over time
      console.log('🔄 Historical backfill would be implemented here with FRED date range queries');
      
      await this.logDataQuality({
        operation: 'backfill',
        seriesId: 'all_indicators',
        recordsProcessed: 0,
        recordsStored: 0,
        recordsSkipped: 0,
        executionTime: Date.now() - startTime,
        status: 'pending',
        errorMessage: 'Backfill implementation pending - focusing on daily accumulation'
      });
      
    } catch (error) {
      console.error('❌ Historical backfill failed:', error);
    }
  }
}

export const historicalDataAccumulator = HistoricalDataAccumulator.getInstance();