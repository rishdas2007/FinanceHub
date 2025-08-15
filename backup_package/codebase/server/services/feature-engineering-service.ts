import { logger } from '../../shared/utils/logger';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { dataLineageTracker } from './data-lineage-tracker';

/**
 * PHASE 3: Advanced Feature Engineering Service
 * Implements YoY, MoM, seasonal adjustment, and trend analysis
 */

export interface EnhancedMetric {
  seriesId: string;
  metricName: string;
  currentValue: number;
  previousValue: number;
  yearAgoValue: number;
  monthOverMonth: number;
  yearOverYear: number;
  seasonallyAdjusted: number;
  trendComponent: number;
  volatility: number;
  zScore: number;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

export interface SeasonalPattern {
  month: number;
  seasonalFactor: number;
  historicalAverage: number;
  volatility: number;
}

export class FeatureEngineeringService {
  
  /**
   * Generate enhanced metrics with YoY, MoM, and seasonal adjustments
   */
  async generateEnhancedMetrics(): Promise<EnhancedMetric[]> {
    const startTime = Date.now();
    logger.info('🔧 Starting advanced feature engineering');
    
    try {
      // Get series with sufficient historical data (at least 24 months for YoY)
      const seriesData = await db.execute(sql`
        WITH series_stats AS (
          SELECT 
            series_id,
            metric_name,
            COUNT(*) as record_count,
            MIN(period_date) as earliest_date,
            MAX(period_date) as latest_date
          FROM economic_indicators_history 
          GROUP BY series_id, metric_name
          HAVING COUNT(*) >= 24
        )
        SELECT * FROM series_stats
        ORDER BY record_count DESC
      `);
      
      const enhancedMetrics: EnhancedMetric[] = [];
      
      for (const series of seriesData.rows) {
        try {
          const seriesId = series.series_id as string;
          const metricName = series.metric_name as string;
          
          const enhancedMetric = await this.calculateEnhancedMetric(seriesId, metricName);
          if (enhancedMetric) {
            enhancedMetrics.push(enhancedMetric);
            
            // Track feature engineering lineage
            await dataLineageTracker.trackCalculation(
              seriesId,
              'feature_engineering',
              enhancedMetric.currentValue,
              enhancedMetric.seasonallyAdjusted,
              {
                monthOverMonth: enhancedMetric.monthOverMonth,
                yearOverYear: enhancedMetric.yearOverYear,
                trendComponent: enhancedMetric.trendComponent,
                volatility: enhancedMetric.volatility,
                confidence: enhancedMetric.confidence
              },
              Date.now() - startTime
            );
          }
          
        } catch (error) {
          logger.error(`Failed to process series ${series.series_id}:`, error);
        }
      }
      
      const processingTime = Date.now() - startTime;
      logger.info(`✅ Feature engineering completed: ${enhancedMetrics.length} enhanced metrics in ${processingTime}ms`);
      
      return enhancedMetrics;
      
    } catch (error) {
      logger.error('Feature engineering failed:', error);
      throw error;
    }
  }
  
  /**
   * Calculate enhanced metric for a single series
   */
  private async calculateEnhancedMetric(seriesId: string, metricName: string): Promise<EnhancedMetric | null> {
    try {
      // Get chronological data for the series
      const timeSeriesData = await db.execute(sql`
        SELECT 
          value,
          period_date,
          EXTRACT(MONTH FROM period_date) as month
        FROM economic_indicators_history 
        WHERE series_id = ${seriesId}
        ORDER BY period_date DESC
        LIMIT 36
      `);
      
      const data = timeSeriesData.rows.map((row: any) => ({
        value: parseFloat(row.value),
        date: new Date(row.period_date),
        month: parseInt(row.month)
      })).filter(d => !isNaN(d.value));
      
      if (data.length < 24) {
        return null; // Need at least 24 months for reliable calculations
      }
      
      const currentValue = data[0].value;
      const previousValue = data[1]?.value || currentValue;
      const yearAgoValue = data[12]?.value || currentValue;
      
      // Calculate percentage changes
      const monthOverMonth = previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
      const yearOverYear = yearAgoValue !== 0 ? ((currentValue - yearAgoValue) / yearAgoValue) * 100 : 0;
      
      // Calculate seasonal adjustment
      const seasonalPatterns = this.calculateSeasonalPatterns(data);
      const currentMonthPattern = seasonalPatterns.find(p => p.month === data[0].month);
      const seasonallyAdjusted = currentMonthPattern ? 
        currentValue / currentMonthPattern.seasonalFactor : currentValue;
      
      // Calculate trend component using moving average
      const trendWindow = Math.min(12, data.length);
      const recentValues = data.slice(0, trendWindow).map(d => d.value);
      const trendComponent = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Calculate volatility (standard deviation of recent changes)
      const changes = [];
      for (let i = 1; i < Math.min(13, data.length); i++) {
        if (data[i].value !== 0) {
          changes.push(((data[i-1].value - data[i].value) / data[i].value) * 100);
        }
      }
      const volatility = changes.length > 0 ? this.calculateStandardDeviation(changes) : 0;
      
      // Calculate z-score for current value
      const allValues = data.map(d => d.value);
      const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
      const stdDev = this.calculateStandardDeviation(allValues);
      const zScore = stdDev !== 0 ? (currentValue - mean) / stdDev : 0;
      
      // Determine confidence based on data quality
      const confidence = this.determineConfidence(data.length, volatility, stdDev);
      
      return {
        seriesId,
        metricName,
        currentValue,
        previousValue,
        yearAgoValue,
        monthOverMonth: Math.round(monthOverMonth * 100) / 100,
        yearOverYear: Math.round(yearOverYear * 100) / 100,
        seasonallyAdjusted: Math.round(seasonallyAdjusted * 1000) / 1000,
        trendComponent: Math.round(trendComponent * 1000) / 1000,
        volatility: Math.round(volatility * 100) / 100,
        zScore: Math.round(zScore * 1000) / 1000,
        confidence,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Failed to calculate enhanced metric for ${seriesId}:`, error);
      return null;
    }
  }
  
  /**
   * Calculate seasonal patterns for a time series
   */
  private calculateSeasonalPatterns(data: Array<{value: number, date: Date, month: number}>): SeasonalPattern[] {
    const monthlyData: Record<number, number[]> = {};
    
    // Group data by month
    data.forEach(point => {
      if (!monthlyData[point.month]) {
        monthlyData[point.month] = [];
      }
      monthlyData[point.month].push(point.value);
    });
    
    // Calculate overall average
    const overallAverage = data.reduce((sum, point) => sum + point.value, 0) / data.length;
    
    // Calculate seasonal factors for each month
    const patterns: SeasonalPattern[] = [];
    
    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyData[month] || [];
      
      if (monthData.length > 0) {
        const monthAverage = monthData.reduce((sum, val) => sum + val, 0) / monthData.length;
        const seasonalFactor = overallAverage !== 0 ? monthAverage / overallAverage : 1;
        const volatility = monthData.length > 1 ? this.calculateStandardDeviation(monthData) : 0;
        
        patterns.push({
          month,
          seasonalFactor,
          historicalAverage: monthAverage,
          volatility
        });
      } else {
        // Default pattern for months with no data
        patterns.push({
          month,
          seasonalFactor: 1,
          historicalAverage: overallAverage,
          volatility: 0
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Determine confidence level based on data quality metrics
   */
  private determineConfidence(dataPoints: number, volatility: number, stdDev: number): 'high' | 'medium' | 'low' {
    let score = 0;
    
    // Data points factor (more data = higher confidence)
    if (dataPoints >= 36) score += 40;
    else if (dataPoints >= 24) score += 30;
    else if (dataPoints >= 12) score += 20;
    else score += 10;
    
    // Volatility factor (lower volatility = higher confidence)
    if (volatility < 2) score += 30;
    else if (volatility < 5) score += 20;
    else if (volatility < 10) score += 10;
    else score += 5;
    
    // Standard deviation factor (consistent data = higher confidence)
    if (stdDev < 1) score += 30;
    else if (stdDev < 5) score += 20;
    else if (stdDev < 10) score += 10;
    else score += 5;
    
    if (score >= 80) return 'high';
    else if (score >= 60) return 'medium';
    else return 'low';
  }
  
  /**
   * Get seasonal adjustment factors for all series
   */
  async getSeasonalAdjustments(): Promise<Record<string, SeasonalPattern[]>> {
    try {
      const seriesList = await db.execute(sql`
        SELECT DISTINCT series_id, metric_name
        FROM economic_indicators_history
        WHERE series_id IN (
          SELECT series_id 
          FROM economic_indicators_history 
          GROUP BY series_id 
          HAVING COUNT(*) >= 24
        )
      `);
      
      const seasonalAdjustments: Record<string, SeasonalPattern[]> = {};
      
      for (const series of seriesList.rows) {
        const seriesId = series.series_id as string;
        
        const timeSeriesData = await db.execute(sql`
          SELECT 
            value,
            period_date,
            EXTRACT(MONTH FROM period_date) as month
          FROM economic_indicators_history 
          WHERE series_id = ${seriesId}
          ORDER BY period_date DESC
          LIMIT 36
        `);
        
        const data = timeSeriesData.rows.map((row: any) => ({
          value: parseFloat(row.value),
          date: new Date(row.period_date),
          month: parseInt(row.month)
        })).filter(d => !isNaN(d.value));
        
        if (data.length >= 24) {
          seasonalAdjustments[seriesId] = this.calculateSeasonalPatterns(data);
        }
      }
      
      return seasonalAdjustments;
      
    } catch (error) {
      logger.error('Failed to calculate seasonal adjustments:', error);
      throw error;
    }
  }
}

export const featureEngineeringService = new FeatureEngineeringService();