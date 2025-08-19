import { db } from '../db';
import { 
  historicalTechnicalIndicators, 
  historicalSectorData,
  historicalMarketSentiment,
  stockData
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql, asc } from 'drizzle-orm';

interface HistoricalInsight {
  metric: string;
  currentValue: number;
  percentileRanking: number;
  historicalAverage: number;
  volatility: number;
  trend: 'rising' | 'falling' | 'stable';
  lastSimilarReading: string | null;
  significanceLevel: 'high' | 'medium' | 'low';
}

interface MarketRegimeAnalysis {
  currentRegime: string;
  confidenceLevel: number;
  durationInRegime: number;
  similarPeriods: any[];
  nextLikelyTransition: string;
}

export class HistoricalDataIntelligence {
  private static instance: HistoricalDataIntelligence;

  static getInstance(): HistoricalDataIntelligence {
    if (!HistoricalDataIntelligence.instance) {
      HistoricalDataIntelligence.instance = new HistoricalDataIntelligence();
    }
    return HistoricalDataIntelligence.instance;
  }

  /**
   * Generate comprehensive historical insights for AI analysis enhancement
   */
  async generateIntelligentInsights(symbol: string = 'SPY'): Promise<{
    technicalInsights: HistoricalInsight[];
    marketRegime: MarketRegimeAnalysis;
    correlationAlerts: any[];
    riskMetrics: any;
  }> {
    console.log(`🧠 Generating intelligent historical insights for ${symbol}...`);

    try {
      // Get 6 months of historical technical data
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const technicalHistory = await db.select()
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          gte(historicalTechnicalIndicators.date, sixMonthsAgo)
        ))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(180);

      console.log(`📊 Found ${technicalHistory.length} historical technical data points`);

      // Generate technical insights
      const technicalInsights = await this.analyzeTechnicalPatterns(technicalHistory);

      // Analyze market regime
      const marketRegime = await this.analyzeMarketRegime(symbol);

      // Generate correlation alerts
      const correlationAlerts = await this.generateCorrelationAlerts();

      // Calculate risk metrics
      const riskMetrics = await this.calculateHistoricalRiskMetrics(symbol);

      console.log(`✅ Generated ${technicalInsights.length} technical insights`);

      return {
        technicalInsights,
        marketRegime,
        correlationAlerts,
        riskMetrics
      };

    } catch (error) {
      console.error('❌ Error generating historical insights:', error);
      return {
        technicalInsights: [],
        marketRegime: {
          currentRegime: 'unknown',
          confidenceLevel: 0,
          durationInRegime: 0,
          similarPeriods: [],
          nextLikelyTransition: 'unknown'
        },
        correlationAlerts: [],
        riskMetrics: {}
      };
    }
  }

  /**
   * Analyze technical indicator patterns and percentiles
   */
  private async analyzeTechnicalPatterns(technicalHistory: any[]): Promise<HistoricalInsight[]> {
    const insights: HistoricalInsight[] = [];

    if (technicalHistory.length === 0) {
      return insights;
    }

    // Analyze RSI patterns
    const rsiValues = technicalHistory
      .map(t => parseFloat(t.rsi || '0'))
      .filter(v => v > 0);

    if (rsiValues.length > 0) {
      const currentRSI = rsiValues[0];
      const rsiSorted = [...rsiValues].sort((a, b) => a - b);
      const percentile = this.calculatePercentile(rsiSorted, currentRSI);
      const average = rsiValues.reduce((a, b) => a + b) / rsiValues.length;
      const volatility = this.calculateVolatility(rsiValues);
      const trend = this.determineTrend(rsiValues.slice(0, 10));

      insights.push({
        metric: 'RSI',
        currentValue: currentRSI,
        percentileRanking: percentile,
        historicalAverage: parseFloat(average.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2)),
        trend,
        lastSimilarReading: this.findLastSimilarReading(rsiValues, currentRSI, 5),
        significanceLevel: this.getSignificanceLevel(percentile)
      });
    }

    // Analyze MACD patterns
    const macdValues = technicalHistory
      .map(t => parseFloat(t.macd || '0'))
      .filter(v => v !== 0);

    if (macdValues.length > 0) {
      const currentMACD = macdValues[0];
      const macdSorted = [...macdValues].sort((a, b) => a - b);
      const percentile = this.calculatePercentile(macdSorted, currentMACD);
      const average = macdValues.reduce((a, b) => a + b) / macdValues.length;
      const volatility = this.calculateVolatility(macdValues);
      const trend = this.determineTrend(macdValues.slice(0, 10));

      insights.push({
        metric: 'MACD',
        currentValue: currentMACD,
        percentileRanking: percentile,
        historicalAverage: parseFloat(average.toFixed(4)),
        volatility: parseFloat(volatility.toFixed(4)),
        trend,
        lastSimilarReading: this.findLastSimilarReading(macdValues, currentMACD, 0.5),
        significanceLevel: this.getSignificanceLevel(percentile)
      });
    }

    return insights;
  }

  /**
   * Analyze current market regime based on historical patterns
   */
  private async analyzeMarketRegime(symbol: string): Promise<MarketRegimeAnalysis> {
    try {
      // Get VIX history
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const sentimentHistory = await db.select()
        .from(historicalMarketSentiment)
        .where(gte(historicalMarketSentiment.date, threeMonthsAgo))
        .orderBy(desc(historicalMarketSentiment.date))
        .limit(90);

      const vixValues = sentimentHistory
        .map(s => parseFloat(s.vix || '0'))
        .filter(v => v > 0);

      if (vixValues.length === 0) {
        return {
          currentRegime: 'insufficient_data',
          confidenceLevel: 0,
          durationInRegime: 0,
          similarPeriods: [],
          nextLikelyTransition: 'unknown'
        };
      }

      const avgVix = vixValues.reduce((a, b) => a + b) / vixValues.length;
      const currentVix = vixValues[0];

      // Simple regime classification based on VIX
      let regime = 'balanced';
      let confidence = 0.6;

      if (currentVix > 25) {
        regime = 'high_volatility';
        confidence = 0.8;
      } else if (currentVix < 15) {
        regime = 'low_volatility';
        confidence = 0.7;
      } else if (avgVix > 20) {
        regime = 'elevated_stress';
        confidence = 0.65;
      }

      return {
        currentRegime: regime,
        confidenceLevel: confidence,
        durationInRegime: this.calculateRegimeDuration(vixValues),
        similarPeriods: [],
        nextLikelyTransition: this.predictNextTransition(regime, currentVix)
      };

    } catch (error) {
      console.error('❌ Error analyzing market regime:', error);
      return {
        currentRegime: 'error',
        confidenceLevel: 0,
        durationInRegime: 0,
        similarPeriods: [],
        nextLikelyTransition: 'unknown'
      };
    }
  }

  /**
   * Generate alerts for unusual correlations
   */
  private async generateCorrelationAlerts(): Promise<any[]> {
    // Simplified implementation - in production would analyze cross-asset correlations
    return [
      {
        type: 'correlation_break',
        assets: ['SPY', 'VIX'],
        significance: 'medium',
        description: 'Historical inverse correlation pattern detected'
      }
    ];
  }

  /**
   * Calculate risk metrics based on historical data
   */
  private async calculateHistoricalRiskMetrics(symbol: string): Promise<any> {
    try {
      // Get recent price history
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const priceHistory = await db.select()
        .from(stockData)
        .where(and(
          eq(stockData.symbol, symbol),
          gte(stockData.timestamp, oneMonthAgo)
        ))
        .orderBy(desc(stockData.timestamp))
        .limit(30);

      if (priceHistory.length < 2) {
        return {
          volatility: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          dataPoints: 0
        };
      }

      const prices = priceHistory.map(p => parseFloat(p.price)).reverse();
      const returns = this.calculateReturns(prices);
      const volatility = this.calculateVolatility(returns) * Math.sqrt(252); // Annualized
      const maxDrawdown = this.calculateMaxDrawdown(prices);

      return {
        volatility: parseFloat(volatility.toFixed(4)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
        sharpeRatio: 0, // Would need risk-free rate
        dataPoints: prices.length
      };

    } catch (error) {
      console.error('❌ Error calculating risk metrics:', error);
      return {
        volatility: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        dataPoints: 0
      };
    }
  }

  /**
   * Enhanced AI Context Generation
   */
  async generateEnhancedAIContext(symbol: string = 'SPY'): Promise<string> {
    try {
      const insights = await this.generateIntelligentInsights(symbol);

      let context = `HISTORICAL CONTEXT ANALYSIS:\n`;

      // Technical insights context
      for (const insight of insights.technicalInsights) {
        if (insight.significanceLevel === 'high' || insight.significanceLevel === 'medium') {
          context += `- ${insight.metric} at ${insight.currentValue} is in the ${insight.percentileRanking}th percentile over 6 months (${insight.trend} trend)\n`;
          
          if (insight.lastSimilarReading) {
            context += `  Last similar reading was ${insight.lastSimilarReading}\n`;
          }
        }
      }

      // Market regime context
      if (insights.marketRegime.confidenceLevel > 0.6) {
        context += `- Current market regime: ${insights.marketRegime.currentRegime} (${(insights.marketRegime.confidenceLevel * 100).toFixed(0)}% confidence)\n`;
        context += `- Duration in regime: ${insights.marketRegime.durationInRegime} days\n`;
      }

      // Risk context
      if (insights.riskMetrics.dataPoints > 10) {
        context += `- Recent volatility: ${(insights.riskMetrics.volatility * 100).toFixed(1)}% (annualized)\n`;
        context += `- Max drawdown: ${(insights.riskMetrics.maxDrawdown * 100).toFixed(1)}%\n`;
      }

      return context;

    } catch (error) {
      console.error('❌ Error generating enhanced AI context:', error);
      return 'Historical context analysis unavailable due to insufficient data.';
    }
  }

  /**
   * Utility Methods
   */
  private calculatePercentile(sortedArray: number[], value: number): number {
    if (sortedArray.length === 0) return 50;
    
    const index = sortedArray.findIndex(v => v >= value);
    if (index === -1) return 100;
    if (index === 0) return 0;
    
    return Math.round((index / sortedArray.length) * 100);
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private determineTrend(recentValues: number[]): 'rising' | 'falling' | 'stable' {
    if (recentValues.length < 3) return 'stable';
    
    const firstThird = recentValues.slice(0, Math.floor(recentValues.length / 3));
    const lastThird = recentValues.slice(-Math.floor(recentValues.length / 3));
    
    const firstAvg = firstThird.reduce((a, b) => a + b) / firstThird.length;
    const lastAvg = lastThird.reduce((a, b) => a + b) / lastThird.length;
    
    const change = ((lastAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 2) return 'falling'; // Note: reversed because most recent is first
    if (change < -2) return 'rising';
    return 'stable';
  }

  private findLastSimilarReading(values: number[], target: number, tolerance: number): string | null {
    for (let i = 1; i < values.length; i++) {
      if (Math.abs(values[i] - target) <= tolerance) {
        return `${i} days ago`;
      }
    }
    return null;
  }

  private getSignificanceLevel(percentile: number): 'high' | 'medium' | 'low' {
    if (percentile > 90 || percentile < 10) return 'high';
    if (percentile > 75 || percentile < 25) return 'medium';
    return 'low';
  }

  private calculateRegimeDuration(vixValues: number[]): number {
    // Simple implementation - count consecutive days in current regime
    if (vixValues.length === 0) return 0;
    
    const currentVix = vixValues[0];
    let duration = 1;
    
    for (let i = 1; i < vixValues.length; i++) {
      const sameRegime = this.isSameRegime(currentVix, vixValues[i]);
      if (!sameRegime) break;
      duration++;
    }
    
    return duration;
  }

  private isSameRegime(vix1: number, vix2: number): boolean {
    const regime1 = vix1 > 25 ? 'high' : vix1 < 15 ? 'low' : 'medium';
    const regime2 = vix2 > 25 ? 'high' : vix2 < 15 ? 'low' : 'medium';
    return regime1 === regime2;
  }

  private predictNextTransition(currentRegime: string, currentVix: number): string {
    // Simple heuristic-based prediction
    switch (currentRegime) {
      case 'high_volatility':
        return 'expect_normalization';
      case 'low_volatility':
        return currentVix < 12 ? 'volatility_spike_risk' : 'stable_continuation';
      default:
        return 'monitor_for_breakout';
    }
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  private calculateMaxDrawdown(prices: number[]): number {
    let maxDrawdown = 0;
    let peak = prices[0];
    
    for (const price of prices) {
      if (price > peak) {
        peak = price;
      }
      
      const drawdown = (peak - price) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }
}

// Export singleton
export const historicalDataIntelligence = HistoricalDataIntelligence.getInstance();