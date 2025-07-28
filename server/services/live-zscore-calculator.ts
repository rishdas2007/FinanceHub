import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

interface LiveZScoreData {
  seriesId: string;
  metric: string;
  currentValue: number;
  historicalMean: number;
  historicalStd: number;
  zScore: number;
  priorValue: number;
  varianceFromMean: number;
  varianceFromPrior: number;
  periodDate: string;
  category: string;
  type: string;
  unit: string;
}

export class LiveZScoreCalculator {
  
  /**
   * Calculate live z-scores for all economic indicators
   * Ensures z-score calculations are never cached and always computed fresh
   */
  async calculateLiveZScores(): Promise<LiveZScoreData[]> {
    logger.info('🔄 Computing LIVE z-scores for all economic indicators (no cache)');
    
    try {
      // Direct query without CTE for better SQL compatibility
      const zScoreData = await db.execute(sql`
        SELECT DISTINCT
          series_id,
          metric_name,
          value as current_value,
          period_date,
          category,
          type,
          unit,
          (
            SELECT value 
            FROM economic_indicators_history e2 
            WHERE e2.series_id = e1.series_id 
              AND e2.period_date < e1.period_date 
            ORDER BY e2.period_date DESC 
            LIMIT 1
          ) as prior_value,
          
          -- Calculate historical mean from last 18 months
          (
            SELECT AVG(value) 
            FROM economic_indicators_history e3 
            WHERE e3.series_id = e1.series_id 
              AND e3.period_date < e1.period_date 
              AND e3.period_date >= e1.period_date - INTERVAL '18 months'
          ) as historical_mean,
          
          -- Calculate historical standard deviation from last 18 months
          (
            SELECT STDDEV(value) 
            FROM economic_indicators_history e4 
            WHERE e4.series_id = e1.series_id 
              AND e4.period_date < e1.period_date 
              AND e4.period_date >= e1.period_date - INTERVAL '18 months'
          ) as historical_std
          
        FROM economic_indicators_history e1
        WHERE e1.period_date = (
          SELECT MAX(period_date) 
          FROM economic_indicators_history e5 
          WHERE e5.series_id = e1.series_id
        )
        ORDER BY e1.series_id
      `);

      const results: LiveZScoreData[] = zScoreData.rows.map((row: any) => {
        const currentValue = parseFloat(row.current_value) || 0;
        const historicalMean = parseFloat(row.historical_mean) || 0;
        const historicalStd = parseFloat(row.historical_std) || 0;
        const priorValue = parseFloat(row.prior_value) || 0;
        
        // Calculate z-score live
        const zScore = (historicalStd > 0 && historicalMean !== null) 
          ? (currentValue - historicalMean) / historicalStd 
          : 0;
        
        // Calculate variances live
        const varianceFromMean = currentValue - historicalMean;
        const varianceFromPrior = currentValue - priorValue;
        
        return {
          seriesId: row.series_id,
          metric: row.metric_name,
          currentValue,
          historicalMean,
          historicalStd,
          zScore,
          priorValue,
          varianceFromMean,
          varianceFromPrior,
          periodDate: row.period_date,
          category: row.category,
          type: row.type,
          unit: row.unit
        };
      });

      logger.info(`✅ Calculated ${results.length} live z-scores`);
      
      // Log a few examples for verification
      const significantAlerts = results.filter(r => Math.abs(r.zScore) > 0.5);
      logger.info(`📊 Found ${significantAlerts.length} indicators with |z-score| > 0.5`);
      
      significantAlerts.slice(0, 5).forEach(alert => {
        logger.info(`📈 ${alert.metric}: z-score=${alert.zScore.toFixed(2)}, current=${alert.currentValue.toFixed(1)}, mean=${alert.historicalMean.toFixed(1)}, variance_from_mean=${alert.varianceFromMean.toFixed(1)}`);
      });

      return results;

    } catch (error) {
      logger.error('❌ Failed to calculate live z-scores:', error);
      return [];
    }
  }

  /**
   * Get z-score explanation for a specific metric
   */
  getZScoreExplanation(zScoreData: LiveZScoreData): string {
    const absZScore = Math.abs(zScoreData.zScore);
    const direction = zScoreData.zScore > 0 ? 'above' : 'below';
    const significance = absZScore > 2 ? 'highly significant' : 
                        absZScore > 1 ? 'significant' : 'moderate';
    
    return `${zScoreData.metric} is ${absZScore.toFixed(2)} standard deviations ${direction} its 18-month historical mean (${significance} deviation)`;
  }

  /**
   * Format variance consistently with z-score methodology
   */
  formatVarianceConsistent(zScoreData: LiveZScoreData, useVarianceFromMean: boolean = true): string {
    const variance = useVarianceFromMean ? zScoreData.varianceFromMean : zScoreData.varianceFromPrior;
    const unit = zScoreData.unit;
    
    // Format based on unit type
    const formatNumber = (value: number): string => {
      if (Math.abs(value) < 0.01) return '0.0';
      
      switch (unit) {
        case 'percent':
          return value.toFixed(1) + '%';
        case 'thousands':
          return (value / 1000).toFixed(1) + 'K';
        case 'millions_dollars':
          return '$' + value.toFixed(1) + 'M';
        case 'billions_dollars':
          return '$' + value.toFixed(2) + 'B';
        case 'index':
          return value.toFixed(1);
        default:
          return value.toFixed(1);
      }
    };

    const formatted = formatNumber(Math.abs(variance));
    return variance < 0 ? `(${formatted})` : formatted;
  }
}

export const liveZScoreCalculator = new LiveZScoreCalculator();