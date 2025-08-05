import { db } from '../db';
import { 
  technicalIndicators, 
  historicalStockData,
  zscoreTechnicalIndicators,
  rollingStatistics 
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
            macd: technicalData.macd,
            macdSignal: technicalData.macdSignal,
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
  private calculateTechnicalIndicators(currentData: any, historicalWindow: any[]): any {
    const closes = historicalWindow.map(d => parseFloat(d.close));
    const highs = historicalWindow.map(d => parseFloat(d.high));
    const lows = historicalWindow.map(d => parseFloat(d.low));
    const volumes = historicalWindow.map(d => parseFloat(d.volume || 0));
    
    // Simple Moving Averages
    const sma_20 = this.calculateSMA(closes, 20);
    const sma_50 = this.calculateSMA(closes, Math.min(50, closes.length));
    
    // RSI (14-period)
    const rsi = this.calculateRSI(closes, Math.min(14, closes.length - 1));
    
    // MACD (12, 26, 9)
    const { macd, signal } = this.calculateMACD(closes);
    
    // Bollinger Bands
    const { upper, middle, lower, percent_b } = this.calculateBollingerBands(closes, 20, 2);
    
    // ATR (14-period)
    const atr = this.calculateATR(highs, lows, closes, Math.min(14, closes.length - 1));
    
    // Williams %R (14-period)
    const willr = this.calculateWilliamsR(highs, lows, closes, Math.min(14, closes.length));
    
    // Stochastic %K and %D
    const { stoch_k, stoch_d } = this.calculateStochastic(highs, lows, closes, Math.min(14, closes.length));
    
    // VWAP
    const vwap = this.calculateVWAP(closes, highs, lows, volumes);
    
    return {
      rsi: rsi ? rsi.toFixed(2) : null,
      macd: macd ? macd.toFixed(4) : null,
      macdSignal: signal ? signal.toFixed(4) : null,
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
    
    let gains = 0;
    let losses = 0;
    
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(closes: number[]): { macd: number | null; signal: number | null } {
    if (closes.length < 26) return { macd: null, signal: null };
    
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    
    if (!ema12 || !ema26) return { macd: null, signal: null };
    
    const macd = ema12 - ema26;
    
    // For signal line, we'd need MACD history - simplified here
    return { macd, signal: null };
  }

  private calculateEMA(values: number[], period: number): number | null {
    if (values.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
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
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
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