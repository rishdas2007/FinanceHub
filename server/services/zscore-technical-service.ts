import { db } from '../db';
import { 
  zscoreTechnicalIndicators, 
  rollingStatistics, 
  technicalIndicators, 
  historicalStockData 
} from '@shared/schema';
import { desc, eq, and, gte, sql, lte } from 'drizzle-orm';
import { logger } from '../middleware/logging';

export interface ZScoreIndicators {
  symbol: string;
  date: Date;
  
  // Original indicators
  rsi: number | null;
  macd: number | null;
  percentB: number | null;
  atr: number | null;
  priceChange: number | null;
  maTrend: number | null;
  
  // Z-Score normalized indicators
  rsiZScore: number | null;
  macdZScore: number | null;
  bollingerZScore: number | null;
  atrZScore: number | null;
  priceMomentumZScore: number | null;
  maTrendZScore: number | null;
  
  // Composite signal
  compositeZScore: number | null;
  signal: 'BUY' | 'SELL' | 'HOLD';
  signalStrength: number | null;
}

export interface ZScoreWeights {
  rsi: number;
  macd: number;
  bollinger: number;
  maTrend: number;
  priceMomentum: number;
  atr: number;
}

class ZScoreTechnicalService {
  private static instance: ZScoreTechnicalService;
  
  // Z-Score Momentum-Focused Weights (from your specification)
  private readonly weights: ZScoreWeights = {
    rsi: 0.30,           // Primary momentum signal
    macd: 0.25,          // Trend confirmation
    bollinger: 0.20,     // Volatility/reversal
    maTrend: 0.10,       // Trend direction
    priceMomentum: 0.10, // Statistical momentum
    atr: 0.05            // Volatility context
  };
  
  // Signal thresholds
  private readonly BUY_THRESHOLD = 0.25;
  private readonly SELL_THRESHOLD = -0.25;
  private readonly ZSCORE_WINDOW = 20; // 20-day rolling window
  
  public static getInstance(): ZScoreTechnicalService {
    if (!ZScoreTechnicalService.instance) {
      ZScoreTechnicalService.instance = new ZScoreTechnicalService();
    }
    return ZScoreTechnicalService.instance;
  }

  /**
   * Calculate Z-Score: (Current Value - 20-day Mean) / 20-day Standard Deviation
   */
  private calculateZScore(currentValue: number, mean: number, stdDev: number): number {
    if (stdDev === 0 || isNaN(stdDev) || isNaN(currentValue) || isNaN(mean)) {
      return 0; // Avoid division by zero or NaN values
    }
    return (currentValue - mean) / stdDev;
  }

  /**
   * Convert Z-score to signal strength (-1 to +1)
   */
  private zscoreToSignal(zscore: number): number {
    if (zscore > 1.5) return 1.0;   // Very bullish
    if (zscore < -1.5) return -1.0; // Very bearish
    if (zscore > 0.5) return 0.5;   // Bullish
    if (zscore < -0.5) return -0.5; // Bearish
    return 0.0; // Neutral
  }

  /**
   * Calculate rolling statistics for a specific indicator
   */
  private async calculateRollingStats(
    symbol: string, 
    indicator: string, 
    values: Array<{ date: Date; value: number }>,
    windowSize: number = 20
  ): Promise<Array<{ date: Date; mean: number; stdDev: number; count: number }>> {
    const results: Array<{ date: Date; mean: number; stdDev: number; count: number }> = [];
    
    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      const windowValues = window.map(w => w.value);
      
      const mean = windowValues.reduce((sum, val) => sum + val, 0) / windowSize;
      const variance = windowValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowSize;
      const stdDev = Math.sqrt(variance);
      
      results.push({
        date: values[i].date,
        mean,
        stdDev,
        count: windowSize
      });
    }
    
    return results;
  }

  /**
   * Fetch historical technical indicators for Z-score calculation
   */
  private async getHistoricalTechnicalData(symbol: string, lookbackDays: number = 60): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    try {
      const historicalData = await db
        .select()
        .from(technicalIndicators)
        .where(
          and(
            eq(technicalIndicators.symbol, symbol),
            gte(technicalIndicators.timestamp, cutoffDate)
          )
        )
        .orderBy(technicalIndicators.timestamp);
      
      return historicalData;
    } catch (error) {
      logger.error(`Error fetching historical technical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate price momentum (daily returns)
   */
  private async calculatePriceMomentum(symbol: string, lookbackDays: number = 60): Promise<Array<{ date: Date; priceChange: number }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    try {
      const priceData = await db
        .select()
        .from(historicalStockData)
        .where(
          and(
            eq(historicalStockData.symbol, symbol),
            gte(historicalStockData.date, cutoffDate)
          )
        )
        .orderBy(historicalStockData.date);
      
      const momentum: Array<{ date: Date; priceChange: number }> = [];
      
      for (let i = 1; i < priceData.length; i++) {
        const currentPrice = parseFloat(priceData[i].close.toString());
        const previousPrice = parseFloat(priceData[i - 1].close.toString());
        const priceChange = (currentPrice - previousPrice) / previousPrice;
        
        momentum.push({
          date: priceData[i].date,
          priceChange
        });
      }
      
      return momentum;
    } catch (error) {
      logger.error(`Error calculating price momentum for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Process Z-Score calculations for a single ETF
   */
  public async processETFZScores(symbol: string): Promise<ZScoreIndicators | null> {
    try {
      logger.info(`🔄 Processing Z-Score calculations for ${symbol}`);
      
      // Fetch historical technical indicators
      const historicalTech = await this.getHistoricalTechnicalData(symbol);
      if (historicalTech.length < this.ZSCORE_WINDOW) {
        logger.warn(`Insufficient data for ${symbol}: ${historicalTech.length} records`);
        return null;
      }

      // Fetch price momentum data
      const priceMomentum = await this.calculatePriceMomentum(symbol);
      
      // Get the latest technical indicators
      const latest = historicalTech[historicalTech.length - 1];
      if (!latest) return null;

      // Prepare data for Z-score calculations
      const rsiValues = historicalTech
        .filter(h => h.rsi !== null)
        .map(h => ({ date: h.timestamp, value: parseFloat(h.rsi?.toString() || '0') }));
      
      const macdValues = historicalTech
        .filter(h => h.macd !== null)
        .map(h => ({ date: h.timestamp, value: parseFloat(h.macd?.toString() || '0') }));
      
      const percentBValues = historicalTech
        .filter(h => h.percent_b !== null)
        .map(h => ({ date: h.timestamp, value: parseFloat(h.percent_b?.toString() || '0') }));
      
      const atrValues = historicalTech
        .filter(h => h.atr !== null)
        .map(h => ({ date: h.timestamp, value: parseFloat(h.atr?.toString() || '0') }));
      
      const maTrendValues = historicalTech
        .filter(h => h.sma_20 !== null && h.sma_50 !== null && 
                     h.sma_20 !== '' && h.sma_50 !== '' &&
                     parseFloat(h.sma_20?.toString() || '0') > 0 && 
                     parseFloat(h.sma_50?.toString() || '0') > 0)
        .map(h => ({
          date: h.timestamp,
          value: parseFloat(h.sma_20?.toString() || '0') - parseFloat(h.sma_50?.toString() || '0')
        }));

      const priceChangeValues = priceMomentum.map(p => ({ date: p.date, value: p.priceChange }));

      // Calculate rolling statistics for each indicator
      const [rsiStats, macdStats, bollingerStats, atrStats, maTrendStats, priceStats] = await Promise.all([
        this.calculateRollingStats(symbol, 'rsi', rsiValues),
        this.calculateRollingStats(symbol, 'macd', macdValues),
        this.calculateRollingStats(symbol, 'bollinger', percentBValues),
        this.calculateRollingStats(symbol, 'atr', atrValues),
        this.calculateRollingStats(symbol, 'ma_trend', maTrendValues),
        this.calculateRollingStats(symbol, 'price_momentum', priceChangeValues)
      ]);

      // Get current values
      const currentRsi = parseFloat(latest.rsi?.toString() || '0');
      const currentMacd = parseFloat(latest.macd?.toString() || '0');
      const currentPercentB = parseFloat(latest.percent_b?.toString() || '0');
      const currentAtr = parseFloat(latest.atr?.toString() || '0');
      const currentMaTrend = parseFloat(latest.sma_20?.toString() || '0') - parseFloat(latest.sma_50?.toString() || '0');
      const currentPriceChange = priceMomentum[priceMomentum.length - 1]?.priceChange || 0;

      // Calculate Z-scores
      const latestRsiStats = rsiStats[rsiStats.length - 1];
      const latestMacdStats = macdStats[macdStats.length - 1];
      const latestBollingerStats = bollingerStats[bollingerStats.length - 1];
      const latestAtrStats = atrStats[atrStats.length - 1];
      const latestMaTrendStats = maTrendStats[maTrendStats.length - 1];
      const latestPriceStats = priceStats[priceStats.length - 1];

      const rsiZScore = latestRsiStats ? this.calculateZScore(currentRsi, latestRsiStats.mean, latestRsiStats.stdDev) : null;
      const macdZScore = latestMacdStats ? this.calculateZScore(currentMacd, latestMacdStats.mean, latestMacdStats.stdDev) : null;
      const bollingerZScore = latestBollingerStats ? this.calculateZScore(currentPercentB, latestBollingerStats.mean, latestBollingerStats.stdDev) : null;
      const atrZScore = latestAtrStats ? this.calculateZScore(currentAtr, latestAtrStats.mean, latestAtrStats.stdDev) : null;
      const maTrendZScore = latestMaTrendStats ? this.calculateZScore(currentMaTrend, latestMaTrendStats.mean, latestMaTrendStats.stdDev) : null;
      
      // Debug MA Trend calculation
      if (symbol === 'SPY') {
        logger.info(`🔍 MA Trend Debug for ${symbol}:`, {
          currentSMA20: parseFloat(latest.sma_20?.toString() || '0'),
          currentSMA50: parseFloat(latest.sma_50?.toString() || '0'),
          currentMaTrend,
          maTrendDataPoints: maTrendValues.length,
          historicalTechLength: historicalTech.length,
          historicalSMA50Records: historicalTech.filter(h => h.sma_50 !== null && h.sma_50 !== '').length,
          latestMaTrendStats: latestMaTrendStats ? {
            mean: latestMaTrendStats.mean,
            stdDev: latestMaTrendStats.stdDev
          } : null,
          maTrendZScore,
          sampleMaTrendValues: maTrendValues.slice(-5).map(v => ({ 
            date: v.date.toISOString().split('T')[0], 
            value: v.value 
          }))
        });
      }
      const priceMomentumZScore = latestPriceStats ? this.calculateZScore(currentPriceChange, latestPriceStats.mean, latestPriceStats.stdDev) : null;

      // Calculate composite Z-score with weights
      const compositeZScore = (
        (rsiZScore !== null ? this.weights.rsi * this.zscoreToSignal(rsiZScore) : 0) +
        (macdZScore !== null ? this.weights.macd * this.zscoreToSignal(macdZScore) : 0) +
        (bollingerZScore !== null ? this.weights.bollinger * this.zscoreToSignal(bollingerZScore) : 0) +
        (maTrendZScore !== null ? this.weights.maTrend * this.zscoreToSignal(maTrendZScore) : 0) +
        (priceMomentumZScore !== null ? this.weights.priceMomentum * this.zscoreToSignal(priceMomentumZScore) : 0) +
        (atrZScore !== null ? this.weights.atr * this.zscoreToSignal(atrZScore) : 0)
      );

      // Generate signal
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (compositeZScore >= this.BUY_THRESHOLD) signal = 'BUY';
      else if (compositeZScore <= this.SELL_THRESHOLD) signal = 'SELL';

      const result: ZScoreIndicators = {
        symbol,
        date: latest.timestamp,
        
        // Original indicators
        rsi: currentRsi,
        macd: currentMacd,
        percentB: currentPercentB,
        atr: currentAtr,
        priceChange: currentPriceChange,
        maTrend: currentMaTrend,
        
        // Z-Score normalized indicators
        rsiZScore,
        macdZScore,
        bollingerZScore,
        atrZScore,
        priceMomentumZScore,
        maTrendZScore,
        
        // Composite signal
        compositeZScore,
        signal,
        signalStrength: Math.abs(compositeZScore)
      };

      // Store in database
      await this.storeZScoreData(result);
      
      logger.info(`✅ Z-Score calculation completed for ${symbol}: ${signal} (${compositeZScore.toFixed(4)})`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Error processing Z-Score for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Store Z-score data in database
   */
  private async storeZScoreData(data: ZScoreIndicators): Promise<void> {
    try {
      await db.insert(zscoreTechnicalIndicators).values({
        symbol: data.symbol,
        date: data.date,
        
        // Original indicators
        rsi: data.rsi?.toString(),
        macd: data.macd?.toString(),
        percentB: data.percentB?.toString(),
        atr: data.atr?.toString(),
        priceChange: data.priceChange?.toString(),
        maTrend: data.maTrend?.toString(),
        
        // Z-Score normalized indicators
        rsiZScore: data.rsiZScore?.toString(),
        macdZScore: data.macdZScore?.toString(),
        bollingerZScore: data.bollingerZScore?.toString(),
        atrZScore: data.atrZScore?.toString(),
        priceMomentumZScore: data.priceMomentumZScore?.toString(),
        maTrendZScore: data.maTrendZScore?.toString(),
        
        // Composite signal
        compositeZScore: data.compositeZScore?.toString(),
        signal: data.signal,
        signalStrength: data.signalStrength?.toString()
      })
      .onConflictDoUpdate({
        target: [zscoreTechnicalIndicators.symbol, zscoreTechnicalIndicators.date],
        set: {
          compositeZScore: data.compositeZScore?.toString(),
          signal: data.signal,
          signalStrength: data.signalStrength?.toString(),
          updatedAt: new Date()
        }
      });
      
    } catch (error) {
      logger.error(`Error storing Z-score data for ${data.symbol}:`, error);
    }
  }

  /**
   * Process Z-scores for all ETFs
   */
  public async processAllETFZScores(): Promise<ZScoreIndicators[]> {
    const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
    const results: ZScoreIndicators[] = [];
    
    logger.info(`🔄 Processing Z-Score calculations for ${ETF_SYMBOLS.length} ETFs`);
    
    for (const symbol of ETF_SYMBOLS) {
      const result = await this.processETFZScores(symbol);
      if (result) {
        results.push(result);
      }
    }
    
    logger.info(`✅ Completed Z-Score processing: ${results.length}/${ETF_SYMBOLS.length} ETFs`);
    return results;
  }

  /**
   * Get latest Z-score data for an ETF
   */
  public async getLatestZScoreData(symbol: string): Promise<ZScoreIndicators | null> {
    try {
      const latest = await db
        .select()
        .from(zscoreTechnicalIndicators)
        .where(eq(zscoreTechnicalIndicators.symbol, symbol))
        .orderBy(desc(zscoreTechnicalIndicators.date))
        .limit(1);
      
      if (latest.length === 0) return null;
      
      const data = latest[0];
      return {
        symbol: data.symbol,
        date: data.date,
        
        // Original indicators
        rsi: data.rsi ? parseFloat(data.rsi.toString()) : null,
        macd: data.macd ? parseFloat(data.macd.toString()) : null,
        percentB: data.percentB ? parseFloat(data.percentB.toString()) : null,
        atr: data.atr ? parseFloat(data.atr.toString()) : null,
        priceChange: data.priceChange ? parseFloat(data.priceChange.toString()) : null,
        maTrend: data.maTrend ? parseFloat(data.maTrend.toString()) : null,
        
        // Z-Score normalized indicators
        rsiZScore: data.rsiZScore ? parseFloat(data.rsiZScore.toString()) : null,
        macdZScore: data.macdZScore ? parseFloat(data.macdZScore.toString()) : null,
        bollingerZScore: data.bollingerZScore ? parseFloat(data.bollingerZScore.toString()) : null,
        atrZScore: data.atrZScore ? parseFloat(data.atrZScore.toString()) : null,
        priceMomentumZScore: data.priceMomentumZScore ? parseFloat(data.priceMomentumZScore.toString()) : null,
        maTrendZScore: data.maTrendZScore ? parseFloat(data.maTrendZScore.toString()) : null,
        
        // Composite signal
        compositeZScore: data.compositeZScore ? parseFloat(data.compositeZScore.toString()) : null,
        signal: data.signal as 'BUY' | 'SELL' | 'HOLD',
        signalStrength: data.signalStrength ? parseFloat(data.signalStrength.toString()) : null
      };
      
    } catch (error) {
      logger.error(`Error fetching latest Z-score data for ${symbol}:`, error);
      return null;
    }
  }
}

export const zscoreTechnicalService = ZScoreTechnicalService.getInstance();