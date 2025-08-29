import { db } from '../db';
import { equityDailyBars, equityFeaturesDaily, historicalStockData } from '@shared/schema-v2';
import { desc, eq, and, gte, sql, asc } from 'drizzle-orm';
import { logger } from '../middleware/logging';
import { welfordStats, hasSufficientData, calculateRSI } from '@shared/utils/statistics';

const PIPELINE_VERSION = 'v1.0.0';
const ETF_SYMBOLS = ['SPY', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE', 'XRT'];

export class EquityFeaturesETL {
  
  /**
   * Backfill equity_daily_bars from historical_stock_data
   */
  async backfillDailyBars(symbols: string[] = ETF_SYMBOLS): Promise<void> {
    logger.info('🔄 Starting daily bars backfill');
    
    for (const symbol of symbols) {
      try {
        // Get historical data for this symbol
        const historicalData = await db
          .select()
          .from(historicalStockData)
          .where(eq(historicalStockData.symbol, symbol))
          .orderBy(asc(historicalStockData.date));
        
        if (historicalData.length === 0) {
          logger.warn(`No historical data found for ${symbol}`);
          continue;
        }
        
        // Transform and insert into equity_daily_bars
        const dailyBars = historicalData.map(row => ({
          symbol: row.symbol,
          tsUtc: new Date(row.date),
          open: parseFloat(row.open.toString()),
          high: parseFloat(row.high.toString()),
          low: parseFloat(row.low.toString()),
          close: parseFloat(row.close.toString()),
          volume: row.volume
        }));
        
        // Upsert daily bars
        for (const bar of dailyBars) {
          await db.insert(equityDailyBars)
            .values({
              symbol: bar.symbol,
              tsUtc: bar.tsUtc,
              open: bar.open.toString(),
              high: bar.high.toString(),
              low: bar.low.toString(),
              close: bar.close.toString(),
              volume: bar.volume
            })
            .onConflictDoNothing();
        }
        
        logger.info(`✅ Backfilled ${dailyBars.length} daily bars for ${symbol}`);
        
      } catch (error) {
        logger.error(`Failed to backfill daily bars for ${symbol}:`, error);
      }
    }
    
    logger.info('✅ Daily bars backfill completed');
  }
  
  /**
   * Compute and store technical features for last N trading days
   */
  async computeFeatures(symbols: string[] = ETF_SYMBOLS, lookbackDays: number = 400): Promise<void> {
    logger.info('🔄 Starting feature computation');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    for (const symbol of symbols) {
      try {
        await this.computeFeaturesForSymbol(symbol, cutoffDate);
        logger.info(`✅ Computed features for ${symbol}`);
      } catch (error) {
        logger.error(`Failed to compute features for ${symbol}:`, error);
      }
    }
    
    logger.info('✅ Feature computation completed');
  }
  
  /**
   * Compute features for a single symbol
   */
  private async computeFeaturesForSymbol(symbol: string, fromDate: Date): Promise<void> {
    // Get daily bars for this symbol
    const dailyBars = await db
      .select()
      .from(equityDailyBars)
      .where(and(
        eq(equityDailyBars.symbol, symbol),
        gte(equityDailyBars.tsUtc, fromDate)
      ))
      .orderBy(asc(equityDailyBars.tsUtc));
    
    if (dailyBars.length < 180) {
      logger.warn(`Insufficient data for ${symbol}: ${dailyBars.length} bars`);
      return;
    }
    
    // Compute features for different horizons
    const horizons = [
      { name: '20D', window: 20 },
      { name: '60D', window: 60 },
      { name: '252D', window: 252 },
      { name: 'RSI14', window: 14 }
    ];
    
    for (const horizon of horizons) {
      await this.computeHorizonFeatures(symbol, dailyBars, horizon);
    }
  }
  
  /**
   * Compute features for a specific horizon
   */
  private async computeHorizonFeatures(
    symbol: string, 
    dailyBars: any[], 
    horizon: { name: string; window: number }
  ): Promise<void> {
    
    const closes = dailyBars.map(bar => bar.close);
    const highs = dailyBars.map(bar => bar.high);
    const lows = dailyBars.map(bar => bar.low);
    
    // Only compute for dates where we have sufficient lookback
    for (let i = Math.max(horizon.window, 252); i < dailyBars.length; i++) {
      const currentBar = dailyBars[i];
      const asofDate = new Date(currentBar.tsUtc).toISOString().split('T')[0];
      
      // Get lookback window
      const windowCloses = closes.slice(Math.max(0, i - horizon.window), i + 1);
      const windowHighs = highs.slice(Math.max(0, i - horizon.window), i + 1);
      const windowLows = lows.slice(Math.max(0, i - horizon.window), i + 1);
      
      // Get 252-day window for Z-score calculation
      const longWindowCloses = closes.slice(Math.max(0, i - 252), i + 1);
      
      // Compute technical indicators
      const rsi = horizon.name === 'RSI14' ? calculateRSI(windowCloses, 14) : null;
      const macd = null; // TODO: Implement MACD calculation
      const bollinger = null; // TODO: Implement Bollinger Bands calculation
      
      // Compute moving averages
      const sma20 = windowCloses.length >= 20 ? 
        windowCloses.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const sma50 = windowCloses.length >= 50 ? 
        windowCloses.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;
      const sma200 = windowCloses.length >= 200 ? 
        windowCloses.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;
      
      // Compute Z-score
      const stats = welfordStats(longWindowCloses);
      const zClose = stats.count >= 180 && stats.stdDev > 1e-8 ? 
        (currentBar.close - stats.mean) / stats.stdDev : null;
      
      // Quality assessment
      const hasQualityData = stats.count >= 180 && stats.stdDev > 1e-8;
      const dataQuality = hasQualityData ? 'high' : stats.count >= 60 ? 'medium' : 'low';
      
      // Store features
      const features = {
        symbol,
        asofDate: asofDate,
        horizon: horizon.name,
        rsi14: rsi,
        macd: macd?.macd || null,
        macdSignal: macd?.signal || null,
        bollUp: bollinger?.upper || null,
        bollMid: bollinger?.middle || null,
        bollLow: bollinger?.lower || null,
        zClose,
        sma20,
        sma50,
        sma200,
        atr: null, // TODO: Implement ATR calculation
        percentB: bollinger?.percentB || null,
        observations: stats.count,
        meanValue: stats.mean,
        stdDev: stats.stdDev,
        dataQuality,
        hasSufficientData: hasQualityData,
        pipelineVersion: PIPELINE_VERSION,
        extras: {}
      };
      
      // Upsert features
      await db.insert(equityFeaturesDaily)
        .values([features])
        .onConflictDoNothing();
    }
  }
  
  /**
   * Get latest features for symbols (for API consumption)
   */
  async getLatestFeatures(symbols: string[] = ETF_SYMBOLS): Promise<any[]> {
    const results = [];
    
    for (const symbol of symbols) {
      // Get most recent features for each horizon
      const features = await db
        .select()
        .from(equityFeaturesDaily)
        .where(eq(equityFeaturesDaily.symbol, symbol))
        .orderBy(desc(equityFeaturesDaily.asofDate))
        .limit(10); // Get recent features across horizons
      
      if (features.length > 0) {
        // Combine features from different horizons
        const combinedFeatures = this.combineFeatures(symbol, features);
        results.push(combinedFeatures);
      }
    }
    
    return results;
  }
  
  /**
   * Combine features from different horizons into a single ETF metrics object
   */
  private combineFeatures(symbol: string, features: any[]): any {
    // Find latest features by horizon
    const latestByHorizon = features.reduce((acc, feature) => {
      if (!acc[feature.horizon] || feature.asofDate > acc[feature.horizon].asofDate) {
        acc[feature.horizon] = feature;
      }
      return acc;
    }, {} as Record<string, any>);
    
    const rsi14 = latestByHorizon['RSI14'];
    const daily20 = latestByHorizon['20D'];
    const daily252 = latestByHorizon['252D'];
    
    return {
      symbol,
      name: this.getETFName(symbol),
      price: 0, // Will be filled by quote service
      changePercent: 0, // Will be filled by quote service
      
      // Technical indicators
      rsi: rsi14?.rsi14 || null,
      macd: daily20?.macd || null,
      bollingerPosition: daily20?.percentB || null,
      atr: daily20?.atr || null,
      
      // Z-Score data
      zScoreData: {
        rsiZScore: null, // TODO: Implement
        macdZScore: null, // TODO: Implement  
        bollingerZScore: null, // TODO: Implement
        compositeZScore: daily252?.zClose || null,
        signal: this.deriveSignal(daily252?.zClose),
        regimeAware: daily252?.hasSufficientData || false
      },
      
      // Quality flags
      fallback: !daily20?.hasSufficientData,
      dataQuality: daily20?.dataQuality || 'low',
      
      // Source tracking
      source: 'db',
      cached: false,
      pipelineVersion: PIPELINE_VERSION
    };
  }
  
  private deriveSignal(zScore: number | null): string | null {
    if (zScore === null) return null;
    if (zScore > 1.5) return 'SELL';
    if (zScore < -1.5) return 'BUY';
    return 'HOLD';
  }
  
  private getETFName(symbol: string): string {
    const names: Record<string, string> = {
      'SPY': 'SPDR S&P 500 ETF',
      'XLK': 'Technology Select Sector SPDR Fund',
      'XLF': 'Financial Select Sector SPDR Fund',
      'XLE': 'Energy Select Sector SPDR Fund',
      'XLV': 'Health Care Select Sector SPDR Fund',
      'XLI': 'Industrial Select Sector SPDR Fund',
      'XLP': 'Consumer Staples Select Sector SPDR Fund',
      'XLY': 'Consumer Discretionary Select Sector SPDR Fund',
      'XLU': 'Utilities Select Sector SPDR Fund',
      'XLB': 'Materials Select Sector SPDR Fund',
      'XLRE': 'Real Estate Select Sector SPDR Fund',
      'XRT': 'SPDR S&P Retail ETF'
    };
    return names[symbol] || symbol;
  }
}

export const equityFeaturesETL = new EquityFeaturesETL();