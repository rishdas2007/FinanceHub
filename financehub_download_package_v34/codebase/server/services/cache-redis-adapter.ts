import Redis from 'ioredis';
import { logger } from '../middleware/logging';

export interface CacheAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  flush(): Promise<void>;
  getStats(): Promise<any>;
}

export class RedisCacheAdapter implements CacheAdapter {
  private redis: Redis;
  private connected: boolean = false;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });

      this.redis.on('connect', () => {
        this.connected = true;
        logger.info('✅ Redis cache connected');
      });

      this.redis.on('error', (error) => {
        this.connected = false;
        logger.error('❌ Redis cache error:', error);
      });

      this.redis.on('close', () => {
        this.connected = false;
        logger.warn('⚠️ Redis cache connection closed');
      });
    } else {
      throw new Error('Redis URL not provided');
    }
  }

  async get(key: string): Promise<any> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get cache key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Failed to set cache key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Failed to check cache key ${key}:`, error);
      throw error;
    }
  }

  async flush(): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      await this.redis.flushall();
    } catch (error) {
      logger.error('Failed to flush cache:', error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    if (!this.connected) {
      return { connected: false, error: 'Redis not connected' };
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: this.connected,
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace)
      };
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return { connected: false, error: error.message };
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    info.split('\r\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    });
    
    return result;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
      logger.info('🔌 Redis cache disconnected');
    }
  }
}

export class MemoryCacheAdapter implements CacheAdapter {
  private cache: Map<string, { value: any; expires?: number }> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    
    if (!item) {
      this.missCount++;
      return null;
    }
    
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }
    
    this.hitCount++;
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.cache.set(key, { value, expires });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    
    if (!item) return false;
    
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async flush(): Promise<void> {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  async getStats(): Promise<any> {
    return {
      connected: true,
      type: 'memory',
      keys: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.hitCount + this.missCount > 0 ? 
        this.hitCount / (this.hitCount + this.missCount) : 0
    };
  }
}