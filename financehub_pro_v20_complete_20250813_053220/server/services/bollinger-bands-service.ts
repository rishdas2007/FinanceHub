import { logger } from '../middleware/logging';

interface BollingerBandData {
  symbol: string;
  upper: number;
  middle: number;
  lower: number;
  percentB: number;
  lastPrice: number;
}

export class BollingerBandsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.twelvedata.com';
  private cache = new Map<string, { data: BollingerBandData; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiKey = process.env.TWELVE_DATA_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('TWELVE_DATA_API_KEY not found - Bollinger Bands service disabled');
    }
  }

  /**
   * Fetch real-time Bollinger Bands from Twelve Data API
   */
  async getBollingerBands(symbol: string): Promise<BollingerBandData | null> {
    if (!this.apiKey) {
      logger.warn(`Cannot fetch Bollinger Bands for ${symbol}: API key missing`);
      return null;
    }

    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Fetch Bollinger Bands with timeout
      const bandsUrl = `${this.baseUrl}/bbands?symbol=${symbol}&interval=1day&apikey=${this.apiKey}&outputsize=1`;
      const bandsResponse = await fetch(bandsUrl, { signal: AbortSignal.timeout(2000) });
      const bandsData = await bandsResponse.json();

      if (bandsData.status === 'error') {
        logger.error(`Bollinger Bands API error for ${symbol}:`, bandsData.message);
        return null;
      }

      // Fetch current price for %B calculation with timeout
      const priceUrl = `${this.baseUrl}/price?symbol=${symbol}&apikey=${this.apiKey}`;
      const priceResponse = await fetch(priceUrl, { signal: AbortSignal.timeout(2000) });
      const priceData = await priceResponse.json();

      if (priceData.status === 'error') {
        logger.error(`Price API error for ${symbol}:`, priceData.message);
        return null;
      }

      const currentPrice = parseFloat(priceData.price);
      const latestBands = bandsData.values?.[0];

      if (!latestBands) {
        logger.warn(`No Bollinger Bands data available for ${symbol}`);
        return null;
      }

      const upper = parseFloat(latestBands.upper_band);
      const middle = parseFloat(latestBands.middle_band);
      const lower = parseFloat(latestBands.lower_band);

      // Calculate %B: (Price - Lower Band) / (Upper Band - Lower Band)
      const percentB = (currentPrice - lower) / (upper - lower);

      const result = {
        symbol,
        upper,
        middle,
        lower,
        percentB,
        lastPrice: currentPrice
      };

      // Cache the result
      this.cache.set(symbol, { data: result, timestamp: Date.now() });
      return result;

    } catch (error) {
      logger.error(`Failed to fetch Bollinger Bands for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch Bollinger Bands for multiple ETF symbols with aggressive parallel processing
   */
  async getBollingerBandsBatch(symbols: string[]): Promise<Map<string, BollingerBandData>> {
    const results = new Map<string, BollingerBandData>();
    
    // Process all symbols in parallel - no artificial delays
    const promises = symbols.map(async (symbol) => {
      try {
        const data = await this.getBollingerBands(symbol);
        if (data) {
          results.set(symbol, data);
        }
      } catch (error) {
        logger.warn(`Bollinger Bands failed for ${symbol}, will use database fallback`);
      }
    });

    // Execute all requests in parallel with timeout
    await Promise.allSettled(promises);

    return results;
  }

  /**
   * Calculate Z-score for %B value (assuming normal distribution around 0.5)
   */
  calculatePercentBZScore(percentB: number): number {
    // Assuming %B follows normal distribution with mean=0.5, std=0.3
    return (percentB - 0.5) / 0.3;
  }
}

export const bollingerBandsService = new BollingerBandsService();