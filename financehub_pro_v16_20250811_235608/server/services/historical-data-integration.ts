import { db } from '../db';
import { 
  technicalIndicators, 
  zscoreTechnicalIndicators,
  rollingStatistics 
} from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { logger } from '../middleware/logging';

export interface HistoricalDataIntegrationService {
  backfillHistoricalData(symbols: string[], requiredDays: number): Promise<void>;
  calculateMissingZScores(symbols: string[]): Promise<void>;
  getDataAvailability(symbols: string[]): Promise<Record<string, { 
    historical: number; 
    technical: number; 
    needed: number; 
  }>>;
}

class HistoricalDataIntegrationServiceImpl implements HistoricalDataIntegrationService {
  private static instance: HistoricalDataIntegrationServiceImpl;
  
  public static getInstance(): HistoricalDataIntegrationServiceImpl {
    if (!HistoricalDataIntegrationServiceImpl.instance) {
      HistoricalDataIntegrationServiceImpl.instance = new HistoricalDataIntegrationServiceImpl();
    }
    return HistoricalDataIntegrationServiceImpl.instance;
  }

  /**
   * Get data availability status for Z-score calculations
   */
  async getDataAvailability(symbols: string[]): Promise<Record<string, { 
    historical: number; 
    technical: number; 
    needed: number; 
  }>> {
    const availability: Record<string, { historical: number; technical: number; needed: number }> = {};
    
    for (const symbol of symbols) {
      try {
        // Check historical stock data (OHLCV)
        // historicalStockData table removed during technical debt cleanup
        const historicalCount = [{ count: 0 }];

        // Check technical indicators data
        const technicalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(technicalIndicators)
          .where(eq(technicalIndicators.symbol, symbol));

        const historical = historicalCount[0]?.count || 0;
        const technical = technicalCount[0]?.count || 0;
        const needed = Math.max(0, 25 - Math.max(historical, technical)); // Need 25 days for robust 20-day windows

        availability[symbol] = { historical, technical, needed };
        
        logger.info(`📊 Data availability for ${symbol}: Historical=${historical}, Technical=${technical}, Need=${needed} more days`);
        
      } catch (error) {
        logger.error(`Error checking data availability for ${symbol}:`, error);
        availability[symbol] = { historical: 0, technical: 0, needed: 25 };
      }
    }
    
    return availability;
  }

  /**
   * Backfill historical data using existing databases first, then Twelve Data API for gaps
   */
  async backfillHistoricalData(symbols: string[], requiredDays: number = 25): Promise<void> {
    logger.info(`🔄 Starting historical data backfill for ${symbols.length} symbols (${requiredDays} days required)`);
    
    const availability = await this.getDataAvailability(symbols);
    
    for (const symbol of symbols) {
      const { historical, technical, needed } = availability[symbol];
      
      if (needed === 0) {
        logger.info(`✅ ${symbol} already has sufficient data (${Math.max(historical, technical)} days)`);
        continue;
      }

      try {
        // Step 1: Use existing historical_stock_data to create technical indicators
        if (historical >= requiredDays) {
          logger.info(`📊 Converting historical stock data to technical indicators for ${symbol}`);
          await this.convertHistoricalStockDataToTechnical(symbol, requiredDays);
        } else {
          // Step 2: Fetch additional data from Twelve Data API (respecting rate limits)
          logger.info(`📡 Fetching ${needed} additional days for ${symbol} from Twelve Data API`);
          await this.fetchAdditionalDataFromAPI(symbol, needed);
        }
        
        // Step 3: Calculate Z-scores for the symbol
        await this.calculateZScoresForSymbol(symbol);
        
      } catch (error) {
        logger.error(`❌ Backfill failed for ${symbol}:`, error);
      }
    }
    
    logger.info(`✅ Historical data backfill completed`);
  }

  /**
   * Convert existing historical stock data to technical indicators format
   */
  private async convertHistoricalStockDataToTechnical(symbol: string, days: number): Promise<void> {
    try {
      // historicalStockData table removed during technical debt cleanup
      // Return empty array to maintain API compatibility
      const historicalData: any[] = [];

      if (historicalData.length === 0) {
        logger.warn(`No historical data found for ${symbol}`);
        return;
      }

      // Calculate basic technical indicators from OHLCV data
      for (const data of historicalData) {
        const technicalData = this.calculateBasicTechnicalIndicators(data, historicalData);
        
        // Check if technical data already exists for this date
        const existing = await db
          .select()
          .from(technicalIndicators)
          .where(
            and(
              eq(technicalIndicators.symbol, symbol),
              eq(technicalIndicators.timestamp, data.date)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          // Insert new technical indicator record
          await db.insert(technicalIndicators).values({
            symbol: symbol,
            timestamp: data.date,
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
          
          logger.info(`📈 Created technical indicators for ${symbol} on ${data.date.toISOString().split('T')[0]}`);
        }
      }
      
    } catch (error) {
      logger.error(`Error converting historical data for ${symbol}:`, error);
    }
  }

  /**
   * Calculate basic technical indicators from OHLCV data
   */
  private calculateBasicTechnicalIndicators(currentData: any, historicalData: any[]): any {
    const closes = historicalData.map(d => parseFloat(d.close)).reverse();
    const highs = historicalData.map(d => parseFloat(d.high)).reverse();
    const lows = historicalData.map(d => parseFloat(d.low)).reverse();
    const volumes = historicalData.map(d => parseFloat(d.volume || 0)).reverse();
    
    const currentIndex = closes.length - 1;
    const currentClose = parseFloat(currentData.close);
    
    // Simple Moving Averages
    const sma_20 = this.calculateSMA(closes, 20);
    const sma_50 = this.calculateSMA(closes, 50);
    
    // RSI (14-period)
    const rsi = this.calculateRSI(closes, 14);
    
    // Bollinger Bands
    const { upper, middle, lower, percent_b } = this.calculateBollingerBands(closes, 20, 2);
    
    // ATR (14-period)
    const atr = this.calculateATR(highs, lows, closes, 14);
    
    // Williams %R (14-period)
    const willr = this.calculateWilliamsR(highs, lows, closes, 14);
    
    // VWAP approximation
    const vwap = this.calculateVWAP(closes, highs, lows, volumes);
    
    return {
      rsi: rsi ? rsi.toFixed(2) : null,
      macd: null, // Would need more complex calculation
      macdSignal: null,
      bb_upper: upper ? upper.toFixed(2) : null,
      bb_middle: middle ? middle.toFixed(2) : null,
      bb_lower: lower ? lower.toFixed(2) : null,
      percent_b: percent_b ? percent_b.toFixed(4) : null,
      adx: null, // Complex calculation
      stoch_k: null, // Would need stochastic calculation
      stoch_d: null,
      sma_20: sma_20 ? sma_20.toFixed(2) : null,
      sma_50: sma_50 ? sma_50.toFixed(2) : null,
      vwap: vwap ? vwap.toFixed(2) : null,
      atr: atr ? atr.toFixed(4) : null,
      willr: willr ? willr.toFixed(2) : null,
    };
  }

  /**
   * Fetch additional data from Twelve Data API with rate limiting
   */
  private async fetchAdditionalDataFromAPI(symbol: string, additionalDays: number): Promise<void> {
    try {
      // Import and use existing twelve data service
      const { twelveDataService } = await import('../services/twelve-data');
      
      logger.info(`📡 Fetching ${additionalDays} days of data for ${symbol} from Twelve Data API`);
      
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const technicalData = await twelveDataService.getHistoricalTechnicalIndicators(symbol, additionalDays);
      
      if (technicalData && technicalData.length > 0) {
        logger.info(`✅ Fetched ${technicalData.length} technical data points for ${symbol}`);
      } else {
        logger.warn(`⚠️ No additional data received for ${symbol}`);
      }
      
    } catch (error) {
      logger.error(`Error fetching additional data for ${symbol}:`, error);
    }
  }

  /**
   * Calculate Z-scores for a specific symbol
   */
  private async calculateZScoresForSymbol(symbol: string): Promise<void> {
    try {
      const { ZScoreTechnicalService } = await import('./zscore-technical-service');
      const zscoreService = ZScoreTechnicalService.getInstance();
      
      const zscoreData = await zscoreService.calculateZScores(symbol);
      
      if (zscoreData) {
        logger.info(`📊 Calculated Z-scores for ${symbol}: Composite=${zscoreData.compositeZScore}, Signal=${zscoreData.signal}`);
      } else {
        logger.warn(`⚠️ Could not calculate Z-scores for ${symbol} - insufficient data`);
      }
      
    } catch (error) {
      logger.error(`Error calculating Z-scores for ${symbol}:`, error);
    }
  }

  /**
   * Calculate missing Z-scores for all symbols
   */
  async calculateMissingZScores(symbols: string[]): Promise<void> {
    logger.info(`🔄 Calculating missing Z-scores for ${symbols.length} symbols`);
    
    for (const symbol of symbols) {
      await this.calculateZScoresForSymbol(symbol);
      
      // Small delay between calculations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`✅ Z-score calculations completed`);
  }

  // Technical indicator calculation helpers
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

  private calculateVWAP(closes: number[], highs: number[], lows: number[], volumes: number[]): number | null {
    if (closes.length === 0) return null;
    
    let totalPriceVolume = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      const volume = volumes[i] || 1; // Default volume if not available
      
      totalPriceVolume += typicalPrice * volume;
      totalVolume += volume;
    }
    
    return totalVolume > 0 ? totalPriceVolume / totalVolume : null;
  }
}

export const historicalDataIntegrationService = HistoricalDataIntegrationServiceImpl.getInstance();