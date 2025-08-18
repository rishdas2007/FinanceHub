import { db } from '../db.js';
import { 
  technicalIndicators, 
  historicalStockData,
  zscoreTechnicalIndicators
} from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { logger } from '../middleware/logging';

export interface DataConversionService {
  convertHistoricalDataToTechnical(symbols: string[]): Promise<void>;
  calculateTechnicalIndicatorsFromOHLCV(symbol: string, days: number): Promise<number>;
  getAvailableHistoricalData(): Promise<Record<string, number>>;
}

class DataConversionServiceImpl implements DataConversionService {
  private static instance: DataConversionServiceImpl;
  
  public static getInstance(): DataConversionServiceImpl {
    if (!DataConversionServiceImpl.instance) {
      DataConversionServiceImpl.instance = new DataConversionServiceImpl();
    }
    return DataConversionServiceImpl.instance;
  }

  /**
   * Get count of available historical data for each symbol
   */
  async getAvailableHistoricalData(): Promise<Record<string, number>> {
    const symbols = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
    const availability: Record<string, number> = {};
    
    for (const symbol of symbols) {
      const result = await db
        .select({ count: sql<number>`count(distinct date)` })
        .from(historicalStockData)
        .where(eq(historicalStockData.symbol, symbol));
      
      availability[symbol] = result[0]?.count || 0;
    }
    
    logger.info(`📊 Historical data availability: ${JSON.stringify(availability)}`);
    return availability;
  }

  /**
   * Convert our 43-day historical OHLCV data to technical indicators
   */
  async convertHistoricalDataToTechnical(symbols: string[]): Promise<void> {
    logger.info(`🔄 Converting historical OHLCV data to technical indicators for ${symbols.length} symbols`);
    
    for (const symbol of symbols) {
      const created = await this.calculateTechnicalIndicatorsFromOHLCV(symbol, 30);
      logger.info(`✅ Created ${created} technical indicator records for ${symbol}`);
    }
    
    logger.info(`✅ Historical data conversion completed`);
  }

  /**
   * Calculate technical indicators from OHLCV data for a specific symbol
   */
  async calculateTechnicalIndicatorsFromOHLCV(symbol: string, days: number): Promise<number> {
    try {
      // Get historical OHLCV data ordered by date
      const historicalData = await db
        .select()
        .from(historicalStockData)
        .where(eq(historicalStockData.symbol, symbol))
        .orderBy(historicalStockData.date)
        .limit(days);

      if (historicalData.length < 20) {
        logger.warn(`Insufficient data for ${symbol}: only ${historicalData.length} records`);
        return 0;
      }

      let created = 0;
      
      // Process each day of data
      for (let i = 19; i < historicalData.length; i++) { // Start at index 19 to have 20 days for calculations
        const currentData = historicalData[i];
        const historicalWindow = historicalData.slice(Math.max(0, i - 19), i + 1); // 20-day window
        
        // Calculate technical indicators
        const technicalData = this.calculateTechnicalIndicators(currentData, historicalWindow);
        
        // Check if record already exists
        const existing = await db
          .select()
          .from(technicalIndicators)
          .where(
            and(
              eq(technicalIndicators.symbol, symbol),
              eq(technicalIndicators.timestamp, currentData.date)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(technicalIndicators).values({
            symbol: symbol,
            timestamp: currentData.date,
            rsi: technicalData.rsi,
            macd_line: technicalData.macd,
            macdSignal: technicalData.macdSignal,
            macdHistogram: technicalData.macdHistogram,
            ema_12: technicalData.ema_12,
            ema_26: technicalData.ema_26,
            bb_upper: technicalData.bb_upper,
            bb_middle: technicalData.bb_middle,
            bb_lower: technicalData.bb_lower,
            percent_b: technicalData.percent_b,
            adx: technicalData.adx,
            stoch_k: technicalData.stoch_k,
            stoch_d: technicalData.stoch_d,
            sma_20: technicalData.sma_20,
            sma_50: technicalData.sma_50,
            vwap: technicalData.vwap,
            atr: technicalData.atr,
            willr: technicalData.willr,
          });
          created++;
        }
      }
      
      return created;
      
    } catch (error) {
      logger.error(`Error calculating technical indicators for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Calculate technical indicators from OHLCV data
   */
  private calculateTechnicalIndicators(
    currentData: { open: number; high: number; low: number; close: number; volume?: number }, 
    historicalWindow: Array<{ open: number; high: number; low: number; close: number; volume?: number }>
  ): {
    rsi: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    ema_12: number | null;
    ema_26: number | null;
    bb_upper: number | null;
    bb_middle: number | null;
    bb_lower: number | null;
    percent_b: number | null;
    adx: number | null;
    stoch_k: number | null;
    stoch_d: number | null;
    sma_20: number | null;
    sma_50: number | null;
    vwap: number | null;
    atr: number | null;
    willr: number | null;
  } {
    const closes = historicalWindow.map(d => parseFloat(d.close));
    const highs = historicalWindow.map(d => parseFloat(d.high));
    const lows = historicalWindow.map(d => parseFloat(d.low));
    const volumes = historicalWindow.map(d => parseFloat(d.volume || 0));
    
    // Simple Moving Averages - Use fixed periods for indicator integrity
    const sma_20 = this.calculateSMA(closes, 20);
    const sma_50 = this.calculateSMA(closes, 50);
    
    // RSI (14-period) - Fixed period requirement
    const rsi = this.calculateRSI(closes, 14);
    
    // MACD (12, 26, 9) - Fixed periods for accurate calculation
    const { macd, signal, histogram, ema12, ema26 } = this.calculateMACD(closes);
    
    // Bollinger Bands (20-period) - Standard period
    const { upper, middle, lower, percent_b } = this.calculateBollingerBands(closes, 20, 2);
    
    // ATR (14-period) - Fixed period requirement  
    const atr = this.calculateATR(highs, lows, closes, 14);
    
    // Williams %R (14-period) - Fixed period requirement
    const willr = this.calculateWilliamsR(highs, lows, closes, 14);
    
    // Stochastic %K and %D (14-period) - Fixed period requirement
    const { stoch_k, stoch_d } = this.calculateStochastic(highs, lows, closes, 14);
    
    // VWAP
    const vwap = this.calculateVWAP(closes, highs, lows, volumes);
    
    return {
      rsi: rsi ? rsi.toFixed(2) : null,
      macd: macd ? macd.toFixed(4) : null,
      macdSignal: signal ? signal.toFixed(4) : null,
      macdHistogram: histogram ? histogram.toFixed(4) : null,
      ema_12: ema12 ? ema12.toFixed(2) : null,
      ema_26: ema26 ? ema26.toFixed(2) : null,
      bb_upper: upper ? upper.toFixed(2) : null,
      bb_middle: middle ? middle.toFixed(2) : null,
      bb_lower: lower ? lower.toFixed(2) : null,
      percent_b: percent_b ? percent_b.toFixed(4) : null,
      adx: null, // Complex calculation - skip for now
      stoch_k: stoch_k ? stoch_k.toFixed(2) : null,
      stoch_d: stoch_d ? stoch_d.toFixed(2) : null,
      sma_20: sma_20 ? sma_20.toFixed(2) : null,
      sma_50: sma_50 ? sma_50.toFixed(2) : null,
      vwap: vwap ? vwap.toFixed(2) : null,
      atr: atr ? atr.toFixed(4) : null,
      willr: willr ? willr.toFixed(2) : null,
    };
  }

  // Technical indicator calculation methods
  private calculateSMA(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  private calculateRSI(closes: number[], period: number = 14): number | null {
    if (closes.length < period + 1) return null;

    // Build changes array first (more accurate method per your plan)
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

  private calculateMACD(closes: number[]): { 
    macd: number | null; 
    signal: number | null; 
    histogram: number | null;
    ema12: number | null;
    ema26: number | null;
  } {
    // Need at least 52 data points for proper MACD (26*2 for EMA seeding + 9 for signal)
    if (closes.length < 61) return { macd: null, signal: null, histogram: null, ema12: null, ema26: null };

    // Calculate current EMAs for storage
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);

    if (!ema12 || !ema26) return { macd: null, signal: null, histogram: null, ema12: null, ema26: null };

    // Calculate EMAs for each data point to build MACD history (per your plan)
    const macdHistory: number[] = [];

    // Start from index 26 to have sufficient EMA history (as per your plan)
    for (let i = 26; i < closes.length; i++) {
      const windowData = closes.slice(0, i + 1);
      const historicalEma12 = this.calculateEMA(windowData, 12);
      const historicalEma26 = this.calculateEMA(windowData, 26);

      if (historicalEma12 && historicalEma26) {
        macdHistory.push(historicalEma12 - historicalEma26);
      }
    }

    if (macdHistory.length < 9) return { macd: null, signal: null, histogram: null, ema12, ema26 };

    const currentMacd = ema12 - ema26;

    // Calculate 9-period EMA of MACD line for signal
    const signal = this.calculateEMA(macdHistory, 9);

    const histogram = signal ? currentMacd - signal : null;

    return {
      macd: currentMacd,
      signal,
      histogram,
      ema12,
      ema26
    };
  }

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

  private calculateBollingerBands(closes: number[], period: number = 20, multiplier: number = 2): {
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
    // Use sample variance (n-1) instead of population variance (n) for better accuracy
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / (period - 1);
    const stdDev = Math.sqrt(variance);
    
    const upper = sma + (multiplier * stdDev);
    const lower = sma - (multiplier * stdDev);
    const currentPrice = closes[closes.length - 1];
    const percent_b = (currentPrice - lower) / (upper - lower);
    
    return {
      upper,
      middle: sma,
      lower,
      percent_b
    };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number | null {
    if (highs.length < period + 1) return null;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
  }

  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number | null {
    if (highs.length < period) return null;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number = 14): { 
    stoch_k: number | null; 
    stoch_d: number | null; 
  } {
    if (highs.length < period) return { stoch_k: null, stoch_d: null };
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const stoch_k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // %D is typically a 3-period SMA of %K - simplified here
    return { stoch_k, stoch_d: null };
  }

  private calculateVWAP(closes: number[], highs: number[], lows: number[], volumes: number[]): number | null {
    if (closes.length === 0) return null;
    
    let totalPriceVolume = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      const volume = volumes[i] || 1;
      
      totalPriceVolume += typicalPrice * volume;
      totalVolume += volume;
    }
    
    return totalVolume > 0 ? totalPriceVolume / totalVolume : null;
  }
}

export const dataConversionService = DataConversionServiceImpl.getInstance();