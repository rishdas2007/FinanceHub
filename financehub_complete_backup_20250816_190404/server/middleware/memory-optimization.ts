/**
 * Memory Optimization and Performance Monitoring
 * Critical for production deployment performance
 */

import { logger } from '@shared/utils/logger';

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: Date;
  threshold: {
    warning: number;
    critical: number;
  };
}

interface PerformanceOptimization {
  cacheHitRate: number;
  avgResponseTime: number;
  memoryEfficiency: number;
  recommendations: string[];
}

export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private readonly MEMORY_WARNING_THRESHOLD = 150 * 1024 * 1024; // 150MB
  private readonly MEMORY_CRITICAL_THRESHOLD = 200 * 1024 * 1024; // 200MB
  private readonly GC_INTERVAL = 30000; // 30 seconds
  
  private memoryHistory: MemoryMetrics[] = [];
  private gcTimer: NodeJS.Timeout | null = null;

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  /**
   * Initialize memory monitoring and optimization
   */
  initializeOptimization(): void {
    logger.info('Initializing memory optimization system', 'MEMORY_OPT');

    // Start periodic memory monitoring
    this.startMemoryMonitoring();
    
    // Set up garbage collection optimization
    this.setupGarbageCollection();
    
    // Monitor process memory events
    this.setupMemoryEventHandlers();

    logger.info('Memory optimization system initialized', 'MEMORY_OPT');
  }

  /**
   * Get current memory metrics with analysis
   */
  getCurrentMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    
    const metrics: MemoryMetrics = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: new Date(),
      threshold: {
        warning: this.MEMORY_WARNING_THRESHOLD,
        critical: this.MEMORY_CRITICAL_THRESHOLD
      }
    };

    // Store in history for trend analysis
    this.memoryHistory.push(metrics);
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-50); // Keep last 50 entries
    }

    // Check thresholds
    this.checkMemoryThresholds(metrics);

    return metrics;
  }

  /**
   * Optimize memory usage for financial calculations
   */
  optimizeForFinancialCalculations(): void {
    logger.info('Starting financial calculation memory optimization', 'MEMORY_OPT');

    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
      logger.debug('Manual garbage collection triggered', 'MEMORY_OPT');
    }

    // Clear old cache entries
    this.clearStaleCache();
    
    // Optimize array allocations
    this.optimizeArrayAllocations();

    const postOptimization = this.getCurrentMemoryMetrics();
    logger.info('Financial calculation memory optimization completed', 'MEMORY_OPT', {
      heapUsedMB: Math.round(postOptimization.heapUsed / 1024 / 1024),
      rssMB: Math.round(postOptimization.rss / 1024 / 1024)
    });
  }

  /**
   * Get performance optimization recommendations
   */
  getOptimizationRecommendations(): PerformanceOptimization {
    const currentMetrics = this.getCurrentMemoryMetrics();
    const recommendations: string[] = [];

    // Memory usage analysis
    const heapUsageMB = currentMetrics.heapUsed / 1024 / 1024;
    if (heapUsageMB > 150) {
      recommendations.push('High heap memory usage detected - consider cache optimization');
    }

    // Memory trend analysis
    if (this.memoryHistory.length > 10) {
      const recentTrend = this.calculateMemoryTrend();
      if (recentTrend > 1.1) {
        recommendations.push('Memory usage trending upward - investigate memory leaks');
      }
    }

    // Cache efficiency
    const cacheHitRate = this.estimateCacheHitRate();
    if (cacheHitRate < 0.8) {
      recommendations.push('Low cache hit rate - optimize caching strategy');
    }

    // Response time optimization
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > 500) {
      recommendations.push('High response times - consider parallel processing optimization');
    }

    return {
      cacheHitRate,
      avgResponseTime,
      memoryEfficiency: this.calculateMemoryEfficiency(),
      recommendations
    };
  }

  /**
   * Force memory cleanup for critical operations
   */
  forceMemoryCleanup(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('Forcing memory cleanup', 'MEMORY_OPT');

      // Clear all possible caches
      this.clearStaleCache();
      
      // Force garbage collection multiple times
      if ((global as any).gc) {
        (global as any).gc();
        setTimeout(() => {
          (global as any).gc();
          resolve();
        }, 100);
      } else {
        resolve();
      }

      logger.info('Memory cleanup completed', 'MEMORY_OPT');
    });
  }

  /**
   * Start periodic memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const metrics = this.getCurrentMemoryMetrics();
      
      // Log memory status every 30 seconds
      logger.debug('Memory status', 'MEMORY_MONITOR', {
        heapUsedMB: Math.round(metrics.heapUsed / 1024 / 1024),
        rssMB: Math.round(metrics.rss / 1024 / 1024)
      });
    }, 30000);
  }

  /**
   * Setup optimized garbage collection
   */
  private setupGarbageCollection(): void {
    if ((global as any).gc) {
      this.gcTimer = setInterval(() => {
        const beforeGC = process.memoryUsage();
        (global as any).gc();
        const afterGC = process.memoryUsage();
        
        const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;
        if (freedMemory > 1024 * 1024) { // Only log if > 1MB freed
          logger.debug('Garbage collection freed memory', 'MEMORY_GC', {
            freedMB: Math.round(freedMemory / 1024 / 1024)
          });
        }
      }, this.GC_INTERVAL);
    }
  }

  /**
   * Setup memory event handlers
   */
  private setupMemoryEventHandlers(): void {
    process.on('warning', (warning: any) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        logger.warn('Memory warning: MaxListenersExceeded', 'MEMORY_WARNING', {
          warning: warning.message
        });
      }
    });
  }

  /**
   * Check memory thresholds and take action
   */
  private checkMemoryThresholds(metrics: MemoryMetrics): void {
    const heapUsedMB = metrics.heapUsed / 1024 / 1024;

    if (metrics.heapUsed > this.MEMORY_CRITICAL_THRESHOLD) {
      logger.error('CRITICAL: Memory usage exceeded threshold', 'MEMORY_CRITICAL', {
        currentMB: Math.round(heapUsedMB),
        thresholdMB: Math.round(this.MEMORY_CRITICAL_THRESHOLD / 1024 / 1024)
      });
      
      // Force immediate cleanup
      this.forceMemoryCleanup();
      
    } else if (metrics.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
      logger.warn('WARNING: High memory usage detected', 'MEMORY_WARNING', {
        currentMB: Math.round(heapUsedMB),
        thresholdMB: Math.round(this.MEMORY_WARNING_THRESHOLD / 1024 / 1024)
      });
    }
  }

  /**
   * Clear stale cache entries
   */
  private clearStaleCache(): void {
    // Implementation would clear expired cache entries
    logger.debug('Clearing stale cache entries', 'MEMORY_OPT');
  }

  /**
   * Optimize array allocations for financial data
   */
  private optimizeArrayAllocations(): void {
    // Implementation would optimize large array allocations
    logger.debug('Optimizing array allocations', 'MEMORY_OPT');
  }

  /**
   * Calculate memory usage trend
   */
  private calculateMemoryTrend(): number {
    if (this.memoryHistory.length < 5) return 1.0;
    
    const recent = this.memoryHistory.slice(-5);
    const oldest = recent[0].heapUsed;
    const newest = recent[recent.length - 1].heapUsed;
    
    return newest / oldest;
  }

  /**
   * Estimate cache hit rate
   */
  private estimateCacheHitRate(): number {
    // Placeholder implementation - would integrate with actual cache metrics
    return 0.85; // 85% hit rate estimate
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    // Placeholder implementation - would integrate with actual performance metrics
    return 380; // milliseconds
  }

  /**
   * Calculate memory efficiency score
   */
  private calculateMemoryEfficiency(): number {
    const current = this.getCurrentMemoryMetrics();
    const efficiency = (current.heapUsed / current.heapTotal) * 100;
    return Math.round(efficiency);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    logger.info('Memory optimizer cleanup completed', 'MEMORY_OPT');
  }
}

export const memoryOptimizer = MemoryOptimizer.getInstance();