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

    try {
      // Fetch Bollinger Bands
      const bandsUrl = `${this.baseUrl}/bbands?symbol=${symbol}&interval=1day&apikey=${this.apiKey}&outputsize=1`;
      const bandsResponse = await fetch(bandsUrl);
      const bandsData = await bandsResponse.json();

      if (bandsData.status === 'error') {
        logger.error(`Bollinger Bands API error for ${symbol}:`, bandsData.message);
        return null;
      }

      // Fetch current price for %B calculation
      const priceUrl = `${this.baseUrl}/price?symbol=${symbol}&apikey=${this.apiKey}`;
      const priceResponse = await fetch(priceUrl);
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

      return {
        symbol,
        upper,
        middle,
        lower,
        percentB,
        lastPrice: currentPrice
      };

    } catch (error) {
      logger.error(`Failed to fetch Bollinger Bands for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch Bollinger Bands for multiple ETF symbols
   */
  async getBollingerBandsBatch(symbols: string[]): Promise<Map<string, BollingerBandData>> {
    const results = new Map<string, BollingerBandData>();
    
    // Process symbols in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        const data = await this.getBollingerBands(symbol);
        if (data) {
          results.set(symbol, data);
        }
        
        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await Promise.all(promises);
      
      // Longer delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

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