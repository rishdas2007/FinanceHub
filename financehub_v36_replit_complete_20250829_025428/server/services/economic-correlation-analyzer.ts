import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { CacheService } from './cache-unified';

const cache = new CacheService();

export interface CorrelationMatrix {
  indicator1: string;
  indicator2: string;
  correlation: number;
  significance: number;
  sampleSize: number;
  timeframe: string;
}

export interface LeadingCorrelation {
  leadingIndicator: string;
  targetIndicator: string;
  correlation: number;
  leadMonths: number;
  significance: number;
}

export interface CorrelationBreakdown {
  indicatorPair: string;
  historicalCorrelation: number;
  currentCorrelation: number;
  breakdownDate: Date;
  severityScore: number;
}

export class EconomicCorrelationAnalyzer {
  private cache = cache;

  async calculateCorrelationMatrix(indicators: string[], timeframe: string = '12m'): Promise<CorrelationMatrix[]> {
    const cacheKey = `correlation-matrix-${indicators.join('-')}-${timeframe}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    logger.info(`🔗 Calculating correlation matrix for ${indicators.length} indicators`);

    const correlations: CorrelationMatrix[] = [];
    
    // Get historical data for all indicators
    const historicalData = await this.getHistoricalIndicatorData(indicators, timeframe);
    
    // Calculate pairwise correlations
    for (let i = 0; i < indicators.length; i++) {
      for (let j = i + 1; j < indicators.length; j++) {
        const indicator1 = indicators[i];
        const indicator2 = indicators[j];
        
        const data1 = historicalData[indicator1] || [];
        const data2 = historicalData[indicator2] || [];
        
        if (data1.length < 12 || data2.length < 12) continue;
        
        const correlation = this.calculatePearsonCorrelation(data1, data2);
        const significance = this.calculateSignificance(correlation, Math.min(data1.length, data2.length));
        
        correlations.push({
          indicator1,
          indicator2,
          correlation,
          significance,
          sampleSize: Math.min(data1.length, data2.length),
          timeframe
        });
      }
    }

    // Cache for 6 hours
    await this.cache.set(cacheKey, correlations, 6 * 60 * 60 * 1000);
    
    logger.info(`✅ Calculated ${correlations.length} correlation pairs`);
    return correlations;
  }

  async getLeadingCorrelations(targetIndicator: string): Promise<LeadingCorrelation[]> {
    const cacheKey = `leading-correlations-${targetIndicator}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    logger.info(`🎯 Finding leading correlations for ${targetIndicator}`);

    const leadingCorrelations: LeadingCorrelation[] = [];
    const allIndicators = await this.getAllIndicatorNames();
    
    for (const leadingIndicator of allIndicators) {
      if (leadingIndicator === targetIndicator) continue;
      
      // Test different lead times (1, 2, 3 months)
      for (const leadMonths of [1, 2, 3]) {
        const correlation = await this.calculateLeadLagCorrelation(
          leadingIndicator, 
          targetIndicator, 
          leadMonths
        );
        
        if (Math.abs(correlation) > 0.5) {
          const significance = this.calculateSignificance(correlation, 24); // Assume 24 months of data
          
          leadingCorrelations.push({
            leadingIndicator,
            targetIndicator,
            correlation,
            leadMonths,
            significance
          });
        }
      }
    }

    // Sort by absolute correlation strength
    leadingCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    
    // Cache for 12 hours
    await this.cache.set(cacheKey, leadingCorrelations.slice(0, 10), 12 * 60 * 60 * 1000);
    
    return leadingCorrelations.slice(0, 10);
  }

  async detectCorrelationBreakdowns(): Promise<CorrelationBreakdown[]> {
    const cacheKey = 'correlation-breakdowns';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    logger.info('🚨 Detecting correlation breakdowns');

    const breakdowns: CorrelationBreakdown[] = [];
    const keyPairs = [
      ['GDP Growth Rate', 'Unemployment Rate'],
      ['Federal Funds Rate', 'Consumer Price Index'],
      ['Nonfarm Payrolls', 'Consumer Confidence'],
      ['Manufacturing PMI', 'Industrial Production']
    ];

    for (const [indicator1, indicator2] of keyPairs) {
      try {
        const historicalCorr = await this.calculateHistoricalCorrelation(indicator1, indicator2, '24m');
        const recentCorr = await this.calculateHistoricalCorrelation(indicator1, indicator2, '6m');
        
        const difference = Math.abs(historicalCorr - recentCorr);
        
        if (difference > 0.3) { // Significant correlation breakdown
          breakdowns.push({
            indicatorPair: `${indicator1} ↔ ${indicator2}`,
            historicalCorrelation: historicalCorr,
            currentCorrelation: recentCorr,
            breakdownDate: new Date(),
            severityScore: difference
          });
        }
      } catch (error) {
        logger.warn(`Failed to calculate breakdown for ${indicator1} ↔ ${indicator2}:`, error);
      }
    }

    // Cache for 24 hours
    await this.cache.set(cacheKey, breakdowns, 24 * 60 * 60 * 1000);
    
    logger.info(`🔍 Found ${breakdowns.length} correlation breakdowns`);
    return breakdowns;
  }

  private async getHistoricalIndicatorData(indicators: string[], timeframe: string): Promise<Record<string, number[]>> {
    const months = timeframe === '12m' ? 12 : timeframe === '24m' ? 24 : 6;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    const data: Record<string, number[]> = {};
    
    for (const indicator of indicators) {
      try {
        const values = await db.execute(sql`
          SELECT value 
          FROM economic_indicators_history 
          WHERE metric = ${indicator} 
          AND period_date >= ${cutoffDate.toISOString()} 
          AND value IS NOT NULL 
          ORDER BY period_date ASC
        `);
        
        data[indicator] = values.rows.map((row: any) => parseFloat(row.value));
      } catch (error) {
        logger.warn(`Failed to get data for ${indicator}:`, error);
        data[indicator] = [];
      }
    }
    
    return data;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const pairs = x.slice(0, n).map((xi, i) => [xi, y[i]]);
    
    const sumX = pairs.reduce((sum, [xi]) => sum + xi, 0);
    const sumY = pairs.reduce((sum, [, yi]) => sum + yi, 0);
    const sumXY = pairs.reduce((sum, [xi, yi]) => sum + xi * yi, 0);
    const sumX2 = pairs.reduce((sum, [xi]) => sum + xi * xi, 0);
    const sumY2 = pairs.reduce((sum, [, yi]) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateSignificance(correlation: number, sampleSize: number): number {
    if (sampleSize <= 2) return 0;
    
    const t = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    const df = sampleSize - 2;
    
    // Simplified p-value approximation
    const pValue = 2 * (1 - this.normalCDF(Math.abs(t)));
    return Math.max(0, Math.min(1, pValue));
  }

  private normalCDF(x: number): number {
    // Approximation of normal cumulative distribution function
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private async getAllIndicatorNames(): Promise<string[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT metric 
      FROM economic_indicators_history 
      WHERE value IS NOT NULL
    `);
    
    return result.rows.map((row: any) => row.metric);
  }

  private async calculateLeadLagCorrelation(
    leadingIndicator: string, 
    targetIndicator: string, 
    leadMonths: number
  ): Promise<number> {
    try {
      // Get data with lead offset
      const leadingData = await db.execute(sql`
        SELECT value, period_date 
        FROM economic_indicators_history 
        WHERE metric = ${leadingIndicator} 
        AND value IS NOT NULL 
        ORDER BY period_date ASC
      `);

      const targetData = await db.execute(sql`
        SELECT value, period_date 
        FROM economic_indicators_history 
        WHERE metric = ${targetIndicator} 
        AND value IS NOT NULL 
        ORDER BY period_date ASC
      `);

      // Align data with lead offset
      const leadingValues: number[] = [];
      const targetValues: number[] = [];

      for (const target of targetData.rows) {
        const targetDate = new Date(target.period_date);
        const leadingDate = new Date(targetDate);
        leadingDate.setMonth(leadingDate.getMonth() - leadMonths);

        const leadingRow = leadingData.rows.find(row => {
          const rowDate = new Date(row.period_date);
          return Math.abs(rowDate.getTime() - leadingDate.getTime()) < 15 * 24 * 60 * 60 * 1000; // Within 15 days
        });

        if (leadingRow) {
          leadingValues.push(parseFloat(leadingRow.value));
          targetValues.push(parseFloat(target.value));
        }
      }

      return this.calculatePearsonCorrelation(leadingValues, targetValues);
    } catch (error) {
      logger.warn(`Failed to calculate lead-lag correlation:`, error);
      return 0;
    }
  }

  private async calculateHistoricalCorrelation(
    indicator1: string, 
    indicator2: string, 
    timeframe: string
  ): Promise<number> {
    const data = await this.getHistoricalIndicatorData([indicator1, indicator2], timeframe);
    return this.calculatePearsonCorrelation(data[indicator1] || [], data[indicator2] || []);
  }
}