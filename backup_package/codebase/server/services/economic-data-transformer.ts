import { db } from '../db.js';
import { economicIndicatorsHistory } from '../../shared/schema';
import { and, eq, gte, lte, desc, asc } from 'drizzle-orm';
import { logger } from '../middleware/logging';

export class EconomicDataTransformer {
  // Series that should be converted from index to YoY %
  private readonly INDEX_SERIES = new Set([
    'CPIAUCSL',   // Consumer Price Index for All Urban Consumers
    'CPILFESL',   // Core CPI (Less Food and Energy)
    'CPIENG',     // CPI for Energy
    'PAYEMS'      // All Employees, Total Nonfarm
  ]);

  /**
   * Convert index value to year-over-year percentage change
   */
  async convertIndexToYoY(seriesId: string, currentValue: number, currentDate: Date): Promise<number | null> {
    if (!this.INDEX_SERIES.has(seriesId)) {
      // Not an index series, return as-is
      return currentValue;
    }

    try {
      // Get value from exactly 12 months ago
      const yearAgoDate = new Date(currentDate);
      yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);

      const yearAgoData = await db
        .select()
        .from(economicIndicatorsHistory)
        .where(
          and(
            eq(economicIndicatorsHistory.seriesId, seriesId),
            gte(economicIndicatorsHistory.periodDate, yearAgoDate),
            lte(economicIndicatorsHistory.periodDate, new Date(yearAgoDate.getTime() + 30 * 24 * 60 * 60 * 1000)) // +30 days window
          )
        )
        .orderBy(desc(economicIndicatorsHistory.periodDate))
        .limit(1);

      if (!yearAgoData.length) {
        logger.warn(`No year-ago data found for ${seriesId} at ${yearAgoDate.toISOString()}`);
        return null;
      }

      const yearAgoValue = parseFloat(yearAgoData[0].value.toString());

      // Calculate YoY percentage change
      const yoyChange = ((currentValue - yearAgoValue) / yearAgoValue) * 100;

      logger.info(`📊 YoY Conversion for ${seriesId}:`, {
        current: currentValue,
        yearAgo: yearAgoValue,
        yoyChange: yoyChange.toFixed(2)
      });

      return yoyChange;

    } catch (error) {
      logger.error(`Error calculating YoY for ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Process FRED API response and convert index values to YoY
   */
  async processFredObservation(seriesId: string, observation: any) {
    const rawValue = parseFloat(observation.value);
    const observationDate = new Date(observation.date);

    if (this.INDEX_SERIES.has(seriesId)) {
      // Convert index to YoY percentage
      const yoyValue = await this.convertIndexToYoY(seriesId, rawValue, observationDate);

      return {
        seriesId,
        date: observationDate,
        value: yoyValue !== null ? yoyValue : rawValue,
        rawIndexValue: rawValue, // Store original for reference
        dataType: 'yoy_percentage'
      };
    } else {
      // Rate-based series, use as-is
      return {
        seriesId,
        date: observationDate,
        value: rawValue,
        dataType: 'rate'
      };
    }
  }

  /**
   * Format economic indicator for dashboard display
   */
  formatEconomicIndicator(series: any) {
    const value = parseFloat(series.value);

    // Format based on series type
    if (['CPIAUCSL', 'CPILFESL', 'CPIENG'].includes(series.seriesId)) {
      // CPI series - show as YoY percentage
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    } else if (series.seriesId === 'PAYEMS') {
      // Payrolls - show YoY change in thousands
      return `${value >= 0 ? '+' : ''}${(value * 1000).toFixed(0)}K`;
    } else {
      // Rates - show as percentage
      return `${value.toFixed(1)}%`;
    }
  }

  /**
   * Check if a series ID is an index-based series
   */
  isIndexSeries(seriesId: string): boolean {
    return this.INDEX_SERIES.has(seriesId);
  }

  /**
   * Get all index series IDs
   */
  getIndexSeries(): string[] {
    return Array.from(this.INDEX_SERIES);
  }
}

export const economicDataTransformer = new EconomicDataTransformer();