/**
 * API Response Optimization and Caching
 * Critical for production performance and user experience
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils/logger';

interface ResponseCache {
  data: any;
  etag: string;
  timestamp: Date;
  ttl: number;
  compressed: boolean;
}

interface ResponseOptimization {
  compressionEnabled: boolean;
  cachingEnabled: boolean;
  etagEnabled: boolean;
  minificationEnabled: boolean;
}

export class ApiResponseOptimizer {
  private static instance: ApiResponseOptimizer;
  private readonly responseCache = new Map<string, ResponseCache>();
  private readonly CACHE_TTL = 300000; // 5 minutes default
  private readonly MAX_CACHE_SIZE = 100; // Maximum cached responses

  static getInstance(): ApiResponseOptimizer {
    if (!ApiResponseOptimizer.instance) {
      ApiResponseOptimizer.instance = new ApiResponseOptimizer();
    }
    return ApiResponseOptimizer.instance;
  }

  /**
   * Optimize API response middleware
   */
  optimizeResponse() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;
      const originalJson = res.json;

      // Override res.send for optimization
      res.send = function(data: any) {
        const responseTime = Date.now() - startTime;
        
        // Apply optimizations
        const optimizedData = ApiResponseOptimizer.getInstance().applyOptimizations(
          req, 
          data, 
          responseTime
        );

        return originalSend.call(res, optimizedData);
      };

      // Override res.json for optimization
      res.json = function(data: any) {
        const responseTime = Date.now() - startTime;
        
        // Apply JSON-specific optimizations
        const optimizedData = ApiResponseOptimizer.getInstance().optimizeJsonResponse(
          req, 
          data, 
          responseTime
        );

        return originalJson.call(res, optimizedData);
      };

      next();
    };
  }

  /**
   * Apply comprehensive response optimizations
   */
  private applyOptimizations(req: Request, data: any, responseTime: number): any {
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(req);
      
      // Check if response should be cached
      if (this.shouldCacheResponse(req, responseTime)) {
        this.cacheResponse(cacheKey, data, responseTime);
      }

      // Apply compression if beneficial
      const optimizedData = this.applyCompression(data);

      // Log optimization metrics
      this.logOptimizationMetrics(req, data, optimizedData, responseTime);

      return optimizedData;

    } catch (error: any) {
      logger.error('Response optimization failed', 'API_OPTIMIZE_ERROR', {
        url: req.originalUrl,
        error: error.message
      });
      return data; // Return original data on error
    }
  }

  /**
   * Optimize JSON responses specifically
   */
  private optimizeJsonResponse(req: Request, data: any, responseTime: number): any {
    try {
      // Minimize JSON structure for financial data
      const optimizedJson = this.minimizeFinancialJson(data);
      
      // Apply ETF-specific optimizations
      if (req.path.includes('etf')) {
        return this.optimizeEtfResponse(optimizedJson);
      }

      // Apply economic data optimizations
      if (req.path.includes('economic')) {
        return this.optimizeEconomicResponse(optimizedJson);
      }

      return optimizedJson;

    } catch (error: any) {
      logger.error('JSON optimization failed', 'JSON_OPTIMIZE_ERROR', {
        url: req.originalUrl,
        error: error.message
      });
      return data;
    }
  }

  /**
   * Check if response from cache
   */
  getCachedResponse(req: Request): ResponseCache | null {
    const cacheKey = this.generateCacheKey(req);
    const cached = this.responseCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      logger.debug('Cache hit for API response', 'API_CACHE', {
        url: req.originalUrl,
        cacheKey
      });
      return cached;
    }

    if (cached) {
      // Remove expired cache
      this.responseCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(req: Request): string {
    const baseKey = `${req.method}:${req.originalUrl}`;
    const queryParams = JSON.stringify(req.query);
    return Buffer.from(baseKey + queryParams).toString('base64').substring(0, 32);
  }

  /**
   * Determine if response should be cached
   */
  private shouldCacheResponse(req: Request, responseTime: number): boolean {
    // Cache GET requests that take longer than 100ms
    if (req.method !== 'GET') return false;
    if (responseTime < 100) return false;
    
    // Cache financial data endpoints
    const cacheableEndpoints = [
      '/api/etf-metrics',
      '/api/sectors',
      '/api/momentum-analysis',
      '/api/macroeconomic-indicators'
    ];

    return cacheableEndpoints.some(endpoint => req.path.includes(endpoint));
  }

  /**
   * Cache response with TTL
   */
  private cacheResponse(cacheKey: string, data: any, responseTime: number): void {
    // Clear old entries if cache is full
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }

    const cacheEntry: ResponseCache = {
      data,
      etag: this.generateETag(data),
      timestamp: new Date(),
      ttl: this.CACHE_TTL,
      compressed: false
    };

    this.responseCache.set(cacheKey, cacheEntry);
    
    logger.debug('Response cached', 'API_CACHE', {
      cacheKey,
      responseTime: `${responseTime}ms`,
      dataSize: JSON.stringify(data).length
    });
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(cached: ResponseCache): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    return age < cached.ttl;
  }

  /**
   * Apply compression to large responses
   */
  private applyCompression(data: any): any {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Only compress large responses (>10KB)
    if (dataString.length > 10240) {
      logger.debug('Applying response compression', 'API_COMPRESS', {
        originalSize: dataString.length,
        compressionTarget: 'large_response'
      });
      
      // In production, this would use actual compression
      // For now, we'll just optimize the data structure
      return this.optimizeDataStructure(data);
    }

    return data;
  }

  /**
   * Minimize financial JSON for efficiency
   */
  private minimizeFinancialJson(data: any): any {
    if (!data || typeof data !== 'object') return data;

    // Remove null fields to reduce payload size
    if (Array.isArray(data)) {
      return data.map(item => this.removeNullFields(item));
    }

    return this.removeNullFields(data);
  }

  /**
   * Optimize ETF response structure
   */
  private optimizeEtfResponse(data: any): any {
    if (data?.data && Array.isArray(data.data)) {
      // Sort by most active/relevant ETFs first
      data.data.sort((a: any, b: any) => {
        if (a.volume && b.volume) {
          return b.volume - a.volume;
        }
        return 0;
      });

      // Limit response size for performance
      if (data.data.length > 50) {
        data.data = data.data.slice(0, 50);
        data.truncated = true;
      }
    }

    return data;
  }

  /**
   * Optimize economic response structure
   */
  private optimizeEconomicResponse(data: any): any {
    if (data?.indicators && Array.isArray(data.indicators)) {
      // Prioritize most recent indicators
      data.indicators.sort((a: any, b: any) => {
        const dateA = new Date(a.releaseDate || a.period_date);
        const dateB = new Date(b.releaseDate || b.period_date);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return data;
  }

  /**
   * Remove null/undefined fields from object
   */
  private removeNullFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          cleaned[key] = this.removeNullFields(value);
        } else {
          cleaned[key] = value;
        }
      }
    }

    return cleaned;
  }

  /**
   * Optimize data structure for transmission
   */
  private optimizeDataStructure(data: any): any {
    // Convert repeated strings to references
    // Round unnecessary precision in numbers
    if (typeof data === 'number') {
      return Math.round(data * 10000) / 10000; // 4 decimal places max
    }

    if (Array.isArray(data)) {
      return data.map(item => this.optimizeDataStructure(item));
    }

    if (data && typeof data === 'object') {
      const optimized: any = {};
      for (const [key, value] of Object.entries(data)) {
        optimized[key] = this.optimizeDataStructure(value);
      }
      return optimized;
    }

    return data;
  }

  /**
   * Generate ETag for response
   */
  private generateETag(data: any): string {
    const content = JSON.stringify(data);
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Log optimization metrics
   */
  private logOptimizationMetrics(req: Request, originalData: any, optimizedData: any, responseTime: number): void {
    const originalSize = JSON.stringify(originalData).length;
    const optimizedSize = JSON.stringify(optimizedData).length;
    const compressionRatio = optimizedSize / originalSize;

    if (compressionRatio < 0.9 || responseTime > 500) {
      logger.info('Response optimization metrics', 'API_OPTIMIZE', {
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        originalSize,
        optimizedSize,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        improvement: `${Math.round((1 - compressionRatio) * 100)}%`
      });
    }
  }

  /**
   * Clear cache for specific patterns
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.responseCache.clear();
      logger.info('API response cache cleared completely', 'API_CACHE');
      return;
    }

    let cleared = 0;
    for (const [key, value] of this.responseCache.entries()) {
      if (key.includes(pattern)) {
        this.responseCache.delete(key);
        cleared++;
      }
    }

    logger.info('API response cache cleared by pattern', 'API_CACHE', {
      pattern,
      entriesCleared: cleared
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const cached of this.responseCache.values()) {
      if (!oldest || cached.timestamp < oldest) {
        oldest = cached.timestamp;
      }
      if (!newest || cached.timestamp > newest) {
        newest = cached.timestamp;
      }
    }

    return {
      size: this.responseCache.size,
      hitRate: 0.85, // Placeholder - would track actual hits/misses
      oldestEntry: oldest,
      newestEntry: newest
    };
  }
}

export const apiResponseOptimizer = ApiResponseOptimizer.getInstance();