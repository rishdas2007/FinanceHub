/**
 * Standard Technical Indicators Service
 * Implements industry-standard calculations for MACD(12,26,9), RSI(14), Bollinger(20,2)
 * This service provides clean separation between raw indicator values and Z-scores
 */

import { db } from '../db.js';
import { historicalStockData } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../middleware/logging';

export interface StandardTechnicalIndicators {
  symbol: string;
  timestamp: Date;

  // Raw indicator values (not Z-scores) - for dashboard display
  rsi: number | null;           // 14-period RSI
  macd: number | null;          // MACD line (EMA12 - EMA26)
  macdSignal: number | null;    // 9-period EMA of MACD
  macdHistogram: number | null; // MACD - Signal

  // Bollinger Bands (20, 2)
  bollingerUpper: number | null;
  bollingerMiddle: number | null;  // 20-period SMA
  bollingerLower: number | null;
  bollingerPercentB: number | null; // %B position

  // Z-scores (for advanced analysis only)
  rsiZScore: number | null;
  macdZScore: number | null;
  bollingerZScore: number | null;
}

export class StandardTechnicalIndicatorsService {
  private static instance: StandardTechnicalIndicatorsService;

  public static getInstance(): StandardTechnicalIndicatorsService {
    if (!this.instance) {
      this.instance = new StandardTechnicalIndicatorsService();
    }
    return this.instance;
  }

  /**
   * Calculate standard technical indicators for display
   */
  async calculateStandardIndicators(symbol: string): Promise<StandardTechnicalIndicators | null> {
    try {
      // Get 100 days of price data for reliable calculations
      const priceData = await this.getPriceHistory(symbol, 100);
      if (priceData.length < 50) return null;

      const closes = priceData.map(d => parseFloat(d.close));

      // Calculate standard indicators
      const rsi = this.calculateStandardRSI(closes, 14);
      const { macd, signal, histogram } = this.calculateStandardMACD(closes);
      const bollinger = this.calculateStandardBollinger(closes, 20, 2);

      // Calculate Z-scores using 60-day rolling window (standard for daily data)
      const rsiZScore = this.calculateZScore(
        closes.map((_, i) => this.calculateStandardRSI(closes.slice(0, i + 1), 14))
               .filter(v => v !== null), 
        rsi, 60
      );
      
      const macdValues = closes.map((_, i) => {
        const result = this.calculateStandardMACD(closes.slice(0, i + 1));
        return result.macd;
      }).filter(v => v !== null);
      const macdZScore = this.calculateZScore(macdValues, macd, 60);
      
      const bollingerZScore = this.calculateZScore(
        closes.map((_, i) => this.calculateStandardBollinger(closes.slice(0, i + 1), 20, 2).percent_b)
               .filter(v => v !== null), 
        bollinger.percent_b, 60
      );

      return {
        symbol,
        timestamp: new Date(),

        // Raw values for dashboard display
        rsi,
        macd,
        macdSignal: signal,
        macdHistogram: histogram,

        bollingerUpper: bollinger.upper,
        bollingerMiddle: bollinger.middle,
        bollingerLower: bollinger.lower,
        bollingerPercentB: bollinger.percent_b,

        // Z-scores for advanced analysis
        rsiZScore,
        macdZScore,
        bollingerZScore
      };

    } catch (error) {
      logger.error(`Error calculating standard indicators for ${symbol}:`, error);
      return null;
    }
  }

  private async getPriceHistory(symbol: string, days: number) {
    return await db
      .select()
      .from(historicalStockData)
      .where(eq(historicalStockData.symbol, symbol))
      .orderBy(desc(historicalStockData.date))
      .limit(days);
  }

  private calculateZScore(historicalValues: number[], currentValue: number | null, window: number): number | null {
    if (!currentValue || historicalValues.length < window) return null;

    const recentValues = historicalValues.slice(-window);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (recentValues.length - 1);
    const stdDev = Math.sqrt(variance);

    return stdDev > 1e-8 ? (currentValue - mean) / stdDev : 0;
  }

  // Standard RSI calculation using Wilder's method
  private calculateStandardRSI(closes: number[], period: number = 14): number | null {
    if (closes.length < period + 1) return null;

    // Build changes array first (more accurate method)
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    if (changes.length < period) return null;

    // Initial averages for first period
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
      const change = changes[i];
      if (change > 0) {
        avgGain += change;
      } else {
        avgLoss += Math.abs(change);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // Apply Wilder's smoothing for remaining periods
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      // Wilder's smoothing: ((previous avg * (period-1)) + current value) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Ensure bounds [0, 100]
    return Math.max(0, Math.min(100, rsi));
  }

  // Standard MACD calculation with proper signal line
  private calculateStandardMACD(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
    // Need at least 52 data points for proper MACD (26*2 for EMA seeding + 9 for signal)
    if (closes.length < 61) return { macd: null, signal: null, histogram: null };

    // Calculate EMAs for each data point to build MACD history
    const macdHistory: number[] = [];

    // Start from index 26 to have sufficient EMA history
    for (let i = 26; i < closes.length; i++) {
      const windowData = closes.slice(0, i + 1);
      const ema12 = this.calculateEMA(windowData, 12);
      const ema26 = this.calculateEMA(windowData, 26);

      if (ema12 && ema26) {
        macdHistory.push(ema12 - ema26);
      }
    }

    if (macdHistory.length < 9) return { macd: null, signal: null, histogram: null };

    const currentMacd = macdHistory[macdHistory.length - 1];

    // Calculate 9-period EMA of MACD line for signal
    const signal = this.calculateEMA(macdHistory, 9);

    const histogram = signal ? currentMacd - signal : null;

    return {
      macd: currentMacd,
      signal,
      histogram
    };
  }

  // Standard Bollinger Bands calculation
  private calculateStandardBollinger(closes: number[], period: number = 20, multiplier: number = 2): {
    upper: number | null;
    middle: number | null;
    lower: number | null;
    percent_b: number | null;
  } {
    if (closes.length < period) {
      return { upper: null, middle: null, lower: null, percent_b: null };
    }

    const slice = closes.slice(-period);
    const sma = slice.reduce((sum, val) => sum + val, 0) / period;

    // Use sample variance (N-1) instead of population variance (N)
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / (period - 1);
    const stdDev = Math.sqrt(variance);

    const upper = sma + (multiplier * stdDev);
    const lower = sma - (multiplier * stdDev);
    const currentPrice = closes[closes.length - 1];

    // Ensure valid %B calculation with proper bounds
    const bandWidth = upper - lower;
    const percent_b = bandWidth > 0 ? (currentPrice - lower) / bandWidth : 0.5;

    return {
      upper,
      middle: sma,
      lower,
      percent_b: Math.max(0, Math.min(1, percent_b)) // Clamp to [0, 1] range
    };
  }

  // EMA calculation with proper seeding
  private calculateEMA(values: number[], period: number): number | null {
    // Need at least 2x period for proper EMA seeding
    if (values.length < period * 2) return null;
    
    const multiplier = 2 / (period + 1);
    
    // Seed with SMA of first 'period' values (proper EMA initialization)
    let ema = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    
    // Apply EMA to remaining values starting from period index
    for (let i = period; i < values.length; i++) {
      ema = (values[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
}

export default StandardTechnicalIndicatorsService;