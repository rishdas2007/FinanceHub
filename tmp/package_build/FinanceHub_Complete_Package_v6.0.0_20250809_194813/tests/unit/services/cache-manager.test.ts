import { describe, it, expect, beforeEach, vi } from 'vitest';
// Mock CacheManager for testing
class CacheManager {
  private cache = new Map<string, { data: any; expiry: number }>();

  set(key: string, data: any, ttlSeconds: number) {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expiry });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  it('should store and retrieve data correctly', () => {
    const testData = { price: 100, symbol: 'SPY' };
    cacheManager.set('test-key', testData, 60);
    
    const retrieved = cacheManager.get('test-key');
    expect(retrieved).toEqual(testData);
  });

  it('should return undefined for expired data', () => {
    const testData = { price: 100 };
    cacheManager.set('test-key', testData, -1); // Already expired
    
    const retrieved = cacheManager.get('test-key');
    expect(retrieved).toBeUndefined();
  });

  it('should return undefined for non-existent keys', () => {
    const retrieved = cacheManager.get('non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('should clear all cache data', () => {
    cacheManager.set('key1', 'data1', 60);
    cacheManager.set('key2', 'data2', 60);
    
    cacheManager.clear();
    
    expect(cacheManager.get('key1')).toBeUndefined();
    expect(cacheManager.get('key2')).toBeUndefined();
  });

  it('should clear expired items automatically', () => {
    // Set items with different expiry times
    cacheManager.set('key1', 'data1', -1); // Already expired
    cacheManager.set('key2', 'data2', 60);  // Valid
    
    cacheManager.clearExpired();
    
    expect(cacheManager.get('key1')).toBeUndefined();
    expect(cacheManager.get('key2')).toBe('data2');
  });
});