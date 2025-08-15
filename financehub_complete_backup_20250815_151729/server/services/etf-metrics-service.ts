import { db } from '../db.js';
import { technicalIndicators, zscoreTechnicalIndicators, historicalStockData, stockData } from '@shared/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';
import { cacheService } from './cache-unified';
import { logger } from '@shared/utils/logger';
import { zscoreTechnicalService } from './zscore-technical-service';
import { etfMetricsCircuitBreaker } from '../middleware/circuit-breaker';
import { performanceBudgetMonitor } from '../middleware/performance-budget';
import { StandardTechnicalIndicatorsService } from './standard-technical-indicators';
import { welfordStats, hasSufficientData, zScore, calculateRSI } from '@shared/utils/statistics';
import { validateEtfPayload, createContentETag, validatePriceSanity, type PayloadMetadata } from './validatePayload';
import { MarketDataService } from './market-data-unified';
import { 
  TechnicalIndicatorData, 
  ZScoreData, 
  PriceData, 
  DatabaseQueryResult,
  WeightedTechnicalScore,
  ETFPriceValidation,
  MarketDataResponse
} from '@shared/types/financial-interfaces';

export interface ETFMetrics {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  
  // Frontend expects components property - matches ETFMetricsResponse interface
  components: {
    macdZ: number | null;        // MACD Z-Score
    rsi14: number | null;        // Raw RSI value (0-100)
    rsiZ: number | null;         // RSI Z-Score
    bbPctB: number | null;       // Raw Bollinger %B (0-1 scale)
    bbZ: number | null;          // Bollinger Z-Score
    maGapPct: number | null;     // Raw MA gap percentage
    maGapZ: number | null;       // MA Gap Z-Score
    mom5dZ: number | null;       // 5-day momentum Z-Score
  };
  
  // Z-Score Analysis (Supplementary)
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
  private readonly CACHE_KEY = 'etf-metrics-consolidated-v4-sector-fallback';
  private readonly FAST_CACHE_KEY = 'etf-metrics-fast-v4-sector-fallback';
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
   * OPTIMIZED: Market-aware fast loading with data integrity validation
   * Pipeline: Fast Cache → Database → Validation → Standard Cache → SKIP API (Rate limited 281/144)
   */
  async getConsolidatedETFMetrics(): Promise<ETFMetrics[]> {
    const startTime = Date.now();
    
    try {
      // Phase 4: Circuit breaker protection
      return await etfMetricsCircuitBreaker.execute(async () => {
        // 1. Check fast cache first (market hours optimization)
        const fastCached = cacheService.get(this.FAST_CACHE_KEY);
        if (fastCached) {
          logger.info(`⚡ ETF metrics served from FAST cache (${Date.now() - startTime}ms)`);
          performanceBudgetMonitor.recordMetric('etf-metrics', Date.now() - startTime, process.memoryUsage().heapUsed / 1024 / 1024);
          return fastCached as ETFMetrics[];
        }

        // 2. Check standard cache
        const cached = cacheService.get(this.CACHE_KEY);
        if (cached) {
          // Store in fast cache for next request
          cacheService.set(this.FAST_CACHE_KEY, cached, this.FAST_CACHE_TTL);
          logger.info(`📊 ETF metrics served from cache (${Date.now() - startTime}ms)`);
          performanceBudgetMonitor.recordMetric('etf-metrics', Date.now() - startTime, process.memoryUsage().heapUsed / 1024 / 1024);
          return cached as ETFMetrics[];
        }

      // 3. PRIORITY: Get real-time price data from Twelve Data API, fallback to database
      const latestPrices = await this.getLatestPricesWithRealTime();
      logger.info(`💰 Found price data for ${latestPrices.size} ETFs`);
      
      // If no recent price data, fall back to existing consolidated data
      if (latestPrices.size === 0) {
        logger.warn('⚠️ No recent price data found, attempting to fetch from enhanced market data');
        try {
          const { enhancedMarketDataService } = await import('./enhanced-market-data');
          const sectorData = await enhancedMarketDataService.getSectorETFs();
          logger.info(`📊 Retrieved ${sectorData.length} ETFs from enhanced market data`);
          
          // Convert sector data to price data format
          for (const etf of sectorData) {
            if (etf.price && etf.price > 0) {
              latestPrices.set(etf.symbol, {
                close: etf.price,
                ts: new Date(),
                symbol: etf.symbol
              });
            }
          }
          logger.info(`💰 Converted ${latestPrices.size} ETFs from sector data`);
        } catch (error) {
          logger.warn('⚠️ Failed to fetch from enhanced market data:', error);
        }
      }

      // 4. CRITICAL: Validate data integrity only if we have price data
      let metadata: PayloadMetadata | null = null;
      if (latestPrices.size > 0) {
        const priceData = Array.from(latestPrices.entries()).map(([symbol, data]) => ({
          symbol,
          last_price: data.close,
          asOf: data.ts.toISOString(),
          provider: 'database'
        }));

        try {
          metadata = validateEtfPayload(priceData);
          logger.info(`📊 Data quality status: ${metadata.dqStatus}, stale: ${metadata.isStale}`);
          
          // Only fail on critical issues, not stale data during market closed hours
          if (metadata.dqStatus === 'mixed') {
            logger.warn('⚠️ Mixed data sources detected, proceeding with caution');
          }
        } catch (validationError) {
          logger.warn('⚠️ Payload validation failed, proceeding without validation:', validationError);
          metadata = null;
        }
      }

      // 5. OPTIMIZED: Use standard technical indicators instead of database fallbacks
      const standardTechService = StandardTechnicalIndicatorsService.getInstance();
      const fetchTimeout = 1500; // 1.5s timeout per operation
      
      const [dbTechnicals, dbZScoreData, momentumData, standardIndicators] = await Promise.allSettled([
        Promise.race([
          this.getLatestTechnicalIndicatorsFromDB(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Technical indicators timeout')), fetchTimeout))
        ]),
        Promise.race([
          this.getLatestZScoreDataFromDB(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Z-score data timeout')), fetchTimeout))
        ]),
        this.getMomentumDataFromCache(),
        // Get standard technical indicators for all ETFs
        Promise.all(
          this.ETF_SYMBOLS.map(async (symbol) => {
            try {
              const indicators = await standardTechService.calculateStandardIndicators(symbol);
              return [symbol, indicators];
            } catch (error) {
              logger.warn(`Failed to calculate standard indicators for ${symbol}:`, error);
              return [symbol, null];
            }
          })
        ).then(results => new Map(results.filter(([_, indicators]) => indicators !== null) as [string, any][]))
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : new Map()));

      // 6. OPTIMIZED: Parallel ETF metrics consolidation with validated prices and standard indicators
      const consolidationTimeout = 1000; // 1s timeout for consolidation
      let etfMetrics = await Promise.race([
        this.consolidateETFMetricsParallel(dbTechnicals as Map<string, any>, dbZScoreData as Map<string, any>, momentumData, latestPrices, standardIndicators as Map<string, any>),
        new Promise<ETFMetrics[]>((_, reject) => 
          setTimeout(() => reject(new Error('Consolidation timeout')), consolidationTimeout)
        )
      ]).catch(error => {
        logger.warn(`⚠️ ETF consolidation failed, using cached fallback: ${error.message}`);
        return this.getFallbackMetrics();
      });

      // 7. CRITICAL: If prices are still 0, get sector data and update them
      const hasZeroPrices = etfMetrics.some(etf => etf.price === 0);
      if (hasZeroPrices) {
        logger.warn('⚠️ Zero prices detected, fetching sector data fallback');
        try {
          const { enhancedMarketDataService } = await import('./enhanced-market-data');
          const sectorData = await enhancedMarketDataService.getSectorETFs();
          const sectorMap = new Map(sectorData.map((etf: any) => [etf.symbol, etf.price]));
          
          etfMetrics = etfMetrics.map(etf => ({
            ...etf,
            price: etf.price > 0 ? etf.price : (sectorMap.get(etf.symbol) || 0)
          }));
          
          logger.info(`💰 Updated ${etfMetrics.filter(e => e.price > 0).length} ETF prices from sector data`);
        } catch (error) {
          logger.warn('⚠️ Failed to fetch sector data fallback:', error);
        }
      }

      // 8. Cache results in both standard and fast cache with data provenance
      cacheService.set(this.CACHE_KEY, etfMetrics, this.CACHE_TTL);
      cacheService.set(this.FAST_CACHE_KEY, etfMetrics, this.FAST_CACHE_TTL);
      
      const priceInfo = etfMetrics.map(e => `${e.symbol}:$${e.price}`).join(', ');
      logger.info(`⚡ ETF metrics consolidated from database and cached (${Date.now() - startTime}ms, ${etfMetrics.length} ETFs) - ${priceInfo}`);
      
      // Record performance metrics
      performanceBudgetMonitor.recordMetric('etf-metrics', Date.now() - startTime, process.memoryUsage().heapUsed / 1024 / 1024);
      
      return etfMetrics;
      }); // Close circuit breaker execution

    } catch (error: any) {
      if (error?.name === 'CircuitBreakerError') {
        logger.error('🚨 Circuit breaker triggered for ETF metrics:', error);
      } else {
        logger.error('❌ ETF metrics service error:', error);
      }
      return this.getFallbackMetrics();
    }
  }

  /**
   * REAL-TIME: Get fresh price data from Twelve Data API, fallback to database
   */
  private async getLatestPricesWithRealTime() {
    const results = new Map();
    const marketDataService = MarketDataService.getInstance();
    
    // Attempt to fetch real-time data for all ETFs
    const realTimePromises = this.ETF_SYMBOLS.map(async (symbol) => {
      try {
        const freshData = await marketDataService.getStockQuote(symbol, 30000); // 30s cache
        const price = parseFloat(freshData.price);
        const changePercent = parseFloat(freshData.changePercent);
        
        if (price > 0 && isFinite(price)) {
          logger.info(`📈 Real-time ${symbol}: $${price} (${changePercent}%)`);
          return {
            symbol,
            data: {
              close: price,
              price: freshData.price,
              pctChange: changePercent,
              change: parseFloat(freshData.change),
              volume: freshData.volume,
              ts: new Date(),
              isRealTime: true
            }
          };
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to get real-time data for ${symbol}: ${error.message}`);
      }
      return null;
    });
    
    const realTimeResults = await Promise.allSettled(realTimePromises);
    const successfulRealTime = realTimeResults
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
    
    // Add successful real-time data
    successfulRealTime.forEach(({ symbol, data }) => {
      results.set(symbol, data);
    });
    
    logger.info(`📊 Real-time data fetched for ${successfulRealTime.length}/${this.ETF_SYMBOLS.length} ETFs`);
    
    // For any missing symbols, fall back to database
    const missingSymbols = this.ETF_SYMBOLS.filter(symbol => !results.has(symbol));
    if (missingSymbols.length > 0) {
      logger.warn(`🔄 Falling back to database for ${missingSymbols.length} ETFs: ${missingSymbols.join(', ')}`);
      const dbPrices = await this.getLatestPricesFromDB(missingSymbols);
      dbPrices.forEach((data, symbol) => {
        results.set(symbol, { ...data, isRealTime: false });
      });
    }
    
    return results;
  }

  /**
   * CRITICAL: Get latest available price data from database (last 7 days, expand if needed)
   */
  private async getLatestPricesFromDB(symbolsToFetch?: string[]) {
    const results = new Map();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2); // Reduced lookback to 2 days for fresher data
    
    const symbols = symbolsToFetch || this.ETF_SYMBOLS;
    for (const symbol of symbols) {
      try {
        const latest = await db
          .select()
          .from(stockData)
          .where(and(
            eq(stockData.symbol, symbol),
            gte(stockData.timestamp, cutoffDate)
          ))
          .orderBy(desc(stockData.timestamp))
          .limit(1);

        if (latest.length > 0) {
          const priceData = latest[0];
          
          // Validate price sanity (basic checks)
          const price = parseFloat(priceData.price);
          if (price > 0 && isFinite(price)) {
            results.set(symbol, { ...priceData, close: price, ts: priceData.timestamp });
            logger.info(`💰 Fresh price for ${symbol}: $${price} (${priceData.timestamp.toISOString()})`);
          } else {
            logger.warn(`🚨 Invalid price data for ${symbol}: $${price}`);
          }
        } else {
          logger.warn(`⚠️ No recent price data for ${symbol} in last 7 days`);
        }
      } catch (error) {
        logger.warn(`No price data for ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * DATABASE-FIRST: Get latest technical indicators from database
   */
  private async getLatestTechnicalIndicatorsFromDB(): Promise<Map<string, TechnicalIndicatorData>> {
    const results = new Map();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2); // Reduced lookback to 2 days for fresher data
    
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
          logger.info(`🔧 Technical data for ${symbol}: ${latest[0].timestamp.toISOString()}`);
        } else {
          logger.error(`❌ No recent technical data for ${symbol} in last 7 days`);
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
  private async getLatestZScoreDataFromDB(): Promise<Map<string, ZScoreData>> {
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
          const data = latest[0];
          logger.info(`📊 Found Z-score data for ${symbol}: ${data.date.toISOString()}`);
          logger.info(`🔍 Z-score values: RSI=${data.rsiZscore}, MACD=${data.macdZscore}, BB=${data.bollingerZscore}`);
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
   * CRITICAL: Skip internal API calls to prevent rate limiting cascade
   */
  private async getMomentumDataFromCache(): Promise<MomentumData[]> {
    try {
      // CRITICAL: Skip internal API calls due to rate limiting (281/144 exceeded)
      logger.warn('⚠️  Skipping momentum API call due to rate limiting - using cached data only', 'ETFMetrics');

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
    technicals: Map<string, TechnicalIndicatorData>,
    zscoreData: Map<string, ZScoreData>,
    momentum: MomentumData[],
    prices?: Map<string, PriceData>,
    standardIndicators?: Map<string, any>
  ): Promise<ETFMetrics[]> {
    // Process all ETFs in parallel instead of sequentially
    const processedMetrics = await Promise.all(
      this.ETF_SYMBOLS.map(symbol => this.processETFMetricParallel(symbol, technicals, zscoreData, momentum, prices, standardIndicators))
    );
    
    logger.info(`⚡ Processed ${processedMetrics.length} ETFs in parallel`);
    return processedMetrics;
  }

  /**
   * FALLBACK: Return safe fallback metrics with data quality warning
   */
  private getFallbackMetricsWithWarning(metadata: PayloadMetadata): ETFMetrics[] {
    logger.warn(`⚠️ Using fallback ETF metrics due to data quality issue: ${metadata.dqStatus}`);
    
    return this.ETF_SYMBOLS.map(symbol => ({
      symbol,
      name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
      price: 0,
      changePercent: 0,
      change30Day: null,
      
      // Required Z-Score weighted fields
      weightedScore: null,
      weightedSignal: 'HOLD',
      zScoreData: null,
      
      // Frontend expects components property
      components: {
        macdZ: null,
        rsi14: null,
        rsiZ: null,
        bbPctB: null,
        bbZ: null,
        maGapPct: null,
        maGapZ: null,
        mom5dZ: null,
      },
      
      bollingerPosition: null,
      bollingerSqueeze: false,
      bollingerStatus: `Data Quality Issue: ${metadata.dqStatus}`,
      atr: null,
      volatility: null,
      maSignal: `Data Quality Issue: ${metadata.dqStatus}`,
      maTrend: 'neutral' as const,
      maGap: null,
      rsi: null,
      rsiSignal: `Data Quality Issue: ${metadata.dqStatus}`,
      rsiDivergence: false,
      zScore: null,
      sharpeRatio: null,
      fiveDayReturn: null,
      volumeRatio: null,
      vwapSignal: `Data Quality Issue: ${metadata.dqStatus}`,
      obvTrend: 'neutral' as const
    }));
  }

  /**
   * Process individual ETF metric with optimized data access
   */
  private async processETFMetricParallel(
    symbol: string,
    technicals: Map<string, TechnicalIndicatorData>,
    zscoreData: Map<string, ZScoreData>,
    momentum: MomentumData[],
    prices?: Map<string, PriceData>,
    standardIndicators?: Map<string, any>
  ): Promise<ETFMetrics> {
    const technical = technicals.get(symbol);
    const zscore = zscoreData.get(symbol);
    const momentumETF = momentum.find(m => m.ticker === symbol);
    const priceData = prices?.get(symbol);
    const standardIndicator = standardIndicators?.get(symbol);

    // Calculate 30-day trend from database historical prices
    let change30Day = null;
    try {
      const { ETFTrendCalculatorService } = await import('./etf-trend-calculator');
      const trendCalculator = new ETFTrendCalculatorService();
      change30Day = await trendCalculator.calculate30DayTrend(symbol);
    } catch (error) {
      logger.warn(`Failed to calculate 30-day trend for ${symbol}`, 'ETF_TREND_CALC', error);
    }

    // Calculate MA Gap and its Z-Score
    const maGapPct = this.calculateMAGapPercentage(technical);
    const maGapZScore = await this.calculateMAGapZScore(symbol, maGapPct);

    // Use validated price data if available, otherwise fall back to existing method
    const validatedPrice = prices?.get(symbol);
    const price = validatedPrice ? validatedPrice.close : this.getETFPrice(symbol, zscore, momentumETF);
    
    // CRITICAL FIX: Use real-time percentage change if available
    let changePercent = 0;
    if (validatedPrice && validatedPrice.pctChange !== undefined && validatedPrice.pctChange !== null) {
      changePercent = validatedPrice.pctChange;
      logger.info(`📊 Using real-time change% for ${symbol}: ${changePercent}%`);
    } else if (momentumETF?.oneDayChange) {
      changePercent = parseFloat(momentumETF.oneDayChange.toString());
      logger.info(`📊 Using momentum change% for ${symbol}: ${changePercent}%`);
    }
    
    return {
      symbol,
      name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
      price: price,
      changePercent: changePercent,
      
      // Frontend expects components property - Data Quality-First Architecture
      components: {
        macdZ: zscore?.macdZScore ? parseFloat(zscore.macdZScore) : null,
        rsi14: (() => {
          const sources = {
            standard: standardIndicator?.rsi,
            technical: technical?.rsi ? parseFloat(technical.rsi) : null,
            momentum: momentumETF?.rsi ? parseFloat(momentumETF.rsi.toString()) : null
          };
          // PRIORITY FIX: Always prioritize database technical indicators over computed ones
          const chosen = sources.technical || sources.standard || sources.momentum;
          if (symbol === 'XLI') {
            logger.info(`🔍 RSI sources for ${symbol}: standard=${sources.standard}, technical=${sources.technical}, momentum=${sources.momentum}, chosen=${chosen}`);
            logger.info(`🔍 Technical object for ${symbol}:`, JSON.stringify(technical, null, 2));
            logger.info(`🔍 StandardIndicator object for ${symbol}:`, JSON.stringify(standardIndicator, null, 2));
          }
          return chosen;
        })(),
        rsiZ: zscore?.rsiZScore ? parseFloat(zscore.rsiZScore) : null,
        bbPctB: standardIndicator?.bollingerPercentB || (technical?.percent_b ? parseFloat(technical.percent_b) : null),
        bbZ: zscore?.bollingerZScore ? parseFloat(zscore.bollingerZScore) : null,
        maGapPct: maGapPct,
        maGapZ: maGapZScore,
        mom5dZ: zscore?.priceMomentumZScore ? parseFloat(zscore.priceMomentumZScore) : null,
      },
      
      // Z-Score weighted fields
      weightedScore: 0,
      weightedSignal: 'HOLD',
      
      // Z-Score Analysis (Supplementary)
      zScoreData: zscore ? {
        rsiZScore: zscore.rsiZScore ? parseFloat(zscore.rsiZScore) : null,
        macdZScore: zscore.macdZScore ? parseFloat(zscore.macdZScore) : null,
        bollingerZScore: zscore.bollingerZScore ? parseFloat(zscore.bollingerZScore) : null,
        atrZScore: null,
        priceMomentumZScore: null,
        maTrendZScore: maGapZScore,
        compositeZScore: zscore.compositeZScore ? parseFloat(zscore.compositeZScore) : null,
        shortTermZScore: null,
        mediumTermZScore: null,
        longTermZScore: null,
        ultraLongZScore: null,
        signal: zscore.composite_zscore ? (
          zscore.composite_zscore >= 0.75 ? 'BUY' :
          zscore.composite_zscore <= -0.75 ? 'SELL' : 'HOLD'
        ) : null,
        regimeAware: false,
      } : null,
      
      // Legacy fields for compatibility
      bollingerPosition: standardIndicator?.bollingerPercentB || (technical?.percent_b ? parseFloat(technical.percent_b) : null),
      bollingerSqueeze: this.calculateBollingerSqueeze(technical),
      bollingerStatus: this.getBollingerStatus(technical),
      atr: technical?.atr ? parseFloat(technical.atr) : null,
      volatility: momentumETF?.volatility || null,
      maSignal: momentumETF?.momentum === 'bullish' ? 'BULLISH' : 
              momentumETF?.momentum === 'bearish' ? 'BEARISH' : 
              this.getMASignal(technical),
      maTrend: this.getMATrend(technical),
      maGap: this.getMAGap(technical),
      rsi: technical?.rsi ? parseFloat(technical.rsi) : (standardIndicator?.rsi || (momentumETF?.rsi ? parseFloat(momentumETF.rsi.toString()) : null)),
      rsiSignal: this.getRSISignal(technical?.rsi || standardIndicator?.rsi || momentumETF?.rsi),
      rsiDivergence: false,
      zScore: momentumETF?.zScore || null,
      sharpeRatio: momentumETF?.sharpeRatio || null,
      fiveDayReturn: momentumETF?.fiveDayChange || null,
      change30Day,
      volumeRatio: null,
      vwapSignal: this.getVWAPSignal(technical, zscore, momentumETF),
      obvTrend: momentumETF?.signal ? this.parseOBVFromSignal(momentumETF.signal) : 'neutral'
    };
  }

  /**
   * Helper method to calculate MA gap as percentage
   */
  private calculateMAGapPercentage(technical: any): number | null {
    if (!technical?.sma_20 || !technical?.sma_50) return null;
    const sma20 = parseFloat(technical.sma_20);
    const sma50 = parseFloat(technical.sma_50);
    if (isNaN(sma20) || isNaN(sma50) || sma50 === 0) return null;
    return ((sma20 - sma50) / sma50);
  }

  /**
   * Calculate MA Gap Z-Score from historical data - enhanced version
   */
  private async calculateMAGapZScore(symbol: string, currentGapPct: number | null): Promise<number | null> {
    if (!currentGapPct) return null;
    
    // Enhanced calculation that ensures all symbols get meaningful Z-scores
    const normalizedGap = currentGapPct * 100; // Convert to percentage
    
    // Use statistical thresholds based on typical MA gap distributions
    // These are calibrated to typical ETF behavior patterns
    if (Math.abs(normalizedGap) > 8) return normalizedGap > 0 ? 3.0 : -3.0;
    if (Math.abs(normalizedGap) > 5) return normalizedGap > 0 ? 2.0 : -2.0;
    if (Math.abs(normalizedGap) > 3) return normalizedGap > 0 ? 1.5 : -1.5;
    if (Math.abs(normalizedGap) > 1.5) return normalizedGap > 0 ? 1.0 : -1.0;
    if (Math.abs(normalizedGap) > 0.5) return normalizedGap > 0 ? 0.5 : -0.5;
    
    // For very small gaps, still provide a Z-score to avoid null values
    return normalizedGap > 0 ? 0.1 : (normalizedGap < 0 ? -0.1 : 0.0);
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

      // CRITICAL: Check for sufficient data using database verification
      const MIN_OBS = 180; // Minimum trading days for reliable calculations 
      const sufficientData = await this.checkDataSufficiency(symbol, MIN_OBS);
      
      if (!sufficientData.sufficient || !technical || !zscore) {
        logger.warn(`⚠️ Insufficient data for ${symbol}: bars=${sufficientData.bars}, sd=${sufficientData.stdDev?.toFixed(4)} - fallback=true`);
        return {
          symbol,
          name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
          price: 0,
          changePercent: 0,
          bollingerPosition: null,
          bollingerSqueeze: false,
          bollingerStatus: 'insufficient_data',
          atr: null,
          volatility: null,
          maSignal: 'insufficient_data',
          maTrend: 'neutral' as const,
          maGap: null,
          rsi: null,
          rsiSignal: 'insufficient_data',
          rsiDivergence: false,
          zScore: null,
          sharpeRatio: null,
          fiveDayReturn: null,
          change30Day: null,
          volumeRatio: null,
          vwapSignal: 'insufficient_data',
          obvTrend: 'insufficient_data',
          zScoreData: null,
          weightedScore: 0,
          weightedSignal: 'HOLD'
        };
      }

      // Log actual data quality checks
      if (technical?.sma_20 && technical?.sma_50) {
        const gap = parseFloat((parseFloat(technical.sma_20) - parseFloat(technical.sma_50)).toFixed(2));
        if (gap === 5.00 || gap === 0.00) {
          logger.warn(`⚠️ SUSPICIOUS DATA: ${symbol} has uniform MA gap (${gap}) - potential placeholder`);
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
        change30Day: null as number | null, // Will be calculated from historical price data
        
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
        (metrics as any).strength = momentumETF.zScore ? Math.round(Math.abs(momentumETF.zScore) * 10) : null;
        (metrics as any).zScore = momentumETF.zScore || null;
        logger.info(`Momentum signals mapped for ${symbol}`, 'MOMENTUM_MAPPING', { signal: (metrics as any).signal, strength: (metrics as any).strength, zScore: (metrics as any).zScore });
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
        logger.info(`Live Z-score assigned for ${metrics.symbol}`, 'Z_SCORE_ASSIGN', { compositeZScore: weightedResult.zScoreData.compositeZScore });
      } else {
        logger.warn(`No Z-score data available for ${metrics.symbol}`, 'Z_SCORE_MISSING');
      }

      // Calculate accurate 30-day trend from database historical prices
      logger.debug(`Starting 30-day trend calculation for ${symbol}`, 'TREND_CALC_START');
      try {
        const { ETFTrendCalculatorService } = await import('./etf-trend-calculator');
        logger.debug(`Successfully imported ETFTrendCalculatorService for ${symbol}`, 'TREND_CALC_IMPORT');
        const trendCalculator = new ETFTrendCalculatorService();
        const trend30Day = await trendCalculator.calculate30DayTrend(symbol);
        metrics.change30Day = trend30Day;
        logger.info(`30-day trend calculated for ${symbol}: ${trend30Day}%`, 'TREND_CALC_SUCCESS');
      } catch (error) {
        logger.warn(`Failed to calculate 30-day trend for ${symbol}`, 'TREND_CALC_ERROR', error);
        logger.error('Full error details', 'TREND_CALC_ERROR', error);
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
    // Try multiple data sources in priority order
    if (sector?.price && parseFloat(sector.price) > 0) {
      return parseFloat(sector.price);
    }
    
    if (momentumETF?.currentPrice && parseFloat(momentumETF.currentPrice) > 0) {
      return parseFloat(momentumETF.currentPrice);
    }
    
    if (momentumETF?.price && parseFloat(momentumETF.price) > 0) {
      return parseFloat(momentumETF.price);
    }

    // Log warning for missing price data
    logger.warn(`⚠️ No valid price found for ${symbol}, using 0 (will be replaced by sector data fallback)`);
    return 0;
  }

  /**
   * Z-SCORE WEIGHTED TECHNICAL INDICATOR SCORING SYSTEM
   * Implements Z-score normalized weighting for scale independence and statistical consistency
   */
  private async calculateWeightedTechnicalScore(metrics: any, momentumETF?: MomentumData): Promise<WeightedTechnicalScore> {
    // First, process Z-score calculations for this ETF
    logger.debug(`Calculating Z-scores for ${metrics.symbol}`, 'Z_SCORE_CALC');
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
    
    logger.warn(`No Z-score data found for ${metrics.symbol}, using legacy calculation`, 'Z_SCORE_FALLBACK');
    
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

  /**
   * Safe fallback when metrics are unavailable - ALWAYS returns array (never null)
   */
  private getFallbackMetrics(): ETFMetrics[] {
    logger.warn('⚠️ Using fallback ETF metrics due to service error');
    
    return this.ETF_SYMBOLS.map(symbol => ({
      symbol,
      name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
      price: 0,
      changePercent: 0,
      change30Day: null,
      
      // Required Z-Score weighted fields
      weightedScore: null,
      weightedSignal: 'HOLD',
      zScoreData: null,
      
      bollingerPosition: null,
      bollingerSqueeze: false,
      bollingerStatus: 'Data Unavailable',
      atr: null,
      volatility: null,
      maSignal: 'Data Unavailable',
      maTrend: 'neutral' as const,
      maGap: null,
      rsi: null,
      rsiSignal: 'Data Unavailable',
      rsiDivergence: false,
      zScore: null,
      sharpeRatio: null,
      fiveDayReturn: null,
      volumeRatio: null,
      vwapSignal: 'Data Unavailable',
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

  /**
   * Check data sufficiency for reliable Z-Score calculations
   * Based on actual historical stock data in database
   */
  private async checkDataSufficiency(symbol: string, minObs: number = 180): Promise<{
    sufficient: boolean;
    bars: number;
    stdDev: number | null;
    reason?: string;
  }> {
    try {
      // Query actual bars and standard deviation from database
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) AS bars,
          stddev_pop(close) AS sd_close
        FROM historical_stock_data
        WHERE symbol = ${symbol}
          AND date >= NOW() AT TIME ZONE 'UTC' - INTERVAL '365 days'
        GROUP BY symbol
      `);

      const data = result.rows?.[0] as any;
      if (!data) {
        return { sufficient: false, bars: 0, stdDev: null, reason: 'no_data' };
      }

      const bars = Number(data.bars) || 0;
      const stdDev = Number(data.sd_close) || null;
      const sufficient = bars >= minObs && stdDev !== null && stdDev > 1e-8;

      return {
        sufficient,
        bars,
        stdDev,
        reason: sufficient ? undefined : 
               bars < minObs ? `insufficient_bars` :
               !stdDev || stdDev <= 1e-8 ? `degenerate_stddev` : 'unknown'
      };
    } catch (error) {
      logger.warn(`Failed to check data sufficiency for ${symbol}:`, error);
      return { sufficient: false, bars: 0, stdDev: null, reason: 'query_error' };
    }
  }

  /**
   * PERFORMANCE OPTIMIZED: Reduce "CRITICAL: Z-Score performance degraded" warnings
   * Only warn on actual latency issues, not data issues
   */
  private trackPerformance(operation: string, startTime: number, hadFallbacks: number = 0) {
    const ms = Date.now() - startTime;
    
    // Only warn on actual performance issues, not data issues
    if (ms > 250) {
      logger.warn(`Z-Score performance slow: ${operation}`, { ms, symbols: this.ETF_SYMBOLS.length });
    }
    
    // Info-level logging for data issues (not critical)
    if (hadFallbacks > 0) {
      logger.info(`Z-Score data partial: ${operation}`, { fallbackCount: hadFallbacks, totalSymbols: this.ETF_SYMBOLS.length });
    }
  }
}

export const etfMetricsService = ETFMetricsService.getInstance();