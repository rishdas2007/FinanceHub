/**
 * Unified Cache Service - High-Performance In-Memory Caching
 * 
 * @class CacheService
 * @description Provides intelligent caching with TTL support, access tracking, and automatic cleanup.
 * Consolidates functionality from cache-manager.ts and smart-cache-service.ts into a single,
 * optimized service for market data, API responses, and computed results.
 * 
 * @features
 * - TTL-based expiration with automatic cleanup
 * - Access pattern tracking and statistics
 * - Memory usage monitoring
 * - Hit/miss ratio analytics
 * - Singleton pattern for global cache consistency
 * 
 * @author AI Agent Documentation Enhancement
 * @version 2.0.0
 * @since 2025-07-25
 */

import { logger } from '../../shared/utils/logger';

/**
 * Cache entry structure with metadata
 * @interface CacheEntry
 * @template T - Type of cached data
 * @property {T} data - The cached data payload
 * @property {number} timestamp - Unix timestamp when entry was created
 * @property {number} ttl - Time-to-live in milliseconds
 * @property {number} hits - Number of times this entry has been accessed
 * @property {number} lastAccessed - Unix timestamp of last access
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

/**
 * Cache performance and usage statistics
 * @interface CacheStats
 * @property {number} totalEntries - Current number of cached entries
 * @property {number} totalHits - Total cache hits since startup
 * @property {number} totalMisses - Total cache misses since startup
 * @property {number} hitRate - Hit rate percentage (0-100)
 * @property {number} memoryUsage - Estimated memory usage in bytes
 * @property {number} oldestEntry - Timestamp of oldest cache entry
 * @property {number} newestEntry - Timestamp of newest cache entry
 */
interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * High-performance unified cache service with intelligent features
 * @class CacheService
 * @implements Singleton pattern for global consistency
 */
export class CacheService {
  private static instance: CacheService;
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };
  
  // EMERGENCY: Extended TTL configurations to reduce API calls (281/144 rate limit exceeded)
  private readonly ECONOMIC_CONFIG = {
    memoryTtl: 172800000, // 48 hours (increased from 24h)
    databaseTtl: 1209600000, // 14 days (increased from 7 days)
    maxStaleAge: 5184000000, // 60 days max stale (increased from 30 days)
    afterHoursMultiplier: 2, // Increased cache during off hours
    weekendMultiplier: 3 // Aggressive caching on weekends
  };

  private constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get singleton instance of cache service
   * @static
   * @returns {CacheService} Singleton cache service instance
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Retrieve cached data by key
   * @async
   * @method get
   * @template T - Type of cached data
   * @param {string} key - Cache key identifier
   * @returns {T | null} Cached data or null if not found/expired
   * @example
   * const marketData = cache.get<MarketData>('SPY-quote');
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      logger.debug(`Cache miss: ${key}`, 'Cache');
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      logger.debug(`Cache expired: ${key}`, 'Cache');
      return null;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = now;
    this.stats.hits++;
    
    logger.debug(`Cache hit: ${key} (${entry.hits} total hits)`, 'Cache');
    return entry.data as T;
  }

  /**
   * Store data in cache with TTL
   * @method set
   * @template T - Type of data being cached
   * @param {string} key - Cache key identifier
   * @param {T} data - Data to cache
   * @param {number} ttlMs - Time-to-live in milliseconds
   * @example
   * cache.set('market-data', stockData, 5 * 60 * 1000); // Cache for 5 minutes
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: ttlMs,
      hits: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.stats.sets++;
    
    logger.debug(`Cache set: ${key} (TTL: ${ttlMs}ms)`, 'Cache');
  }

  /**
   * Remove entry from cache
   * @method delete
   * @param {string} key - Cache key to remove
   * @returns {boolean} True if entry was deleted, false if not found
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      logger.debug(`Cache delete: ${key}`, 'Cache');
    }
    return deleted;
  }

  /**
   * Check if key exists in cache and is not expired
   * @method has
   * @param {string} key - Cache key to check
   * @returns {boolean} True if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cached entries
   * @method clear
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared: ${size} entries removed`, 'Cache');
  }

  /**
   * Remove expired entries from cache (called automatically)
   * @method cleanup
   * @private
   */
  cleanup(): void {
    const now = Date.now();
    let expired = 0;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expired++;
      }
    }
    
    if (expired > 0) {
      logger.info(`Cache cleanup: ${expired} expired entries removed`, 'Cache');
    }
  }

  /**
   * Get comprehensive cache statistics
   * @method getStats
   * @returns {CacheStats} Current cache performance metrics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let memoryUsage = 0;
    let oldest = now;
    let newest = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      // Rough memory calculation
      memoryUsage += JSON.stringify(entry.data).length + key.length;
      
      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    }

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      memoryUsage,
      oldestEntry: oldest === now ? 0 : now - oldest,
      newestEntry: newest === 0 ? 0 : now - newest
    };
  }

  /**
   * Get cached value or compute and cache it if not found
   * @method getOrSet
   * @template T - Type of cached data
   * @param {string} key - Cache key identifier
   * @param {() => Promise<T>} factory - Function to compute value if not cached
   * @param {number} ttlMs - Time-to-live for new entries
   * @returns {Promise<T>} Cached or computed value
   * @example
   * const data = await cache.getOrSet('expensive-calculation', 
   *   () => computeExpensiveResult(), 
   *   10 * 60 * 1000
   * );
   */
  getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttlMs: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return factory().then(data => {
      this.set(key, data, ttlMs);
      return data;
    });
  }

  // Smart cache with adaptive TTL based on access patterns
  smartSet<T>(key: string, data: T, baseTtlMs: number): void {
    const existing = this.cache.get(key);
    let adjustedTtl = baseTtlMs;

    if (existing && existing.hits > 10) {
      // Popular items get longer TTL
      adjustedTtl = baseTtlMs * 2;
    } else if (existing && existing.hits < 2) {
      // Unpopular items get shorter TTL
      adjustedTtl = baseTtlMs / 2;
    }

    this.set(key, data, adjustedTtl);
  }

  // Get multiple keys at once
  getMultiple<T>(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  // Set multiple keys at once
  setMultiple<T>(entries: Array<{ key: string; data: T; ttl: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.data, entry.ttl);
    }
  }

  // Get keys matching a pattern
  getKeysByPattern(pattern: RegExp): string[] {
    return Array.from(this.cache.keys()).filter(key => pattern.test(key));
  }

  // Delete keys matching a pattern
  deleteByPattern(pattern: RegExp): number {
    const keys = this.getKeysByPattern(pattern);
    let deleted = 0;
    
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }
    
    return deleted;
  }
}

export const cacheService = CacheService.getInstance();

// Legacy exports for backward compatibility
export const getCached = <T>(key: string): T | null => cacheService.get<T>(key);
export const setCached = <T>(key: string, data: T, ttlMs: number): void => cacheService.set(key, data, ttlMs);
export const clearCache = (): void => cacheService.clear();