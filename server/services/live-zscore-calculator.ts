import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import { CURATED_SERIES } from './fred-api-service-incremental';

/**
 * Economic directionality mapping for delta-adjusted z-scores
 * +1: Increase is Good (economic strength)
 * -1: Increase is Bad (economic weakness)
 */
const ECONOMIC_DIRECTIONALITY: Record<string, number> = {
  // Growth indicators (increase = good)
  'GDP Growth Rate': 1,
  'Manufacturing PMI': 1,
  'S&P Global Manufacturing PMI': 1,
  'Nonfarm Payrolls': 1,
  'Consumer Confidence Index': 1,
  'Michigan Consumer Sentiment': 1,
  'Retail Sales MoM': 1,
  'Industrial Production YoY': 1,
  'Housing Starts': 1,
  'Building Permits': 1,
  'Durable Goods Orders MoM': 1,
  'Leading Economic Index': 1,
  'Consumer Durable Goods New Orders': 1,
  'E-commerce Retail Sales': 1,
  'Real Disposable Personal Income': 1,
  'Retail Sales Ex-Auto': 1,
  'Retail Sales: Food Services': 1,
  'Average Hourly Earnings': 1,
  'Average Weekly Hours': 1,
  'Employment Population Ratio': 1,
  'JOLTS Hires': 1,
  'JOLTS Job Openings': 1,
  'Labor Force Participation Rate': 1,
  'Case-Shiller Home Price Index': 1,
  'Existing Home Sales': 1,
  'New Home Sales': 1,
  'Total Construction Spending': 1,
  'Capacity Utilization (Mfg)': 1,
  'Yield Curve (10yr-2yr)': 1,
  'Retail Sales': 1,
  'Industrial Production': 1,
  'Durable Goods Orders': 1,
  'Manufacturing Employment': 1,
  'Manufacturing Hours': 1,
  'Personal Consumption Expenditures': 1,
  'JOLTS Quits': 1,
  'Employment to Population Ratio': 1,

  // Negative indicators (increase = bad)
  'CPI Year-over-Year': -1,
  'Core CPI Year-over-Year': -1,
  'PCE Price Index YoY': -1,
  'Unemployment Rate': -1,
  'Federal Funds Rate': -1,
  '10-Year Treasury Yield': -1,
  'Personal Savings Rate': -1,
  'Continuing Jobless Claims': -1,
  'Initial Jobless Claims': -1,
  'U-6 Unemployment Rate': -1,
  'Months Supply of Homes': -1,
  'Commercial & Industrial Loans': -1,
  'CPI Energy': -1,
  'Core PCE Price Index': -1,
  'Core PPI': -1,
  'CPI All Items': -1,
  'Core CPI': -1,
  'PPI All Commodities': -1,
  'PCE Price Index': -1,
  'Inventories to Sales Ratio': -1,
  'PPI Final Demand': -1,
  'Gasoline Prices': -1,
  '30-Year Mortgage Rate': -1,

  // Neutral or context-dependent
  'US Dollar Index': 0
};

// Economic indicator frequency mapping for proper delta z-score calculations
const INDICATOR_FREQUENCY: Record<string, string> = {
  // Daily indicators
  '10-Year Treasury Yield': 'daily',
  'Yield Curve (10yr-2yr)': 'daily',
  'Federal Funds Rate': 'daily',
  'US Dollar Index': 'daily',
  '30-Year Mortgage Rate': 'daily',
  
  // Weekly indicators
  'Initial Jobless Claims': 'weekly',
  'Continuing Jobless Claims': 'weekly',
  
  // Monthly indicators (most economic data)
  'Average Weekly Hours': 'monthly',
  'Average Hourly Earnings': 'monthly',
  'Nonfarm Payrolls': 'monthly',
  'Unemployment Rate': 'monthly',
  'Labor Force Participation Rate': 'monthly',
  'Employment Population Ratio': 'monthly',
  'CPI All Items': 'monthly',
  'Core CPI': 'monthly',
  'CPI Energy': 'monthly',
  'Core PPI': 'monthly',
  'PPI All Commodities': 'monthly',
  'PCE Price Index': 'monthly',
  'Core PCE Price Index': 'monthly',
  'PPI Final Demand': 'monthly',
  'Personal Savings Rate': 'monthly',
  'Industrial Production': 'monthly',
  'Capacity Utilization (Mfg)': 'monthly',
  'Housing Starts': 'monthly',
  'New Home Sales': 'monthly',
  'Existing Home Sales': 'monthly',
  'Building Permits': 'monthly',
  'Months Supply of Homes': 'monthly',
  'Case-Shiller Home Price Index': 'monthly',
  'Retail Sales': 'monthly',
  'Retail Sales Ex-Auto': 'monthly',
  'Retail Sales: Food Services': 'monthly',
  'E-commerce Retail Sales': 'monthly',
  'Consumer Durable Goods New Orders': 'monthly',
  'Total Construction Spending': 'monthly',
  'Commercial & Industrial Loans': 'monthly',
  'Real Disposable Personal Income': 'monthly',
  'Consumer Confidence Index': 'monthly',
  'Michigan Consumer Sentiment': 'monthly',
  'JOLTS Job Openings': 'monthly',
  'JOLTS Hires': 'monthly',
  'Inventories to Sales Ratio': 'monthly',
  'Gasoline Prices': 'monthly',
  
  // Quarterly indicators
  'GDP Growth Rate': 'quarterly'
};

interface LiveZScoreData {
  seriesId: string;
  metric: string;
  currentValue: number;
  historicalMean: number;
  historicalStd: number;
  zScore: number;
  deltaAdjustedZScore: number;  // New: directionality-adjusted z-score
  priorValue: number;
  varianceFromMean: number;
  varianceFromPrior: number;
  periodDate: string;
  category: string;
  type: string;
  unit: string;
  directionality: number;  // New: +1, -1, or 0
  isUnprecedentedEvent?: boolean;  // New: flag for extreme economic events
  // Delta z-score fields
  deltaZScore: number;  // Z-score of period-to-period change
  deltaHistoricalMean: number;  // Historical mean of period changes
  deltaHistoricalStd: number;   // Historical std dev of period changes
  frequency: string;  // daily, weekly, monthly, quarterly
}

export class LiveZScoreCalculator {
  
  /**
   * Calculate live z-scores for all economic indicators
   * Ensures z-score calculations are never cached and always computed fresh
   */
  async calculateLiveZScores(): Promise<LiveZScoreData[]> {
    logger.info('🔄 Computing LIVE z-scores for RESTRICTED economic indicators (no cache)');
    
    try {
      // Create array of valid series IDs from CURATED_SERIES
      const validSeriesIds = CURATED_SERIES.map(series => series.id);
      logger.info(`📊 Processing only ${validSeriesIds.length} indicators with historical data`);
      
      // Build SQL query with series ID restriction and deduplicate by metric_name 
      const seriesIdFilter = validSeriesIds.map(id => `'${id}'`).join(',');
      const sqlQuery = `
        WITH latest_per_metric AS (
          SELECT DISTINCT
            series_id,
            metric_name,
            -- Use monthly_change for employment metrics, value for others
            CASE 
              WHEN metric_name ILIKE '%nonfarm%' OR metric_name ILIKE '%payroll%' OR metric_name ILIKE '%employment change%'
              THEN COALESCE(monthly_change, value)
              ELSE value 
            END as current_value,
            period_date,
            category,
            type,
            unit,
            ROW_NUMBER() OVER (
              PARTITION BY metric_name 
              ORDER BY period_date DESC, series_id ASC
            ) as rn
          FROM economic_indicators_history
          WHERE series_id IN (${seriesIdFilter})
            AND period_date IS NOT NULL
        ),
        
        -- Calculate period-to-period changes for delta z-score
        period_changes AS (
          SELECT 
            series_id,
            metric_name,
            value,
            period_date,
            LAG(value) OVER (PARTITION BY metric_name ORDER BY period_date) as prev_value,
            value - LAG(value) OVER (PARTITION BY metric_name ORDER BY period_date) as period_change
          FROM economic_indicators_history
          WHERE series_id IN (${seriesIdFilter})
            AND period_date IS NOT NULL
        )
        SELECT 
          series_id,
          metric_name,
          current_value,
          period_date,
          category,
          type,
          unit,
          (
            SELECT 
              CASE 
                WHEN lpm.metric_name ILIKE '%nonfarm%' OR lpm.metric_name ILIKE '%payroll%' OR lpm.metric_name ILIKE '%employment change%'
                THEN COALESCE(e2.monthly_change, e2.value)
                ELSE e2.value 
              END
            FROM economic_indicators_history e2 
            WHERE e2.metric_name = lpm.metric_name 
              AND e2.unit = lpm.unit
              AND e2.period_date < lpm.period_date 
            ORDER BY e2.period_date DESC 
            LIMIT 1
          ) as prior_value,
          
          -- Calculate historical mean from last 12 months (same metric and unit type)
          (
            SELECT AVG(
              CASE 
                WHEN lpm.metric_name ILIKE '%nonfarm%' OR lpm.metric_name ILIKE '%payroll%' OR lpm.metric_name ILIKE '%employment change%'
                THEN COALESCE(e3.monthly_change, e3.value)
                ELSE e3.value 
              END
            ) 
            FROM economic_indicators_history e3 
            WHERE e3.metric_name = lpm.metric_name 
              AND e3.unit = lpm.unit
              AND e3.period_date < lpm.period_date 
              AND e3.period_date >= lpm.period_date - INTERVAL '12 months'
          ) as historical_mean,
          
          -- Calculate historical standard deviation from last 12 months (same metric and unit type)
          (
            SELECT STDDEV(
              CASE 
                WHEN lpm.metric_name ILIKE '%nonfarm%' OR lpm.metric_name ILIKE '%payroll%' OR lpm.metric_name ILIKE '%employment change%'
                THEN COALESCE(e4.monthly_change, e4.value)
                ELSE e4.value 
              END
            ) 
            FROM economic_indicators_history e4 
            WHERE e4.metric_name = lpm.metric_name 
              AND e4.unit = lpm.unit
              AND e4.period_date < lpm.period_date 
              AND e4.period_date >= lpm.period_date - INTERVAL '12 months'
          ) as historical_std,
          
          -- Calculate current period change (for delta z-score)
          (
            SELECT 
              lpm.current_value - COALESCE(
                (SELECT 
                  CASE 
                    WHEN lpm.metric_name ILIKE '%nonfarm%' OR lpm.metric_name ILIKE '%payroll%' OR lpm.metric_name ILIKE '%employment change%'
                    THEN COALESCE(e5.monthly_change, e5.value)
                    ELSE e5.value 
                  END
                 FROM economic_indicators_history e5 
                 WHERE e5.metric_name = lpm.metric_name 
                   AND e5.unit = lpm.unit
                   AND e5.period_date < lpm.period_date 
                 ORDER BY e5.period_date DESC 
                 LIMIT 1), 0)
          ) as current_period_change,
          
          -- Calculate historical mean of period changes
          (
            SELECT AVG(pc.period_change) 
            FROM period_changes pc 
            WHERE pc.metric_name = lpm.metric_name 
              AND pc.period_change IS NOT NULL
              AND pc.period_date < lpm.period_date 
              AND pc.period_date >= lpm.period_date - INTERVAL '12 months'
          ) as delta_historical_mean,
          
          -- Calculate historical standard deviation of period changes
          (
            SELECT STDDEV(pc.period_change) 
            FROM period_changes pc 
            WHERE pc.metric_name = lpm.metric_name 
              AND pc.period_change IS NOT NULL
              AND pc.period_date < lpm.period_date 
              AND pc.period_date >= lpm.period_date - INTERVAL '12 months'
          ) as delta_historical_std
          
        FROM latest_per_metric lpm
        WHERE rn = 1
        ORDER BY metric_name
      `;
      
      const zScoreData = await db.execute(sql.raw(sqlQuery));

      const results: LiveZScoreData[] = zScoreData.rows.map((row: any) => {
        const currentValue = parseFloat(row.current_value) || 0;
        const historicalMean = parseFloat(row.historical_mean) || 0;
        const historicalStd = parseFloat(row.historical_std) || 0;
        const priorValue = parseFloat(row.prior_value) || 0;
        
        // Calculate z-score live
        const rawZScore = (historicalStd > 0 && historicalMean !== null) 
          ? (currentValue - historicalMean) / historicalStd 
          : 0;
        
        // Flag unprecedented economic events instead of arbitrary capping
        // Values beyond ±5 are statistically extreme (99.9999% confidence)
        let zScore = rawZScore;
        let isUnprecedentedEvent = false;
        
        if (Math.abs(rawZScore) > 5) {
          isUnprecedentedEvent = true;
          logger.warn(`📊 Unprecedented economic event detected for ${row.metric_name}: z-score ${rawZScore.toFixed(2)}`);
          // Cap at ±5 for display consistency while flagging as unprecedented
          zScore = Math.sign(rawZScore) * 5;
        }
        
        // Calculate variances live
        const varianceFromMean = currentValue - historicalMean;
        const varianceFromPrior = currentValue - priorValue;
        
        // Apply economic directionality for delta-adjusted z-score
        const directionality = ECONOMIC_DIRECTIONALITY[row.metric_name] || 1; // Default to positive
        const deltaAdjustedZScore = zScore * directionality;
        
        // Delta z-score calculation for period-to-period changes
        const currentPeriodChange = parseFloat(row.current_period_change) || 0;
        const deltaHistoricalMean = parseFloat(row.delta_historical_mean) || 0;
        const deltaHistoricalStd = parseFloat(row.delta_historical_std) || 0;
        
        // Calculate delta z-score with statistical validation
        const rawDeltaZScore = (deltaHistoricalStd > 0 && deltaHistoricalMean !== null) 
          ? (currentPeriodChange - deltaHistoricalMean) / deltaHistoricalStd 
          : 0;
        
        // Apply same unprecedented event logic to delta z-scores
        let deltaZScore = rawDeltaZScore;
        let isDeltaUnprecedentedEvent = false;
        
        if (Math.abs(rawDeltaZScore) > 5) {
          isDeltaUnprecedentedEvent = true;
          logger.warn(`📊 Unprecedented period change detected for ${row.metric_name}: delta z-score ${rawDeltaZScore.toFixed(2)}`);
          // Cap at ±5 for display consistency while flagging as unprecedented
          deltaZScore = Math.sign(rawDeltaZScore) * 5;
        }
        
        // Get frequency for this indicator
        const frequency = INDICATOR_FREQUENCY[row.metric_name] || 'monthly';
        
        return {
          seriesId: row.series_id,
          metric: row.metric_name,
          currentValue,
          historicalMean,
          historicalStd,
          zScore,
          deltaAdjustedZScore: zScore * directionality,
          priorValue,
          varianceFromMean,
          varianceFromPrior,
          periodDate: row.period_date,
          category: row.category,
          type: row.type,
          unit: row.unit,
          directionality,
          isUnprecedentedEvent: isUnprecedentedEvent || isDeltaUnprecedentedEvent,
          // Delta z-score fields
          deltaZScore,
          deltaHistoricalMean,
          deltaHistoricalStd,
          frequency
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
      logger.error('❌ Failed to calculate live z-scores:', String(error));
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