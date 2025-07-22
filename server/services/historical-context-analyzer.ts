import { db } from '../db.js';
import { historicalEconomicData, stockData, technicalIndicators, marketSentiment } from '@shared/schema';
import { desc, eq, sql, and, gte, lte } from 'drizzle-orm';

export interface StatisticalContext {
  percentileRank: number;
  zScore: number;
  regimeClassification: 'extreme_low' | 'low' | 'normal' | 'high' | 'extreme_high';
  rollingComparisons: {
    '30d': number;
    '60d': number;
    '90d': number;
    '1y': number;
  };
  bayesianPrior: {
    regimeProbabilities: Record<string, number>;
    expectedPersistence: number;
    confidenceInterval: [number, number];
  };
  lastSimilarOccurrence?: string;
  anomalyFlag: boolean;
}

export interface MetricAnalysis {
  name: string;
  currentValue: number;
  context: StatisticalContext;
  narrative: string;
}

export class HistoricalContextAnalyzer {
  private static instance: HistoricalContextAnalyzer;
  
  static getInstance(): HistoricalContextAnalyzer {
    if (!HistoricalContextAnalyzer.instance) {
      HistoricalContextAnalyzer.instance = new HistoricalContextAnalyzer();
    }
    return HistoricalContextAnalyzer.instance;
  }

  /**
   * Main analysis method - calculates comprehensive historical context for all metrics
   */
  async analyzeHistoricalContext(currentMetrics: {
    rsi?: number;
    vix?: number;
    spyPrice?: number;
    aaiiBullish?: number;
    macd?: number;
  }): Promise<MetricAnalysis[]> {
    console.log('📊 Analyzing comprehensive historical context for metrics...');
    
    const analyses: MetricAnalysis[] = [];
    
    try {
      // Define metrics to analyze with their data sources
      const metricsConfig = [
        { 
          name: 'RSI', 
          value: currentMetrics.rsi, 
          dataSource: 'technical',
          field: 'rsi'
        },
        { 
          name: 'VIX', 
          value: currentMetrics.vix, 
          dataSource: 'sentiment',
          field: 'vix'
        },
        { 
          name: 'SPY Price', 
          value: currentMetrics.spyPrice, 
          dataSource: 'stock',
          field: 'price'
        },
        { 
          name: 'AAII Bullish', 
          value: currentMetrics.aaiiBullish, 
          dataSource: 'sentiment',
          field: 'aaiiBullish'
        },
        { 
          name: 'MACD', 
          value: currentMetrics.macd, 
          dataSource: 'technical',
          field: 'macd'
        }
      ];

      for (const metric of metricsConfig) {
        if (metric.value !== undefined && !isNaN(metric.value)) {
          try {
            const context = await this.calculateStatisticalContext(
              metric.name, 
              metric.value, 
              metric.dataSource, 
              metric.field
            );
            
            const narrative = this.generateContextNarrative(metric.name, metric.value, context);
            
            analyses.push({
              name: metric.name,
              currentValue: metric.value,
              context,
              narrative
            });
            
          } catch (error) {
            console.warn(`⚠️ Could not analyze ${metric.name}:`, error.message);
          }
        }
      }

      return analyses;
      
    } catch (error) {
      console.error('❌ Error in historical context analysis:', error);
      return [];
    }
  }

  /**
   * Calculate comprehensive statistical context for a metric
   */
  private async calculateStatisticalContext(
    metricName: string, 
    currentValue: number, 
    dataSource: string, 
    field: string
  ): Promise<StatisticalContext> {
    
    // Get historical data based on data source
    const historicalData = await this.getHistoricalData(dataSource, field);
    
    if (historicalData.length < 10) {
      throw new Error(`Insufficient historical data for ${metricName} (${historicalData.length} points)`);
    }

    // Extract values and calculate basic statistics
    const values = historicalData.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
    const sortedValues = [...values].sort((a, b) => a - b);
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate percentile rank
    const percentileRank = this.calculatePercentileRank(currentValue, sortedValues);
    
    // Calculate z-score
    const zScore = (currentValue - mean) / stdDev;
    
    // Classify regime
    const regimeClassification = this.classifyRegime(percentileRank);
    
    // Calculate rolling comparisons
    const rollingComparisons = await this.calculateRollingComparisons(
      currentValue, dataSource, field, [30, 60, 90, 365]
    );
    
    // Calculate Bayesian priors
    const bayesianPrior = this.calculateBayesianPrior(
      values, currentValue, regimeClassification
    );
    
    // Find last similar occurrence
    const lastSimilarOccurrence = this.findLastSimilarOccurrence(
      currentValue, historicalData, 0.1
    );
    
    // Flag anomalies (>2 standard deviations)
    const anomalyFlag = Math.abs(zScore) > 2;

    return {
      percentileRank,
      zScore,
      regimeClassification,
      rollingComparisons,
      bayesianPrior,
      lastSimilarOccurrence,
      anomalyFlag
    };
  }

  /**
   * Get historical data based on data source
   */
  private async getHistoricalData(dataSource: string, field: string): Promise<Array<{value: string, timestamp: Date}>> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    try {
      switch (dataSource) {
        case 'technical':
          if (field === 'rsi') {
            const techData = await db
              .select({
                value: sql`${technicalIndicators.rsi}::text`,
                timestamp: technicalIndicators.timestamp
              })
              .from(technicalIndicators)
              .where(
                and(
                  gte(technicalIndicators.timestamp, sixMonthsAgo),
                  sql`${technicalIndicators.rsi} IS NOT NULL`
                )
              )
              .orderBy(desc(technicalIndicators.timestamp))
              .limit(500);
            
            return techData.map(d => ({
              value: d.value as string,
              timestamp: d.timestamp
            }));
          } else if (field === 'macd') {
            const techData = await db
              .select({
                value: sql`${technicalIndicators.macd}::text`,
                timestamp: technicalIndicators.timestamp
              })
              .from(technicalIndicators)
              .where(
                and(
                  gte(technicalIndicators.timestamp, sixMonthsAgo),
                  sql`${technicalIndicators.macd} IS NOT NULL`
                )
              )
              .orderBy(desc(technicalIndicators.timestamp))
              .limit(500);
            
            return techData.map(d => ({
              value: d.value as string,
              timestamp: d.timestamp
            }));
          }
          return [];

        case 'sentiment':
          if (field === 'vix') {
            const sentimentData = await db
              .select({
                value: sql`${marketSentiment.vix}::text`,
                timestamp: marketSentiment.timestamp
              })
              .from(marketSentiment)
              .where(
                and(
                  gte(marketSentiment.timestamp, sixMonthsAgo),
                  sql`${marketSentiment.vix} IS NOT NULL`
                )
              )
              .orderBy(desc(marketSentiment.timestamp))
              .limit(500);
            
            return sentimentData.map(d => ({
              value: d.value as string,
              timestamp: d.timestamp
            }));
          } else if (field === 'aaiiBullish') {
            const sentimentData = await db
              .select({
                value: sql`${marketSentiment.aaiiBullish}::text`,
                timestamp: marketSentiment.timestamp
              })
              .from(marketSentiment)
              .where(
                and(
                  gte(marketSentiment.timestamp, sixMonthsAgo),
                  sql`${marketSentiment.aaiiBullish} IS NOT NULL`
                )
              )
              .orderBy(desc(marketSentiment.timestamp))
              .limit(500);
            
            return sentimentData.map(d => ({
              value: d.value as string,
              timestamp: d.timestamp
            }));
          }
          return [];

        case 'stock':
          const stockPriceData = await db
            .select({
              value: sql`${stockData.price}::text`,
              timestamp: stockData.timestamp
            })
            .from(stockData)
            .where(
              and(
                eq(stockData.symbol, 'SPY'),
                gte(stockData.timestamp, sixMonthsAgo)
              )
            )
            .orderBy(desc(stockData.timestamp))
            .limit(500);
          
          return stockPriceData.map(d => ({
            value: d.value as string,
            timestamp: d.timestamp
          }));

        default:
          throw new Error(`Unknown data source: ${dataSource}`);
      }
    } catch (error) {
      console.error(`❌ Error fetching historical data for ${dataSource}.${field}:`, error as Error);
      return [];
    }
  }

  /**
   * Calculate percentile rank of current value
   */
  private calculatePercentileRank(currentValue: number, sortedValues: number[]): number {
    const valuesAtOrBelow = sortedValues.filter(v => v <= currentValue).length;
    return Math.round((valuesAtOrBelow / sortedValues.length) * 100);
  }

  /**
   * Classify regime based on percentile
   */
  private classifyRegime(percentile: number): 'extreme_low' | 'low' | 'normal' | 'high' | 'extreme_high' {
    if (percentile <= 5) return 'extreme_low';
    if (percentile <= 25) return 'low';
    if (percentile >= 95) return 'extreme_high';
    if (percentile >= 75) return 'high';
    return 'normal';
  }

  /**
   * Calculate rolling window comparisons
   */
  private async calculateRollingComparisons(
    currentValue: number, 
    dataSource: string, 
    field: string, 
    windowDays: number[]
  ): Promise<{ '30d': number; '60d': number; '90d': number; '1y': number; }> {
    const comparisons = {
      '30d': 50,
      '60d': 50,
      '90d': 50,
      '1y': 50
    };
    
    for (const days of windowDays) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        // Get data for this window - simplified query for performance
        const windowData = await this.getHistoricalDataForWindow(dataSource, field, cutoffDate);
        
        if (windowData.length > 0) {
          const values = windowData.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
          const sortedValues = [...values].sort((a, b) => a - b);
          const windowPercentile = this.calculatePercentileRank(currentValue, sortedValues);
          
          if (days === 30) comparisons['30d'] = windowPercentile;
          else if (days === 60) comparisons['60d'] = windowPercentile;
          else if (days === 90) comparisons['90d'] = windowPercentile;
          else if (days >= 365) comparisons['1y'] = windowPercentile;
        }
      } catch (error) {
        console.warn(`⚠️ Could not calculate ${days}d comparison:`, (error as Error).message);
      }
    }
    
    return comparisons;
  }

  /**
   * Get historical data for specific window (optimized query)
   */
  private async getHistoricalDataForWindow(
    dataSource: string, 
    field: string, 
    cutoffDate: Date
  ): Promise<Array<{value: string}>> {
    try {
      switch (dataSource) {
        case 'technical':
          if (field === 'rsi') {
            const data = await db
              .select({
                value: sql`${technicalIndicators.rsi}::text`
              })
              .from(technicalIndicators)
              .where(
                and(
                  gte(technicalIndicators.timestamp, cutoffDate),
                  sql`${technicalIndicators.rsi} IS NOT NULL`
                )
              )
              .limit(200);
            return data.map(d => ({ value: d.value as string }));
          } else if (field === 'macd') {
            const data = await db
              .select({
                value: sql`${technicalIndicators.macd}::text`
              })
              .from(technicalIndicators)
              .where(
                and(
                  gte(technicalIndicators.timestamp, cutoffDate),
                  sql`${technicalIndicators.macd} IS NOT NULL`
                )
              )
              .limit(200);
            return data.map(d => ({ value: d.value as string }));
          }
          return [];

        case 'sentiment':
          if (field === 'vix') {
            const data = await db
              .select({
                value: sql`${marketSentiment.vix}::text`
              })
              .from(marketSentiment)
              .where(
                and(
                  gte(marketSentiment.timestamp, cutoffDate),
                  sql`${marketSentiment.vix} IS NOT NULL`
                )
              )
              .limit(200);
            return data.map(d => ({ value: d.value as string }));
          } else if (field === 'aaiiBullish') {
            const data = await db
              .select({
                value: sql`${marketSentiment.aaiiBullish}::text`
              })
              .from(marketSentiment)
              .where(
                and(
                  gte(marketSentiment.timestamp, cutoffDate),
                  sql`${marketSentiment.aaiiBullish} IS NOT NULL`
                )
              )
              .limit(200);
            return data.map(d => ({ value: d.value as string }));
          }
          return [];

        case 'stock':
          const data = await db
            .select({
              value: sql`${stockData.price}::text`
            })
            .from(stockData)
            .where(
              and(
                eq(stockData.symbol, 'SPY'),
                gte(stockData.timestamp, cutoffDate)
              )
            )
            .limit(200);
          return data.map(d => ({ value: d.value as string }));

        default:
          return [];
      }
    } catch (error) {
      console.warn(`⚠️ Window query failed for ${dataSource}.${field}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Calculate Bayesian priors for regime persistence
   */
  private calculateBayesianPrior(
    historicalValues: number[], 
    currentValue: number, 
    currentRegime: string
  ): {
    regimeProbabilities: Record<string, number>;
    expectedPersistence: number;
    confidenceInterval: [number, number];
  } {
    // Calculate regime transition probabilities
    const regimes = historicalValues.map(v => {
      const percentile = this.calculatePercentileRank(v, historicalValues);
      return this.classifyRegime(percentile);
    });

    // Count regime occurrences
    const regimeCounts = regimes.reduce((acc, regime) => {
      acc[regime] = (acc[regime] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate probabilities
    const total = regimes.length;
    const regimeProbabilities = Object.entries(regimeCounts).reduce((acc, [regime, count]) => {
      acc[regime] = count / total;
      return acc;
    }, {} as Record<string, number>);

    // Simple persistence calculation (how often similar regimes continue)
    const currentRegimeOccurrences = regimeCounts[currentRegime] || 1;
    const expectedPersistence = Math.min(10, Math.max(3, currentRegimeOccurrences / 10));

    // Calculate confidence interval based on historical variance
    const mean = historicalValues.reduce((sum, v) => sum + v, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    const confidenceInterval: [number, number] = [
      currentValue - (1.96 * stdDev),
      currentValue + (1.96 * stdDev)
    ];

    return {
      regimeProbabilities,
      expectedPersistence,
      confidenceInterval
    };
  }

  /**
   * Find last similar occurrence
   */
  private findLastSimilarOccurrence(
    currentValue: number, 
    historicalData: Array<{value: string, timestamp: Date}>, 
    tolerance: number = 0.1
  ): string | undefined {
    const threshold = currentValue * tolerance;
    
    for (const dataPoint of historicalData) {
      const value = parseFloat(dataPoint.value);
      if (!isNaN(value) && Math.abs(value - currentValue) <= threshold) {
        const daysAgo = Math.floor((Date.now() - dataPoint.timestamp.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo > 0) {
          return `${daysAgo} days ago`;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Generate narrative interpretation
   */
  private generateContextNarrative(
    metricName: string, 
    currentValue: number, 
    context: StatisticalContext
  ): string {
    const { percentileRank, zScore, regimeClassification, anomalyFlag, lastSimilarOccurrence } = context;
    
    let narrative = `${metricName} at ${currentValue.toFixed(2)} is at the ${percentileRank}th percentile`;
    
    // Add regime context
    const regimeDescriptions = {
      'extreme_low': 'extremely low level',
      'low': 'below-normal level', 
      'normal': 'normal range',
      'high': 'above-normal level',
      'extreme_high': 'extremely high level'
    };
    
    narrative += ` (${regimeDescriptions[regimeClassification]})`;
    
    // Add z-score if significant
    if (Math.abs(zScore) > 1.5) {
      narrative += `, ${Math.abs(zScore).toFixed(1)} standard deviations ${zScore > 0 ? 'above' : 'below'} historical mean`;
    }
    
    // Add anomaly flag
    if (anomalyFlag) {
      narrative += ' - ANOMALOUS READING';
    }
    
    // Add last similar occurrence
    if (lastSimilarOccurrence) {
      narrative += `. Last similar reading was ${lastSimilarOccurrence}`;
    }
    
    return narrative;
  }

  /**
   * Get summary of most significant findings
   */
  async getSummaryFindings(analyses: MetricAnalysis[]): Promise<string> {
    const significantFindings = analyses.filter(analysis => 
      analysis.context.anomalyFlag || 
      analysis.context.percentileRank >= 85 || 
      analysis.context.percentileRank <= 15
    );

    if (significantFindings.length === 0) {
      return "All metrics within normal historical ranges";
    }

    const summaries = significantFindings.map(finding => {
      const { name, context } = finding;
      if (context.anomalyFlag) {
        return `${name} showing anomalous reading (${context.percentileRank}th percentile)`;
      } else if (context.percentileRank >= 85) {
        return `${name} at extreme high (${context.percentileRank}th percentile)`;
      } else {
        return `${name} at extreme low (${context.percentileRank}th percentile)`;
      }
    });

    return summaries.join(' • ');
  }
}