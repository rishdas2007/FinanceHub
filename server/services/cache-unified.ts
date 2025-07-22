/**
 * Unified Cache Service
 * Consolidates: cache-manager.ts, smart-cache-service.ts
 */

import { logger } from '../../shared/utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

export class CacheService {
  private static instance: CacheService;
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  private constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

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

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      logger.debug(`Cache delete: ${key}`, 'Cache');
    }
    return deleted;
  }

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

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared: ${size} entries removed`, 'Cache');
  }

  cleanup(): void {
    const now = Date.now();
    let expired = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expired++;
      }
    }
    
    if (expired > 0) {
      logger.info(`Cache cleanup: ${expired} expired entries removed`, 'Cache');
    }
  }

  getStats(): CacheStats {
    const now = Date.now();
    let memoryUsage = 0;
    let oldest = now;
    let newest = 0;

    for (const [key, entry] of this.cache.entries()) {
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

  // Specialized cache methods for common patterns
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