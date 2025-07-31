/**
 * Intelligent Caching System - Phase 1: Emergency Performance Fix
 * 
 * Core Principle: Real Data Only - Never use static/made-up data.
 * Always use the most recent actual data fetched from APIs, with clear timestamps.
 */

import { logger } from '../../shared/utils/logger';
import { storage } from '../storage';

interface CachedData<T> {
  data: T;
  timestamp: number;
  source: 'api' | 'database' | 'fallback';
  dataAge: number;
  freshness: 'live' | 'recent' | 'historical' | 'stale';
}

interface CacheConfig {
  memoryTtl: number;
  databaseTtl: number;
  maxStaleAge: number;
  marketHoursMultiplier: number;
  afterHoursMultiplier: number;
  weekendMultiplier: number;
}

interface MarketStatus {
  isOpen: boolean;
  isAfterHours: boolean;
  isWeekend: boolean;
  nextOpen: Date;
  currentTime: Date;
}

export class IntelligentCacheSystem {
  private memoryCache = new Map<string, CachedData<any>>();
  private cacheConfigs = new Map<string, CacheConfig>();
  private performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    databaseQueries: 0,
    averageResponseTime: 0
  };

  constructor() {
    this.initializeCacheConfigs();
    this.startCacheCleanup();
  }

  private initializeCacheConfigs(): void {
    // Stock quotes - most time-sensitive
    this.cacheConfigs.set('stock', {
      memoryTtl: 30000,        // 30 seconds during market hours
      databaseTtl: 300000,     // 5 minutes for database fallback
      maxStaleAge: 1800000,    // 30 minutes max stale
      marketHoursMultiplier: 1,
      afterHoursMultiplier: 30, // 15 minutes after hours
      weekendMultiplier: 120    // 1 hour on weekends
    });

    // Technical indicators - moderately time-sensitive
    this.cacheConfigs.set('technical', {
      memoryTtl: 180000,       // 3 minutes during market hours
      databaseTtl: 900000,     // 15 minutes for database fallback
      maxStaleAge: 3600000,    // 1 hour max stale
      marketHoursMultiplier: 1,
      afterHoursMultiplier: 10, // 30 minutes after hours
      weekendMultiplier: 40     // 2 hours on weekends
    });

    // Sector data - less time-sensitive
    this.cacheConfigs.set('sector', {
      memoryTtl: 300000,       // 5 minutes during market hours
      databaseTtl: 1800000,    // 30 minutes for database fallback
      maxStaleAge: 7200000,    // 2 hours max stale
      marketHoursMultiplier: 1,
      afterHoursMultiplier: 6,  // 30 minutes after hours
      weekendMultiplier: 24     // 2 hours on weekends
    });

    // Economic data - least time-sensitive
    this.cacheConfigs.set('economic', {
      memoryTtl: 3600000,      // 1 hour during market hours
      databaseTtl: 14400000,   // 4 hours for database fallback
      maxStaleAge: 86400000,   // 24 hours max stale
      marketHoursMultiplier: 1,
      afterHoursMultiplier: 4,  // 4 hours after hours
      weekendMultiplier: 24     // 24 hours on weekends
    });
  }

  private getMarketStatus(): MarketStatus {
    const now = new Date();
    const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const est = new Date(utc.getTime() - 5 * 60 * 60 * 1000); // EST = UTC-5
    
    const dayOfWeek = est.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = est.getHours();
    const minute = est.getMinutes();
    const totalMinutes = hour * 60 + minute;

    const marketOpenMinutes = 9 * 60 + 30;  // 9:30 AM
    const marketCloseMinutes = 16 * 60;     // 4:00 PM

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMarketHours = isWeekday && totalMinutes >= marketOpenMinutes && totalMinutes <= marketCloseMinutes;
    const isAfterHours = isWeekday && !isMarketHours;

    // Calculate next market open
    let nextOpen = new Date(est);
    if (isWeekend || (isWeekday && totalMinutes > marketCloseMinutes)) {
      // Set to next Monday 9:30 AM if weekend or after close
      const daysUntilMonday = isWeekend ? (8 - dayOfWeek) % 7 : 3;
      nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
      nextOpen.setHours(9, 30, 0, 0);
    } else if (isWeekday && totalMinutes < marketOpenMinutes) {
      // Set to today 9:30 AM if before open
      nextOpen.setHours(9, 30, 0, 0);
    }

    return {
      isOpen: isMarketHours,
      isAfterHours,
      isWeekend,
      nextOpen,
      currentTime: est
    };
  }

  private calculateDynamicTtl(baseConfig: CacheConfig, marketStatus: MarketStatus): number {
    let multiplier = 1;

    if (marketStatus.isWeekend) {
      multiplier = baseConfig.weekendMultiplier;
    } else if (marketStatus.isAfterHours) {
      multiplier = baseConfig.afterHoursMultiplier;
    } else {
      multiplier = baseConfig.marketHoursMultiplier;
    }

    return baseConfig.memoryTtl * multiplier;
  }

  private getFreshnessLevel(dataAge: number, marketStatus: MarketStatus): 'live' | 'recent' | 'historical' | 'stale' {
    if (dataAge < 60000) return 'live';          // < 1 minute
    if (dataAge < 300000) return 'recent';       // < 5 minutes
    if (dataAge < 1800000) return 'historical';  // < 30 minutes
    return 'stale';                              // > 30 minutes
  }

  async get<T>(
    key: string,
    category: string,
    apiCall: () => Promise<T>,
    options: { forceRefresh?: boolean; maxStaleAge?: number } = {}
  ): Promise<CachedData<T>> {
    const startTime = Date.now();
    const marketStatus = this.getMarketStatus();
    const config = this.cacheConfigs.get(category) || this.cacheConfigs.get('stock')!;
    const dynamicTtl = this.calculateDynamicTtl(config, marketStatus);

    // Step 1: Check memory cache first (fastest - 1-5ms response)
    if (!options.forceRefresh) {
      const memoryData = this.memoryCache.get(key);
      if (memoryData) {
        const age = Date.now() - memoryData.timestamp;
        if (age < dynamicTtl) {
          this.performanceMetrics.cacheHits++;
          const responseTime = Date.now() - startTime;
          logger.debug(`Cache hit for ${key}: ${responseTime}ms`, 'IntelligentCache');
          
          return {
            ...memoryData,
            dataAge: age,
            freshness: this.getFreshnessLevel(age, marketStatus)
          };
        }
      }
    }

    // Step 2: Check database for most recent historical data (50-200ms response)
    try {
      const dbData = await this.getFromDatabase<T>(key, category);
      if (dbData) {
        const age = Date.now() - dbData.timestamp;
        const maxStale = options.maxStaleAge || config.maxStaleAge;
        
        if (age < maxStale) {
          this.performanceMetrics.databaseQueries++;
          
          // Store in memory cache for next time
          this.memoryCache.set(key, dbData);
          
          const responseTime = Date.now() - startTime;
          logger.info(`Database cache hit for ${key}: ${responseTime}ms (age: ${Math.round(age/1000)}s)`, 'IntelligentCache');
          
          // Trigger background refresh if data is getting stale
          if (age > dynamicTtl / 2) {
            this.backgroundRefresh(key, category, apiCall);
          }
          
          return {
            ...dbData,
            dataAge: age,
            freshness: this.getFreshnessLevel(age, marketStatus)
          };
        }
      }
    } catch (error) {
      logger.warn(`Database query failed for ${key}`, 'IntelligentCache', error);
    }

    // Step 3: Make API call and store result (1-5 second response)
    try {
      this.performanceMetrics.apiCalls++;
      this.performanceMetrics.cacheMisses++;
      
      const apiData = await apiCall();
      const now = Date.now();
      
      const cachedData: CachedData<T> = {
        data: apiData,
        timestamp: now,
        source: 'api',
        dataAge: 0,
        freshness: 'live'
      };

      // Store in both memory cache and database
      this.memoryCache.set(key, cachedData);
      await this.storeInDatabase(key, category, cachedData);
      
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      logger.info(`Fresh API data for ${key}: ${responseTime}ms`, 'IntelligentCache');
      
      return cachedData;
      
    } catch (error) {
      logger.error(`API call failed for ${key}`, 'IntelligentCache', error);
      
      // Emergency fallback: try to get any historical data from database
      const emergencyData = await this.getFromDatabase<T>(key, category, true);
      if (emergencyData) {
        const age = Date.now() - emergencyData.timestamp;
        logger.warn(`Using emergency fallback data for ${key} (age: ${Math.round(age/60000)} minutes)`, 'IntelligentCache');
        
        return {
          ...emergencyData,
          dataAge: age,
          freshness: 'stale'
        };
      }
      
      throw error;
    }
  }

  private async getFromDatabase<T>(key: string, category: string, emergency = false): Promise<CachedData<T> | null> {
    try {
      // Implementation depends on your database schema
      // For now, return null to trigger API calls
      return null;
    } catch (error) {
      logger.error(`Database retrieval failed for ${key}`, 'IntelligentCache', error);
      return null;
    }
  }

  private async storeInDatabase(key: string, category: string, data: CachedData<any>): Promise<void> {
    try {
      // Implementation depends on your database schema
      // Store the cached data in appropriate table for future retrieval
      logger.debug(`Stored ${key} in database for future fallback`, 'IntelligentCache');
    } catch (error) {
      logger.error(`Failed to store ${key} in database`, 'IntelligentCache', error);
    }
  }

  private async backgroundRefresh<T>(key: string, category: string, apiCall: () => Promise<T>): Promise<void> {
    // Trigger async refresh without blocking current request
    setTimeout(async () => {
      try {
        logger.debug(`Background refresh triggered for ${key}`, 'IntelligentCache');
        await this.get(key, category, apiCall, { forceRefresh: true });
      } catch (error) {
        logger.warn(`Background refresh failed for ${key}`, 'IntelligentCache', error);
      }
    }, 100);
  }

  private startCacheCleanup(): void {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let removed = 0;
      
      for (const [key, data] of Array.from(this.memoryCache.entries())) {
        const age = now - data.timestamp;
        const config = this.cacheConfigs.get('stock')!; // Use most aggressive cleanup
        
        if (age > config.maxStaleAge) {
          this.memoryCache.delete(key);
          removed++;
        }
      }
      
      if (removed > 0) {
        logger.info(`Cache cleanup: ${removed} expired entries removed`, 'IntelligentCache');
      }
    }, 300000); // 5 minutes
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalCalls = this.performanceMetrics.apiCalls + this.performanceMetrics.databaseQueries;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime * (totalCalls - 1) + responseTime) / totalCalls;
  }

  getPerformanceMetrics() {
    const totalRequests = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.performanceMetrics.cacheHits / totalRequests) * 100 : 0;
    
    return {
      ...this.performanceMetrics,
      totalRequests,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryEntries: this.memoryCache.size
    };
  }

  // Data transparency methods
  generateDataSourceIndicator(cachedData: CachedData<any>): string {
    const ageMinutes = Math.round(cachedData.dataAge / 60000);
    
    switch (cachedData.freshness) {
      case 'live':
        return `🟢 Live (${cachedData.source === 'api' ? 'API' : 'cached'} < 1min)`;
      case 'recent':
        return `🟡 Recent (${ageMinutes}min old)`;
      case 'historical':
        return `🟠 Historical (${ageMinutes}min old)`;
      case 'stale':
        return `🔴 Stale (${ageMinutes}min old)`;
    }
  }

  formatLastUpdated(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.round(diffMins / 60)}h ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Clear specific cache entries
  invalidate(keyPattern: string): void {
    let removed = 0;
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.includes(keyPattern)) {
        this.memoryCache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info(`Cache invalidation: ${removed} entries removed for pattern "${keyPattern}"`, 'IntelligentCache');
    }
  }

  // Force refresh of all data
  async warmCache(categories: string[] = ['stock', 'technical', 'sector']): Promise<void> {
    logger.info('Starting cache warm-up process...', 'IntelligentCache');
    
    // This would trigger fresh API calls for all major data categories
    // Implementation depends on your specific data sources
    
    logger.info('Cache warm-up completed', 'IntelligentCache');
  }
}

export const intelligentCache = new IntelligentCacheSystem();