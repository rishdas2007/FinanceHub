import { db } from '../db';
import { economicCalendar, econDerivedMetrics, type InsertEconDerivedMetrics } from '../../shared/schema';
import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

/**
 * Economic Metrics Calculator Service
 * Transforms raw economic data into investment-relevant metrics
 */

interface TimeSeriesDataPoint {
  periodDate: Date;
  actualValue: number;
  seriesId: string;
  frequency: string;
  unit: string;
}

interface CalculationResult {
  yoyGrowth?: number;
  qoqAnnualized?: number;
  momAnnualized?: number;
  yoy3yrAvg?: number;
  ma3m?: number;
  ma6m?: number;
  ma12m?: number;
  volatility3m?: number;
  volatility12m?: number;
  trendSlope?: number;
  percentileRank1y?: number;
  percentileRank5y?: number;
  percentileRank10y?: number;
  investmentSignal?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalStrength?: number;
  calculationConfidence?: number;
}

export class EconomicMetricsCalculator {
  private readonly PIPELINE_VERSION = 'v2.0-investment-grade';

  /**
   * Calculate year-over-year growth rate
   */
  private calculateYoYGrowth(current: number, yearAgo: number): number | null {
    if (!yearAgo || yearAgo === 0) return null;
    return ((current - yearAgo) / Math.abs(yearAgo)) * 100;
  }

  /**
   * Calculate quarter-over-quarter annualized growth rate
   */
  private calculateQoQAnnualized(current: number, quarterAgo: number): number | null {
    if (!quarterAgo || quarterAgo === 0) return null;
    const qoqRate = ((current - quarterAgo) / Math.abs(quarterAgo));
    return (Math.pow(1 + qoqRate, 4) - 1) * 100; // Annualized
  }

  /**
   * Calculate month-over-month annualized growth rate  
   */
  private calculateMoMAnnualized(current: number, monthAgo: number): number | null {
    if (!monthAgo || monthAgo === 0) return null;
    const momRate = ((current - monthAgo) / Math.abs(monthAgo));
    return (Math.pow(1 + momRate, 12) - 1) * 100; // Annualized
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(values: number[], periods: number): number | null {
    if (values.length < periods) return null;
    const relevantValues = values.slice(-periods);
    return relevantValues.reduce((sum, val) => sum + val, 0) / relevantValues.length;
  }

  /**
   * Calculate volatility (standard deviation) 
   */
  private calculateVolatility(values: number[], periods: number): number | null {
    if (values.length < periods) return null;
    
    const relevantValues = values.slice(-periods);
    const mean = relevantValues.reduce((sum, val) => sum + val, 0) / relevantValues.length;
    
    const variance = relevantValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (relevantValues.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile ranking over a given period
   */
  private calculatePercentileRank(currentValue: number, historicalValues: number[]): number | null {
    if (historicalValues.length < 10) return null; // Need sufficient data
    
    const sortedValues = [...historicalValues].sort((a, b) => a - b);
    const rank = sortedValues.filter(val => val <= currentValue).length;
    return (rank / sortedValues.length) * 100;
  }

  /**
   * Calculate linear trend slope using least squares regression
   */
  private calculateTrendSlope(values: number[], periods: number): number | null {
    if (values.length < periods) return null;
    
    const relevantValues = values.slice(-periods);
    const n = relevantValues.length;
    const xSum = (n * (n - 1)) / 2; // Sum of x values (0, 1, 2, ...)
    const ySum = relevantValues.reduce((sum, val) => sum + val, 0);
    const xySum = relevantValues.reduce((sum, val, idx) => sum + (val * idx), 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of x² values
    
    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    return slope;
  }

  /**
   * Determine investment signal based on multiple factors
   */
  private determineInvestmentSignal(
    yoyGrowth: number | null,
    trend: number | null,
    percentile1y: number | null,
    volatility: number | null
  ): { signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL', strength: number } {
    let score = 0;
    let factors = 0;

    // YoY Growth component
    if (yoyGrowth !== null) {
      if (yoyGrowth > 3) score += 2;
      else if (yoyGrowth > 0) score += 1;
      else if (yoyGrowth < -2) score -= 2;
      else score -= 1;
      factors++;
    }

    // Trend component
    if (trend !== null) {
      if (trend > 0.1) score += 1;
      else if (trend < -0.1) score -= 1;
      factors++;
    }

    // Percentile ranking component
    if (percentile1y !== null) {
      if (percentile1y > 80) score += 1;
      else if (percentile1y < 20) score -= 1;
      factors++;
    }

    // Volatility component (high volatility = caution)
    if (volatility !== null) {
      // This is context-dependent, but generally high volatility = bearish
      // Normalize volatility impact based on historical context
      factors++; // Count as factor but don't adjust score without more context
    }

    if (factors === 0) return { signal: 'NEUTRAL', strength: 0 };

    const normalizedScore = score / factors;
    const strength = Math.min(Math.abs(normalizedScore), 1);

    if (normalizedScore > 0.3) return { signal: 'BULLISH', strength };
    else if (normalizedScore < -0.3) return { signal: 'BEARISH', strength };
    else return { signal: 'NEUTRAL', strength };
  }

  /**
   * Get historical data points for a series
   */
  private async getHistoricalData(seriesId: string, limitYears: number = 10): Promise<TimeSeriesDataPoint[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - limitYears);

      const results = await db
        .select({
          periodDate: economicCalendar.periodDate,
          actualValue: economicCalendar.actualValue,
          seriesId: economicCalendar.seriesId,
          frequency: economicCalendar.frequency,
          unit: economicCalendar.unit,
        })
        .from(economicCalendar)
        .where(
          and(
            eq(economicCalendar.seriesId, seriesId),
            sql`period_date >= ${cutoffDate.toISOString()}`
          )
        )
        .orderBy(asc(economicCalendar.periodDate));

      return results.map(row => ({
        periodDate: new Date(row.periodDate),
        actualValue: parseFloat(row.actualValue),
        seriesId: row.seriesId,
        frequency: row.frequency,
        unit: row.unit,
      }));
    } catch (error) {
      logger.error(`Failed to get historical data for ${seriesId}:`, error);
      return [];
    }
  }

  /**
   * Calculate all investment metrics for a specific data point
   */
  private calculateInvestmentMetrics(
    dataPoints: TimeSeriesDataPoint[],
    currentIndex: number
  ): CalculationResult {
    if (currentIndex < 0 || currentIndex >= dataPoints.length) {
      return { calculationConfidence: 0 };
    }

    const current = dataPoints[currentIndex];
    const values = dataPoints.slice(0, currentIndex + 1).map(dp => dp.actualValue);
    const currentValue = current.actualValue;

    // Calculate growth rates
    let yoyGrowth: number | null = null;
    let qoqAnnualized: number | null = null;
    let momAnnualized: number | null = null;

    // Find year-ago, quarter-ago, month-ago values
    const yearAgoIndex = dataPoints.findIndex(dp => {
      const timeDiff = current.periodDate.getTime() - dp.periodDate.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      return daysDiff >= 350 && daysDiff <= 380; // ~1 year ago
    });

    if (yearAgoIndex >= 0) {
      yoyGrowth = this.calculateYoYGrowth(currentValue, dataPoints[yearAgoIndex].actualValue);
    }

    // For quarterly data
    if (current.frequency === 'quarterly' && currentIndex >= 1) {
      qoqAnnualized = this.calculateQoQAnnualized(currentValue, dataPoints[currentIndex - 1].actualValue);
    }

    // For monthly data  
    if (current.frequency === 'monthly' && currentIndex >= 1) {
      momAnnualized = this.calculateMoMAnnualized(currentValue, dataPoints[currentIndex - 1].actualValue);
    }

    // Calculate 3-year average YoY growth
    let yoy3yrAvg: number | null = null;
    if (values.length >= 36) { // 3 years of monthly data
      const recentYoyGrowths: number[] = [];
      for (let i = Math.max(12, values.length - 36); i < values.length; i++) {
        const currentVal = values[i];
        const yearAgoVal = values[i - 12];
        if (yearAgoVal && currentVal) {
          const yoyRate = this.calculateYoYGrowth(currentVal, yearAgoVal);
          if (yoyRate !== null) recentYoyGrowths.push(yoyRate);
        }
      }
      if (recentYoyGrowths.length > 0) {
        yoy3yrAvg = recentYoyGrowths.reduce((sum, val) => sum + val, 0) / recentYoyGrowths.length;
      }
    }

    // Calculate moving averages
    const ma3m = this.calculateMovingAverage(values, 3);
    const ma6m = this.calculateMovingAverage(values, 6);
    const ma12m = this.calculateMovingAverage(values, 12);

    // Calculate volatility measures
    const volatility3m = this.calculateVolatility(values, 3);
    const volatility12m = this.calculateVolatility(values, 12);

    // Calculate trend slope
    const trendSlope = this.calculateTrendSlope(values, 12);

    // Calculate percentile rankings
    const percentileRank1y = this.calculatePercentileRank(currentValue, values.slice(-12));
    const percentileRank5y = this.calculatePercentileRank(currentValue, values.slice(-60));
    const percentileRank10y = this.calculatePercentileRank(currentValue, values);

    // Determine investment signal
    const { signal: investmentSignal, strength: signalStrength } = this.determineInvestmentSignal(
      yoyGrowth,
      trendSlope,
      percentileRank1y,
      volatility12m
    );

    // Calculate confidence score based on data availability
    let confidenceFactors = 0;
    let availableFactors = 0;

    [yoyGrowth, ma12m, volatility12m, percentileRank1y, trendSlope].forEach(metric => {
      availableFactors++;
      if (metric !== null) confidenceFactors++;
    });

    const calculationConfidence = availableFactors > 0 ? confidenceFactors / availableFactors : 0;

    return {
      yoyGrowth,
      qoqAnnualized,
      momAnnualized,
      yoy3yrAvg,
      ma3m,
      ma6m,
      ma12m,
      volatility3m,
      volatility12m,
      trendSlope,
      percentileRank1y,
      percentileRank5y,
      percentileRank10y,
      investmentSignal,
      signalStrength,
      calculationConfidence,
    };
  }

  /**
   * Process and calculate derived metrics for a specific series
   */
  async calculateDerivedMetrics(seriesId: string): Promise<void> {
    try {
      logger.info(`🧮 Calculating derived metrics for series: ${seriesId}`);

      // Get historical data
      const dataPoints = await this.getHistoricalData(seriesId);
      
      if (dataPoints.length === 0) {
        logger.warn(`⚠️ No historical data found for series: ${seriesId}`);
        return;
      }

      logger.info(`📊 Processing ${dataPoints.length} data points for ${seriesId}`);

      // Calculate metrics for each data point (focusing on recent ones)
      const recentDataPoints = dataPoints.slice(-24); // Last 24 periods for efficiency
      const metricsToInsert: InsertEconDerivedMetrics[] = [];

      for (let i = Math.max(12, recentDataPoints.length - 24); i < recentDataPoints.length; i++) {
        const globalIndex = dataPoints.length - recentDataPoints.length + i;
        const metrics = this.calculateInvestmentMetrics(dataPoints, globalIndex);
        const currentPoint = recentDataPoints[i];

        if (metrics.calculationConfidence && metrics.calculationConfidence > 0.3) {
          const derivedMetric: InsertEconDerivedMetrics = {
            seriesId,
            periodEnd: currentPoint.periodDate,
            baseTransformCode: 'RAW',
            pipelineVersion: this.PIPELINE_VERSION,
            calculationEngine: 'v2.0',
            
            // Growth metrics
            yoyGrowth: metrics.yoyGrowth?.toString(),
            qoqAnnualized: metrics.qoqAnnualized?.toString(),
            momAnnualized: metrics.momAnnualized?.toString(),
            yoy3yrAvg: metrics.yoy3yrAvg?.toString(),
            
            // Moving averages
            ma3m: metrics.ma3m?.toString(),
            ma6m: metrics.ma6m?.toString(),
            ma12m: metrics.ma12m?.toString(),
            
            // Volatility & trends
            volatility3m: metrics.volatility3m?.toString(),
            volatility12m: metrics.volatility12m?.toString(),
            trendSlope: metrics.trendSlope?.toString(),
            
            // Percentile rankings
            percentileRank1y: metrics.percentileRank1y?.toString(),
            percentileRank5y: metrics.percentileRank5y?.toString(),
            percentileRank10y: metrics.percentileRank10y?.toString(),
            
            // Investment signals
            investmentSignal: metrics.investmentSignal,
            signalStrength: metrics.signalStrength?.toString(),
            
            // Quality metrics
            calculationConfidence: metrics.calculationConfidence?.toString(),
            dataQualityScore: '0.95', // Default high quality for FRED data
            misssingDataPoints: 0,
          };

          metricsToInsert.push(derivedMetric);
        }
      }

      // Bulk insert derived metrics
      if (metricsToInsert.length > 0) {
        await db.insert(econDerivedMetrics)
          .values(metricsToInsert)
          .onConflictDoUpdate({
            target: [econDerivedMetrics.seriesId, econDerivedMetrics.periodEnd, econDerivedMetrics.baseTransformCode],
            set: {
              yoyGrowth: sql`excluded.yoy_growth`,
              qoqAnnualized: sql`excluded.qoq_annualized`,
              momAnnualized: sql`excluded.mom_annualized`,
              volatility12m: sql`excluded.volatility_12m`,
              investmentSignal: sql`excluded.investment_signal`,
              signalStrength: sql`excluded.signal_strength`,
              calculationConfidence: sql`excluded.calculation_confidence`,
              updatedAt: sql`NOW()`,
            },
          });

        logger.info(`✅ Calculated and stored ${metricsToInsert.length} derived metrics for ${seriesId}`);
      } else {
        logger.warn(`⚠️ No qualifying metrics calculated for ${seriesId} (insufficient data quality)`);
      }

    } catch (error) {
      logger.error(`❌ Failed to calculate derived metrics for ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Process all economic series for derived metrics
   */
  async processAllSeries(): Promise<void> {
    try {
      logger.info('🚀 Starting bulk derived metrics calculation for all economic series');

      // Get all unique series IDs
      const uniqueSeries = await db
        .selectDistinct({ seriesId: economicCalendar.seriesId })
        .from(economicCalendar);

      logger.info(`📊 Found ${uniqueSeries.length} unique economic series to process`);

      // Process series in batches to avoid overwhelming the database
      const BATCH_SIZE = 5;
      for (let i = 0; i < uniqueSeries.length; i += BATCH_SIZE) {
        const batch = uniqueSeries.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(series => this.calculateDerivedMetrics(series.seriesId))
        );

        logger.info(`✅ Completed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueSeries.length / BATCH_SIZE)}`);
        
        // Small delay to prevent database overload
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('🎉 Completed bulk derived metrics calculation for all series');

    } catch (error) {
      logger.error('❌ Failed to process all series for derived metrics:', error);
      throw error;
    }
  }
}

export const economicMetricsCalculator = new EconomicMetricsCalculator();