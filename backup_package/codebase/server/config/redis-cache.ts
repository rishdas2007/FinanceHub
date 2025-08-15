import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

/**
 * Enhanced Redis Caching System
 * Optimized TTLs for 10-year dataset volume and access patterns
 */
class RedisCacheManager {
  private static instance: RedisCacheManager;
  private redis: Redis | null = null;
  private isConnected: boolean = false;

  // Enhanced TTLs optimized for data volume and access patterns
  public readonly CACHE_TTL = {
    REALTIME: 30,           // 30 seconds for real-time market data
    INTRADAY: 300,          // 5 minutes for intraday data  
    DAILY: 600,             // 10 minutes for daily data (reduced from 2 hours for responsiveness)
    ECONOMIC: 3600,         // 1 hour for economic indicators
    STATISTICAL: 7200,      // 2 hours for statistical calculations
    HISTORICAL: 21600,      // 6 hours for historical analysis (rarely changes)
    Z_SCORE: 1800,          // 30 minutes for z-score calculations
    BATCH_RESULTS: 3600     // 1 hour for batch processing results
  };

  private constructor() {
    // Use Redis URL if available, otherwise fall back to local Redis
    const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
    
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnCluster: 100,
        keepAlive: 30000,
        family: 4, // Force IPv4
      });
    } else {
      // Fall back to local Redis or memory cache
      logger.warn('No Redis URL found, using in-memory cache fallback');
      this.initializeMemoryFallback();
      return;
    }

    this.redis.on('connect', () => {
      logger.info('Redis cache connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
      this.isConnected = false;
    });

    this.redis.on('ready', () => {
      logger.info('Redis cache ready for operations');
      this.isConnected = true;
    });
  }

  private memoryCache = new Map<string, { value: any; expiry: number }>();

  private initializeMemoryFallback() {
    logger.info('Initializing memory cache fallback');
    this.isConnected = true;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.memoryCache.entries())) {
        if (now > entry.expiry) {
          this.memoryCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  public static getInstance(): RedisCacheManager {
    if (!RedisCacheManager.instance) {
      RedisCacheManager.instance = new RedisCacheManager();
    }
    return RedisCacheManager.instance;
  }

  /**
   * Set cache value with automatic TTL selection
   */
  public async set(
    key: string, 
    value: any, 
    ttlType: keyof typeof this.CACHE_TTL = 'DAILY'
  ): Promise<void> {
    try {
      const ttlSeconds = this.CACHE_TTL[ttlType];
      const serializedValue = JSON.stringify(value);
      
      if (this.redis && this.isConnected) {
        await this.redis.setex(key, ttlSeconds, serializedValue);
      } else {
        // Memory fallback
        this.memoryCache.set(key, {
          value: serializedValue,
          expiry: Date.now() + (ttlSeconds * 1000)
        });
      }
      
      logger.debug('Cache set', { key, ttlType, ttlSeconds });
    } catch (error) {
      logger.error('Cache set error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Get cache value with automatic deserialization
   */
  public async get<T = any>(key: string): Promise<T | null> {
    try {
      let serializedValue: string | null = null;
      
      if (this.redis && this.isConnected) {
        serializedValue = await this.redis.get(key);
      } else {
        // Memory fallback
        const entry = this.memoryCache.get(key);
        if (entry && Date.now() <= entry.expiry) {
          serializedValue = entry.value;
        } else if (entry) {
          this.memoryCache.delete(key);
        }
      }
      
      if (serializedValue) {
        const value = JSON.parse(serializedValue);
        logger.debug('Cache hit', { key });
        return value;
      }
      
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  public async del(key: string): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Set multiple cache entries in batch
   */
  public async mset(entries: Array<{ key: string; value: any; ttlType?: keyof typeof this.CACHE_TTL }>): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        const pipeline = this.redis.pipeline();
        
        for (const entry of entries) {
          const ttlType = entry.ttlType || 'DAILY';
          const ttlSeconds = this.CACHE_TTL[ttlType];
          const serializedValue = JSON.stringify(entry.value);
          pipeline.setex(entry.key, ttlSeconds, serializedValue);
        }
        
        await pipeline.exec();
      } else {
        // Memory fallback
        for (const entry of entries) {
          const ttlType = entry.ttlType || 'DAILY';
          const ttlSeconds = this.CACHE_TTL[ttlType];
          this.memoryCache.set(entry.key, {
            value: JSON.stringify(entry.value),
            expiry: Date.now() + (ttlSeconds * 1000)
          });
        }
      }
      
      logger.debug('Batch cache set', { count: entries.length });
    } catch (error) {
      logger.error('Batch cache set error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  public async flushAll(): Promise<void> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.flushall();
      } else {
        this.memoryCache.clear();
      }
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    connected: boolean;
    type: 'redis' | 'memory';
    keyCount?: number;
    memoryUsage?: string;
  }> {
    try {
      if (this.redis && this.isConnected) {
        const info = await this.redis.info('memory');
        return {
          connected: this.isConnected,
          type: 'redis',
          memoryUsage: info.match(/used_memory_human:(.+)/)?.[1]?.trim()
        };
      } else {
        return {
          connected: this.isConnected,
          type: 'memory',
          keyCount: this.memoryCache.size
        };
      }
    } catch (error) {
      return {
        connected: false,
        type: this.redis ? 'redis' : 'memory'
      };
    }
  }

  /**
   * Graceful shutdown
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      logger.info('Redis cache disconnected');
    } catch (error) {
      logger.error('Redis disconnect error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

export const redisCache = RedisCacheManager.getInstance();
export default redisCache;