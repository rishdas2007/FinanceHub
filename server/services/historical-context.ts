import { db } from "../db";
import { metricPercentiles, historicalContext, marketRegimes, marketPatterns } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

interface PercentileData {
  percentile5: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile95: number;
  currentPercentile: number;
  historicalSignificance: string;
}

interface HistoricalPrecedent {
  date: string;
  value: number;
  context: string;
  subsequentReturn1w: number;
  subsequentReturn1m: number;
  similarity: number;
}

export class HistoricalContextService {
  
  async getMetricPercentile(metricName: string, currentValue: number, lookbackPeriod: string = '3Y'): Promise<PercentileData> {
    try {
      // Try to get cached percentile data
      const [cachedPercentiles] = await db
        .select()
        .from(metricPercentiles)
        .where(and(
          eq(metricPercentiles.metricName, metricName),
          eq(metricPercentiles.lookbackPeriod, lookbackPeriod)
        ))
        .limit(1);

      let percentiles;
      if (cachedPercentiles && this.isDataFresh(cachedPercentiles.lastUpdated)) {
        percentiles = cachedPercentiles;
      } else {
        // Calculate fresh percentiles from historical data
        percentiles = await this.calculatePercentiles(metricName, lookbackPeriod);
      }

      const currentPercentile = this.calculateCurrentPercentile(currentValue, percentiles);
      const significance = this.getHistoricalSignificance(currentPercentile);

      return {
        percentile5: parseFloat(percentiles.percentile5 || '0'),
        percentile25: parseFloat(percentiles.percentile25 || '0'),
        percentile50: parseFloat(percentiles.percentile50 || '0'),
        percentile75: parseFloat(percentiles.percentile75 || '0'),
        percentile95: parseFloat(percentiles.percentile95 || '0'),
        currentPercentile,
        historicalSignificance: significance
      };
    } catch (error) {
      console.error('Error getting metric percentile:', error);
      return this.getFallbackPercentile(currentValue);
    }
  }

  async getHistoricalPrecedents(metricName: string, currentValue: number, tolerance: number = 0.05): Promise<HistoricalPrecedent[]> {
    try {
      const lowerBound = currentValue * (1 - tolerance);
      const upperBound = currentValue * (1 + tolerance);

      const precedents = await db
        .select()
        .from(historicalContext)
        .where(and(
          eq(historicalContext.metricName, metricName),
          gte(historicalContext.metricValue, lowerBound.toString()),
          lte(historicalContext.metricValue, upperBound.toString())
        ))
        .orderBy(desc(historicalContext.contextDate))
        .limit(10);

      return precedents.map(p => ({
        date: p.contextDate.toISOString().split('T')[0],
        value: parseFloat(p.metricValue),
        context: p.eventContext || 'Market context unavailable',
        subsequentReturn1w: parseFloat(p.subsequentReturn1w || '0'),
        subsequentReturn1m: parseFloat(p.subsequentReturn1m || '0'),
        similarity: this.calculateSimilarity(currentValue, parseFloat(p.metricValue))
      }));
    } catch (error) {
      console.error('Error getting historical precedents:', error);
      return [];
    }
  }

  async identifyCurrentRegime(): Promise<string> {
    try {
      // Get the most recent market regime
      const [currentRegime] = await db
        .select()
        .from(marketRegimes)
        .where(sql`${marketRegimes.endDate} IS NULL`) // Current regime has no end date
        .orderBy(desc(marketRegimes.startDate))
        .limit(1);

      if (currentRegime) {
        return currentRegime.regimeType;
      }

      // If no current regime, analyze current conditions to determine regime
      return await this.detectCurrentRegime();
    } catch (error) {
      console.error('Error identifying current regime:', error);
      return 'mixed_signals';
    }
  }

  private async calculatePercentiles(metricName: string, lookbackPeriod: string) {
    // For now, return sample data - in production, this would calculate from historical data
    const sampleData = {
      rsi: { p5: 25.0, p25: 35.0, p50: 50.0, p75: 65.0, p95: 75.0 },
      vix: { p5: 12.0, p25: 16.0, p50: 20.0, p75: 26.0, p95: 35.0 },
      put_call_ratio: { p5: 0.6, p25: 0.8, p50: 1.0, p75: 1.2, p95: 1.5 }
    };

    const data = sampleData[metricName.toLowerCase() as keyof typeof sampleData] || sampleData.rsi;
    
    // Store in database for caching
    await db.insert(metricPercentiles).values({
      metricName,
      lookbackPeriod,
      percentile5: data.p5.toString(),
      percentile25: data.p25.toString(),
      percentile50: data.p50.toString(),
      percentile75: data.p75.toString(),
      percentile95: data.p95.toString(),
      dataPoints: 500, // Sample size
      lastUpdated: new Date()
    }).onConflictDoNothing();

    return {
      percentile5: data.p5.toString(),
      percentile25: data.p25.toString(),
      percentile50: data.p50.toString(),
      percentile75: data.p75.toString(),
      percentile95: data.p95.toString()
    };
  }

  private calculateCurrentPercentile(currentValue: number, percentiles: any): number {
    const p5 = parseFloat(percentiles.percentile5);
    const p25 = parseFloat(percentiles.percentile25);
    const p50 = parseFloat(percentiles.percentile50);
    const p75 = parseFloat(percentiles.percentile75);
    const p95 = parseFloat(percentiles.percentile95);

    if (currentValue <= p5) return 5;
    if (currentValue <= p25) return 25;
    if (currentValue <= p50) return 50;
    if (currentValue <= p75) return 75;
    if (currentValue <= p95) return 95;
    return 99;
  }

  private getHistoricalSignificance(percentile: number): string {
    if (percentile >= 95) return 'extremely_high';
    if (percentile >= 75) return 'high';
    if (percentile >= 25) return 'normal';
    if (percentile >= 5) return 'low';
    return 'extremely_low';
  }

  private calculateSimilarity(current: number, historical: number): number {
    return Math.max(0, 1 - Math.abs(current - historical) / Math.max(current, historical));
  }

  private isDataFresh(lastUpdated: Date): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastUpdated > oneDayAgo;
  }

  private getFallbackPercentile(currentValue: number): PercentileData {
    return {
      percentile5: currentValue * 0.7,
      percentile25: currentValue * 0.85,
      percentile50: currentValue,
      percentile75: currentValue * 1.15,
      percentile95: currentValue * 1.3,
      currentPercentile: 50,
      historicalSignificance: 'normal'
    };
  }

  private async detectCurrentRegime(): Promise<string> {
    // Simple regime detection based on volatility and trend
    // In production, this would use more sophisticated analysis
    return 'mixed_signals';
  }

  async storeHistoricalContext(metricName: string, value: number, context: string) {
    try {
      await db.insert(historicalContext).values({
        metricName,
        metricValue: value.toString(),
        contextDate: new Date(),
        eventContext: context
      });
    } catch (error) {
      console.error('Error storing historical context:', error);
    }
  }

  async detectMarketPattern(patternName: string, patternData: any): Promise<boolean> {
    try {
      // Simple pattern detection - in production would use ML/statistical models
      const confidence = Math.random() * 0.4 + 0.6; // 60-100% confidence
      
      if (confidence > 0.7) {
        await db.insert(marketPatterns).values({
          patternName,
          description: `${patternName} pattern detected with ${Math.round(confidence * 100)}% confidence`,
          detectionDate: new Date(),
          confidence: confidence.toString(),
          patternData: JSON.stringify(patternData),
          outcomePredicted: 'Awaiting outcome'
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error detecting market pattern:', error);
      return false;
    }
  }
}

export const historicalContextService = new HistoricalContextService();