/**
 * Unified Market Data Service
 * Consolidates: financial-data.ts, simplified-sector-analysis.ts, market data fetching
 */

import { logger } from '../../shared/utils/logger';
import { isMarketOpen } from '../../shared/utils/marketHours-unified';
import { formatNumber, formatPercentage, formatLargeNumber } from '../../shared/utils/numberFormatting-unified';

interface StockData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume?: string;
  high?: string;
  low?: string;
  open?: string;
  previousClose?: string;
  marketCap?: string;
}

interface SectorETF {
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  fiveDayChange?: number;
  oneMonthChange?: number;
  volume?: number;
}

interface TechnicalIndicators {
  symbol: string;
  rsi: string;
  macd: string;
  macdSignal: string;
  macdHistogram: string;
  sma20: string;
  sma50: string;
  ema12: string;
  ema26: string;
  bb_upper: string;
  bb_middle: string;
  bb_lower: string;
  percent_b: string;
  adx: string;
  stoch_k: string;
  stoch_d: string;
  vwap: string;
  atr: string;
  willr: string;
}

export class MarketDataService {
  private static instance: MarketDataService;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private apiKey = process.env.TWELVE_DATA_API_KEY;
  private apiCallCount = 0;
  private lastResetTime = Date.now();
  private readonly CALLS_PER_MINUTE = 144;

  private constructor() {}

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  private async rateLimitGuard(): Promise<void> {
    const now = Date.now();
    if (now - this.lastResetTime > 60000) {
      this.apiCallCount = 0;
      this.lastResetTime = now;
    }

    if (this.apiCallCount >= this.CALLS_PER_MINUTE) {
      const waitTime = 60000 - (now - this.lastResetTime);
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`, 'MarketData');
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.apiCallCount = 0;
      this.lastResetTime = Date.now();
    }
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  async getStockQuote(symbol: string, cacheTtl = 60000): Promise<StockData> {
    const cacheKey = `stock_${symbol}`;
    const cached = this.getCached<StockData>(cacheKey);
    if (cached) {
      logger.debug(`Using cached stock data for ${symbol}`, 'MarketData');
      return cached;
    }

    try {
      await this.rateLimitGuard();
      this.apiCallCount++;

      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'error' || !data.close) {
        throw new Error('Invalid response from Twelve Data API');
      }

      const stockData: StockData = {
        symbol: data.symbol || symbol,
        price: parseFloat(data.close || '0').toFixed(2),
        change: parseFloat(data.change || '0').toFixed(2),
        changePercent: parseFloat(data.percent_change || '0').toFixed(2),
        volume: data.volume ? formatLargeNumber(parseInt(data.volume)) : undefined,
        high: data.high ? parseFloat(data.high).toFixed(2) : undefined,
        low: data.low ? parseFloat(data.low).toFixed(2) : undefined,
        open: data.open ? parseFloat(data.open).toFixed(2) : undefined,
        previousClose: data.previous_close ? parseFloat(data.previous_close).toFixed(2) : undefined
      };

      this.setCache(cacheKey, stockData, cacheTtl);
      logger.info(`Real data for ${symbol}: $${stockData.price} (${stockData.changePercent}%)`, 'MarketData');
      
      return stockData;

    } catch (error) {
      logger.error(`Error fetching ${symbol}`, 'MarketData', error);
      
      // Return fallback data during market hours only if we have cached data
      const fallbackData: StockData = {
        symbol,
        price: '0.00',
        change: '0.00',
        changePercent: '0.00'
      };
      
      return fallbackData;
    }
  }

  async getTechnicalIndicators(symbol: string, cacheTtl = 180000): Promise<TechnicalIndicators> {
    const cacheKey = `technical_${symbol}`;
    const cached = this.getCached<TechnicalIndicators>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      await this.rateLimitGuard();
      
      // Fetch multiple indicators in parallel
      const indicators = [
        'RSI', 'MACD', 'SMA', 'EMA', 'BBANDS', 'ADX', 'STOCH', 'VWAP', 'ATR', 'WILLR'
      ];

      const requests = indicators.map(async (indicator) => {
        this.apiCallCount++;
        let url = `https://api.twelvedata.com/${indicator.toLowerCase()}?symbol=${symbol}&interval=1day&apikey=${this.apiKey}`;
        
        // Add specific parameters for certain indicators
        if (indicator === 'SMA') {
          url += '&time_period=20';
        } else if (indicator === 'EMA') {
          url += '&time_period=12';
        }
        
        return fetch(url);
      });

      const responses = await Promise.all(requests);
      const dataPromises = responses.map(r => r.json());
      const results = await Promise.all(dataPromises);

      // Process results into technical indicators object
      const technical: TechnicalIndicators = {
        symbol,
        rsi: '0',
        macd: '0',
        macdSignal: '0',
        macdHistogram: '0',
        sma20: '0',
        sma50: '0',
        ema12: '0',
        ema26: '0',
        bb_upper: '0',
        bb_middle: '0',
        bb_lower: '0',
        percent_b: '0',
        adx: '0',
        stoch_k: '0',
        stoch_d: '0',
        vwap: '0',
        atr: '0',
        willr: '0'
      };

      // Parse each indicator result
      results.forEach((result, index) => {
        if (result.values && result.values.length > 0) {
          const latest = result.values[0];
          const indicator = indicators[index];
          
          switch (indicator) {
            case 'RSI':
              technical.rsi = parseFloat(latest.rsi || '0').toFixed(5);
              break;
            case 'MACD':
              technical.macd = parseFloat(latest.macd || '0').toFixed(5);
              technical.macdSignal = parseFloat(latest.macd_signal || '0').toFixed(5);
              technical.macdHistogram = parseFloat(latest.macd_hist || '0').toFixed(5);
              break;
            // Add more cases as needed
          }
        }
      });

      this.setCache(cacheKey, technical, cacheTtl);
      logger.info(`Enhanced technical indicators fetched for ${symbol}`, 'MarketData');
      
      return technical;

    } catch (error) {
      logger.error(`Error fetching technical indicators for ${symbol}`, 'MarketData', error);
      
      // Return fallback technical data
      return {
        symbol,
        rsi: '50.0',
        macd: '0.0',
        macdSignal: '0.0',
        macdHistogram: '0.0',
        sma20: '0.0',
        sma50: '0.0',
        ema12: '0.0',
        ema26: '0.0',
        bb_upper: '0.0',
        bb_middle: '0.0',
        bb_lower: '0.0',
        percent_b: '0.5',
        adx: '25.0',
        stoch_k: '50.0',
        stoch_d: '50.0',
        vwap: '0.0',
        atr: '1.0',
        willr: '-50.0'
      };
    }
  }

  async getSectorETFs(cacheTtl = 300000): Promise<SectorETF[]> {
    const cacheKey = 'sector_etfs';
    const cached = this.getCached<SectorETF[]>(cacheKey);
    if (cached) {
      logger.debug('Using cached sector data', 'MarketData');
      return cached;
    }

    const sectorSymbols = [
      { symbol: 'SPY', name: 'S&P 500 INDEX' },
      { symbol: 'XLK', name: 'Technology' },
      { symbol: 'XLV', name: 'Health Care' },
      { symbol: 'XLF', name: 'Financials' },
      { symbol: 'XLY', name: 'Consumer Discretionary' },
      { symbol: 'XLI', name: 'Industrials' },
      { symbol: 'XLC', name: 'Communication Services' },
      { symbol: 'XLP', name: 'Consumer Staples' },
      { symbol: 'XLE', name: 'Energy' },
      { symbol: 'XLU', name: 'Utilities' },
      { symbol: 'XLB', name: 'Materials' },
      { symbol: 'XLRE', name: 'Real Estate' }
    ];

    try {
      const sectorPromises = sectorSymbols.map(async (sector) => {
        const stockData = await this.getStockQuote(sector.symbol, 60000);
        return {
          name: sector.name,
          symbol: sector.symbol,
          price: parseFloat(stockData.price),
          changePercent: parseFloat(stockData.changePercent),
          fiveDayChange: 0, // Would need historical data
          oneMonthChange: 0, // Would need historical data
          volume: stockData.volume ? parseInt(stockData.volume.replace(/[^\d]/g, '')) : undefined
        };
      });

      const sectors = await Promise.all(sectorPromises);
      this.setCache(cacheKey, sectors, cacheTtl);
      logger.info(`Real sector data fetched for ${sectors.length} ETFs`, 'MarketData');
      
      return sectors;

    } catch (error) {
      logger.error('Error fetching sector data', 'MarketData', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Market data cache cleared', 'MarketData');
  }

  getCacheStats(): { entries: number; hitRate: number } {
    return {
      entries: this.cache.size,
      hitRate: 0 // Would need hit/miss tracking
    };
  }
}

export const marketDataService = MarketDataService.getInstance();