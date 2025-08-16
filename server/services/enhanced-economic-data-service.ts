/**
 * Enhanced Economic Data Service for FinanceHub Pro v30
 * Leverages the new 3-layer economic data model with 76,441 historical records
 * Provides YoY transformations and real-time economic indicator processing
 */

import { db } from '../db';
import { sql, eq, desc, and, gte } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import { EconomicUnitFormatter } from '../../shared/formatters/economic-unit-formatter';

interface EconomicIndicatorResult {
  metric: string;
  type: string;
  category: string;
  currentReading: string;
  priorReading: string;
  changeDirection: 'up' | 'down' | 'flat';
  varianceFromNorm: number;
  period_date: string;
  releaseDate: string;
  significance: 'high' | 'medium' | 'low';
  unit: string;
  transform: string;
}

/**
 * Calculates YoY percentage change for index-based series
 */
async function calculateYoYChange(seriesId: string, currentValue: number, currentDate: string): Promise<number | null> {
  try {
    // Get value from 12 months ago
    const oneYearAgo = new Date(currentDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const priorData = await db.execute(sql`
      SELECT value_std as value
      FROM econ_series_observation
      WHERE series_id = ${seriesId}
        AND period_end >= ${oneYearAgo.toISOString().split('T')[0]}
      ORDER BY period_end
      LIMIT 1
    `);

    if (priorData.rows.length === 0) {
      return null;
    }

    const priorValue = priorData.rows[0].value;
    const yoyChange = ((currentValue - priorValue) / priorValue) * 100;
    
    return yoyChange;
  } catch (error) {
    logger.error(`Error calculating YoY change for ${seriesId}:`, error);
    return null;
  }
}

/**
 * Formats economic indicator value using centralized formatter
 */
function formatIndicatorValue(value: number, standardUnit: string, scaleHint: string, displayPrecision: number, yoyChange?: number | null, transformCode?: string): string {
  return EconomicUnitFormatter.formatValue({
    value,
    standardUnit,
    scaleHint: scaleHint || 'NONE',
    displayPrecision,
    transformCode,
    yoyChange
  });
}

/**
 * Gets enhanced economic indicators using the new 3-layer data model
 */
export async function getEnhancedEconomicIndicators(): Promise<EconomicIndicatorResult[]> {
  try {
    logger.info('Fetching enhanced economic indicators from 3-layer model');
    
    // Get current data for critical indicators
    const criticalSeries = [
      'CPIAUCSL',   // CPI
      'PPIACO',     // PPI
      'UNRATE',     // Unemployment Rate
      'DFF',        // Federal Funds Rate
      'DGS10',      // 10-Year Treasury
      'ICSA',       // Initial Claims
      'PAYEMS',     // Nonfarm Payrolls
      'INDPRO',     // Industrial Production
      'HOUST',      // Housing Starts
      'UMCSENT'     // Consumer Sentiment
    ];
    
    const indicators: EconomicIndicatorResult[] = [];
    
    for (const seriesId of criticalSeries) {
      try {
        // Get latest observation using existing schema
        const latestData = await db.execute(sql`
          SELECT 
            e.value_std as value,
            e.period_end as period_end,
            e.standard_unit,
            e.scale_hint,
            e.display_precision,
            e.transform_code,
            d.display_name,
            d.category,
            d.type_tag,
            d.default_transform
          FROM econ_series_observation e
          INNER JOIN econ_series_def d ON e.series_id = d.series_id
          WHERE e.series_id = ${seriesId}
          ORDER BY e.period_end DESC
          LIMIT 2
        `);
        
        if (latestData.rows.length === 0) {
          logger.warn(`No data found for series: ${seriesId}`);
          continue;
        }
        
        const current = latestData.rows[0];
        const prior = latestData.rows[1];
        
        // Calculate YoY change for inflation indicators
        let yoyChange: number | null = null;
        if (current.standard_unit === 'INDEX_PT' && current.default_transform === 'YOY') {
          yoyChange = await calculateYoYChange(seriesId, current.value, current.period_end);
        }
        
        // Format current and prior readings
        const currentReading = formatIndicatorValue(
          current.value,
          current.standard_unit,
          current.scale_hint,
          current.display_precision,
          yoyChange
        );
        
        const priorReading = prior ? formatIndicatorValue(
          prior.value,
          prior.standard_unit,
          prior.scale_hint,
          prior.display_precision
        ) : 'N/A';
        
        // Determine change direction
        let changeDirection: 'up' | 'down' | 'flat' = 'flat';
        if (prior) {
          if (current.value > prior.value) changeDirection = 'up';
          else if (current.value < prior.value) changeDirection = 'down';
        }
        
        // Calculate variance from norm (simplified)
        const varianceFromNorm = prior ? ((current.value - prior.value) / prior.value) * 100 : 0;
        
        // Determine significance
        let significance: 'high' | 'medium' | 'low' = 'medium';
        if (['CPIAUCSL', 'UNRATE', 'DFF'].includes(seriesId)) significance = 'high';
        else if (['DGS10', 'PAYEMS'].includes(seriesId)) significance = 'medium';
        else significance = 'low';
        
        // Create release date (next business day after period end)
        const releaseDate = new Date(current.period_end);
        releaseDate.setDate(releaseDate.getDate() + 1);
        
        indicators.push({
          metric: current.display_name,
          type: current.type_tag,
          category: current.category,
          currentReading,
          priorReading,
          changeDirection,
          varianceFromNorm: Number(varianceFromNorm.toFixed(2)),
          period_date: current.period_end,
          releaseDate: releaseDate.toISOString().split('T')[0],
          significance,
          unit: current.standard_unit,
          transform: current.transform_code
        });
        
      } catch (seriesError) {
        logger.error(`Error processing series ${seriesId}:`, seriesError);
      }
    }
    
    logger.info(`Enhanced economic indicators fetched successfully: ${indicators.length} indicators`);
    return indicators;
    
  } catch (error) {
    logger.error('Error fetching enhanced economic indicators:', error);
    throw error;
  }
}

/**
 * Gets historical data for z-score calculations
 */
export async function getHistoricalDataForZScore(seriesId: string, months: number = 60): Promise<Array<{ value: number; date: string }>> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    const historicalData = await db.execute(sql`
      SELECT value_std as value, period_end as date
      FROM econ_series_observation
      WHERE series_id = ${seriesId}
        AND period_end >= ${cutoffDate.toISOString().split('T')[0]}
      ORDER BY period_end DESC
    `);
    
    return historicalData.rows;
  } catch (error) {
    logger.error(`Error fetching historical data for ${seriesId}:`, error);
    return [];
  }
}

/**
 * Gets economic data summary statistics
 */
export async function getEconomicDataSummary(): Promise<{
  totalRecords: number;
  uniqueSeries: number;
  dateRange: { earliest: string; latest: string };
  criticalSeriesStatus: Array<{ seriesId: string; recordCount: number; isReady: boolean }>;
}> {
  try {
    // Get total records and unique series
    const summary = await db.execute(sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT series_id) as unique_series,
        MIN(period_end) as earliest_date,
        MAX(period_end) as latest_date
      FROM econ_series_observation
    `);
    
    // Check critical series status
    const criticalSeries = ['CPIAUCSL', 'UNRATE', 'DFF', 'DGS10', 'ICSA', 'PAYEMS'];
    const criticalSeriesStatus = [];
    
    for (const seriesId of criticalSeries) {
      const count = await db.execute(sql`
        SELECT COUNT(*) as record_count
        FROM econ_series_observation
        WHERE series_id = ${seriesId}
          AND period_end >= CURRENT_DATE - INTERVAL '72 months'
      `);
      
      const recordCount = Number(count.rows[0]?.record_count || 0);
      criticalSeriesStatus.push({
        seriesId,
        recordCount,
        isReady: recordCount >= 60
      });
    }
    
    const result = summary.rows[0];
    return {
      totalRecords: Number(result?.total_records || 0),
      uniqueSeries: Number(result?.unique_series || 0),
      dateRange: {
        earliest: result?.earliest_date || '',
        latest: result?.latest_date || ''
      },
      criticalSeriesStatus
    };
    
  } catch (error) {
    logger.error('Error getting economic data summary:', error);
    throw error;
  }
}