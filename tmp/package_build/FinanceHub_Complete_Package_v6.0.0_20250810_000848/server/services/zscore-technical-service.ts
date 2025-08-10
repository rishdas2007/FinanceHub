import { db } from '../db';
import { 
  zscoreTechnicalIndicators, 
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
  
  // Multi-horizon Z-Score normalized indicators (leveraging 10-year dataset)
  rsiZScore: number | null;
  macdZScore: number | null;
  bollingerZScore: number | null;
  atrZScore: number | null;
  priceMomentumZScore: number | null;
  maTrendZScore: number | null;
  
  // Multi-horizon composite signals
  compositeZScore: number | null;
  shortTermZScore: number | null;   // 63 days (3 months)
  mediumTermZScore: number | null;  // 252 days (1 year)
  longTermZScore: number | null;    // 756 days (3 years)
  ultraLongZScore: number | null;   // 1260 days (5 years)
  
  signal: 'BUY' | 'SELL' | 'HOLD';
  signalStrength: number | null;
  regimeAware: boolean;
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
  
  // Multi-horizon analysis windows (leveraging 10-year dataset - 2,610 days available)
  private readonly ZSCORE_WINDOWS = {
    shortTerm: 63,     // 3 months (current)
    mediumTerm: 252,   // 1 year (improved stability)
    longTerm: 756,     // 3 years (regime-aware)
    ultraLong: 1260,   // 5 years (ultra-stable)
    maximum: 2520      // 10 years (full dataset)
  };
  
  // Regime-aware signal thresholds
  private readonly THRESHOLDS = {
    // Short-term (higher sensitivity for trading signals)
    shortTerm: { buy: 0.75, sell: -0.75, strongBuy: 1.5, strongSell: -1.5 },
    // Medium-term (balanced stability and responsiveness)
    mediumTerm: { buy: 1.0, sell: -1.0, strongBuy: 1.96, strongSell: -1.96 },
    // Long-term (conservative, high confidence)
    longTerm: { buy: 1.5, sell: -1.5, strongBuy: 2.58, strongSell: -2.58 },
    // Ultra-long (institutional-grade signals)
    ultraLong: { buy: 2.0, sell: -2.0, strongBuy: 3.0, strongSell: -3.0 }
  };
  
  // Volatility regime detector for dynamic thresholds
  private readonly volatilityDetector = VolatilityRegimeDetector.getInstance();
  
  public static getInstance(): ZScoreTechnicalService {
    if (!ZScoreTechnicalService.instance) {
      ZScoreTechnicalService.instance = new ZScoreTechnicalService();
    }
    return ZScoreTechnicalService.instance;
  }

  /**
   * Calculate Multi-Horizon Z-Score: (Current Value - Mean) / Standard Deviation
   * Returns null for invalid calculations to maintain statistical integrity
   */
  private calculateZScore(currentValue: number, mean: number, stdDev: number): number | null {
    if (stdDev === 0 || isNaN(stdDev) || isNaN(currentValue) || isNaN(mean) || !isFinite(currentValue)) {
      return null; // Return null instead of 0 for invalid calculations
    }
    return (currentValue - mean) / stdDev;
  }

  /**
   * Calculate multi-horizon z-scores for improved statistical stability
   * Leverages 10-year dataset for institutional-grade analysis
   */
  private async calculateMultiHorizonZScores(
    values: Array<{ date: Date; value: number }>,
    currentValue: number
  ): Promise<{
    shortTerm: number | null;
    mediumTerm: number | null; 
    longTerm: number | null;
    ultraLong: number | null;
  }> {
    const results = {
      shortTerm: null as number | null,
      mediumTerm: null as number | null,
      longTerm: null as number | null,
      ultraLong: null as number | null
    };

    // Calculate for each horizon if sufficient data available
    for (const [horizon, window] of Object.entries(this.ZSCORE_WINDOWS)) {
      if (horizon === 'maximum') continue; // Skip maximum, it's for reference
      
      if (values.length >= window) {
        const recentValues = values.slice(-window).map(v => v.value);
        const mean = recentValues.reduce((sum, val) => sum + val, 0) / window;
        const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / Math.max(1, window - 1);
        const stdDev = Math.sqrt(variance);
        
        const zScore = this.calculateZScore(currentValue, mean, stdDev);
        results[horizon as keyof typeof results] = zScore;
      }
    }

    return results;
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
      // Default to medium-term thresholds if no VIX available
      if (!vixLevel) {
        return {
          buyThreshold: this.THRESHOLDS.mediumTerm.buy,
          sellThreshold: this.THRESHOLDS.mediumTerm.sell,
          strongBuyThreshold: this.THRESHOLDS.mediumTerm.strongBuy,
          strongSellThreshold: this.THRESHOLDS.mediumTerm.strongSell
        };
      }

      // Get volatility regime assessment
      const regimeInfo = await this.volatilityDetector.getVolatilityAdjustment(vixLevel);
      
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
        default:         // Normal/high volatility: Use medium-term thresholds
          return {
            buyThreshold: this.THRESHOLDS.mediumTerm.buy,
            sellThreshold: this.THRESHOLDS.mediumTerm.sell,
            strongBuyThreshold: this.THRESHOLDS.mediumTerm.strongBuy,
            strongSellThreshold: this.THRESHOLDS.mediumTerm.strongSell
          };
      }
    } catch (error) {
      logger.warn('Error getting volatility-adjusted thresholds, using defaults:', error);
      return {
        buyThreshold: this.THRESHOLDS.mediumTerm.buy,
        sellThreshold: this.THRESHOLDS.mediumTerm.sell,
        strongBuyThreshold: this.THRESHOLDS.mediumTerm.strongBuy,
        strongSellThreshold: this.THRESHOLDS.mediumTerm.strongSell
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
   * Fetch historical technical indicators for multi-horizon Z-score calculation
   * Uses maximum available data from 10-year dataset for institutional-grade analysis
   */
  private async getHistoricalTechnicalData(symbol: string, lookbackDays: number = 2520): Promise<any[]> {
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
      
      logger.info(`📊 Retrieved ${historicalData.length} technical records for ${symbol} (max ${lookbackDays} days)`);
      return historicalData;
    } catch (error) {
      logger.error(`Error fetching historical technical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate price momentum using full 10-year historical dataset
   * Leverages excellent historical sector data for institutional-grade momentum analysis
   */
  private async calculatePriceMomentum(symbol: string, lookbackDays: number = 2520): Promise<Array<{ date: Date; priceChange: number }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    try {
      // Use full historical sector data (excellent 10-year dataset)
      const priceData = await db
        .select({
          symbol: historicalSectorData.symbol,
          date: historicalSectorData.date,
          price: historicalSectorData.price
        })
        .from(historicalSectorData)
        .where(
          and(
            eq(historicalSectorData.symbol, symbol),
            gte(historicalSectorData.date, cutoffDate),
            sql`price IS NOT NULL AND price > 0`
          )
        )
        .orderBy(historicalSectorData.date);
      
      logger.info(`📊 Retrieved ${priceData.length} price records for ${symbol} from 10-year dataset`);
      
      const momentum: Array<{ date: Date; priceChange: number }> = [];
      
      for (let i = 1; i < priceData.length; i++) {
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
      
      logger.info(`✅ Calculated ${momentum.length} momentum points from 10-year dataset for ${symbol}`);
      return momentum;
    } catch (error) {
      logger.error(`Error calculating price momentum for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Process Multi-Horizon Z-Score calculations for a single ETF
   * Leverages 10-year dataset for institutional-grade statistical analysis
   */
  public async processETFZScores(symbol: string): Promise<ZScoreIndicators | null> {
    try {
      logger.info(`🔄 Processing Multi-Horizon Z-Score calculations for ${symbol} using 10-year dataset`);
      
      // Fetch maximum historical technical indicators (up to 10 years)
      const historicalTech = await this.getHistoricalTechnicalData(symbol);
      if (historicalTech.length < this.ZSCORE_WINDOWS.shortTerm) {
        logger.error(`Insufficient data for ${symbol}: ${historicalTech.length} records, minimum ${this.ZSCORE_WINDOWS.shortTerm} required`);
        return null;
      }
      
      logger.info(`📊 Using ${historicalTech.length} technical records for ${symbol} multi-horizon analysis`);

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

      // Log data availability for multi-horizon analysis
      logger.info(`🔍 Multi-Horizon Data Check for ${symbol}:`, {
        totalHistoricalRecords: historicalTech.length,
        validMATrendRecords: maTrendValues.length,
        shortTermWindow: this.ZSCORE_WINDOWS.shortTerm,
        mediumTermWindow: this.ZSCORE_WINDOWS.mediumTerm,
        longTermWindow: this.ZSCORE_WINDOWS.longTerm,
        ultraLongWindow: this.ZSCORE_WINDOWS.ultraLong,
        maxAvailable: Math.min(historicalTech.length, 2610) // 10-year dataset limit
      });

      const priceChangeValues = priceMomentum.map(p => ({ date: p.date, value: p.priceChange }));

      // Get current values
      const currentRsi = parseFloat(latest.rsi?.toString() || '0');
      const currentMacd = parseFloat(latest.macd?.toString() || '0');
      const currentPercentB = parseFloat(latest.percent_b?.toString() || '0');
      const currentAtr = parseFloat(latest.atr?.toString() || '0');
      const currentMaTrend = parseFloat(latest.sma_20?.toString() || '0') - parseFloat(latest.sma_50?.toString() || '0');
      const currentPriceChange = priceMomentum[priceMomentum.length - 1]?.priceChange || 0;

      // Calculate multi-horizon z-scores for each indicator using 10-year dataset
      const [rsiMultiHorizon, macdMultiHorizon, bollingerMultiHorizon, atrMultiHorizon, maTrendMultiHorizon, priceMultiHorizon] = await Promise.all([
        this.calculateMultiHorizonZScores(rsiValues, currentRsi),
        this.calculateMultiHorizonZScores(macdValues, currentMacd),
        this.calculateMultiHorizonZScores(percentBValues, currentPercentB),
        this.calculateMultiHorizonZScores(atrValues, currentAtr),
        this.calculateMultiHorizonZScores(maTrendValues, currentMaTrend),
        this.calculateMultiHorizonZScores(priceChangeValues, currentPriceChange)
      ]);

      // Use medium-term (1-year) z-scores as primary indicators for better stability
      const rsiZScore = rsiMultiHorizon.mediumTerm || rsiMultiHorizon.shortTerm;
      const macdZScore = macdMultiHorizon.mediumTerm || macdMultiHorizon.shortTerm;
      const bollingerZScore = bollingerMultiHorizon.mediumTerm || bollingerMultiHorizon.shortTerm;
      const atrZScore = atrMultiHorizon.mediumTerm || atrMultiHorizon.shortTerm;
      const maTrendZScore = maTrendMultiHorizon.mediumTerm || maTrendMultiHorizon.shortTerm;
      const priceMomentumZScore = priceMultiHorizon.mediumTerm || priceMultiHorizon.shortTerm;

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

      // Calculate multi-horizon composite scores
      const shortTermComposite = (
        (rsiMultiHorizon.shortTerm !== null ? this.weights.rsi * this.zscoreToSignal(rsiMultiHorizon.shortTerm) : 0) +
        (macdMultiHorizon.shortTerm !== null ? this.weights.macd * this.zscoreToSignal(macdMultiHorizon.shortTerm) : 0) +
        (bollingerMultiHorizon.shortTerm !== null ? this.weights.bollinger * this.zscoreToSignal(-bollingerMultiHorizon.shortTerm) : 0) +
        (maTrendMultiHorizon.shortTerm !== null ? this.weights.maTrend * this.zscoreToSignal(maTrendMultiHorizon.shortTerm) : 0) +
        (priceMultiHorizon.shortTerm !== null ? this.weights.priceMomentum * this.zscoreToSignal(priceMultiHorizon.shortTerm) : 0)
      );

      const mediumTermComposite = (
        (rsiMultiHorizon.mediumTerm !== null ? this.weights.rsi * this.zscoreToSignal(rsiMultiHorizon.mediumTerm) : 0) +
        (macdMultiHorizon.mediumTerm !== null ? this.weights.macd * this.zscoreToSignal(macdMultiHorizon.mediumTerm) : 0) +
        (bollingerMultiHorizon.mediumTerm !== null ? this.weights.bollinger * this.zscoreToSignal(-bollingerMultiHorizon.mediumTerm) : 0) +
        (maTrendMultiHorizon.mediumTerm !== null ? this.weights.maTrend * this.zscoreToSignal(maTrendMultiHorizon.mediumTerm) : 0) +
        (priceMultiHorizon.mediumTerm !== null ? this.weights.priceMomentum * this.zscoreToSignal(priceMultiHorizon.mediumTerm) : 0)
      );

      const longTermComposite = (
        (rsiMultiHorizon.longTerm !== null ? this.weights.rsi * this.zscoreToSignal(rsiMultiHorizon.longTerm) : 0) +
        (macdMultiHorizon.longTerm !== null ? this.weights.macd * this.zscoreToSignal(macdMultiHorizon.longTerm) : 0) +
        (bollingerMultiHorizon.longTerm !== null ? this.weights.bollinger * this.zscoreToSignal(-bollingerMultiHorizon.longTerm) : 0) +
        (maTrendMultiHorizon.longTerm !== null ? this.weights.maTrend * this.zscoreToSignal(maTrendMultiHorizon.longTerm) : 0) +
        (priceMultiHorizon.longTerm !== null ? this.weights.priceMomentum * this.zscoreToSignal(priceMultiHorizon.longTerm) : 0)
      );

      const ultraLongComposite = (
        (rsiMultiHorizon.ultraLong !== null ? this.weights.rsi * this.zscoreToSignal(rsiMultiHorizon.ultraLong) : 0) +
        (macdMultiHorizon.ultraLong !== null ? this.weights.macd * this.zscoreToSignal(macdMultiHorizon.ultraLong) : 0) +
        (bollingerMultiHorizon.ultraLong !== null ? this.weights.bollinger * this.zscoreToSignal(-bollingerMultiHorizon.ultraLong) : 0) +
        (maTrendMultiHorizon.ultraLong !== null ? this.weights.maTrend * this.zscoreToSignal(maTrendMultiHorizon.ultraLong) : 0) +
        (priceMultiHorizon.ultraLong !== null ? this.weights.priceMomentum * this.zscoreToSignal(priceMultiHorizon.ultraLong) : 0)
      );

      // Use medium-term thresholds for primary signal generation (balanced stability/responsiveness)
      const thresholds = this.THRESHOLDS.mediumTerm;
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (compositeZScore >= thresholds.strongBuy) signal = 'BUY';
      else if (compositeZScore >= thresholds.buy) signal = 'BUY';
      else if (compositeZScore <= thresholds.strongSell) signal = 'SELL';
      else if (compositeZScore <= thresholds.sell) signal = 'SELL';

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
        
        // Z-Score normalized indicators (using medium-term for stability)
        rsiZScore,
        macdZScore,
        bollingerZScore,
        atrZScore,
        priceMomentumZScore,
        maTrendZScore,
        
        // Multi-horizon composite signals (institutional-grade analysis)
        compositeZScore,
        shortTermZScore: shortTermComposite,
        mediumTermZScore: mediumTermComposite,
        longTermZScore: longTermComposite,
        ultraLongZScore: ultraLongComposite,
        
        signal,
        signalStrength: Math.abs(compositeZScore),
        regimeAware: true // Indicates this uses multi-horizon regime-aware analysis
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
   * Store Multi-Horizon Z-score data in database
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
        
        // Multi-horizon composite signals (institutional-grade)
        compositeZScore: data.compositeZScore?.toString(),
        shortTermZScore: data.shortTermZScore?.toString(),
        mediumTermZScore: data.mediumTermZScore?.toString(),
        longTermZScore: data.longTermZScore?.toString(),
        ultraLongZScore: data.ultraLongZScore?.toString(),
        
        signal: data.signal,
        signalStrength: data.signalStrength?.toString(),
        regimeAware: data.regimeAware
      })
      .onConflictDoUpdate({
        target: [zscoreTechnicalIndicators.symbol, zscoreTechnicalIndicators.date],
        set: {
          compositeZScore: data.compositeZScore?.toString(),
          shortTermZScore: data.shortTermZScore?.toString(),
          mediumTermZScore: data.mediumTermZScore?.toString(),
          longTermZScore: data.longTermZScore?.toString(),
          ultraLongZScore: data.ultraLongZScore?.toString(),
          signal: data.signal,
          signalStrength: data.signalStrength?.toString(),
          regimeAware: data.regimeAware,
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
        
        // Multi-horizon composite signals (institutional-grade analysis)
        compositeZScore: data.compositeZScore ? parseFloat(data.compositeZScore.toString()) : null,
        shortTermZScore: data.shortTermZScore ? parseFloat(data.shortTermZScore.toString()) : null,
        mediumTermZScore: data.mediumTermZScore ? parseFloat(data.mediumTermZScore.toString()) : null,
        longTermZScore: data.longTermZScore ? parseFloat(data.longTermZScore.toString()) : null,
        ultraLongZScore: data.ultraLongZScore ? parseFloat(data.ultraLongZScore.toString()) : null,
        
        signal: data.signal as 'BUY' | 'SELL' | 'HOLD',
        signalStrength: data.signalStrength ? parseFloat(data.signalStrength.toString()) : null,
        regimeAware: data.regimeAware || false
      };
      
    } catch (error) {
      logger.error(`Error fetching latest Z-score data for ${symbol}:`, error);
      return null;
    }
  }
}

export const zscoreTechnicalService = ZScoreTechnicalService.getInstance();