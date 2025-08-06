import { db } from '../db';
import { 
  zscoreTechnicalIndicators, 
  rollingStatistics, 
  technicalIndicators,
  historicalStockData,
  historicalSectorData 
} from '@shared/schema';
import { desc, eq, and, gte, sql, lte } from 'drizzle-orm';
import { logger } from '../middleware/logging';
import { VolatilityRegimeDetector } from './volatility-regime-detector';

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
  
  // Optimized Z-Score Weights (Based on Performance Analysis - August 6, 2025)
  private readonly weights: ZScoreWeights = {
    rsi: 0.25,           // Reduced noise from 35% to 25%
    macd: 0.35,          // Primary trend signal (increased from 30%)  
    bollinger: 0.15,     // Reduced contrarian fighting (down from 20%)
    maTrend: 0.20,       // Stronger trend confirmation (up from 15%)
    priceMomentum: 0.05, // Minimized noise (down from 10%)
    atr: 0.00            // Used as volatility modifier only
  };
  
  // Optimized signal thresholds (Based on 11.2% → 20% actionable target)
  private readonly BUY_THRESHOLD = 0.75;   // Optimized from 1.0 (40% more signals)
  private readonly SELL_THRESHOLD = -0.75; // Optimized from -1.0 (better balance)
  private readonly STRONG_BUY_THRESHOLD = 1.5;   // Optimized from 1.96
  private readonly STRONG_SELL_THRESHOLD = -1.5; // Optimized from -1.96
  private readonly ZSCORE_WINDOW = 63; // 3-month daily data (asset-class appropriate for ETFs)
  
  // Volatility regime detector for dynamic thresholds
  private readonly volatilityDetector = VolatilityRegimeDetector.getInstance();
  
  public static getInstance(): ZScoreTechnicalService {
    if (!ZScoreTechnicalService.instance) {
      ZScoreTechnicalService.instance = new ZScoreTechnicalService();
    }
    return ZScoreTechnicalService.instance;
  }

  /**
   * Calculate Z-Score: (Current Value - Mean) / Standard Deviation
   * Returns null for invalid calculations to maintain statistical integrity
   */
  private calculateZScore(currentValue: number, mean: number, stdDev: number): number | null {
    if (stdDev === 0 || isNaN(stdDev) || isNaN(currentValue) || isNaN(mean) || !isFinite(currentValue)) {
      return null; // Return null instead of 0 for invalid calculations
    }
    return (currentValue - mean) / stdDev;
  }

  /**
   * Convert Z-score to signal strength based on statistical confidence levels
   * Maintains statistical significance instead of arbitrary scaling
   */
  private zscoreToSignal(zscore: number): number {
    if (zscore === null || !isFinite(zscore)) return 0;
    
    // Use proper statistical thresholds
    if (Math.abs(zscore) > 2.58) return Math.sign(zscore) * 1.0;    // 99% confidence
    if (Math.abs(zscore) > 1.96) return Math.sign(zscore) * 0.75;   // 95% confidence  
    if (Math.abs(zscore) > 1.0) return Math.sign(zscore) * 0.5;     // 68% confidence
    return zscore * 0.25; // Linear scaling for small deviations
  }

  /**
   * Apply ATR as volatility signal strength modifier
   */
  private applyAtrModifier(compositeScore: number, atrZScore: number | null): number {
    if (atrZScore === null) return compositeScore;
    
    // High volatility increases signal strength (both positive and negative)
    const atrMultiplier = 1 + Math.abs(atrZScore) * 0.1;
    return compositeScore * atrMultiplier;
  }

  /**
   * Get volatility-adjusted thresholds based on market conditions
   * Implements dynamic threshold optimization from performance analysis
   */
  private async getVolatilityAdjustedThresholds(vixLevel?: number): Promise<{
    buyThreshold: number;
    sellThreshold: number;
    strongBuyThreshold: number;
    strongSellThreshold: number;
  }> {
    try {
      // Default to current static thresholds if no VIX available
      if (!vixLevel) {
        return {
          buyThreshold: this.BUY_THRESHOLD,
          sellThreshold: this.SELL_THRESHOLD,
          strongBuyThreshold: this.STRONG_BUY_THRESHOLD,
          strongSellThreshold: this.STRONG_SELL_THRESHOLD
        };
      }

      // Get volatility regime assessment
      const regimeInfo = await this.volatilityDetector.getVolatilityAdjustmentFactor(vixLevel);
      
      // Apply volatility-based threshold adjustments
      switch (regimeInfo.regime) {
        case 'low':      // VIX < 20: Lower thresholds for more signals
          return {
            buyThreshold: 0.6,
            sellThreshold: -0.6,
            strongBuyThreshold: 1.2,
            strongSellThreshold: -1.2
          };
        case 'crisis':   // VIX > 45: Higher thresholds for safety
          return {
            buyThreshold: 1.2,
            sellThreshold: -1.2,
            strongBuyThreshold: 2.0,
            strongSellThreshold: -2.0
          };
        default:         // Normal/high volatility: Use optimized defaults
          return {
            buyThreshold: this.BUY_THRESHOLD,
            sellThreshold: this.SELL_THRESHOLD,
            strongBuyThreshold: this.STRONG_BUY_THRESHOLD,
            strongSellThreshold: this.STRONG_SELL_THRESHOLD
          };
      }
    } catch (error) {
      logger.warn('Error getting volatility-adjusted thresholds, using defaults:', error);
      return {
        buyThreshold: this.BUY_THRESHOLD,
        sellThreshold: this.SELL_THRESHOLD,
        strongBuyThreshold: this.STRONG_BUY_THRESHOLD,
        strongSellThreshold: this.STRONG_SELL_THRESHOLD
      };
    }
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
      // Use sample variance (N-1) for finite samples - critical for accurate statistics
      const variance = windowValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / Math.max(1, windowValues.length - 1);
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
      // FIXED: Query historicalStockData where we actually store the price data
      const priceData = await db
        .select({
          symbol: historicalStockData.symbol,
          date: historicalStockData.date,
          price: historicalStockData.price
        })
        .from(historicalStockData)
        .where(
          and(
            eq(historicalStockData.symbol, symbol),
            gte(historicalStockData.date, cutoffDate),
            sql`price IS NOT NULL AND price > 0`
          )
        )
        .orderBy(historicalStockData.date);
      
      logger.info(`📊 Found ${priceData.length} price records for ${symbol} momentum calculation`);
      
      const momentum: Array<{ date: Date; priceChange: number }> = [];
      
      for (let i = 1; i < priceData.length; i++) {
        // Use price field from historicalSectorData
        const currentPrice = parseFloat(priceData[i].price?.toString() || '0');
        const previousPrice = parseFloat(priceData[i - 1].price?.toString() || '0');
        
        if (currentPrice > 0 && previousPrice > 0) {
          const priceChange = (currentPrice - previousPrice) / previousPrice;
          
          momentum.push({
            date: priceData[i].date,
            priceChange
          });
        }
      }
      
      logger.info(`✅ Calculated ${momentum.length} price momentum points for ${symbol}`);
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
        logger.error(`Insufficient data for ${symbol}: ${historicalTech.length} records, minimum ${this.ZSCORE_WINDOW} required`);
        return null; // Reject processing to prevent unreliable z-score calculations
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

      // DEBUG: Log data availability for troubleshooting
      if (symbol === 'SPY' || maTrendValues.length < 5) {
        logger.info(`🔍 MA Trend Data Check for ${symbol}:`, {
          totalHistoricalRecords: historicalTech.length,
          validMATrendRecords: maTrendValues.length,
          requiredWindow: this.ZSCORE_WINDOW,
          hasSufficientData: maTrendValues.length >= this.ZSCORE_WINDOW,
          sampleData: maTrendValues.slice(-3).map(v => ({
            date: v.date.toISOString().split('T')[0],
            value: v.value
          }))
        });
      }

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
      
      // Debug MA Trend calculation with immediate console output
      console.log(`🔍 MA TREND DEBUG FOR ${symbol}:`);
      console.log(`  Current SMA20: ${parseFloat(latest.sma_20?.toString() || '0')}`);
      console.log(`  Current SMA50: ${parseFloat(latest.sma_50?.toString() || '0')}`);
      console.log(`  Current MA Trend: ${currentMaTrend}`);
      console.log(`  MA Trend Data Points: ${maTrendValues.length}`);
      console.log(`  Has MA Trend Stats: ${latestMaTrendStats ? 'YES' : 'NO'}`);
      if (latestMaTrendStats) {
        console.log(`  MA Trend Mean: ${latestMaTrendStats.mean}`);
        console.log(`  MA Trend StdDev: ${latestMaTrendStats.stdDev}`);
      }
      console.log(`  MA Trend Z-Score: ${maTrendZScore}`);
      console.log(`  Sample Values:`, maTrendValues.slice(-3).map(v => v.value));
      const priceMomentumZScore = latestPriceStats ? this.calculateZScore(currentPriceChange, latestPriceStats.mean, latestPriceStats.stdDev) : null;

      // Calculate composite Z-score with weights and directional corrections
      const rawCompositeZScore = (
        (rsiZScore !== null ? this.weights.rsi * this.zscoreToSignal(rsiZScore) : 0) +
        (macdZScore !== null ? this.weights.macd * this.zscoreToSignal(macdZScore) : 0) +
        // CRITICAL FIX: Invert Bollinger %B direction (high %B = overbought = bearish)
        (bollingerZScore !== null ? this.weights.bollinger * this.zscoreToSignal(-bollingerZScore) : 0) +
        (maTrendZScore !== null ? this.weights.maTrend * this.zscoreToSignal(maTrendZScore) : 0) +
        (priceMomentumZScore !== null ? this.weights.priceMomentum * this.zscoreToSignal(priceMomentumZScore) : 0)
        // ATR removed from directional calculation, used as volatility modifier below
      );

      // Apply ATR as volatility signal strength modifier instead of directional component
      const compositeZScore = this.applyAtrModifier(rawCompositeZScore, atrZScore);

      // Get volatility-adjusted thresholds (async, will fallback to static if VIX unavailable)
      const thresholds = await this.getVolatilityAdjustedThresholds();

      // Generate optimized signal with dynamic thresholds
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (compositeZScore >= thresholds.strongBuyThreshold) signal = 'BUY';      // Strong BUY
      else if (compositeZScore >= thresholds.buyThreshold) signal = 'BUY';       // Regular BUY
      else if (compositeZScore <= thresholds.strongSellThreshold) signal = 'SELL'; // Strong SELL
      else if (compositeZScore <= thresholds.sellThreshold) signal = 'SELL';      // Regular SELL

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