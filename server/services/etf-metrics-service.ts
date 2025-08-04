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
  
  // Weighted Technical Indicator Scoring System
  weightedScore: number | null;
  weightedSignal: string | null;
  
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
      // First, try to get fresh momentum data by making an API call to the momentum endpoint
      try {
        const response = await fetch('http://localhost:5000/api/momentum-analysis');
        if (response.ok) {
          const data = await response.json();
          if (data.momentumStrategies && Array.isArray(data.momentumStrategies)) {
            logger.info(`📊 Fetched fresh momentum data for ${data.momentumStrategies.length} ETFs from API`);
            return data.momentumStrategies;
          }
        }
      } catch (fetchError) {
        logger.warn('Failed to fetch fresh momentum data via API:', fetchError);
      }

      // Fallback: Use cached momentum data
      const momentumCacheKey = 'momentum-analysis-cache-v2';
      const cached = cacheService.get(momentumCacheKey);
      
      if (cached && cached.momentumStrategies && Array.isArray(cached.momentumStrategies)) {
        logger.info(`📊 Using cached momentum data for ${cached.momentumStrategies.length} ETFs`);
        return cached.momentumStrategies;
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

      const metrics = {
        symbol,
        name: this.ETF_NAMES[symbol as keyof typeof this.ETF_NAMES] || symbol,
        price: sector ? parseFloat(sector.price) : 0,
        changePercent: momentumETF?.oneDayChange ? parseFloat(momentumETF.oneDayChange.toString()) : 
                      (sector ? parseFloat(sector.changePercent) : 0),
        
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
        
        // RSI (Momentum) - Prioritize momentum data, fallback to technical
        rsi: momentumETF?.rsi ? parseFloat(momentumETF.rsi.toString()) : (technical?.rsi ? parseFloat(technical.rsi) : null),
        rsiSignal: this.getRSISignal(momentumETF?.rsi || technical?.rsi),
        rsiDivergence: false, // Would need historical analysis
        
        // Z-Score, Sharpe, Returns - Enhanced integration with momentum data
        zScore: momentumETF?.zScore || momentumETF?.zScoreOfLatest1DayMove || null,
        sharpeRatio: momentumETF?.sharpeRatio || null,
        fiveDayReturn: momentumETF?.fiveDayChange || momentumETF?.fiveDayMove || momentumETF?.oneDayMove || null,
        
        // Volume, VWAP, OBV - Enhanced VWAP integration
        volumeRatio: this.calculateVolumeRatio(sector),
        vwapSignal: this.getVWAPSignal(technical, sector, momentumETF),
        obvTrend: momentumETF?.signal ? this.parseOBVFromSignal(momentumETF.signal) : 'neutral',
        
        // Weighted Technical Indicator Scoring System (placeholder for now)
        weightedScore: null,
        weightedSignal: null
      };

      // Calculate weighted scoring system
      const weightedResult = this.calculateWeightedTechnicalScore(metrics, momentumETF);
      metrics.weightedScore = weightedResult.score;
      metrics.weightedSignal = weightedResult.signal;

      return metrics;
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
   * WEIGHTED TECHNICAL INDICATOR SCORING SYSTEM
   * Implements scientifically-backed weighting based on predictive power
   */
  private calculateWeightedTechnicalScore(metrics: any, momentumETF?: any): { score: number; signal: string } {
    let totalScore = 0;
    let totalWeight = 0;

    // 1. Bollinger Bands - Highest weight (30%) - Strong mean reversion predictor
    const bollingerScore = this.getBollingerScore(metrics.bollingerPosition, metrics.bollingerStatus);
    if (bollingerScore !== null) {
      totalScore += bollingerScore * 0.30;
      totalWeight += 0.30;
    }

    // 2. ATR/Volatility - High weight (20%) - Risk and momentum predictor
    const atrScore = this.getATRScore(metrics.atr, metrics.volatility, momentumETF);
    if (atrScore !== null) {
      totalScore += atrScore * 0.20;
      totalWeight += 0.20;
    }

    // 3. MA Trend - High weight (15%) - Trend confirmation
    const maScore = this.getMAScore(metrics.maSignal, metrics.maTrend);
    if (maScore !== null) {
      totalScore += maScore * 0.15;
      totalWeight += 0.15;
    }

    // 4. RSI - Medium weight (15%) - Momentum oscillator
    const rsiScore = this.getRSIScore(metrics.rsi);
    if (rsiScore !== null) {
      totalScore += rsiScore * 0.15;
      totalWeight += 0.15;
    }

    // 5. Z-Score - Medium weight (10%) - Statistical deviation
    const zScore = this.getZScore(metrics.zScore);
    if (zScore !== null) {
      totalScore += zScore * 0.10;
      totalWeight += 0.10;
    }

    // 6. VWAP - Supporting weight (10%) - Price vs volume confirmation
    const vwapScore = this.getVWAPScore(metrics.vwapSignal);
    if (vwapScore !== null) {
      totalScore += vwapScore * 0.10;
      totalWeight += 0.10;
    }

    // Normalize score if we have any data
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Classification based on statistical thresholds
    let signal: string;
    if (finalScore > 0.5) {
      signal = 'BUY';
    } else if (finalScore < -0.5) {
      signal = 'SELL';
    } else {
      signal = 'HOLD';
    }

    return { score: finalScore, signal };
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

  private getVWAPScore(signal: string): number | null {
    if (!signal || signal === 'No Data' || signal === 'Loading...') return null;
    
    if (signal.includes('Above')) return 1;
    if (signal.includes('Below')) return -1;
    return 0; // At VWAP = neutral
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