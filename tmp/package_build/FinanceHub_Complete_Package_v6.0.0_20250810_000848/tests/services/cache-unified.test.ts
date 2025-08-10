/**
 * Cache Unified Service Test Suite
 * Comprehensive tests for caching functionality, TTL management, and statistics
 * 
 * @author AI Agent Test Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService } from '../../server/services/cache-unified';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    // Reset singleton instance for clean testing
    (CacheService as any).instance = undefined;
    cache = CacheService.getInstance();
    
    // Mock timers for TTL testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Singleton Implementation', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = CacheService.getInstance();
      instance1.set('test-key', 'test-value', 60000);
      
      const instance2 = CacheService.getInstance();
      const value = instance2.get('test-key');
      
      expect(value).toBe('test-value');
    });
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve values correctly', () => {
      cache.set('user:123', { id: 123, name: 'John Doe' }, 60000);
      
      const user = cache.get('user:123');
      
      expect(user).toEqual({ id: 123, name: 'John Doe' });
    });

    it('should return null for non-existent keys', () => {
      const value = cache.get('non-existent-key');
      
      expect(value).toBeNull();
    });

    it('should handle different data types', () => {
      const testCases = [
        { key: 'string', value: 'test string', ttl: 60000 },
        { key: 'number', value: 42, ttl: 60000 },
        { key: 'boolean', value: true, ttl: 60000 },
        { key: 'array', value: [1, 2, 3], ttl: 60000 },
        { key: 'object', value: { nested: { prop: 'value' } }, ttl: 60000 },
        { key: 'null', value: null, ttl: 60000 }
      ];

      testCases.forEach(({ key, value, ttl }) => {
        cache.set(key, value, ttl);
        expect(cache.get(key)).toEqual(value);
      });
    });

    it('should delete entries correctly', () => {
      cache.set('to-delete', 'value', 60000);
      expect(cache.get('to-delete')).toBe('value');
      
      const deleted = cache.delete('to-delete');
      
      expect(deleted).toBe(true);
      expect(cache.get('to-delete')).toBeNull();
    });

    it('should return false when deleting non-existent keys', () => {
      const deleted = cache.delete('non-existent');
      
      expect(deleted).toBe(false);
    });
  });

  describe('TTL (Time-To-Live) Management', () => {
    it('should expire entries after TTL', () => {
      cache.set('expiring-key', 'will expire', 1000); // 1 second TTL
      
      expect(cache.get('expiring-key')).toBe('will expire');
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(1500);
      
      expect(cache.get('expiring-key')).toBeNull();
    });

    it('should not expire entries before TTL', () => {
      cache.set('not-expiring', 'still valid', 5000); // 5 second TTL
      
      // Advance time but not beyond TTL
      vi.advanceTimersByTime(3000);
      
      expect(cache.get('not-expiring')).toBe('still valid');
    });

    it('should handle different TTL values correctly', () => {
      cache.set('short-ttl', 'expires soon', 500);
      cache.set('long-ttl', 'expires later', 2000);
      
      // Advance time to expire short TTL but not long TTL
      vi.advanceTimersByTime(1000);
      
      expect(cache.get('short-ttl')).toBeNull();
      expect(cache.get('long-ttl')).toBe('expires later');
    });

    it('should update TTL on set operations', () => {
      cache.set('renewable', 'original', 1000);
      
      // Advance time close to expiration
      vi.advanceTimersByTime(800);
      
      // Renew with new TTL
      cache.set('renewable', 'updated', 2000);
      
      // Advance past original TTL
      vi.advanceTimersByTime(500);
      
      expect(cache.get('renewable')).toBe('updated');
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses correctly', () => {
      cache.set('stat-test', 'value', 60000);
      
      // Generate some hits
      cache.get('stat-test');
      cache.get('stat-test');
      cache.get('stat-test');
      
      // Generate some misses
      cache.get('non-existent-1');
      cache.get('non-existent-2');
      
      const stats = cache.getStats();
      
      expect(stats.totalHits).toBe(3);
      expect(stats.totalMisses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3 hits out of 5 total
    });

    it('should calculate hit rate correctly with no requests', () => {
      const stats = cache.getStats();
      
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should track total entries', () => {
      cache.set('entry1', 'value1', 60000);
      cache.set('entry2', 'value2', 60000);
      cache.set('entry3', 'value3', 60000);
      
      const stats = cache.getStats();
      
      expect(stats.totalEntries).toBe(3);
    });

    it('should estimate memory usage', () => {
      cache.set('memory-test', { large: 'object'.repeat(100) }, 60000);
      
      const stats = cache.getStats();
      
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track oldest and newest entries', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      
      cache.set('oldest', 'value', 60000);
      
      vi.advanceTimersByTime(5000);
      
      cache.set('newest', 'value', 60000);
      
      const stats = cache.getStats();
      
      expect(stats.oldestEntry).toBe(5000);
      expect(stats.newestEntry).toBe(0);
    });
  });

  describe('Advanced Features', () => {
    it('should check if key exists without affecting stats', () => {
      cache.set('exists-test', 'value', 60000);
      
      const existsBefore = cache.has('exists-test');
      const statsBefore = cache.getStats();
      
      const existsAfter = cache.has('exists-test');
      const statsAfter = cache.getStats();
      
      expect(existsBefore).toBe(true);
      expect(existsAfter).toBe(true);
      expect(statsAfter.totalHits).toBe(statsBefore.totalHits); // No hit recorded
    });

    it('should return false for expired keys in has() method', () => {
      cache.set('expiring-has', 'value', 1000);
      
      expect(cache.has('expiring-has')).toBe(true);
      
      vi.advanceTimersByTime(1500);
      
      expect(cache.has('expiring-has')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1', 60000);
      cache.set('key2', 'value2', 60000);
      cache.set('key3', 'value3', 60000);
      
      expect(cache.getStats().totalEntries).toBe(3);
      
      cache.clear();
      
      expect(cache.getStats().totalEntries).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });
  });

  describe('getOrSet Method', () => {
    it('should return cached value if available', async () => {
      const factory = vi.fn().mockResolvedValue('computed value');
      
      cache.set('cached-key', 'existing value', 60000);
      
      const result = await cache.getOrSet('cached-key', factory, 60000);
      
      expect(result).toBe('existing value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should compute and cache value if not available', async () => {
      const factory = vi.fn().mockResolvedValue('computed value');
      
      const result = await cache.getOrSet('new-key', factory, 60000);
      
      expect(result).toBe('computed value');
      expect(factory).toHaveBeenCalledOnce();
      expect(cache.get('new-key')).toBe('computed value');
    });

    it('should handle factory function errors', async () => {
      const factory = vi.fn().mockRejectedValue(new Error('Factory failed'));
      
      await expect(
        cache.getOrSet('error-key', factory, 60000)
      ).rejects.toThrow('Factory failed');
      
      expect(factory).toHaveBeenCalledOnce();
      expect(cache.get('error-key')).toBeNull();
    });

    it('should use TTL correctly for computed values', async () => {
      const factory = vi.fn().mockResolvedValue('computed');
      
      await cache.getOrSet('ttl-test', factory, 1000);
      
      expect(cache.get('ttl-test')).toBe('computed');
      
      vi.advanceTimersByTime(1500);
      
      expect(cache.get('ttl-test')).toBeNull();
    });
  });

  describe('Memory Management', () => {
    it('should handle automatic cleanup', () => {
      // Add entries with different TTLs
      cache.set('expires-soon', 'value1', 500);
      cache.set('expires-later', 'value2', 2000);
      cache.set('expires-much-later', 'value3', 5000);
      
      expect(cache.getStats().totalEntries).toBe(3);
      
      // Advance time to trigger cleanup
      vi.advanceTimersByTime(1000);
      
      // Manually trigger cleanup (normally done by setInterval)
      (cache as any).cleanup();
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2); // One entry should be cleaned up
    });

    it('should not affect valid entries during cleanup', () => {
      cache.set('valid-entry', 'should remain', 5000);
      cache.set('expired-entry', 'should be removed', 500);
      
      vi.advanceTimersByTime(1000);
      (cache as any).cleanup();
      
      expect(cache.get('valid-entry')).toBe('should remain');
      expect(cache.get('expired-entry')).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero TTL', () => {
      cache.set('zero-ttl', 'value', 0);
      
      expect(cache.get('zero-ttl')).toBeNull();
    });

    it('should handle negative TTL', () => {
      cache.set('negative-ttl', 'value', -1000);
      
      expect(cache.get('negative-ttl')).toBeNull();
    });

    it('should handle very large TTL values', () => {
      const largeTTL = Number.MAX_SAFE_INTEGER;
      
      cache.set('large-ttl', 'value', largeTTL);
      
      expect(cache.get('large-ttl')).toBe('value');
    });

    it('should handle special characters in keys', () => {
      const specialKeys = [
        'key with spaces',
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
        'key/with/slashes',
        'key:with:colons'
      ];

      specialKeys.forEach(key => {
        cache.set(key, `value for ${key}`, 60000);
        expect(cache.get(key)).toBe(`value for ${key}`);
      });
    });

    it('should handle concurrent operations gracefully', async () => {
      const promises: Promise<string>[] = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          cache.getOrSet(`concurrent-${i}`, 
            () => Promise.resolve(`value-${i}`), 
            60000
          )
        );
      }
      
      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result).toBe(`value-${index}`);
      });
      
      expect(cache.getStats().totalEntries).toBe(100);
    });
  });
});