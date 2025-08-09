import { logger } from '../middleware/logging';
import { db } from '../db';

interface EconomicDataPoint {
  id?: number;
  metric_name: string;
  value: number;
  date: Date | string;
  series_id: string;
  monthly_change?: number;
  annual_change?: number;
  z_score_12m?: number;
}

interface ProcessedEconomicData extends EconomicDataPoint {
  monthly_change: number | null;
  annual_change: number | null;
  z_score_12m: number | null;
}

/**
 * Economic Delta Calculator Service
 * Processes raw economic data to calculate delta-adjusted versions
 * Addresses missing historical data for indicators like CCSA, ICSA, PAYEMS
 */
export class EconomicDeltaCalculator {
  private readonly PRIORITY_INDICATORS = [
    { series: 'CCSA', name: 'Continuing Jobless Claims', priority: 1 },
    { series: 'ICSA', name: 'Initial Jobless Claims', priority: 1 },
    { series: 'PAYEMS', name: 'Nonfarm Payrolls', priority: 1 },
    { series: 'CPIAUCSL', name: 'CPI All Items', priority: 2 },
    { series: 'CPILFESL', name: 'Core CPI', priority: 2 },
    { series: 'A191RL1Q225SBEA', name: 'GDP Growth Rate', priority: 2 },
    { series: 'RSAFS', name: 'Retail Sales', priority: 2 },
    { series: 'HOUST', name: 'Housing Starts', priority: 2 }
  ];

  async processAllMissingDeltas(): Promise<void> {
    logger.info('🧮 Starting economic delta calculation for missing indicators');

    for (const indicator of this.PRIORITY_INDICATORS) {
      try {
        await this.processIndicatorDeltas(indicator.series, indicator.name);
      } catch (error) {
        logger.error(`❌ Failed to process deltas for ${indicator.series}:`, error);
      }
    }

    logger.info('✅ Economic delta calculation completed');
  }

  async processIndicatorDeltas(seriesId: string, indicatorName: string): Promise<void> {
    logger.info(`📊 Processing delta calculations for ${indicatorName} (${seriesId})`);

    // Get raw historical data
    const rawData = await this.getRawHistoricalData(seriesId);
    
    if (rawData.length < 2) {
      logger.warn(`⚠️ Insufficient data for ${seriesId}: ${rawData.length} records`);
      return;
    }

    // Calculate deltas
    const processedData = await this.calculateDeltas(rawData, indicatorName);

    // Save processed data
    await this.saveProcessedData(processedData, seriesId);

    logger.info(`✅ Processed ${processedData.length} delta records for ${seriesId}`);
  }

  private async getRawHistoricalData(seriesId: string): Promise<EconomicDataPoint[]> {
    try {
      const result = await db.execute(`
        SELECT 
          metric_name,
          value,
          date,
          '${seriesId}' as series_id
        FROM economic_indicators_current 
        WHERE metric_name LIKE '%${this.getIndicatorNameBySeriesId(seriesId)}%'
        AND metric_name NOT LIKE '%Δ-adjusted%'
        ORDER BY date ASC
      `);

      return result.rows.map(row => ({
        metric_name: String(row.metric_name),
        value: Number(row.value),
        date: new Date(String(row.date)),
        series_id: seriesId
      }));
    } catch (error) {
      logger.error(`❌ Error fetching raw data for ${seriesId}:`, error);
      return [];
    }
  }

  private async calculateDeltas(rawData: EconomicDataPoint[], indicatorName: string): Promise<ProcessedEconomicData[]> {
    return rawData.map((point, index) => {
      const monthlyChange = this.calculateMonthlyChange(rawData, index);
      const annualChange = this.calculateAnnualChange(rawData, index);
      const zScore12m = this.calculateZScore(rawData, index, 12);

      return {
        ...point,
        metric_name: `${indicatorName} (Δ-adjusted)`,
        monthly_change: monthlyChange,
        annual_change: annualChange,
        z_score_12m: zScore12m
      };
    });
  }

  private calculateMonthlyChange(data: EconomicDataPoint[], currentIndex: number): number | null {
    if (currentIndex === 0) return null;
    
    const current = data[currentIndex].value;
    const previous = data[currentIndex - 1].value;
    
    if (previous === 0) return null;
    
    return ((current - previous) / previous) * 100;
  }

  private calculateAnnualChange(data: EconomicDataPoint[], currentIndex: number): number | null {
    if (currentIndex < 12) return null;
    
    const current = data[currentIndex].value;
    const yearAgo = data[currentIndex - 12].value;
    
    if (yearAgo === 0) return null;
    
    return ((current - yearAgo) / yearAgo) * 100;
  }

  private calculateZScore(data: EconomicDataPoint[], currentIndex: number, windowSize: number): number | null {
    if (currentIndex < windowSize) return null;

    const window = data.slice(Math.max(0, currentIndex - windowSize + 1), currentIndex + 1);
    const values = window.map(d => d.value);
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    if (standardDeviation === 0) return null;
    
    return (data[currentIndex].value - mean) / standardDeviation;
  }

  private async saveProcessedData(processedData: ProcessedEconomicData[], seriesId: string): Promise<void> {
    try {
      // First, remove existing delta-adjusted records for this series
      await db.execute(`
        DELETE FROM economic_indicators_current 
        WHERE metric_name LIKE '%${this.getIndicatorNameBySeriesId(seriesId)}% (Δ-adjusted)%'
      `);

      // Insert new processed data
      for (const dataPoint of processedData) {
        await db.execute(`
          INSERT INTO economic_indicators_current 
          (metric_name, value, date, monthly_change, annual_change, z_score_12m)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (metric_name, date) DO UPDATE SET
            value = EXCLUDED.value,
            monthly_change = EXCLUDED.monthly_change,
            annual_change = EXCLUDED.annual_change,
            z_score_12m = EXCLUDED.z_score_12m
        `, [
          dataPoint.metric_name,
          dataPoint.value,
          dataPoint.date,
          dataPoint.monthly_change,
          dataPoint.annual_change,
          dataPoint.z_score_12m
        ]);
      }

      logger.info(`✅ Saved ${processedData.length} processed records for ${seriesId}`);
    } catch (error) {
      logger.error(`❌ Error saving processed data for ${seriesId}:`, error);
      throw error;
    }
  }

  private getIndicatorNameBySeriesId(seriesId: string): string {
    const mapping: Record<string, string> = {
      'CCSA': 'Continuing Jobless Claims',
      'ICSA': 'Initial Jobless Claims',
      'PAYEMS': 'Nonfarm Payrolls',
      'CPIAUCSL': 'CPI All Items',
      'CPILFESL': 'Core CPI',
      'A191RL1Q225SBEA': 'GDP Growth Rate',
      'RSAFS': 'Retail Sales',
      'HOUST': 'Housing Starts'
    };
    
    return mapping[seriesId] || seriesId;
  }

  async getProcessingStatus(): Promise<any> {
    const status = [];

    for (const indicator of this.PRIORITY_INDICATORS) {
      try {
        const rawCount = await this.getRawDataCount(indicator.series);
        const processedCount = await this.getProcessedDataCount(indicator.series);

        status.push({
          series: indicator.series,
          name: indicator.name,
          priority: indicator.priority,
          rawRecords: rawCount,
          processedRecords: processedCount,
          needsProcessing: rawCount > processedCount
        });
      } catch (error) {
        status.push({
          series: indicator.series,
          name: indicator.name,
          priority: indicator.priority,
          rawRecords: 0,
          processedRecords: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return status;
  }

  private async getRawDataCount(seriesId: string): Promise<number> {
    const result = await db.execute(`
      SELECT COUNT(*) as count
      FROM economic_indicators_current 
      WHERE metric_name LIKE '%${this.getIndicatorNameBySeriesId(seriesId)}%'
      AND metric_name NOT LIKE '%Δ-adjusted%'
    `);
    
    return Number(result.rows[0]?.count || 0);
  }

  private async getProcessedDataCount(seriesId: string): Promise<number> {
    const result = await db.execute(`
      SELECT COUNT(*) as count
      FROM economic_indicators_current 
      WHERE metric_name LIKE '%${this.getIndicatorNameBySeriesId(seriesId)}% (Δ-adjusted)%'
    `);
    
    return Number(result.rows[0]?.count || 0);
  }
}

export const economicDeltaCalculator = new EconomicDeltaCalculator();