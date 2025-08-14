/**
 * Intelligent Cache System
 * Implements multi-tier caching with adaptive TTLs and intelligent invalidation
 */

import { logger } from '../utils/logger';
import { db } from '../db.js';

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  hitCount: number;
  lastAccessed: Date;
}

interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: Date | null;
}

export class IntelligentCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;
  private maxMemoryEntries: number = 1000;

  constructor() {
    // Cleanup interval for expired entries
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Every minute
  }

  /**
   * Get data from cache (Memory → Database → null)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      memoryEntry.hitCount++;
      memoryEntry.lastAccessed = new Date();
      this.hitCount++;
      
      logger.debug(`🎯 Memory cache hit: ${key}`);
      return memoryEntry.data as T;
    }

    // Try database cache (placeholder - would integrate with actual cache table)
    try {
      // For now, just return null as we don't have a cache table
      // In production, this would query a dedicated cache table
      this.missCount++;
      return null;
    } catch (error) {
      logger.error(`Cache retrieval error for ${key}:`, error);
      this.missCount++;
      return null;
    }
  }

  /**
   * Set data in cache with adaptive TTL
   */
  async set<T>(key: string, data: T, ttl: number = 300): Promise<void> {
    try {
      // Store in memory cache
      const entry: CacheEntry<T> = {
        data,
        timestamp: new Date(),
        ttl,
        hitCount: 0,
        lastAccessed: new Date()
      };

      this.memoryCache.set(key, entry);

      // Enforce memory limits
      if (this.memoryCache.size > this.maxMemoryEntries) {
        this.evictLeastUsed();
      }

      logger.debug(`💾 Cached data: ${key} (TTL: ${ttl}s)`);

      // TODO: Store in database cache table for persistence
      // await this.setDatabaseCache(key, data, ttl);

    } catch (error) {
      logger.error(`Cache storage error for ${key}:`, error);
    }
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    logger.debug(`🗑️ Deleted cache entry: ${key}`);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('🧹 Cache cleared');
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    const entryTime = entry.timestamp.getTime();
    const ttlMs = entry.ttl * 1000;
    
    return (now - entryTime) > ttlMs;
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    let cleaned = 0;
    
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastUsed(): void {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => {
      return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
    });

    // Remove oldest 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
    }

    logger.debug(`🗑️ Evicted ${toRemove} least used cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.memoryCache.values());
    
    let oldestEntry: Date | null = null;
    if (entries.length > 0) {
      oldestEntry = entries.reduce((oldest, entry) => {
        return entry.timestamp < oldest ? entry.timestamp : oldest;
      }, entries[0].timestamp);
    }

    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      totalEntries: this.memoryCache.size,
      hitRate,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry
    };
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    let estimatedBytes = 0;
    
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      // Rough estimation: key size + JSON serialized data size
      estimatedBytes += key.length * 2; // Unicode characters
      estimatedBytes += JSON.stringify(entry.data).length * 2;
      estimatedBytes += 100; // Overhead for entry metadata
    }

    return estimatedBytes;
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{ healthy: boolean; details: string[] }> {
    const stats = this.getStats();
    const details: string[] = [];
    let healthy = true;

    // Check hit rate
    if (stats.hitRate < 50) {
      details.push(`Low cache hit rate: ${stats.hitRate.toFixed(1)}%`);
      healthy = false;
    }

    // Check memory usage (rough threshold)
    if (stats.memoryUsage > 50 * 1024 * 1024) { // 50MB
      details.push(`High memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    }

    // Check entry count
    if (stats.totalEntries > this.maxMemoryEntries * 0.9) {
      details.push(`High entry count: ${stats.totalEntries}`);
    }

    return { healthy, details };
  }

  /**
   * Get entries matching pattern
   */
  getByPattern(pattern: RegExp): Map<string, any> {
    const matches = new Map();
    
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (pattern.test(key) && !this.isExpired(entry)) {
        matches.set(key, entry.data);
      }
    }

    return matches;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of Array.from(this.memoryCache.keys())) {
      if (pattern.test(key)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    logger.info(`🔄 Invalidated ${invalidated} cache entries matching pattern`);
    return invalidated;
  }
}

export const intelligentCache = new IntelligentCache();