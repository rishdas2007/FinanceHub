/**
 * Intelligent Cache Manager
 * Preserves real market data while providing fast access through smart caching
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface CacheConfig {
  key: string;
  ttl: number; // Time to live in seconds
  refreshThreshold: number; // Refresh when this much TTL remains
  source: 'database' | 'api' | 'calculation';
  priority: 'high' | 'medium' | 'low';
}

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  source: string;
  hits: number;
  last_accessed: number;
}

export class IntelligentCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private configs: Map<string, CacheConfig> = new Map();
  private refreshQueue: Set<string> = new Set();
  private isRefreshing: Set<string> = new Set();

  constructor() {
    this.initializeCacheConfigs();
    this.startBackgroundRefresh();
  }

  /**
   * Initialize cache configurations for different data types
   */
  private initializeCacheConfigs() {
    // ETF real-time data - cache for 30 seconds, refresh at 25 seconds
    this.configs.set('etf-metrics', {
      key: 'etf-metrics',
      ttl: 30,
      refreshThreshold: 25,
      source: 'database',
      priority: 'high'
    });

    // ETF technical indicators - cache for 5 minutes, refresh at 4 minutes  
    // TEMPORARY: Disable etf-technical cache to fix cache poisoning
    // this.configs.set('etf-technical', {
    //   key: 'etf-technical',
    //   ttl: 300,
    //   refreshThreshold: 240,
    //   source: 'calculation',
    //   priority: 'high'
    // });

    // Economic indicators - cache for 1 hour, refresh at 50 minutes
    this.configs.set('economic-indicators', {
      key: 'economic-indicators', 
      ttl: 3600,
      refreshThreshold: 3000,
      source: 'api',
      priority: 'medium'
    });

    // Market sentiment - cache for 10 minutes, refresh at 8 minutes
    this.configs.set('market-sentiment', {
      key: 'market-sentiment',
      ttl: 600,
      refreshThreshold: 480,
      source: 'calculation',
      priority: 'medium'
    });

    // Historical data - cache for 24 hours, refresh at 23 hours
    this.configs.set('historical-data', {
      key: 'historical-data',
      ttl: 86400,
      refreshThreshold: 82800,
      source: 'database',
      priority: 'low'
    });

    logger.info(`🚀 Initialized ${this.configs.size} cache configurations`);
  }

  /**
   * Get data from cache or source with intelligent refresh
   */
  async get<T>(key: string, sourceFunction: () => Promise<T>): Promise<T> {
    const config = this.configs.get(key);
    if (!config) {
      logger.warn(`⚠️ No cache config for key: ${key}, executing directly`);
      return await sourceFunction();
    }

    const cached = this.cache.get(key);
    const now = Date.now();

    // Check if cache is valid
    if (cached && (now - cached.timestamp) < (cached.ttl * 1000)) {
      // Update access stats
      cached.hits++;
      cached.last_accessed = now;
      
      // Check if we need background refresh
      const age = (now - cached.timestamp) / 1000;
      if (age > config.refreshThreshold && !this.isRefreshing.has(key)) {
        this.scheduleBackgroundRefresh(key, sourceFunction);
      }

      logger.info(`⚡ Cache hit for ${key} (age: ${Math.round(age)}s, hits: ${cached.hits})`);
      return cached.data;
    }

    // Cache miss or expired - fetch fresh data
    logger.info(`🔄 Cache miss for ${key}, fetching fresh data...`);
    const startTime = Date.now();
    
    try {
      const freshData = await sourceFunction();
      const fetchTime = Date.now() - startTime;
      
      // Store in cache
      this.cache.set(key, {
        key,
        data: freshData,
        timestamp: now,
        ttl: config.ttl,
        source: config.source,
        hits: 1,
        last_accessed: now
      });

      logger.info(`✅ Cached fresh data for ${key} (fetch: ${fetchTime}ms, TTL: ${config.ttl}s)`);
      return freshData;
      
    } catch (error) {
      logger.error(`❌ Failed to fetch data for ${key}:`, error);
      
      // Return stale cache if available as fallback
      if (cached) {
        logger.warn(`🔄 Returning stale cache for ${key} due to fetch error`);
        cached.hits++;
        cached.last_accessed = now;
        return cached.data;
      }
      
      throw error;
    }
  }

  /**
   * Schedule background refresh for a cache entry
   */
  private scheduleBackgroundRefresh<T>(key: string, sourceFunction: () => Promise<T>) {
    if (this.isRefreshing.has(key)) {
      return; // Already refreshing
    }

    this.isRefreshing.add(key);
    
    // Use setTimeout for non-blocking background refresh
    setTimeout(async () => {
      try {
        logger.info(`🔄 Background refresh starting for ${key}...`);
        const startTime = Date.now();
        
        const freshData = await sourceFunction();
        const fetchTime = Date.now() - startTime;
        
        const config = this.configs.get(key);
        const now = Date.now();
        
        // Update cache with fresh data
        const existing = this.cache.get(key);
        this.cache.set(key, {
          key,
          data: freshData,
          timestamp: now,
          ttl: config.ttl,
          source: config.source,
          hits: existing?.hits || 0,
          last_accessed: existing?.last_accessed || now
        });

        logger.info(`✅ Background refresh completed for ${key} (${fetchTime}ms)`);
        
      } catch (error) {
        logger.error(`❌ Background refresh failed for ${key}:`, error);
      } finally {
        this.isRefreshing.delete(key);
      }
    }, 100); // Small delay to avoid blocking current request
  }

  /**
   * Start background maintenance processes
   */
  private startBackgroundRefresh() {
    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);

    // Cache performance monitoring every 30 seconds
    setInterval(() => {
      this.logCachePerformance();
    }, 30 * 1000);

    logger.info('🔧 Background cache maintenance started');
  }

  /**
   * Remove expired cache entries
   */
  private cleanupExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = (now - entry.timestamp) / 1000;
      if (age > entry.ttl * 2) { // Keep entries for 2x TTL before cleanup
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Log cache performance metrics
   */
  private logCachePerformance() {
    const totalEntries = this.cache.size;
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hits, 0);
    const avgHits = totalEntries > 0 ? totalHits / totalEntries : 0;

    // Find most/least used entries
    const entries = Array.from(this.cache.values());
    const mostUsed = entries.reduce((max, entry) => entry.hits > max.hits ? entry : max, entries[0]);
    const leastUsed = entries.reduce((min, entry) => entry.hits < min.hits ? entry : min, entries[0]);

    logger.info(`📊 Cache Stats: ${totalEntries} entries, ${totalHits} total hits, ${avgHits.toFixed(1)} avg hits`);
    
    if (mostUsed && leastUsed) {
      logger.info(`📈 Most used: ${mostUsed.key} (${mostUsed.hits} hits), Least used: ${leastUsed.key} (${leastUsed.hits} hits)`);
    }
  }

  /**
   * Force refresh a specific cache entry
   */
  async forceRefresh<T>(key: string, sourceFunction: () => Promise<T>): Promise<T> {
    logger.info(`🔄 Force refreshing cache for ${key}`);
    this.cache.delete(key); // Remove from cache
    return await this.get(key, sourceFunction);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      total_entries: entries.length,
      total_hits: entries.reduce((sum, e) => sum + e.hits, 0),
      avg_age_seconds: entries.length > 0 ? 
        entries.reduce((sum, e) => sum + (now - e.timestamp), 0) / entries.length / 1000 : 0,
      hit_rate_by_key: Object.fromEntries(
        entries.map(e => [e.key, { hits: e.hits, age_seconds: (now - e.timestamp) / 1000 }])
      ),
      refreshing_keys: Array.from(this.isRefreshing),
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Clear all cache entries (for testing/debugging)
   */
  clearCache() {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.isRefreshing.clear();
    logger.warn(`🧹 Cleared all ${entriesCleared} cache entries`);
  }
}

// Export singleton instance
export const cacheManager = new IntelligentCacheManager();