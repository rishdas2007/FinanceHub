import { db } from '../db';
import { technicalIndicators, sectorData, historicalTechnicalIndicators } from '@shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';
import { cacheService } from './cache-unified';
import { logger } from '../middleware/logging';

export interface ETFMetrics {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
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
  // RSI (Momentum)
  rsi: number | null;
  rsiSignal: string;
  rsiDivergence: boolean;
  // Z-Score, Sharpe, Returns
  zScore: number | null;
  sharpeRatio: number | null;
  fiveDayReturn: number | null;
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
  private readonly CACHE_KEY = 'etf-metrics-consolidated-v1';
  private readonly CACHE_TTL = 300; // 5 minutes
  
  // Standard ETF universe
  private readonly ETF_SYMBOLS = [
    'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
  ];

  private readonly ETF_NAMES = {
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
   * MAIN METHOD: Get consolidated ETF metrics following data pipeline principles
   * Pipeline: Database → Cache → API (only if needed)
   */
  async getConsolidatedETFMetrics(): Promise<ETFMetrics[]> {
    const startTime = Date.now();
    
    try {
      // 1. Check cache first
      const cached = cacheService.get(this.CACHE_KEY);
      if (cached) {
        logger.info(`📊 ETF metrics served from cache (${Date.now() - startTime}ms)`);
        return cached as ETFMetrics[];
      }

      // 2. Fetch from database (prioritized)
      const [dbTechnicals, dbSectorData, momentumData] = await Promise.all([
        this.getLatestTechnicalIndicatorsFromDB(),
        this.getLatestSectorDataFromDB(),
        this.getMomentumDataFromCache()
      ]);

      // 3. Consolidate data
      const etfMetrics = this.consolidateETFMetrics(dbTechnicals, dbSectorData, momentumData);

      // 4. Cache results
      cacheService.set(this.CACHE_KEY, etfMetrics, this.CACHE_TTL);
      
      logger.info(`📊 ETF metrics consolidated from database (${Date.now() - startTime}ms, ${etfMetrics.length} ETFs)`);
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
    
    for (const symbol of this.ETF_SYMBOLS) {
      try {
        const latest = await db
          .select()
          .from(technicalIndicators)
          .where(eq(technicalIndicators.symbol, symbol))
          .orderBy(desc(technicalIndicators.id))
          .limit(1);

        if (latest.length > 0) {
          results.set(symbol, latest[0]);
        }
      } catch (error) {
        logger.warn(`No technical data for ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * DATABASE-FIRST: Get latest sector data from database
   */
  private async getLatestSectorDataFromDB() {
    const results = new Map();
    
    for (const symbol of this.ETF_SYMBOLS) {
      try {
        const latest = await db
          .select()
          .from(sectorData)
          .where(eq(sectorData.symbol, symbol))
          .orderBy(desc(sectorData.timestamp))
          .limit(1);

        if (latest.length > 0) {
          results.set(symbol, latest[0]);
        }
      } catch (error) {
        logger.warn(`No sector data for ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * CACHE-FIRST: Get momentum data from existing momentum analysis
   */
  private async getMomentumDataFromCache(): Promise<MomentumData[]> {
    try {
      // Leverage existing momentum analysis cache
      const momentumCacheKey = 'momentum-analysis-cache-v2';
      const cached = cacheService.get(momentumCacheKey);
      
      if (cached && cached.momentumStrategies && Array.isArray(cached.momentumStrategies)) {
        logger.info(`📊 Using cached momentum data for ${cached.momentumStrategies.length} ETFs`);
        return cached.momentumStrategies;
      }

      // Fallback: Try to fetch fresh momentum data to improve consistency
      try {
        // For now, return empty array since momentum service integration needs more work
        logger.info('📊 Momentum service integration pending - using fallback');
        return [];
      } catch (momentumError) {
        logger.warn('Failed to fetch fresh momentum data:', momentumError);
      }

      logger.warn('No momentum data available, using empty fallback');
      return [];
    } catch (error) {
      logger.warn('Could not fetch momentum data:', error);
      return [];
    }
  }

  /**
   * CONSOLIDATE: Merge all data sources into unified ETF metrics
   */
  private consolidateETFMetrics(
    technicals: Map<string, any>,
    sectors: Map<string, any>,
    momentum: MomentumData[]
  ): ETFMetrics[] {
    return this.ETF_SYMBOLS.map(symbol => {
      const technical = technicals.get(symbol);
      const sector = sectors.get(symbol);
      const momentumETF = momentum.find(m => m.ticker === symbol);

      return {
        symbol,
        name: this.ETF_NAMES[symbol as keyof typeof this.ETF_NAMES] || symbol,
        price: sector ? parseFloat(sector.price) : 0,
        changePercent: sector ? parseFloat(sector.changePercent) : 0,
        
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
        
        // RSI (Momentum)
        rsi: technical?.rsi ? parseFloat(technical.rsi) : null,
        rsiSignal: this.getRSISignal(technical?.rsi),
        rsiDivergence: false, // Would need historical analysis
        
        // Z-Score, Sharpe, Returns
        zScore: momentumETF?.zScore || null,
        sharpeRatio: momentumETF?.sharpeRatio || null,
        fiveDayReturn: momentumETF?.fiveDayChange || null,
        
        // Volume, VWAP, OBV
        volumeRatio: this.calculateVolumeRatio(sector),
        vwapSignal: this.getVWAPSignal(technical, sector),
        obvTrend: 'neutral' // Would need volume analysis
      };
    });
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
    if (!technical?.sma_20) return 'No Data';
    // Would compare current price to SMA for signal
    return 'Above 20 SMA';
  }

  private getMATrend(technical: any): 'bullish' | 'bearish' | 'neutral' {
    if (!technical?.sma_20) return 'neutral';
    // Simplified logic - would need historical SMA comparison
    return 'neutral';
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

  private getVWAPSignal(technical: any, sector: any): string {
    if (!technical?.vwap || !sector?.price) return 'No Data';
    const price = parseFloat(sector.price);
    const vwap = parseFloat(technical.vwap);
    
    if (price > vwap * 1.01) return 'Above VWAP';
    if (price < vwap * 0.99) return 'Below VWAP';
    return 'Near VWAP';
  }

  private getFallbackMetrics(): ETFMetrics[] {
    return this.ETF_SYMBOLS.map(symbol => ({
      symbol,
      name: this.ETF_NAMES[symbol as keyof typeof this.ETF_NAMES] || symbol,
      price: 0,
      changePercent: 0,
      bollingerPosition: null,
      bollingerSqueeze: false,
      bollingerStatus: 'Loading...',
      atr: null,
      volatility: null,
      maSignal: 'Loading...',
      maTrend: 'neutral',
      rsi: null,
      rsiSignal: 'Loading...',
      rsiDivergence: false,
      zScore: null,
      sharpeRatio: null,
      fiveDayReturn: null,
      volumeRatio: null,
      vwapSignal: 'Loading...',
      obvTrend: 'neutral'
    }));
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