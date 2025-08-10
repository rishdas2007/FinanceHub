/**
 * Enterprise Rate Limiting Service
 * Implements adaptive rate limiting with proper backoff and quota management
 */

import { logger } from '../utils/logger';

interface RateLimitConfig {
  requests: number;
  window: number; // milliseconds
  burst: number; // burst allowance
}

interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  nextAllowedTime?: Date;
}

interface RateLimitBucket {
  count: number;
  windowStart: number;
  burstCount: number;
  burstStart: number;
}

export class RateLimitingService {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private config: Map<string, RateLimitConfig> = new Map();

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig(): void {
    // Configure rate limits per service/endpoint
    this.config.set('twelve_data', {
      requests: 144, // 144 calls per minute (Twelve Data limit)
      window: 60 * 1000, // 1 minute
      burst: 10 // Allow 10 burst requests
    });

    this.config.set('fred_api', {
      requests: 120, // Conservative limit for FRED
      window: 60 * 1000,
      burst: 5
    });

    this.config.set('openai_api', {
      requests: 50, // Conservative for cost management
      window: 60 * 1000,
      burst: 3
    });

    this.config.set('etf_metrics', {
      requests: 60, // Internal processing limit
      window: 60 * 1000,
      burst: 5
    });

    this.config.set('economic_data', {
      requests: 30, // Economic data refresh limit
      window: 60 * 1000,
      burst: 3
    });

    this.config.set('technical_indicators', {
      requests: 100, // Technical indicator calculations
      window: 60 * 1000,
      burst: 10
    });
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(service: string): Promise<RateLimitStatus> {
    const config = this.config.get(service);
    if (!config) {
      logger.warn(`No rate limit config found for service: ${service}`);
      return {
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 60000)
      };
    }

    const now = Date.now();
    let bucket = this.buckets.get(service);

    // Initialize bucket if not exists
    if (!bucket) {
      bucket = {
        count: 0,
        windowStart: now,
        burstCount: 0,
        burstStart: now
      };
      this.buckets.set(service, bucket);
    }

    // Reset window if expired
    if (now - bucket.windowStart >= config.window) {
      bucket.count = 0;
      bucket.windowStart = now;
    }

    // Reset burst window (shorter window for burst detection)
    if (now - bucket.burstStart >= 10000) { // 10 second burst window
      bucket.burstCount = 0;
      bucket.burstStart = now;
    }

    // Check burst limit
    if (bucket.burstCount >= config.burst) {
      const nextAllowedTime = new Date(bucket.burstStart + 10000);
      logger.warn(`🚦 Burst limit exceeded for ${service}. Next allowed: ${nextAllowedTime.toISOString()}`);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(bucket.windowStart + config.window),
        nextAllowedTime
      };
    }

    // Check main rate limit
    if (bucket.count >= config.requests) {
      const resetTime = new Date(bucket.windowStart + config.window);
      logger.warn(`🚦 Rate limit exceeded for ${service}. Reset: ${resetTime.toISOString()}`);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        nextAllowedTime: resetTime
      };
    }

    // Request allowed - update counters
    bucket.count++;
    bucket.burstCount++;

    const remaining = config.requests - bucket.count;
    const resetTime = new Date(bucket.windowStart + config.window);

    logger.debug(`✅ Rate limit check passed for ${service}: ${remaining} remaining`);

    return {
      allowed: true,
      remaining,
      resetTime
    };
  }

  /**
   * Get current rate limit status for a service
   */
  getStatus(service: string): RateLimitStatus | null {
    const config = this.config.get(service);
    const bucket = this.buckets.get(service);

    if (!config || !bucket) {
      return null;
    }

    const now = Date.now();
    const remaining = Math.max(0, config.requests - bucket.count);
    const resetTime = new Date(bucket.windowStart + config.window);

    return {
      allowed: remaining > 0,
      remaining,
      resetTime
    };
  }

  /**
   * Manually consume rate limit quota (for batch operations)
   */
  async consumeQuota(service: string, count: number = 1): Promise<boolean> {
    for (let i = 0; i < count; i++) {
      const status = await this.checkLimit(service);
      if (!status.allowed) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all rate limit statuses
   */
  getAllStatuses(): Map<string, RateLimitStatus | null> {
    const statuses = new Map<string, RateLimitStatus | null>();
    
    for (const service of Array.from(this.config.keys())) {
      statuses.set(service, this.getStatus(service));
    }
    
    return statuses;
  }

  /**
   * Calculate optimal delay for next request
   */
  getOptimalDelay(service: string): number {
    const status = this.getStatus(service);
    if (!status || status.allowed) {
      return 0;
    }

    const now = Date.now();
    const delayMs = status.resetTime.getTime() - now;
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    return Math.max(0, delayMs + jitter);
  }

  /**
   * Adaptive backoff implementation
   */
  async withBackoff<T>(
    service: string, 
    operation: () => Promise<T>, 
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const status = await this.checkLimit(service);
        
        if (!status.allowed) {
          const delay = this.getOptimalDelay(service);
          logger.info(`⏱️ Rate limited. Waiting ${delay}ms for ${service}`);
          await this.sleep(delay);
          continue;
        }

        return await operation();
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`🔄 Attempt ${attempt + 1} failed for ${service}. Retrying in ${backoffDelay}ms`);
          await this.sleep(backoffDelay);
        }
      }
    }

    throw lastError || new Error(`Rate limiting failed after ${maxRetries} retries`);
  }

  /**
   * Clean up expired buckets
   */
  cleanupExpiredBuckets(): void {
    const now = Date.now();
    
    for (const [service, bucket] of Array.from(this.buckets.entries())) {
      const config = this.config.get(service);
      if (config && now - bucket.windowStart > config.window * 2) {
        this.buckets.delete(service);
        logger.debug(`🧹 Cleaned up expired bucket for ${service}`);
      }
    }
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): {
    services: Map<string, RateLimitStatus | null>;
    activeBuckets: number;
    totalConfigs: number;
  } {
    return {
      services: this.getAllStatuses(),
      activeBuckets: this.buckets.size,
      totalConfigs: this.config.size
    };
  }
}

export const rateLimitingService = new RateLimitingService();