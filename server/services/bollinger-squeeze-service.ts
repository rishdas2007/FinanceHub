import { inject, injectable } from "inversify";
import { DatabaseService } from "./database-service";
import { CacheService } from "./cache-service";
import { Logger } from "./logger-service";
import type { BollingerSqueezeEvent, Timeframe } from "../../shared/convergence-types";

@injectable()
export class BollingerSqueezeService {
  constructor(
    @inject("DatabaseService") private db: DatabaseService,
    @inject("CacheService") private cache: CacheService,
    @inject("Logger") private logger: Logger
  ) {}

  async detectSqueeze(
    symbol: string,
    timeframe: Timeframe,
    indicators: {
      bollinger_upper: number;
      bollinger_middle: number;
      bollinger_lower: number;
      atr: number;
      price: number;
      volume: number;
    }
  ): Promise<boolean> {
    try {
      // Calculate Bollinger Band width as percentage of middle band
      const bandWidth = (indicators.bollinger_upper - indicators.bollinger_lower) / indicators.bollinger_middle;
      
      // Get historical band width for comparison (20-period average)
      const historicalWidth = await this.getHistoricalBandWidth(symbol, timeframe);
      
      // Squeeze condition: current width is in bottom 20th percentile of historical widths
      const isSqueezeCondition = bandWidth < (historicalWidth * 0.8);
      
      if (isSqueezeCondition) {
        await this.recordSqueezeEvent(symbol, timeframe, indicators);
        this.logger.info(`🔄 Bollinger squeeze detected for ${symbol} on ${timeframe} timeframe`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Squeeze detection failed for ${symbol}-${timeframe}:`, error);
      return false;
    }
  }

  async detectBreakout(
    symbol: string,
    timeframe: Timeframe,
    currentPrice: number,
    currentVolume: number
  ): Promise<{ direction: 'up' | 'down' | null; strength: number }> {
    try {
      // Get active squeeze for this symbol/timeframe
      const activeSqueezeResult = await this.db.query(`
        SELECT * FROM bollinger_squeeze_events 
        WHERE symbol = $1 AND timeframe = $2 
        AND is_active = true AND squeeze_end IS NULL
        ORDER BY squeeze_start DESC LIMIT 1
      `, [symbol, timeframe]);

      if (activeSqueezeResult.rows.length === 0) {
        return { direction: null, strength: 0 };
      }

      const squeeze = activeSqueezeResult.rows[0];
      const priceAtSqueeze = parseFloat(squeeze.price_at_squeeze);
      const volumeAtSqueeze = parseFloat(squeeze.volume_at_squeeze);

      // Calculate price movement and volume confirmation
      const priceChange = (currentPrice - priceAtSqueeze) / priceAtSqueeze;
      const volumeRatio = currentVolume / volumeAtSqueeze;

      // Breakout thresholds
      const minPriceMove = 0.015; // 1.5% minimum price movement
      const minVolumeRatio = 1.5; // 50% volume increase

      let direction: 'up' | 'down' | null = null;
      let strength = 0;

      if (Math.abs(priceChange) >= minPriceMove && volumeRatio >= minVolumeRatio) {
        direction = priceChange > 0 ? 'up' : 'down';
        
        // Calculate strength based on price movement and volume
        const priceStrength = Math.min(100, Math.abs(priceChange) * 100 / minPriceMove);
        const volumeStrength = Math.min(100, (volumeRatio - 1) * 100);
        strength = Math.round((priceStrength + volumeStrength) / 2);

        // Record the breakout
        await this.recordBreakout(squeeze.id, direction, strength, currentPrice, currentVolume);
        
        this.logger.info(`🚀 Breakout detected for ${symbol}-${timeframe}: ${direction} with strength ${strength}`);
      }

      return { direction, strength };
    } catch (error) {
      this.logger.error(`Breakout detection failed for ${symbol}-${timeframe}:`, error);
      return { direction: null, strength: 0 };
    }
  }

  private async getHistoricalBandWidth(symbol: string, timeframe: Timeframe): Promise<number> {
    try {
      const cacheKey = `historical-band-width-${symbol}-${timeframe}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as number;
      }

      const result = await this.db.query(`
        SELECT AVG(
          (bollinger_upper - bollinger_lower) / bollinger_middle
        ) as avg_width
        FROM technical_indicators_multi_timeframe 
        WHERE symbol = $1 AND timeframe = $2 
        AND bollinger_upper IS NOT NULL 
        AND bollinger_middle IS NOT NULL 
        AND bollinger_lower IS NOT NULL
        AND timestamp > NOW() - INTERVAL '30 days'
      `, [symbol, timeframe]);

      const avgWidth = parseFloat(result.rows[0]?.avg_width || '0.04'); // Default 4% if no data
      
      // Cache for 1 hour
      await this.cache.set(cacheKey, avgWidth, 3600);
      
      return avgWidth;
    } catch (error) {
      this.logger.error(`Failed to get historical band width for ${symbol}-${timeframe}:`, error);
      return 0.04; // Default fallback
    }
  }

  private async recordSqueezeEvent(
    symbol: string,
    timeframe: Timeframe,
    indicators: {
      bollinger_upper: number;
      bollinger_middle: number;
      bollinger_lower: number;
      atr: number;
      price: number;
      volume: number;
    }
  ): Promise<void> {
    try {
      // Check if there's already an active squeeze for this symbol/timeframe
      const existingResult = await this.db.query(`
        SELECT id FROM bollinger_squeeze_events 
        WHERE symbol = $1 AND timeframe = $2 
        AND is_active = true AND squeeze_end IS NULL
      `, [symbol, timeframe]);

      if (existingResult.rows.length > 0) {
        return; // Already tracking this squeeze
      }

      await this.db.query(`
        INSERT INTO bollinger_squeeze_events (
          symbol, timeframe, squeeze_start, price_at_squeeze, volume_at_squeeze, is_active
        ) VALUES ($1, $2, NOW(), $3, $4, true)
      `, [symbol, timeframe, indicators.price, indicators.volume]);
    } catch (error) {
      this.logger.error(`Failed to record squeeze event for ${symbol}-${timeframe}:`, error);
    }
  }

  private async recordBreakout(
    squeezeId: number,
    direction: 'up' | 'down',
    strength: number,
    price: number,
    volume: number
  ): Promise<void> {
    try {
      // Update the squeeze event with breakout information
      await this.db.query(`
        UPDATE bollinger_squeeze_events 
        SET 
          squeeze_end = NOW(),
          squeeze_duration_hours = EXTRACT(EPOCH FROM (NOW() - squeeze_start)) / 3600,
          breakout_direction = $1,
          breakout_strength = $2,
          price_at_breakout = $3,
          volume_at_breakout = $4,
          is_active = false
        WHERE id = $5
      `, [direction, strength, price, volume, squeezeId]);

      // Schedule return calculation for later (24h and 7d)
      this.scheduleReturnCalculation(squeezeId);
    } catch (error) {
      this.logger.error(`Failed to record breakout for squeeze ${squeezeId}:`, error);
    }
  }

  private scheduleReturnCalculation(squeezeId: number): void {
    // Schedule return calculations
    setTimeout(async () => {
      await this.calculateReturns(squeezeId, '24h');
    }, 24 * 60 * 60 * 1000); // 24 hours

    setTimeout(async () => {
      await this.calculateReturns(squeezeId, '7d');
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  private async calculateReturns(squeezeId: number, period: '24h' | '7d'): Promise<void> {
    try {
      // Get squeeze event
      const squeezeResult = await this.db.query(`
        SELECT symbol, price_at_breakout FROM bollinger_squeeze_events WHERE id = $1
      `, [squeezeId]);

      if (squeezeResult.rows.length === 0) return;

      const { symbol, price_at_breakout } = squeezeResult.rows[0];
      const breakoutPrice = parseFloat(price_at_breakout);

      // Get current price (this would typically come from your stock data service)
      const currentPriceResult = await this.db.query(`
        SELECT price FROM stock_data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1
      `, [symbol]);

      if (currentPriceResult.rows.length === 0) return;

      const currentPrice = parseFloat(currentPriceResult.rows[0].price);
      const returnPercentage = (currentPrice - breakoutPrice) / breakoutPrice;

      // Update the squeeze event with return data
      const updateField = period === '24h' ? 'return_24h' : 'return_7d';
      await this.db.query(`
        UPDATE bollinger_squeeze_events 
        SET ${updateField} = $1 
        WHERE id = $2
      `, [returnPercentage, squeezeId]);

      this.logger.info(`Updated ${period} return for squeeze ${squeezeId}: ${(returnPercentage * 100).toFixed(2)}%`);
    } catch (error) {
      this.logger.error(`Failed to calculate ${period} return for squeeze ${squeezeId}:`, error);
    }
  }

  async getSqueezeStatistics(symbol?: string): Promise<{
    total_squeezes: number;
    avg_duration_hours: number;
    breakout_success_rate: number;
    avg_return_24h: number;
    avg_return_7d: number;
  }> {
    try {
      const whereClause = symbol ? 'WHERE symbol = $1' : '';
      const params = symbol ? [symbol] : [];

      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_squeezes,
          AVG(squeeze_duration_hours) as avg_duration_hours,
          COUNT(CASE WHEN breakout_direction IS NOT NULL THEN 1 END)::float / COUNT(*) as breakout_success_rate,
          AVG(return_24h) as avg_return_24h,
          AVG(return_7d) as avg_return_7d
        FROM bollinger_squeeze_events 
        ${whereClause}
        AND squeeze_start > NOW() - INTERVAL '6 months'
      `, params);

      const row = result.rows[0];
      
      return {
        total_squeezes: parseInt(row.total_squeezes || '0'),
        avg_duration_hours: parseFloat(row.avg_duration_hours || '0'),
        breakout_success_rate: parseFloat(row.breakout_success_rate || '0'),
        avg_return_24h: parseFloat(row.avg_return_24h || '0'),
        avg_return_7d: parseFloat(row.avg_return_7d || '0')
      };
    } catch (error) {
      this.logger.error('Failed to get squeeze statistics:', error);
      return {
        total_squeezes: 0,
        avg_duration_hours: 0,
        breakout_success_rate: 0,
        avg_return_24h: 0,
        avg_return_7d: 0
      };
    }
  }
}