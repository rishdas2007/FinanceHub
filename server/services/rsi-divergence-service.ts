import { inject, injectable } from "inversify";
import { DatabaseService } from "./database-service";
import { CacheService } from "./cache-service";
import { Logger } from "./logger-service";
import type { RSIDivergence, Timeframe } from "../../shared/convergence-types";

interface PriceRSIPoint {
  timestamp: Date;
  price: number;
  rsi: number;
}

@injectable()
export class RSIDivergenceService {
  constructor(
    @inject("DatabaseService") private db: DatabaseService,
    @inject("CacheService") private cache: CacheService,
    @inject("Logger") private logger: Logger
  ) {}

  async detectDivergence(
    symbol: string,
    timeframe: Timeframe,
    lookbackPeriods: number = 20
  ): Promise<RSIDivergence[]> {
    try {
      const cacheKey = `rsi-divergence-${symbol}-${timeframe}-${lookbackPeriods}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as RSIDivergence[];
      }

      // Get recent price and RSI data
      const data = await this.getPriceRSIData(symbol, timeframe, lookbackPeriods);
      
      if (data.length < 10) {
        return []; // Not enough data for divergence analysis
      }

      const divergences: RSIDivergence[] = [];

      // Detect bullish divergences (price makes lower lows, RSI makes higher lows)
      const bullishDivergence = this.findBullishDivergence(data);
      if (bullishDivergence) {
        divergences.push({
          symbol,
          timeframe,
          divergence_type: 'bullish',
          price_points: bullishDivergence.pricePoints,
          rsi_points: bullishDivergence.rsiPoints,
          strength: bullishDivergence.strength,
          confidence: bullishDivergence.confidence,
          detected_at: new Date()
        });
      }

      // Detect bearish divergences (price makes higher highs, RSI makes lower highs)
      const bearishDivergence = this.findBearishDivergence(data);
      if (bearishDivergence) {
        divergences.push({
          symbol,
          timeframe,
          divergence_type: 'bearish',
          price_points: bearishDivergence.pricePoints,
          rsi_points: bearishDivergence.rsiPoints,
          strength: bearishDivergence.strength,
          confidence: bearishDivergence.confidence,
          detected_at: new Date()
        });
      }

      // Cache for 10 minutes
      await this.cache.set(cacheKey, divergences, 600);

      if (divergences.length > 0) {
        this.logger.info(`🔍 RSI divergences detected for ${symbol}-${timeframe}: ${divergences.length} signals`);
      }

      return divergences;
    } catch (error) {
      this.logger.error(`RSI divergence detection failed for ${symbol}-${timeframe}:`, error);
      return [];
    }
  }

  private async getPriceRSIData(
    symbol: string,
    timeframe: Timeframe,
    periods: number
  ): Promise<PriceRSIPoint[]> {
    try {
      // Get price data from stock data
      const priceResult = await this.db.query(`
        SELECT timestamp, close as price
        FROM historical_stock_data 
        WHERE symbol = $1 
        ORDER BY date DESC 
        LIMIT $2
      `, [symbol, periods]);

      // Get RSI data from technical indicators
      const rsiResult = await this.db.query(`
        SELECT timestamp, rsi
        FROM technical_indicators_multi_timeframe 
        WHERE symbol = $1 AND timeframe = $2 
        AND rsi IS NOT NULL
        ORDER BY timestamp DESC 
        LIMIT $3
      `, [symbol, timeframe, periods]);

      // Merge price and RSI data by timestamp
      const priceData = new Map();
      priceResult.rows.forEach(row => {
        const dateKey = new Date(row.timestamp).toISOString().split('T')[0];
        priceData.set(dateKey, parseFloat(row.price));
      });

      const combinedData: PriceRSIPoint[] = [];
      rsiResult.rows.forEach(row => {
        const dateKey = new Date(row.timestamp).toISOString().split('T')[0];
        const price = priceData.get(dateKey);
        
        if (price && row.rsi) {
          combinedData.push({
            timestamp: new Date(row.timestamp),
            price: price,
            rsi: parseFloat(row.rsi)
          });
        }
      });

      return combinedData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      this.logger.error(`Failed to get price/RSI data for ${symbol}-${timeframe}:`, error);
      return [];
    }
  }

  private findBullishDivergence(data: PriceRSIPoint[]): {
    pricePoints: Array<{ timestamp: Date; price: number }>;
    rsiPoints: Array<{ timestamp: Date; rsi: number }>;
    strength: number;
    confidence: number;
  } | null {
    try {
      // Find price lows (local minima)
      const priceLows = this.findLocalMinima(data.map(d => ({ timestamp: d.timestamp, value: d.price })));
      
      // Find RSI lows
      const rsiLows = this.findLocalMinima(data.map(d => ({ timestamp: d.timestamp, value: d.rsi })));

      if (priceLows.length < 2 || rsiLows.length < 2) {
        return null;
      }

      // Get the two most recent lows for comparison
      const recentPriceLows = priceLows.slice(-2);
      const recentRSILows = rsiLows.slice(-2);

      // Check for bullish divergence: price lower low, RSI higher low
      const priceIsLowerLow = recentPriceLows[1].value < recentPriceLows[0].value;
      const rsiIsHigherLow = recentRSILows[1].value > recentRSILows[0].value;

      if (priceIsLowerLow && rsiIsHigherLow) {
        // Calculate strength based on the magnitude of divergence
        const priceChange = Math.abs((recentPriceLows[1].value - recentPriceLows[0].value) / recentPriceLows[0].value);
        const rsiChange = Math.abs(recentRSILows[1].value - recentRSILows[0].value);
        
        const strength = Math.min(100, (priceChange + rsiChange / 100) * 50);
        
        // Calculate confidence based on RSI levels and time separation
        const avgRSI = (recentRSILows[0].value + recentRSILows[1].value) / 2;
        const oversoldBonus = avgRSI < 30 ? 20 : 0; // Bonus for oversold conditions
        const timeSeparation = Math.abs(recentRSILows[1].timestamp.getTime() - recentRSILows[0].timestamp.getTime());
        const timeBonus = timeSeparation > 7 * 24 * 60 * 60 * 1000 ? 10 : 0; // Bonus for good time separation
        
        const confidence = Math.min(100, 60 + oversoldBonus + timeBonus);

        return {
          pricePoints: recentPriceLows.map(p => ({ timestamp: p.timestamp, price: p.value })),
          rsiPoints: recentRSILows.map(r => ({ timestamp: r.timestamp, rsi: r.value })),
          strength: Math.round(strength),
          confidence: Math.round(confidence)
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to find bullish divergence:', error);
      return null;
    }
  }

  private findBearishDivergence(data: PriceRSIPoint[]): {
    pricePoints: Array<{ timestamp: Date; price: number }>;
    rsiPoints: Array<{ timestamp: Date; rsi: number }>;
    strength: number;
    confidence: number;
  } | null {
    try {
      // Find price highs (local maxima)
      const priceHighs = this.findLocalMaxima(data.map(d => ({ timestamp: d.timestamp, value: d.price })));
      
      // Find RSI highs
      const rsiHighs = this.findLocalMaxima(data.map(d => ({ timestamp: d.timestamp, value: d.rsi })));

      if (priceHighs.length < 2 || rsiHighs.length < 2) {
        return null;
      }

      // Get the two most recent highs for comparison
      const recentPriceHighs = priceHighs.slice(-2);
      const recentRSIHighs = rsiHighs.slice(-2);

      // Check for bearish divergence: price higher high, RSI lower high
      const priceIsHigherHigh = recentPriceHighs[1].value > recentPriceHighs[0].value;
      const rsiIsLowerHigh = recentRSIHighs[1].value < recentRSIHighs[0].value;

      if (priceIsHigherHigh && rsiIsLowerHigh) {
        // Calculate strength based on the magnitude of divergence
        const priceChange = Math.abs((recentPriceHighs[1].value - recentPriceHighs[0].value) / recentPriceHighs[0].value);
        const rsiChange = Math.abs(recentRSIHighs[1].value - recentRSIHighs[0].value);
        
        const strength = Math.min(100, (priceChange + rsiChange / 100) * 50);
        
        // Calculate confidence based on RSI levels and time separation
        const avgRSI = (recentRSIHighs[0].value + recentRSIHighs[1].value) / 2;
        const overboughtBonus = avgRSI > 70 ? 20 : 0; // Bonus for overbought conditions
        const timeSeparation = Math.abs(recentRSIHighs[1].timestamp.getTime() - recentRSIHighs[0].timestamp.getTime());
        const timeBonus = timeSeparation > 7 * 24 * 60 * 60 * 1000 ? 10 : 0; // Bonus for good time separation
        
        const confidence = Math.min(100, 60 + overboughtBonus + timeBonus);

        return {
          pricePoints: recentPriceHighs.map(p => ({ timestamp: p.timestamp, price: p.value })),
          rsiPoints: recentRSIHighs.map(r => ({ timestamp: r.timestamp, rsi: r.value })),
          strength: Math.round(strength),
          confidence: Math.round(confidence)
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to find bearish divergence:', error);
      return null;
    }
  }

  private findLocalMinima(data: Array<{ timestamp: Date; value: number }>): Array<{ timestamp: Date; value: number }> {
    const minima: Array<{ timestamp: Date; value: number }> = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i].value < data[i - 1].value && data[i].value < data[i + 1].value) {
        minima.push(data[i]);
      }
    }
    
    return minima;
  }

  private findLocalMaxima(data: Array<{ timestamp: Date; value: number }>): Array<{ timestamp: Date; value: number }> {
    const maxima: Array<{ timestamp: Date; value: number }> = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i].value > data[i - 1].value && data[i].value > data[i + 1].value) {
        maxima.push(data[i]);
      }
    }
    
    return maxima;
  }

  async getDivergenceStatistics(symbol?: string): Promise<{
    total_divergences: number;
    bullish_count: number;
    bearish_count: number;
    avg_success_rate: number;
    best_timeframe: string;
  }> {
    try {
      // This would typically query a divergence history table
      // For now, return mock statistics
      return {
        total_divergences: 0,
        bullish_count: 0,
        bearish_count: 0,
        avg_success_rate: 0,
        best_timeframe: '1d'
      };
    } catch (error) {
      this.logger.error('Failed to get divergence statistics:', error);
      return {
        total_divergences: 0,
        bullish_count: 0,
        bearish_count: 0,
        avg_success_rate: 0,
        best_timeframe: '1d'
      };
    }
  }
}