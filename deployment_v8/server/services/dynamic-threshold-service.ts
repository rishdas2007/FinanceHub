import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { CacheService } from './cache-unified.js';

const cache = new CacheService();

export interface DynamicThreshold {
  indicator: string;
  baseThreshold: number;
  currentThreshold: number;
  vixLevel: number;
  importanceWeight: number;
  marketContext: string;
  lastCalculated: Date;
}

export interface ThresholdAdjustment {
  reason: string;
  adjustment: number;
  confidence: number;
}

export class DynamicThresholdService {
  private cache = cache;
  private readonly INDICATOR_WEIGHTS: Record<string, number> = {
    'Nonfarm Payrolls': 1.5,
    'Unemployment Rate': 1.5,
    'GDP Growth Rate': 1.4,
    'Consumer Price Index': 1.3,
    'Federal Funds Rate': 1.3,
    'Consumer Confidence': 1.2,
    'Manufacturing PMI': 1.1,
    'Housing Starts': 1.0,
    'Industrial Production': 1.0,
    'Retail Sales': 0.9,
    'Consumer Sentiment': 0.8,
    'Leading Economic Index': 0.7
  };

  private readonly BASE_THRESHOLD = 1.0; // 1 standard deviation



  async calculateDynamicThreshold(indicator: string): Promise<DynamicThreshold> {
    const cacheKey = `dynamic-threshold-${indicator}`;
    const cached = await this.cache.get(cacheKey);
    if (cached && this.isRecentCalculation(cached.lastCalculated)) {
      return cached;
    }

    logger.debug(`🎯 Calculating dynamic threshold for ${indicator}`);

    try {
      // Get current market context
      const vixLevel = await this.getCurrentVIX();
      const marketHours = this.isMarketHours();
      const importanceWeight = this.INDICATOR_WEIGHTS[indicator] || 1.0;

      // Calculate adjustments
      const vixAdjustment = this.calculateVIXAdjustment(vixLevel);
      const timeAdjustment = this.calculateTimeAdjustment(marketHours);
      const volatilityAdjustment = await this.calculateVolatilityAdjustment(indicator);

      // Final threshold calculation
      const currentThreshold = this.BASE_THRESHOLD * 
        (1 + vixAdjustment + timeAdjustment + volatilityAdjustment) * 
        importanceWeight;

      const threshold: DynamicThreshold = {
        indicator,
        baseThreshold: this.BASE_THRESHOLD,
        currentThreshold: Math.max(0.3, Math.min(3.0, currentThreshold)), // Clamp between 0.3 and 3.0
        vixLevel,
        importanceWeight,
        marketContext: this.getMarketContext(vixLevel, marketHours),
        lastCalculated: new Date()
      };

      // Cache for 30 minutes
      await this.cache.set(cacheKey, threshold, 30 * 60 * 1000);

      logger.debug(`✅ Dynamic threshold for ${indicator}: ${threshold.currentThreshold.toFixed(2)}`);
      return threshold;
    } catch (error) {
      logger.error(`Failed to calculate dynamic threshold for ${indicator}:`, error);
      
      // Return conservative threshold on error
      return {
        indicator,
        baseThreshold: this.BASE_THRESHOLD,
        currentThreshold: this.BASE_THRESHOLD,
        vixLevel: 20,
        importanceWeight: this.INDICATOR_WEIGHTS[indicator] || 1.0,
        marketContext: 'normal',
        lastCalculated: new Date()
      };
    }
  }

  async exceedsThreshold(indicator: string, zScore: number): Promise<{
    exceeds: boolean;
    threshold: DynamicThreshold;
    adjustments: ThresholdAdjustment[];
  }> {
    const threshold = await this.calculateDynamicThreshold(indicator);
    const adjustments = await this.getThresholdAdjustments(indicator, threshold);
    
    const exceeds = Math.abs(zScore) > threshold.currentThreshold;
    
    if (exceeds) {
      logger.info(`🚨 ${indicator} exceeds dynamic threshold: |${zScore.toFixed(2)}| > ${threshold.currentThreshold.toFixed(2)}`);
    }

    return {
      exceeds,
      threshold,
      adjustments
    };
  }

  private async getCurrentVIX(): Promise<number> {
    try {
      // Try to get VIX from recent stock data
      const result = await db.execute(sql`
        SELECT close_price
        FROM stock_data 
        WHERE symbol = '^VIX' 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      if (result.rows.length > 0) {
        return parseFloat((result.rows[0] as any).close_price);
      }

      // Fallback: estimate VIX from SPY volatility
      const spyVolatility = await this.estimateVolatilityFromSPY();
      return spyVolatility * 100; // Convert to VIX-like scale
    } catch (error) {
      logger.warn('Failed to get VIX, using default:', error);
      return 20; // Default VIX level
    }
  }

  private async estimateVolatilityFromSPY(): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT close_price, timestamp
        FROM stock_data 
        WHERE symbol = 'SPY' 
        ORDER BY timestamp DESC 
        LIMIT 20
      `);

      if (result.rows.length < 10) return 0.2;

      const returns = [];
      for (let i = 1; i < result.rows.length; i++) {
        const currentPrice = parseFloat((result.rows[i - 1] as any).close_price);
        const previousPrice = parseFloat((result.rows[i] as any).close_price);
        returns.push(Math.log(currentPrice / previousPrice));
      }

      const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
      
      return Math.sqrt(variance * 252); // Annualized volatility
    } catch (error) {
      logger.warn('Failed to estimate volatility from SPY:', error);
      return 0.2;
    }
  }

  private calculateVIXAdjustment(vixLevel: number): number {
    if (vixLevel > 30) return -0.3; // High fear = lower thresholds (more sensitive)
    if (vixLevel > 25) return -0.2;
    if (vixLevel > 20) return -0.1;
    if (vixLevel < 12) return 0.2; // Low fear = higher thresholds (less sensitive)
    return 0; // Normal range
  }

  private calculateTimeAdjustment(isMarketHours: boolean): number {
    const now = new Date();
    const hour = now.getHours();

    // Pre-market sensitivity (4-9:30 AM ET)
    if (hour >= 4 && hour < 9) return -0.1;
    
    // After-hours sensitivity (4-8 PM ET)  
    if (hour >= 16 && hour < 20) return -0.1;
    
    // Overnight (low volume, higher noise)
    if (hour >= 20 || hour < 4) return 0.2;
    
    return 0;
  }

  private async calculateVolatilityAdjustment(indicator: string): Promise<number> {
    try {
      // Calculate recent volatility of the indicator
      const result = await db.execute(sql`
        SELECT value 
        FROM economic_indicators_history 
        WHERE metric = ${indicator} 
        ORDER BY period_date DESC 
        LIMIT 12
      `);

      if (result.rows.length < 6) return 0;

      const values = result.rows.map((row: any) => parseFloat(row.value));
      const returns = [];
      
      for (let i = 1; i < values.length; i++) {
        const change = (values[i - 1] - values[i]) / Math.abs(values[i]);
        returns.push(change);
      }

      const volatility = this.calculateStandardDeviation(returns);
      
      // High volatility = higher thresholds (less sensitive to noise)
      if (volatility > 0.1) return 0.3;
      if (volatility > 0.05) return 0.1;
      if (volatility < 0.02) return -0.1; // Low volatility = lower thresholds
      
      return 0;
    } catch (error) {
      logger.warn(`Failed to calculate volatility adjustment for ${indicator}:`, error);
      return 0;
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    
    return Math.sqrt(variance);
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Weekend
    if (day === 0 || day === 6) return false;
    
    // Market hours: 9:30 AM - 4:00 PM ET
    return hour >= 9 && hour < 16;
  }

  private isRecentCalculation(lastCalculated: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - new Date(lastCalculated).getTime()) / (1000 * 60);
    return diffMinutes < 30; // Consider recent if calculated within 30 minutes
  }

  private getMarketContext(vixLevel: number, isMarketHours: boolean): string {
    if (vixLevel > 30) return 'high-volatility';
    if (vixLevel > 25) return 'elevated-volatility';
    if (vixLevel < 12) return 'low-volatility';
    if (!isMarketHours) return 'after-hours';
    return 'normal';
  }

  private async getThresholdAdjustments(
    indicator: string, 
    threshold: DynamicThreshold
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];

    // VIX adjustment explanation
    if (threshold.vixLevel > 25) {
      adjustments.push({
        reason: `High market volatility (VIX: ${threshold.vixLevel.toFixed(1)})`,
        adjustment: this.calculateVIXAdjustment(threshold.vixLevel),
        confidence: 0.8
      });
    }

    // Importance weighting explanation
    if (threshold.importanceWeight !== 1.0) {
      adjustments.push({
        reason: `Indicator importance weighting`,
        adjustment: threshold.importanceWeight - 1.0,
        confidence: 0.9
      });
    }

    // Market hours adjustment
    if (threshold.marketContext === 'after-hours') {
      adjustments.push({
        reason: 'After-hours trading period',
        adjustment: -0.1,
        confidence: 0.7
      });
    }

    return adjustments;
  }
}