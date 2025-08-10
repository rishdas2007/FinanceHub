import { logger } from '../utils/logger';

/**
 * WEEK 2: SMART CACHE TTL SYSTEM
 * Intelligent cache TTL based on data type, market hours, and volatility
 */

export interface CacheTTLConfig {
  baselineTTL: number;
  marketHoursMultiplier: number;
  volatilityAdjustment: number;
  dataTypeModifier: number;
  minTTL: number;
  maxTTL: number;
}

export enum DataType {
  REAL_TIME_MARKET = 'realtime_market',
  TECHNICAL_INDICATORS = 'technical_indicators', 
  ECONOMIC_DATA = 'economic_data',
  AI_ANALYSIS = 'ai_analysis',
  HISTORICAL_DATA = 'historical_data',
  SECTOR_PERFORMANCE = 'sector_performance'
}

export class SmartCacheTTLService {
  private readonly configs: Map<DataType, CacheTTLConfig> = new Map([
    [DataType.REAL_TIME_MARKET, {
      baselineTTL: 30 * 1000, // 30 seconds
      marketHoursMultiplier: 0.5, // More frequent during market hours
      volatilityAdjustment: 0.3,
      dataTypeModifier: 1.0,
      minTTL: 15 * 1000, // 15 seconds minimum
      maxTTL: 5 * 60 * 1000 // 5 minutes maximum
    }],
    [DataType.TECHNICAL_INDICATORS, {
      baselineTTL: 2 * 60 * 1000, // 2 minutes
      marketHoursMultiplier: 0.7,
      volatilityAdjustment: 0.4,
      dataTypeModifier: 1.2,
      minTTL: 1 * 60 * 1000, // 1 minute minimum
      maxTTL: 10 * 60 * 1000 // 10 minutes maximum
    }],
    [DataType.ECONOMIC_DATA, {
      baselineTTL: 15 * 60 * 1000, // 15 minutes
      marketHoursMultiplier: 1.0, // No change for market hours
      volatilityAdjustment: 0.1, // Low volatility impact
      dataTypeModifier: 2.0,
      minTTL: 10 * 60 * 1000, // 10 minutes minimum
      maxTTL: 60 * 60 * 1000 // 1 hour maximum
    }],
    [DataType.AI_ANALYSIS, {
      baselineTTL: 5 * 60 * 1000, // 5 minutes
      marketHoursMultiplier: 0.8,
      volatilityAdjustment: 0.2,
      dataTypeModifier: 1.5,
      minTTL: 3 * 60 * 1000, // 3 minutes minimum
      maxTTL: 20 * 60 * 1000 // 20 minutes maximum
    }],
    [DataType.HISTORICAL_DATA, {
      baselineTTL: 30 * 60 * 1000, // 30 minutes
      marketHoursMultiplier: 1.0,
      volatilityAdjustment: 0.05,
      dataTypeModifier: 3.0,
      minTTL: 20 * 60 * 1000, // 20 minutes minimum
      maxTTL: 2 * 60 * 60 * 1000 // 2 hours maximum
    }],
    [DataType.SECTOR_PERFORMANCE, {
      baselineTTL: 3 * 60 * 1000, // 3 minutes
      marketHoursMultiplier: 0.6,
      volatilityAdjustment: 0.3,
      dataTypeModifier: 1.3,
      minTTL: 2 * 60 * 1000, // 2 minutes minimum
      maxTTL: 15 * 60 * 1000 // 15 minutes maximum
    }]
  ]);

  /**
   * Calculate smart TTL based on market conditions
   */
  calculateSmartTTL(
    dataType: DataType, 
    marketVolatility: number = 0.5, // 0-1 scale
    isMarketHours: boolean = true
  ): number {
    const config = this.configs.get(dataType);
    if (!config) {
      logger.warn(`Unknown data type: ${dataType}, using default TTL`);
      return 5 * 60 * 1000; // 5 minutes default
    }

    let ttl = config.baselineTTL;

    // Apply market hours adjustment
    if (isMarketHours) {
      ttl *= config.marketHoursMultiplier;
    }

    // Apply volatility adjustment (higher volatility = shorter TTL)
    const volatilityFactor = 1 - (marketVolatility * config.volatilityAdjustment);
    ttl *= volatilityFactor;

    // Apply data type modifier
    ttl *= config.dataTypeModifier;

    // Enforce bounds
    ttl = Math.max(config.minTTL, Math.min(config.maxTTL, ttl));

    logger.debug(`Smart TTL calculated for ${dataType}: ${ttl}ms (volatility: ${marketVolatility}, market hours: ${isMarketHours})`);

    return Math.round(ttl);
  }

  /**
   * Get market volatility based on VIX or recent price movements
   */
  async getMarketVolatility(): Promise<number> {
    try {
      // Simple volatility calculation based on VIX proxy
      // In production, this would use actual VIX data
      const baseVolatility = 0.3; // Base volatility assumption
      const timeOfDay = new Date().getHours();
      
      // Higher volatility during market open/close
      let volatilityAdjustment = 0;
      if (timeOfDay >= 9 && timeOfDay <= 10) volatilityAdjustment = 0.2; // Market open
      if (timeOfDay >= 15 && timeOfDay <= 16) volatilityAdjustment = 0.15; // Market close
      
      return Math.min(1.0, baseVolatility + volatilityAdjustment);
    } catch (error) {
      logger.error('Error calculating market volatility:', error);
      return 0.5; // Default moderate volatility
    }
  }

  /**
   * Check if market is currently open
   */
  isMarketHours(): boolean {
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getUTCHours();
    
    // Market is closed on weekends
    if (day === 0 || day === 6) return false;
    
    // EST market hours: 9:30 AM - 4:00 PM (14:30 - 21:00 UTC)
    return hour >= 14 && hour < 21;
  }

  /**
   * Get optimized cache configuration for React Query
   */
  async getReactQueryConfig(dataType: DataType): Promise<{
    staleTime: number;
    gcTime: number;
    refetchInterval: number | false;
  }> {
    const volatility = await this.getMarketVolatility();
    const isMarketOpen = this.isMarketHours();
    const smartTTL = this.calculateSmartTTL(dataType, volatility, isMarketOpen);

    return {
      staleTime: smartTTL,
      gcTime: smartTTL * 2, // Keep cached data twice as long as stale time
      refetchInterval: isMarketOpen ? smartTTL * 1.5 : false // Auto-refetch only during market hours
    };
  }
}

export const smartCacheTTLService = new SmartCacheTTLService();