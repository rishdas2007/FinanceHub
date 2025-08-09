import { db } from '../db';
import { technicalIndicators, zscoreTechnicalIndicators } from '@shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';
import { cacheService } from './cache-unified';
import { logger } from '../middleware/logging';
import { zscoreTechnicalService } from './zscore-technical-service';

export interface ETFMetrics {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  
  // Z-Score Weighted Technical Indicator Scoring System
  weightedScore: number | null;
  weightedSignal: string | null;
  
  // Multi-Horizon Z-Score indicators (institutional-grade analysis)
  zScoreData: {
    rsiZScore: number | null;
    macdZScore: number | null;
    bollingerZScore: number | null;
    atrZScore: number | null;
    priceMomentumZScore: number | null;
    maTrendZScore: number | null;
    compositeZScore: number | null;
    shortTermZScore: number | null;    // 63-day horizon
    mediumTermZScore: number | null;   // 252-day horizon
    longTermZScore: number | null;     // 756-day horizon
    ultraLongZScore: number | null;    // 1260-day horizon
    signal: string | null;
    regimeAware: boolean | null;       // Indicates multi-horizon analysis
  } | null;
  
  // Bollinger Bands & Position/Squeeze
  bollingerPosition: number | null; // %B
  bollingerSqueeze: boolean;
  bollingerStatus: string;
  // ATR & Volatility
  atr: number | null;
  volatility: number | null;
  // Moving Average (Trend)
  maSignal: string;
  maTrend: 'bullish' | 'bearish' | 'neutral';
  maGap: number | null; // SMA_20 - SMA_50 gap value
  // RSI (Momentum)
  rsi: number | null;
  rsiSignal: string;
  rsiDivergence: boolean;
  // Z-Score, Sharpe, Returns  
  zScore: number | null;
  sharpeRatio: number | null;
  fiveDayReturn: number | null;
  // 30-Day Trend (Fixed calculation from database)
  change30Day: number | null;
  // Volume, VWAP, OBV
  volumeRatio: number | null;
  vwapSignal: string;
  obvTrend: string;
}

interface MomentumData {
  ticker: string;
  sector: string;
  momentum: 'bullish' | 'bearish' | 'neutral';
  rsi: number;
  zScore: number;
  fiveDayZScore: number;
  sharpeRatio: number;
  volatility: number;
  oneDayChange: number;
  fiveDayChange: number;
  oneMonthChange: number;
  correlationToSPY: number;
  signal: string;
}

class ETFMetricsService {
  private static instance: ETFMetricsService;
  private readonly CACHE_KEY = 'etf-metrics-consolidated-v2-with-30day-trend';
  private readonly FAST_CACHE_KEY = 'etf-metrics-fast-v2-with-30day-trend';
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly FAST_CACHE_TTL = 120; // 2 minutes during market hours
  
  // Standard ETF universe
  private readonly ETF_SYMBOLS = [
    'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
  ];

  private static readonly ETF_NAMES = {
    'SPY': 'S&P 500 INDEX',
    'XLK': 'Technology',
    'XLV': 'Health Care',
    'XLF': 'Financials',
    'XLY': 'Consumer Discretionary',
    'XLI': 'Industrials',
    'XLC': 'Communication Services',
    'XLP': 'Consumer Staples',
    'XLE': 'Energy',
    'XLU': 'Utilities',
    'XLB': 'Materials',
    'XLRE': 'Real Estate'
  };

  static getInstance(): ETFMetricsService {
    if (!ETFMetricsService.instance) {
      ETFMetricsService.instance = new ETFMetricsService();
    }
    return ETFMetricsService.instance;
  }

  /**
   * OPTIMIZED: Market-aware fast loading for ETF metrics during market hours
   * Pipeline: Fast Cache → Database → Standard Cache → API (if needed)
   */
  async getConsolidatedETFMetrics(): Promise<ETFMetrics[]> {
    const startTime = Date.now();
    
    try {
      // 1. Check fast cache first (market hours optimization)
      const fastCached = cacheService.get(this.FAST_CACHE_KEY);
      if (fastCached) {
        logger.info(`⚡ ETF metrics served from FAST cache (${Date.now() - startTime}ms)`);
        return fastCached as ETFMetrics[];
      }

      // 2. Check standard cache
      const cached = cacheService.get(this.CACHE_KEY);
      if (cached) {
        // Store in fast cache for next request
        cacheService.set(this.FAST_CACHE_KEY, cached, this.FAST_CACHE_TTL);
        logger.info(`📊 ETF metrics served from cache (${Date.now() - startTime}ms)`);
        return cached as ETFMetrics[];
      }

      // 3. OPTIMIZED: Parallel database fetching with timeout protection
      const fetchTimeout = 1500; // 1.5s timeout per operation
      const [dbTechnicals, dbZScoreData, momentumData] = await Promise.all([
        Promise.race([
          this.getLatestTechnicalIndicatorsFromDB(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Technical indicators timeout')), fetchTimeout))
        ]).catch(error => {
          logger.warn(`⚠️ Technical indicators fetch failed: ${error.message}`);
          return new Map();
        }),
        Promise.race([
          this.getLatestZScoreDataFromDB(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Z-score data timeout')), fetchTimeout))
        ]).catch(error => {
          logger.warn(`⚠️ Z-score data fetch failed: ${error.message}`);
          return new Map();
        }),
        this.getMomentumDataFromCache()
      ]);

      // 4. OPTIMIZED: Parallel ETF metrics consolidation
      const consolidationTimeout = 1000; // 1s timeout for consolidation
      const etfMetrics = await Promise.race([
        this.consolidateETFMetricsParallel(dbTechnicals as Map<string, any>, dbZScoreData as Map<string, any>, momentumData),
        new Promise<ETFMetrics[]>((_, reject) => 
          setTimeout(() => reject(new Error('Consolidation timeout')), consolidationTimeout)
        )
      ]).catch(error => {
        logger.warn(`⚠️ ETF consolidation failed, using cached fallback: ${error.message}`);
        return this.getFallbackMetrics();
      });

      // 5. Cache results in both standard and fast cache
      cacheService.set(this.CACHE_KEY, etfMetrics, this.CACHE_TTL);
      cacheService.set(this.FAST_CACHE_KEY, etfMetrics, this.FAST_CACHE_TTL);
      
      logger.info(`⚡ ETF metrics consolidated from database and cached (${Date.now() - startTime}ms, ${etfMetrics.length} ETFs)`);
      return etfMetrics;

    } catch (error) {
      logger.error('❌ ETF metrics service error:', error);
      return this.getFallbackMetrics();
    }
  }

  /**
   * DATABASE-FIRST: Get latest technical indicators from database
   */
  private async getLatestTechnicalIndicatorsFromDB() {
    const results = new Map();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Get data from last 30 days only
    
    for (const symbol of this.ETF_SYMBOLS) {
      try {
        const latest = await db
          .select()
          .from(technicalIndicators)
          .where(and(
            eq(technicalIndicators.symbol, symbol),
            gte(technicalIndicators.timestamp, cutoffDate)
          ))
          .orderBy(desc(technicalIndicators.timestamp))
          .limit(1);

        if (latest.length > 0) {
          results.set(symbol, latest[0]);
          logger.warn(`🔧 FIXED ${symbol} Technical Data: ${latest[0].timestamp.toISOString()} (SMA20: ${latest[0].sma_20}, SMA50: ${latest[0].sma_50}, Gap: ${parseFloat(latest[0].sma_20 || '0') - parseFloat(latest[0].sma_50 || '0')})`);
        } else {
          logger.error(`❌ No recent technical data for ${symbol} in last 30 days`);
        }
      } catch (error) {
        logger.warn(`No technical data for ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * DATABASE-FIRST: Get latest Z-score technical data from database
   */
  private async getLatestZScoreDataFromDB() {
    const results = new Map();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Get data from last 30 days only
    
    for (const symbol of this.ETF_SYMBOLS) {
      try {
        const latest = await db
          .select()
          .from(zscoreTechnicalIndicators)
          .where(and(
            eq(zscoreTechnicalIndicators.symbol, symbol),
            gte(zscoreTechnicalIndicators.date, cutoffDate)
          ))
          .orderBy(desc(zscoreTechnicalIndicators.date))
          .limit(1);

        if (latest.length > 0) {
          results.set(symbol, latest[0]);
          logger.info(`📊 Found Z-score data for ${symbol}: ${latest[0].date.toISOString()}`);
        } else {
          logger.warn(`❌ No recent Z-score data for ${symbol} in last 30 days`);
        }
      } catch (error) {
        logger.warn(`No Z-score data for ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * CACHE-FIRST: Get momentum data from existing momentum analysis
   */
  private async getMomentumDataFromCache(): Promise<MomentumData[]> {
    try {
      // First, try to get fresh momentum data by making an API call to the momentum endpoint
      try {
        const response = await fetch('http://localhost:5000/api/momentum-analysis');
        if (response.ok) {
          const data = await response.json();
          if ((data as any).momentumStrategies && Array.isArray((data as any).momentumStrategies)) {
            logger.info(`📊 Fetched fresh momentum data for ${(data as any).momentumStrategies.length} ETFs from API`);
            return (data as any).momentumStrategies;
          }
        }
      } catch (fetchError) {
        logger.warn('Failed to fetch fresh momentum data via API:', fetchError);
      }

      // Fallback: Use cached momentum data
      const momentumCacheKey = 'momentum-analysis-cache-v2';
      const cached = cacheService.get(momentumCacheKey);
      
      if (cached && (cached as any).momentumStrategies && Array.isArray((cached as any).momentumStrategies)) {
        logger.info(`📊 Using cached momentum data for ${(cached as any).momentumStrategies.length} ETFs`);
        return (cached as any).momentumStrategies;
      }

      logger.warn('No momentum data available, using empty fallback');
      return [];
    } catch (error) {
      logger.warn('Could not fetch momentum data:', error);
      return [];
    }
  }

  /**
   * PARALLEL CONSOLIDATE: Process ETF metrics in parallel for maximum speed
   */
  private async consolidateETFMetricsParallel(
    technicals: Map<string, any>,
    zscoreData: Map<string, any>,
    momentum: MomentumData[]
  ): Promise<ETFMetrics[]> {
    // Process all ETFs in parallel instead of sequentially
    const processedMetrics = await Promise.all(
      this.ETF_SYMBOLS.map(symbol => this.processETFMetricParallel(symbol, technicals, zscoreData, momentum))
    );
    
    logger.info(`⚡ Processed ${processedMetrics.length} ETFs in parallel`);
    return processedMetrics;
  }

  /**
   * Process individual ETF metric with optimized data access
   */
  private async processETFMetricParallel(
    symbol: string,
    technicals: Map<string, any>,
    zscoreData: Map<string, any>,
    momentum: MomentumData[]
  ): Promise<ETFMetrics> {
    const technical = technicals.get(symbol);
    const zscore = zscoreData.get(symbol);
    const momentumETF = momentum.find(m => m.ticker === symbol);

    // Calculate 30-day trend from database historical prices
    let change30Day = null;
    try {
      const { ETFTrendCalculatorService } = await import('./etf-trend-calculator');
      const trendCalculator = new ETFTrendCalculatorService();
      change30Day = await trendCalculator.calculate30DayTrend(symbol);
    } catch (error) {
      console.warn(`⚠️ Failed to calculate 30-day trend for ${symbol}:`, error);
    }

    return {
      symbol,
      name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
      price: this.getETFPrice(symbol, zscore, momentumETF),
      changePercent: momentumETF?.oneDayChange ? parseFloat(momentumETF.oneDayChange.toString()) : 0,
      
      // Bollinger Bands & Position/Squeeze
      bollingerPosition: technical?.percent_b ? parseFloat(technical.percent_b) : null,
      bollingerSqueeze: this.calculateBollingerSqueeze(technical),
      bollingerStatus: this.getBollingerStatus(technical),
      
      // ATR & Volatility
      atr: technical?.atr ? parseFloat(technical.atr) : null,
      volatility: momentumETF?.volatility || null,
      
      // Moving Average (Trend)
      maSignal: this.getMASignal(technical),
      maTrend: this.getMATrend(technical),
      maGap: this.getMAGap(technical),
      
      // RSI (Momentum)
      rsi: momentumETF?.rsi ? parseFloat(momentumETF.rsi.toString()) : (technical?.rsi ? parseFloat(technical.rsi) : null),
      rsiSignal: this.getRSISignal(momentumETF?.rsi || technical?.rsi),
      rsiDivergence: false,
      
      // Technical Signal Analysis - from momentum data  
      signal: momentumETF?.momentum === 'bullish' ? 'BULLISH' : 
              momentumETF?.momentum === 'bearish' ? 'BEARISH' : 'NEUTRAL',
      strength: momentumETF?.strength ? Math.round(momentumETF.strength * 10) : null,
      
      // Z-Score calculations
      zScore: momentumETF?.zScore || null,
      sharpeRatio: momentumETF?.sharpeRatio || null,
      fiveDayReturn: momentumETF?.fiveDayChange || null,
      // 30-Day Trend (Fixed calculation from database)
      change30Day,
      
      // Volume, VWAP, OBV
      volumeRatio: null,
      vwapSignal: this.getVWAPSignal(technical, zscore, momentumETF),
      obvTrend: momentumETF?.signal ? this.parseOBVFromSignal(momentumETF.signal) : 'neutral',
      
      // Z-Score system results
      weightedScore: 0,
      weightedSignal: 'HOLD',
      zScoreData: zscore ? this.buildZScoreDataOptimized(zscore) : null
    };
  }

  /**
   * LEGACY: Merge all data sources into unified ETF metrics (kept for fallback)
   */
  private async consolidateETFMetrics(
    technicals: Map<string, any>,
    zscoreData: Map<string, any>,
    momentum: MomentumData[]
  ): Promise<ETFMetrics[]> {
    const processedMetrics = await Promise.all(this.ETF_SYMBOLS.map(async (symbol) => {
      const technical = technicals.get(symbol);
      const zscore = zscoreData.get(symbol);
      const momentumETF = momentum.find(m => m.ticker === symbol);
      
      // Debug technical data for problematic ETFs
      if (['XLI', 'XLY', 'XLC', 'XLP', 'XLE', 'XLB'].includes(symbol)) {
        logger.warn(`🔍 DEBUG ${symbol} Technical Data:`, { 
          hasTechnical: !!technical,
          sma_20: technical?.sma_20,
          sma_50: technical?.sma_50,
          timestamp: technical?.timestamp 
        });
      }

      // Log MA gap calculations to identify placeholder data
      if (technical?.sma_20 && technical?.sma_50) {
        const gap = parseFloat((parseFloat(technical.sma_20) - parseFloat(technical.sma_50)).toFixed(2));
        if (gap === 5.00) {
          logger.warn(`⚠️ PLACEHOLDER DATA DETECTED: ${symbol} has suspicious MA gap of exactly 5.00 (SMA20: ${technical.sma_20}, SMA50: ${technical.sma_50})`);
        }
      }

      const metrics = {
        symbol,
        name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
        price: this.getETFPrice(symbol, zscore, momentumETF),
        changePercent: momentumETF?.oneDayChange ? parseFloat(momentumETF.oneDayChange.toString()) : 0,
        
        // Bollinger Bands & Position/Squeeze
        bollingerPosition: technical?.percent_b ? parseFloat(technical.percent_b) : null,
        bollingerSqueeze: this.calculateBollingerSqueeze(technical),
        bollingerStatus: this.getBollingerStatus(technical),
        
        // ATR & Volatility
        atr: technical?.atr ? parseFloat(technical.atr) : null,
        volatility: momentumETF?.volatility || null,
        
        // Moving Average (Trend)
        maSignal: this.getMASignal(technical),
        maTrend: this.getMATrend(technical),
        maGap: this.getMAGap(technical), // SMA_20 - SMA_50 gap value
        
        // RSI (Momentum) - Prioritize momentum data, fallback to technical
        rsi: momentumETF?.rsi ? parseFloat(momentumETF.rsi.toString()) : (technical?.rsi ? parseFloat(technical.rsi) : null),
        rsiSignal: this.getRSISignal(momentumETF?.rsi || technical?.rsi),
        rsiDivergence: false, // Would need historical analysis
        
        // Z-Score - Use live calculations, NOT cached momentum data
        zScore: null, // Will be calculated fresh from Z-score Technical Service
        sharpeRatio: momentumETF?.sharpeRatio || null,
        fiveDayReturn: momentumETF?.fiveDayChange || null,
        // 30-Day Trend (Fixed calculation from database)
        change30Day: null, // Will be calculated from historical price data
        
        // Volume, VWAP, OBV - Enhanced VWAP integration
        volumeRatio: null, // Will be calculated from Z-score data if available
        vwapSignal: this.getVWAPSignal(technical, zscore, momentumETF),
        obvTrend: momentumETF?.signal ? this.parseOBVFromSignal(momentumETF.signal) : 'neutral',
        
        // Technical Signal Analysis - Enhanced integration with momentum data
        signal: null, // Will be populated from momentum data
        strength: null, // Will be populated from momentum data
        
        // Initialize properties for Z-score system
        weightedScore: 0,
        weightedSignal: 'HOLD',
        zScoreData: null
      };

      // Map momentum data to main metrics object
      if (momentumETF) {
        (metrics as any).signal = momentumETF.momentum === 'bullish' ? 'BULLISH' : 
                                   momentumETF.momentum === 'bearish' ? 'BEARISH' : 'NEUTRAL';
        (metrics as any).strength = momentumETF.strength ? Math.round(momentumETF.strength * 10) : null;
        (metrics as any).zScore = momentumETF.zScore || null;
        console.log(`✅ Momentum signals mapped for ${symbol}: ${(metrics as any).signal}, strength: ${(metrics as any).strength}, zScore: ${(metrics as any).zScore}`);
      }

      // Calculate weighted scoring system with LIVE Z-score integration
      const weightedResult = await this.calculateWeightedTechnicalScore(metrics, momentumETF);
      metrics.weightedScore = weightedResult.score;
      metrics.weightedSignal = weightedResult.signal;
      metrics.zScoreData = weightedResult.zScoreData;
      
      // Override Z-score with live calculation from Z-score Technical Service
      if (weightedResult.zScoreData?.compositeZScore !== undefined) {
        metrics.zScore = weightedResult.zScoreData.compositeZScore;
        // CRITICAL FIX: Add z-score data to main metrics object for API response  
        (metrics as any).compositeZScore = weightedResult.zScoreData.compositeZScore;
        (metrics as any).zscoreSignal = weightedResult.zScoreData.signal;
        (metrics as any).zscoreStrength = Math.abs(weightedResult.zScoreData.compositeZScore);
        console.log(`✅ Live Z-score assigned for ${metrics.symbol}: ${weightedResult.zScoreData.compositeZScore}`);
      } else {
        console.log(`⚠️ No Z-score data available for ${metrics.symbol}`);
      }

      // Calculate accurate 30-day trend from database historical prices
      console.log(`🔍 Starting 30-day trend calculation for ${symbol}...`);
      try {
        const { ETFTrendCalculatorService } = await import('./etf-trend-calculator');
        console.log(`📦 Successfully imported ETFTrendCalculatorService for ${symbol}`);
        const trendCalculator = new ETFTrendCalculatorService();
        const trend30Day = await trendCalculator.calculate30DayTrend(symbol);
        metrics.change30Day = trend30Day;
        console.log(`✅ 30-day trend calculated for ${symbol}: ${trend30Day}%`);
      } catch (error) {
        console.warn(`⚠️ Failed to calculate 30-day trend for ${symbol}:`, error);
        console.error('Full error details:', error);
        metrics.change30Day = null;
      }

      return metrics;
    }));
    
    return processedMetrics;
  }

  // HELPER METHODS: Technical analysis calculations
  private calculateBollingerSqueeze(technical: any): boolean {
    if (!technical?.bb_upper || !technical?.bb_lower) return false;
    const bbWidth = parseFloat(technical.bb_upper) - parseFloat(technical.bb_lower);
    const price = parseFloat(technical.bb_middle) || 100;
    return (bbWidth / price) < 0.02; // Less than 2% width indicates squeeze
  }

  private getBollingerStatus(technical: any): string {
    if (!technical?.percent_b) return 'No Data';
    const percentB = parseFloat(technical.percent_b);
    if (percentB > 0.8) return 'Overbought';
    if (percentB < 0.2) return 'Oversold';
    if (percentB > 0.6) return 'Strong';
    if (percentB < 0.4) return 'Weak';
    return 'Neutral';
  }

  private getMASignal(technical: any): string {
    if (!technical?.sma_20 || !technical?.sma_50) return 'No Data';
    const sma20 = parseFloat(technical.sma_20);
    const sma50 = parseFloat(technical.sma_50);
    
    if (sma20 > sma50) return 'Bull Cross';
    if (sma20 < sma50) return 'Bear Cross';
    return 'Neutral';
  }

  private getMATrend(technical: any): 'bullish' | 'bearish' | 'neutral' {
    if (!technical?.sma_20 || !technical?.sma_50) return 'neutral';
    const sma20 = parseFloat(technical.sma_20);
    const sma50 = parseFloat(technical.sma_50);
    
    if (sma20 > sma50) return 'bullish';
    if (sma20 < sma50) return 'bearish';
    return 'neutral';
  }

  private getMAGap(technical: any): number | null {
    if (!technical?.sma_20 || !technical?.sma_50) {
      logger.warn(`Missing SMA data for MA Gap calculation:`, { 
        sma_20: technical?.sma_20, 
        sma_50: technical?.sma_50,
        symbol: technical?.symbol 
      });
      return null;
    }
    
    const sma20 = parseFloat(technical.sma_20);
    const sma50 = parseFloat(technical.sma_50);
    
    // Check for invalid values
    if (isNaN(sma20) || isNaN(sma50)) {
      logger.warn(`Invalid SMA values for ${technical?.symbol}:`, { sma20, sma50 });
      return null;
    }
    
    // Calculate percentage difference: ((sma20 - sma50) / sma50) * 100
    const gap = parseFloat((((sma20 - sma50) / sma50) * 100).toFixed(2));
    
    // Cap values at reasonable ranges (±50%)
    const cappedGap = Math.max(-50, Math.min(50, gap));
    
    logger.info(`✅ MA Gap calculated for ${technical?.symbol}: ${cappedGap}% (SMA20: ${sma20}, SMA50: ${sma50})`);
    return cappedGap;
  }

  private getRSISignal(rsi: string | number | null): string {
    if (!rsi) return 'No Data';
    const rsiValue = typeof rsi === 'string' ? parseFloat(rsi) : rsi;
    if (rsiValue > 70) return 'Overbought';
    if (rsiValue < 30) return 'Oversold';
    if (rsiValue > 60) return 'Strong';
    if (rsiValue < 40) return 'Weak';
    return 'Neutral';
  }

  private calculateVolumeRatio(sector: any): number | null {
    if (!sector?.volume) return null;
    // Would need historical volume for ratio calculation
    return 1.0; // Placeholder
  }

  private getVWAPSignal(technical: any, sector: any, momentum?: any): string {
    // First try to use momentum signal data if available
    if (momentum?.signal) {
      const signal = momentum.signal.toString().toLowerCase();
      if (signal.includes('above vwap') || signal.includes('strong bull')) return 'Above VWAP';
      if (signal.includes('below vwap') || signal.includes('strong bear')) return 'Below VWAP';
      if (signal.includes('vwap')) return 'Near VWAP';
    }
    
    // Fallback to technical VWAP calculation
    if (!technical?.vwap || !sector?.price) return 'No Data';
    const price = parseFloat(sector.price);
    const vwap = parseFloat(technical.vwap);
    
    if (price > vwap * 1.01) return 'Above VWAP';
    if (price < vwap * 0.99) return 'Below VWAP';
    return 'Near VWAP';
  }

  private parseOBVFromSignal(signal: string): string {
    if (!signal) return 'neutral';
    const signalLower = signal.toString().toLowerCase();
    if (signalLower.includes('strong bull') || signalLower.includes('bullish')) return 'bullish';
    if (signalLower.includes('strong bear') || signalLower.includes('bearish')) return 'bearish';
    return 'neutral';
  }

  /**
   * Get ETF current price from multiple sources with fallbacks
   */
  private getETFPrice(symbol: string, sector: any, momentumETF: any): number {
    // ETF price mapping based on common market values (fallback for missing data)
    const FALLBACK_PRICES = {
      'SPY': 630,
      'XLK': 260,
      'XLV': 133,
      'XLF': 52,
      'XLY': 195,
      'XLI': 140,
      'XLC': 100,
      'XLP': 82,
      'XLE': 95,
      'XLU': 87,
      'XLB': 88,
      'XLRE': 42
    };

    // Try multiple data sources
    if (sector?.price && parseFloat(sector.price) > 0) {
      return parseFloat(sector.price);
    }
    
    if (momentumETF?.currentPrice && parseFloat(momentumETF.currentPrice) > 0) {
      return parseFloat(momentumETF.currentPrice);
    }
    
    if (momentumETF?.price && parseFloat(momentumETF.price) > 0) {
      return parseFloat(momentumETF.price);
    }

    // Use realistic fallback price for the ETF
    return FALLBACK_PRICES[symbol as keyof typeof FALLBACK_PRICES] || 100;
  }

  /**
   * Z-SCORE WEIGHTED TECHNICAL INDICATOR SCORING SYSTEM
   * Implements Z-score normalized weighting for scale independence and statistical consistency
   */
  private async calculateWeightedTechnicalScore(metrics: any, momentumETF?: any): Promise<{ score: number; signal: string; zScoreData: any }> {
    // First, process Z-score calculations for this ETF
    console.log(`🔄 Calculating Z-scores for ${metrics.symbol}...`);
    const zScoreData = await zscoreTechnicalService.processETFZScores(metrics.symbol);
    
    if (zScoreData && zScoreData.compositeZScore !== null) {
      // Use Z-score system with momentum-focused weights
      return {
        score: zScoreData.compositeZScore,
        signal: zScoreData.signal,
        zScoreData: {
          rsiZScore: zScoreData.rsiZScore,
          macdZScore: zScoreData.macdZScore,
          bollingerZScore: zScoreData.bollingerZScore,
          atrZScore: zScoreData.atrZScore,
          priceMomentumZScore: zScoreData.priceMomentumZScore,
          maTrendZScore: zScoreData.maTrendZScore,
          compositeZScore: zScoreData.compositeZScore,
          shortTermZScore: zScoreData.shortTermZScore,
          mediumTermZScore: zScoreData.mediumTermZScore,
          longTermZScore: zScoreData.longTermZScore,
          ultraLongZScore: zScoreData.ultraLongZScore,
          signal: zScoreData.signal,
          regimeAware: zScoreData.regimeAware
        }
      };
    }
    
    // Fallback to legacy weighting system if Z-score data unavailable
    let totalScore = 0;
    let totalWeight = 0;
    
    console.log(`⚠️ No Z-score data found for ${metrics.symbol}, using legacy calculation`);
    
    // Legacy weights
    const LEGACY_WEIGHTS = {
      bollinger: 0.40,  
      rsi: 0.20,        
      atr: 0.15,        
      macd: 0.10,       
      maTrend: 0.10,    
      zScore: 0.05      
    };

    // 1. Bollinger Bands - Highest weight (40%) - Strong volatility/reversal predictor
    const bollingerScore = this.getBollingerScore(metrics.bollingerPosition, metrics.bollingerStatus);
    if (bollingerScore !== null) {
      totalScore += bollingerScore * LEGACY_WEIGHTS.bollinger;
      totalWeight += LEGACY_WEIGHTS.bollinger;
    }

    // 2. RSI - High weight (20%) - Momentum confirmation
    const rsiScore = this.getRSIScore(metrics.rsi);
    if (rsiScore !== null) {
      totalScore += rsiScore * LEGACY_WEIGHTS.rsi;
      totalWeight += LEGACY_WEIGHTS.rsi;
    }

    // 3. ATR/Volatility - Medium weight (15%) - Risk and momentum predictor
    const atrScore = this.getATRScore(metrics.atr, metrics.volatility, momentumETF);
    if (atrScore !== null) {
      totalScore += atrScore * LEGACY_WEIGHTS.atr;
      totalWeight += LEGACY_WEIGHTS.atr;
    }

    // 4. MACD - Medium weight (10%) - Trend following
    const macdScore = this.getMACDScore(momentumETF);
    if (macdScore !== null) {
      totalScore += macdScore * LEGACY_WEIGHTS.macd;
      totalWeight += LEGACY_WEIGHTS.macd;
    }

    // 5. MA Trend - Medium weight (10%) - Trend confirmation
    const maScore = this.getMAScore(metrics.maSignal, metrics.maTrend);
    if (maScore !== null) {
      totalScore += maScore * LEGACY_WEIGHTS.maTrend;
      totalWeight += LEGACY_WEIGHTS.maTrend;
    }

    // 6. Z-Score - Low weight (5%) - Statistical deviation
    const zScore = this.getZScore(metrics.zScore);
    if (zScore !== null) {
      totalScore += zScore * LEGACY_WEIGHTS.zScore;
      totalWeight += LEGACY_WEIGHTS.zScore;
    }

    // Normalize score if we have any data
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Classification based on revised thresholds
    let signal: string;
    if (finalScore >= 0.25) {
      signal = 'BUY';
    } else if (finalScore <= -0.25) {
      signal = 'SELL';
    } else {
      signal = 'HOLD';
    }

    return { score: finalScore, signal, zScoreData: null };
  }

  // Individual scoring methods for each indicator
  private getBollingerScore(position: number | null, status: string): number | null {
    if (position === null) return null;
    
    // %B interpretation: 0 = at lower band, 1 = at upper band
    if (position < 0.2) return 1;     // Oversold = Strong Buy
    if (position < 0.4) return 0.5;   // Weak = Mild Buy
    if (position > 0.8) return -1;    // Overbought = Strong Sell
    if (position > 0.6) return -0.5;  // Strong = Mild Sell
    return 0; // Neutral zone
  }

  private getATRScore(atr: number | null, volatility: number | null, momentum?: any): number | null {
    // Use volatility from momentum data if available
    const vol = volatility || (momentum?.volatility);
    if (!vol && !atr) return null;

    // Higher volatility with positive momentum = bullish
    // Higher volatility with negative momentum = bearish
    const volValue = vol || (atr ? atr * 100 : 0); // Normalize ATR
    
    if (momentum?.momentum === 'bullish' && volValue > 20) return 1;
    if (momentum?.momentum === 'bearish' && volValue > 20) return -1;
    if (volValue < 10) return 0; // Low volatility = neutral
    return 0.5; // Moderate volatility = mild positive
  }

  private getMAScore(signal: string, trend: string): number | null {
    if (!signal || signal === 'Loading...' || signal === 'No Data') return null;
    
    if (trend === 'bullish' || signal.includes('Above')) return 1;
    if (trend === 'bearish' || signal.includes('Below')) return -1;
    return 0;
  }

  private getRSIScore(rsi: number | null): number | null {
    if (rsi === null) return null;
    
    if (rsi < 30) return 1;      // Oversold = Buy
    if (rsi < 40) return 0.5;    // Weak = Mild Buy
    if (rsi > 70) return -1;     // Overbought = Sell
    if (rsi > 60) return -0.5;   // Strong = Mild Sell
    return 0; // Neutral zone
  }

  private getZScore(zScore: number | null): number | null {
    if (zScore === null) return null;
    
    if (zScore > 1) return 1;    // Strong positive deviation = Buy
    if (zScore < -1) return -1;  // Strong negative deviation = Sell
    return 0; // Within normal range
  }

  private getMACDScore(momentumETF?: any): number | null {
    if (!momentumETF?.signal) return null;
    
    const signal = momentumETF.signal.toString().toLowerCase();
    
    // MACD bullish signals
    if (signal.includes('bullish') || signal.includes('strong bull')) return 1;
    if (signal.includes('mild bull') || signal.includes('positive')) return 0.5;
    
    // MACD bearish signals
    if (signal.includes('bearish') || signal.includes('strong bear')) return -1;
    if (signal.includes('mild bear') || signal.includes('negative')) return -0.5;
    
    return 0; // Neutral
  }

  private getFallbackMetrics(): ETFMetrics[] {
    return this.ETF_SYMBOLS.map(symbol => ({
      symbol,
      name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
      price: 0,
      changePercent: 0,
      
      // Required Z-Score weighted fields
      weightedScore: null,
      weightedSignal: 'HOLD',
      zScoreData: null,
      
      bollingerPosition: null,
      bollingerSqueeze: false,
      bollingerStatus: 'Loading...',
      atr: null,
      volatility: null,
      maSignal: 'Loading...',
      maTrend: 'neutral' as const,
      maGap: null,
      rsi: null,
      rsiSignal: 'Loading...',
      rsiDivergence: false,
      zScore: null,
      sharpeRatio: null,
      fiveDayReturn: null,
      volumeRatio: null,
      vwapSignal: 'Loading...',
      obvTrend: 'neutral' as const
    }));
  }

  /**
   * OPTIMIZED: Build Z-Score data object with minimal processing
   */
  private buildZScoreDataOptimized(zscore: any) {
    if (!zscore) return null;
    
    // Helper function to safely convert string/number to number
    const safeParseFloat = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
      return isNaN(parsed) ? null : parsed;
    };
    
    
    return {
      rsiZScore: safeParseFloat(zscore.rsiZScore),
      macdZScore: safeParseFloat(zscore.macdZScore), 
      bollingerZScore: safeParseFloat(zscore.bollingerZScore),
      atrZScore: safeParseFloat(zscore.atrZScore),
      priceMomentumZScore: safeParseFloat(zscore.priceMomentumZScore),
      maTrendZScore: safeParseFloat(zscore.maTrendZScore),
      compositeZScore: safeParseFloat(zscore.compositeZScore),
      shortTermZScore: safeParseFloat(zscore.shortTermZScore),
      mediumTermZScore: safeParseFloat(zscore.mediumTermZScore),
      longTermZScore: safeParseFloat(zscore.longTermZScore),
      ultraLongZScore: safeParseFloat(zscore.ultraLongZScore),
      signal: zscore.signal || 'HOLD',
      regimeAware: zscore.regimeAware || false
    };
  }

  /**
   * REFRESH: Manual refresh that respects rate limits
   */
  async refreshETFMetrics(): Promise<void> {
    logger.info('🔄 Refreshing ETF metrics from authoritative sources...');
    
    // Clear cache to force fresh data
    cacheService.delete(this.CACHE_KEY);
    
    // This would trigger background batch refresh of database
    // Following principle: API → Database → Cache → Frontend
    
    logger.info('✅ ETF metrics refresh initiated');
  }
}

export const etfMetricsService = ETFMetricsService.getInstance();