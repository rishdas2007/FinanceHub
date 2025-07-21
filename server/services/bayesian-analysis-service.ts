import { db } from '../db.js';
import { historicalEconomicData, stockData, technicalIndicators, marketSentiment } from '@shared/schema';
import { desc, eq, sql, and, gte, lte } from 'drizzle-orm';

export class BayesianAnalysisService {
  private static instance: BayesianAnalysisService;
  
  static getInstance(): BayesianAnalysisService {
    if (!BayesianAnalysisService.instance) {
      BayesianAnalysisService.instance = new BayesianAnalysisService();
    }
    return BayesianAnalysisService.instance;
  }

  /**
   * Only include historical context when metrics are statistically significant
   * This dramatically reduces token usage while maintaining analytical value
   */
  async getSignificantHistoricalContext(currentMetrics: any): Promise<string> {
    console.log('🎯 Calculating significant historical context for Bayesian analysis...');
    
    const significantContext = [];
    const SIGNIFICANCE_THRESHOLD = 75; // Only mention if above 75th or below 25th percentile
    
    try {
      // Check each metric for statistical significance
      const metricsToCheck = [
        { name: 'RSI', value: currentMetrics.rsi, indicator: 'RSI' },
        { name: 'VIX', value: currentMetrics.vix, indicator: 'VIX' },
        { name: 'SPY', value: currentMetrics.spyPrice, indicator: 'SPY_PRICE' },
        { name: 'AAII Bullish', value: currentMetrics.aaiiBullish, indicator: 'AAII_BULLISH' }
      ];

      for (const metric of metricsToCheck) {
        if (metric.value && !isNaN(metric.value)) {
          const percentileData = await this.getPercentileWithSignificance(metric.indicator, metric.value);
          
          // Only include if statistically significant (extreme readings)
          if (percentileData.isSignificant) {
            const contextString = this.buildCompactContext(metric.name, percentileData);
            significantContext.push(contextString);
          }
        }
      }

      // If nothing is significant, return minimal context
      if (significantContext.length === 0) {
        return "Current readings within normal historical ranges";
      }

      return significantContext.join(' • ');
      
    } catch (error) {
      console.error('❌ Error calculating significant historical context:', error);
      return "Historical analysis temporarily unavailable";
    }
  }

  private async getPercentileWithSignificance(indicator: string, currentValue: number): Promise<any> {
    try {
      // Get historical data for percentile calculation
      const percentile3Y = await this.calculatePercentile(indicator, currentValue, 36);
      const percentile1Y = await this.calculatePercentile(indicator, currentValue, 12);
      
      // Determine if this reading is statistically significant
      const isExtreme = percentile3Y >= 80 || percentile3Y <= 20;
      const isRecentExtreme = percentile1Y >= 85 || percentile1Y <= 15;
      
      // Get last occurrence of similar reading
      const lastSimilar = await this.getLastSimilarReading(indicator, currentValue, 0.15);
      
      return {
        percentile3Y,
        percentile1Y,
        isSignificant: isExtreme || isRecentExtreme,
        significance: isExtreme ? 'extreme' : isRecentExtreme ? 'notable' : 'normal',
        lastSimilar: lastSimilar ? {
          date: lastSimilar.date,
          value: lastSimilar.value
        } : null,
        regime: this.determineRegime(percentile3Y)
      };
    } catch (error) {
      console.error(`Error calculating significance for ${indicator}:`, error);
      return { isSignificant: false, significance: 'unknown' };
    }
  }

  private async calculatePercentile(indicator: string, currentValue: number, monthsBack: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

      let historicalValues: number[] = [];

      // Get historical data based on indicator type
      if (indicator === 'RSI' || indicator === 'MACD') {
        const technicalData = await db
          .select({ value: indicator === 'RSI' ? technicalIndicators.rsi : technicalIndicators.macd })
          .from(technicalIndicators)
          .where(gte(technicalIndicators.timestamp, cutoffDate))
          .orderBy(desc(technicalIndicators.timestamp));
        
        historicalValues = technicalData
          .map(d => parseFloat(d.value?.toString() || '0'))
          .filter(v => !isNaN(v) && v > 0);
      } 
      else if (indicator === 'VIX') {
        const sentimentData = await db
          .select({ vix: marketSentiment.vix })
          .from(marketSentiment)
          .where(gte(marketSentiment.timestamp, cutoffDate))
          .orderBy(desc(marketSentiment.timestamp));
        
        historicalValues = sentimentData
          .map(d => parseFloat(d.vix?.toString() || '0'))
          .filter(v => !isNaN(v) && v > 0);
      }
      else if (indicator === 'SPY_PRICE') {
        const stockPriceData = await db
          .select({ price: stockData.price })
          .from(stockData)
          .where(and(
            eq(stockData.symbol, 'SPY'),
            gte(stockData.timestamp, cutoffDate)
          ))
          .orderBy(desc(stockData.timestamp));
        
        historicalValues = stockPriceData
          .map(d => parseFloat(d.price?.toString() || '0'))
          .filter(v => !isNaN(v) && v > 0);
      }
      else if (indicator === 'AAII_BULLISH') {
        const aaiiBullishData = await db
          .select({ bullish: marketSentiment.aaiiBullish })
          .from(marketSentiment)
          .where(gte(marketSentiment.timestamp, cutoffDate))
          .orderBy(desc(marketSentiment.timestamp));
        
        historicalValues = aaiiBullishData
          .map(d => parseFloat(d.bullish?.toString() || '0'))
          .filter(v => !isNaN(v) && v > 0);
      }

      if (historicalValues.length < 10) {
        return 50; // Default to median if insufficient data
      }

      // Calculate percentile
      historicalValues.sort((a, b) => a - b);
      const rank = historicalValues.filter(v => v < currentValue).length;
      const percentile = Math.round((rank / historicalValues.length) * 100);
      
      return Math.max(0, Math.min(100, percentile));
      
    } catch (error) {
      console.error(`Error calculating percentile for ${indicator}:`, error);
      return 50;
    }
  }

  private async getLastSimilarReading(indicator: string, currentValue: number, tolerance: number): Promise<any> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 24); // Look back 24 months

      const lowerBound = currentValue * (1 - tolerance);
      const upperBound = currentValue * (1 + tolerance);

      // Look for similar readings in the past
      if (indicator === 'RSI') {
        const similarReadings = await db
          .select({ 
            date: technicalIndicators.timestamp,
            value: technicalIndicators.rsi
          })
          .from(technicalIndicators)
          .where(and(
            gte(technicalIndicators.timestamp, cutoffDate),
            sql`${technicalIndicators.rsi} >= ${lowerBound}`,
            sql`${technicalIndicators.rsi} <= ${upperBound}`
          ))
          .orderBy(desc(technicalIndicators.timestamp))
          .limit(3);

        return similarReadings.length > 0 ? {
          date: similarReadings[0].date,
          value: similarReadings[0].value
        } : null;
      }
      
      return null;
    } catch (error) {
      console.error(`Error finding similar readings for ${indicator}:`, error);
      return null;
    }
  }

  private buildCompactContext(metricName: string, data: any): string {
    const { percentile3Y, significance, lastSimilar, regime } = data;
    
    let context = `${metricName} at ${percentile3Y}th percentile (${regime})`;
    
    // Add last occurrence if available and recent
    if (lastSimilar && this.isRecentEnough(lastSimilar.date)) {
      const monthsAgo = this.getMonthsAgo(lastSimilar.date);
      context += ` - last at this level ${monthsAgo}mo ago`;
    }
    
    return context;
  }

  private determineRegime(percentile: number): string {
    if (percentile >= 90) return 'extreme high';
    if (percentile >= 80) return 'elevated';
    if (percentile <= 10) return 'extreme low';
    if (percentile <= 20) return 'depressed';
    return 'normal';
  }

  private isRecentEnough(date: Date): boolean {
    const monthsAgo = this.getMonthsAgo(date);
    return monthsAgo <= 18; // Only mention if within 18 months
  }

  private getMonthsAgo(date: Date): number {
    const now = new Date();
    const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + 
                      (now.getMonth() - date.getMonth());
    return Math.round(monthsDiff);
  }

  async calculateMarketSignificanceScore(marketData: any): Promise<number> {
    let score = 0;
    
    // Check each metric for extremes (adds to score)
    const checks = [
      { name: 'RSI', value: marketData.rsi || 50, thresholds: [30, 70], weight: 2 },
      { name: 'VIX', value: marketData.vix || 20, thresholds: [12, 25], weight: 3 },
      { name: 'AAII', value: marketData.aaiiBullish || 40, thresholds: [25, 65], weight: 1 },
      { name: 'SPY Change', value: Math.abs(marketData.spyChange || 0), thresholds: [1, 2], weight: 2 }
    ];
    
    for (const check of checks) {
      if (check.value < check.thresholds[0] || check.value > check.thresholds[1]) {
        score += check.weight;
        console.log(`📊 ${check.name} is extreme (${check.value}), adding ${check.weight} to significance score`);
      }
    }
    
    console.log(`🎯 Market significance score: ${score}/10`);
    return score;
  }

  async getCurrentRegimeAnalysis(): Promise<string> {
    try {
      // Get current market state for regime analysis
      const recentData = await this.getRecentMarketData();
      
      if (!recentData) {
        return "Market regime analysis unavailable";
      }

      const { vixAvg, rsiAvg, volumeTrend } = recentData;
      
      // Determine market regime
      let regime = "Balanced";
      
      if (vixAvg > 25 && rsiAvg < 40) {
        regime = "High Volatility/Oversold";
      } else if (vixAvg < 15 && rsiAvg > 60) {
        regime = "Low Volatility/Complacent";
      } else if (volumeTrend > 1.2) {
        regime = "High Conviction Move";
      } else if (volumeTrend < 0.8) {
        regime = "Low Conviction Drift";
      }
      
      return `Current regime: ${regime} (VIX avg: ${vixAvg.toFixed(1)}, RSI avg: ${rsiAvg.toFixed(1)})`;
      
    } catch (error) {
      console.error('Error calculating regime analysis:', error);
      return "Regime analysis temporarily unavailable";
    }
  }

  private async getRecentMarketData(): Promise<any> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get recent VIX and RSI data
      const recentSentiment = await db
        .select({
          vix: marketSentiment.vix,
          timestamp: marketSentiment.timestamp
        })
        .from(marketSentiment)
        .where(gte(marketSentiment.timestamp, sevenDaysAgo))
        .orderBy(desc(marketSentiment.timestamp))
        .limit(7);

      const recentTechnical = await db
        .select({
          rsi: technicalIndicators.rsi,
          timestamp: technicalIndicators.timestamp
        })
        .from(technicalIndicators)
        .where(gte(technicalIndicators.timestamp, sevenDaysAgo))
        .orderBy(desc(technicalIndicators.timestamp))
        .limit(7);

      if (recentSentiment.length === 0 || recentTechnical.length === 0) {
        return null;
      }

      // Calculate averages
      const vixValues = recentSentiment
        .map(d => parseFloat(d.vix?.toString() || '0'))
        .filter(v => !isNaN(v) && v > 0);
      
      const rsiValues = recentTechnical
        .map(d => parseFloat(d.rsi?.toString() || '0'))
        .filter(v => !isNaN(v) && v > 0);

      const vixAvg = vixValues.length > 0 ? vixValues.reduce((a, b) => a + b) / vixValues.length : 20;
      const rsiAvg = rsiValues.length > 0 ? rsiValues.reduce((a, b) => a + b) / rsiValues.length : 50;

      return {
        vixAvg,
        rsiAvg,
        volumeTrend: 1.0 // Simplified for now
      };

    } catch (error) {
      console.error('Error getting recent market data:', error);
      return null;
    }
  }
}