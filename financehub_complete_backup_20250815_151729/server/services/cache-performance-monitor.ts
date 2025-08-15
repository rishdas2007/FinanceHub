import { logger } from '../../shared/utils/logger';

/**
 * ✅ PHASE 3 TASK 3: Cache Performance Monitoring
 * Real-time cache performance tracking and optimization
 */

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  totalOperations: number;
  lastReset: Date;
}

export interface CacheEntry {
  key: string;
  size: number;
  lastAccessed: Date;
  accessCount: number;
  ttl: number;
}

export class CachePerformanceMonitor {
  private metrics: Map<string, CacheMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private entries: Map<string, CacheEntry> = new Map();
  
  /**
   * Record cache hit
   */
  recordHit(cacheKey: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(cacheKey);
    metrics.hits++;
    metrics.totalOperations++;
    this.updateResponseTime(cacheKey, responseTime);
    this.updateHitRate(cacheKey);
    
    // Update entry access info
    const entry = this.entries.get(cacheKey);
    if (entry) {
      entry.lastAccessed = new Date();
      entry.accessCount++;
    }
  }
  
  /**
   * Record cache miss
   */
  recordMiss(cacheKey: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(cacheKey);
    metrics.misses++;
    metrics.totalOperations++;
    this.updateResponseTime(cacheKey, responseTime);
    this.updateHitRate(cacheKey);
  }
  
  /**
   * Record cache entry creation
   */
  recordEntry(cacheKey: string, dataSize: number, ttl: number): void {
    this.entries.set(cacheKey, {
      key: cacheKey,
      size: dataSize,
      lastAccessed: new Date(),
      accessCount: 1,
      ttl
    });
  }
  
  /**
   * Get performance metrics for a specific cache key
   */
  getMetrics(cacheKey: string): CacheMetrics | null {
    return this.metrics.get(cacheKey) || null;
  }
  
  /**
   * Get comprehensive performance summary
   */
  getPerformanceSummary() {
    const allMetrics = Array.from(this.metrics.entries());
    const totalHits = allMetrics.reduce((sum, [, m]) => sum + m.hits, 0);
    const totalMisses = allMetrics.reduce((sum, [, m]) => sum + m.misses, 0);
    const totalOperations = totalHits + totalMisses;
    
    const topPerformers = allMetrics
      .sort(([, a], [, b]) => b.hitRate - a.hitRate)
      .slice(0, 5);
    
    const lowPerformers = allMetrics
      .filter(([, m]) => m.totalOperations >= 10) // Only consider caches with significant usage
      .sort(([, a], [, b]) => a.hitRate - b.hitRate)
      .slice(0, 5);
    
    return {
      overall: {
        totalHits,
        totalMisses,
        totalOperations,
        overallHitRate: totalOperations > 0 ? (totalHits / totalOperations) * 100 : 0
      },
      topPerformers: topPerformers.map(([key, metrics]) => ({
        key,
        hitRate: metrics.hitRate,
        operations: metrics.totalOperations
      })),
      lowPerformers: lowPerformers.map(([key, metrics]) => ({
        key,
        hitRate: metrics.hitRate,
        operations: metrics.totalOperations,
        avgResponseTime: metrics.avgResponseTime
      })),
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  /**
   * Get cache memory usage estimation
   */
  private getMemoryUsage() {
    const entries = Array.from(this.entries.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalEntries = entries.length;
    
    return {
      totalSize,
      totalEntries,
      averageEntrySize: totalEntries > 0 ? Math.round(totalSize / totalEntries) : 0,
      largestEntries: entries
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(e => ({ key: e.key, size: e.size }))
    };
  }
  
  /**
   * Identify optimization opportunities
   */
  getOptimizationRecommendations() {
    const summary = this.getPerformanceSummary();
    const recommendations: string[] = [];
    
    // Low hit rate recommendations
    summary.lowPerformers.forEach(cache => {
      if (cache.hitRate < 30) {
        recommendations.push(`Consider increasing TTL for ${cache.key} (hit rate: ${cache.hitRate.toFixed(1)}%)`);
      }
      if (cache.avgResponseTime > 100) {
        recommendations.push(`Optimize data structure for ${cache.key} (avg response: ${cache.avgResponseTime.toFixed(1)}ms)`);
      }
    });
    
    // Memory usage recommendations
    if (summary.memoryUsage.totalSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Consider implementing cache eviction policy (high memory usage)');
    }
    
    // Overall performance recommendations
    if (summary.overall.overallHitRate < 70) {
      recommendations.push('Overall cache hit rate is low - review caching strategy');
    }
    
    return recommendations;
  }
  
  /**
   * Reset metrics for a specific cache key
   */
  resetMetrics(cacheKey?: string): void {
    if (cacheKey) {
      this.metrics.delete(cacheKey);
      this.responseTimes.delete(cacheKey);
      this.entries.delete(cacheKey);
    } else {
      this.metrics.clear();
      this.responseTimes.clear();
      this.entries.clear();
    }
    
    logger.info(`Cache metrics reset${cacheKey ? ` for ${cacheKey}` : ' (all caches)'}`);
  }
  
  private getOrCreateMetrics(cacheKey: string): CacheMetrics {
    if (!this.metrics.has(cacheKey)) {
      this.metrics.set(cacheKey, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgResponseTime: 0,
        totalOperations: 0,
        lastReset: new Date()
      });
      this.responseTimes.set(cacheKey, []);
    }
    return this.metrics.get(cacheKey)!;
  }
  
  private updateResponseTime(cacheKey: string, responseTime: number): void {
    const times = this.responseTimes.get(cacheKey) || [];
    times.push(responseTime);
    
    // Keep only last 100 response times
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
    
    const metrics = this.metrics.get(cacheKey)!;
    metrics.avgResponseTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    
    this.responseTimes.set(cacheKey, times);
  }
  
  private updateHitRate(cacheKey: string): void {
    const metrics = this.metrics.get(cacheKey)!;
    metrics.hitRate = metrics.totalOperations > 0 
      ? (metrics.hits / metrics.totalOperations) * 100 
      : 0;
  }
}

export const cachePerformanceMonitor = new CachePerformanceMonitor();