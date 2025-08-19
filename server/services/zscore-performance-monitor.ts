import { logger } from '../middleware/logging';
import { optimizedDbPool } from './optimized-db-pool';

interface PerformanceMetrics {
  calculationTimes: Map<string, number[]>;
  cacheHitRates: Map<string, { hits: number; misses: number }>;
  errorRates: Map<string, number>;
  memoryUsage: number[];
  throughput: number[];
}

interface PerformanceReport {
  avgCalculationTime: number;
  cacheHitRate: number;
  slowestSymbols: Array<{ symbol: string; avgTime: number }>;
  recommendations: string[];
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  timestamp: string;
}

/**
 * Real-time Performance Monitor for Z-Score Calculations
 * Tracks metrics, identifies bottlenecks, and provides optimization recommendations
 */
export class ZScorePerformanceMonitor {
  private metrics: PerformanceMetrics = {
    calculationTimes: new Map(),
    cacheHitRates: new Map(),
    errorRates: new Map(),
    memoryUsage: [],
    throughput: []
  };

  private startTime: number = Date.now();
  private totalCalculations: number = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    logger.info('📊 Z-Score Performance Monitor initialized');
    this.startMonitoring();
  }

  /**
   * Start continuous performance monitoring
   */
  private startMonitoring(): void {
    // Significantly reduce monitoring frequency to prevent performance feedback loops
    const intervalMs = process.env.HIGH_LOAD_MODE === 'true' ? 300000 : 180000; // 5min vs 3min (was causing spam)
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.analyzePerformanceTrends();
    }, intervalMs);

    logger.info(`🔍 Performance monitoring started (${intervalMs/1000}s intervals)`);
  }

  /**
   * Track a z-score calculation
   */
  trackCalculation(
    symbol: string, 
    duration: number, 
    cacheHit: boolean, 
    successful: boolean = true
  ): void {
    this.totalCalculations++;

    // Track calculation times
    if (!this.metrics.calculationTimes.has(symbol)) {
      this.metrics.calculationTimes.set(symbol, []);
    }
    this.metrics.calculationTimes.get(symbol)!.push(duration);

    // Update cache metrics
    if (!this.metrics.cacheHitRates.has(symbol)) {
      this.metrics.cacheHitRates.set(symbol, { hits: 0, misses: 0 });
    }
    const cache = this.metrics.cacheHitRates.get(symbol)!;
    if (cacheHit) cache.hits++;
    else cache.misses++;

    // Track error rates
    if (!successful) {
      const currentErrors = this.metrics.errorRates.get(symbol) || 0;
      this.metrics.errorRates.set(symbol, currentErrors + 1);
    }

    // Log slow calculations
    if (duration > 1000) {
      logger.warn(`🐌 Slow z-score calculation detected`, {
        symbol,
        duration: `${duration}ms`,
        cacheHit
      });
    }

    // Log extremely slow calculations
    if (duration > 5000) {
      logger.error(`🚨 Extremely slow z-score calculation`, {
        symbol,
        duration: `${duration}ms`,
        recommendation: 'Consider optimizing data queries or increasing cache TTL'
      });
    }
  }

  /**
   * Collect system-level performance metrics
   */
  private collectSystemMetrics(): void {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push(memUsage.heapUsed / 1024 / 1024); // MB

    // Keep only last 100 memory readings
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
    }

    // Calculate throughput (calculations per minute)
    const runtimeMinutes = (Date.now() - this.startTime) / 60000;
    const throughput = this.totalCalculations / Math.max(runtimeMinutes, 1);
    this.metrics.throughput.push(throughput);

    if (this.metrics.throughput.length > 100) {
      this.metrics.throughput = this.metrics.throughput.slice(-100);
    }
  }

  /**
   * Analyze performance trends and detect issues
   */
  private analyzePerformanceTrends(): void {
    const report = this.generatePerformanceReport();
    
    // Alert on performance issues (but only if we have significant calculation data)
    if (this.totalCalculations > 50 && report.overallHealth === 'critical') {
      logger.error('🚨 CRITICAL: Z-Score performance is severely degraded', {
        avgCalculationTime: report.avgCalculationTime,
        cacheHitRate: report.cacheHitRate,
        totalCalculations: this.totalCalculations,
        recommendations: report.recommendations,
        triggerCondition: this.getHealthTriggerCondition()
      });
    } else if (this.totalCalculations > 20 && report.overallHealth === 'warning') {
      logger.warn('⚠️ WARNING: Z-Score performance is degrading', {
        avgCalculationTime: report.avgCalculationTime,
        totalCalculations: this.totalCalculations,
        recommendations: report.recommendations,
        triggerCondition: this.getHealthTriggerCondition()
      });
    } else if (report.overallHealth === 'critical') {
      // Debug: Log why it's critical even with low calculation count
      logger.debug('🔍 Z-Score Monitor: Critical state detected with low calculation count', {
        totalCalculations: this.totalCalculations,
        avgCalculationTime: report.avgCalculationTime,
        cacheHitRate: report.cacheHitRate,
        triggerCondition: this.getHealthTriggerCondition(),
        suppressedAlert: true
      });
    }
  }

  /**
   * Calculate average calculation time across all symbols
   */
  private calculateAverageTime(): number {
    let totalTime = 0;
    let totalCalculations = 0;

    for (const [symbol, times] of this.metrics.calculationTimes) {
      totalTime += times.reduce((sum, time) => sum + time, 0);
      totalCalculations += times.length;
    }

    return totalCalculations > 0 ? totalTime / totalCalculations : 0;
  }

  /**
   * Calculate overall cache hit rate
   */
  private calculateCacheHitRate(): number {
    let totalHits = 0;
    let totalRequests = 0;

    for (const [symbol, cache] of this.metrics.cacheHitRates) {
      totalHits += cache.hits;
      totalRequests += cache.hits + cache.misses;
    }

    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  /**
   * Identify slowest performing symbols
   */
  private identifySlowSymbols(limit: number = 5): Array<{ symbol: string; avgTime: number }> {
    const symbolAvgs: Array<{ symbol: string; avgTime: number }> = [];

    for (const [symbol, times] of this.metrics.calculationTimes) {
      if (times.length > 0) {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        symbolAvgs.push({ symbol, avgTime });
      }
    }

    return symbolAvgs
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  /**
   * Generate optimization recommendations based on metrics
   */
  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgTime = this.calculateAverageTime();
    const cacheHitRate = this.calculateCacheHitRate();
    const slowSymbols = this.identifySlowSymbols(3);

    // Performance recommendations
    if (avgTime > 1000) {
      recommendations.push('Consider optimizing database queries or adding more database indexes');
    }

    if (cacheHitRate < 70) {
      recommendations.push('Increase cache TTL or improve cache warming strategies');
    }

    if (slowSymbols.length > 0 && slowSymbols[0].avgTime > 2000) {
      recommendations.push(`Focus optimization on slowest symbols: ${slowSymbols.map(s => s.symbol).join(', ')}`);
    }

    // Memory recommendations
    const avgMemory = this.metrics.memoryUsage.length > 0 
      ? this.metrics.memoryUsage.reduce((sum, mem) => sum + mem, 0) / this.metrics.memoryUsage.length 
      : 0;

    if (avgMemory > 500) {
      recommendations.push('High memory usage detected - consider implementing memory-efficient data structures');
    }

    // Throughput recommendations
    const avgThroughput = this.metrics.throughput.length > 0
      ? this.metrics.throughput.reduce((sum, t) => sum + t, 0) / this.metrics.throughput.length
      : 0;

    if (avgThroughput < 10) {
      recommendations.push('Low calculation throughput - consider parallel processing or worker threads');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - no immediate optimizations needed');
    }

    return recommendations;
  }

  /**
   * Get detailed trigger condition for health assessment
   */
  private getHealthTriggerCondition(): string {
    const avgTime = this.calculateAverageTime();
    const cacheHitRate = this.calculateCacheHitRate();
    const errorCount = Array.from(this.metrics.errorRates.values()).reduce((sum, count) => sum + count, 0);
    const errorRate = this.totalCalculations > 0 ? (errorCount / this.totalCalculations) * 100 : 0;

    const conditions = [];
    if (avgTime > 10000) conditions.push(`avgTime: ${avgTime}ms > 10000ms`);
    if (errorRate > 15) conditions.push(`errorRate: ${errorRate}% > 15%`);
    if (cacheHitRate < 20) conditions.push(`cacheHitRate: ${cacheHitRate}% < 20%`);
    
    return conditions.length > 0 ? conditions.join(', ') : 'no trigger conditions met';
  }

  /**
   * Determine overall system health
   */
  private assessOverallHealth(): PerformanceReport['overallHealth'] {
    const avgTime = this.calculateAverageTime();
    const cacheHitRate = this.calculateCacheHitRate();
    const errorCount = Array.from(this.metrics.errorRates.values()).reduce((sum, count) => sum + count, 0);
    const errorRate = this.totalCalculations > 0 ? (errorCount / this.totalCalculations) * 100 : 0;

    // Don't assess as critical if we have very few calculations (startup condition)
    if (this.totalCalculations < 5) {
      return 'good'; // Default to good during startup
    }

    // Critical conditions - increased thresholds for production
    if (avgTime > 10000 || errorRate > 15 || cacheHitRate < 20) {
      return 'critical';
    }

    // Warning conditions - adjusted for production
    if (avgTime > 5000 || errorRate > 8 || cacheHitRate < 40) {
      return 'warning';
    }

    // Good conditions
    if (avgTime < 1000 && errorRate < 2 && cacheHitRate > 80) {
      return 'excellent';
    }

    return 'good';
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(): PerformanceReport {
    return {
      avgCalculationTime: this.calculateAverageTime(),
      cacheHitRate: this.calculateCacheHitRate(),
      slowestSymbols: this.identifySlowSymbols(),
      recommendations: this.generateOptimizationRecommendations(),
      overallHealth: this.assessOverallHealth(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed metrics for specific symbol
   */
  getSymbolMetrics(symbol: string): any {
    const times = this.metrics.calculationTimes.get(symbol) || [];
    const cache = this.metrics.cacheHitRates.get(symbol) || { hits: 0, misses: 0 };
    const errors = this.metrics.errorRates.get(symbol) || 0;

    return {
      symbol,
      totalCalculations: times.length,
      avgCalculationTime: times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0,
      minCalculationTime: times.length > 0 ? Math.min(...times) : 0,
      maxCalculationTime: times.length > 0 ? Math.max(...times) : 0,
      cacheHitRate: (cache.hits + cache.misses) > 0 ? (cache.hits / (cache.hits + cache.misses)) * 100 : 0,
      errorCount: errors,
      errorRate: times.length > 0 ? (errors / times.length) * 100 : 0
    };
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.metrics.calculationTimes.clear();
    this.metrics.cacheHitRates.clear();
    this.metrics.errorRates.clear();
    this.metrics.memoryUsage = [];
    this.metrics.throughput = [];
    this.totalCalculations = 0;
    this.startTime = Date.now();

    logger.info('📊 Performance metrics reset');
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): any {
    return {
      startTime: this.startTime,
      totalCalculations: this.totalCalculations,
      metrics: {
        calculationTimes: Object.fromEntries(this.metrics.calculationTimes),
        cacheHitRates: Object.fromEntries(this.metrics.cacheHitRates),
        errorRates: Object.fromEntries(this.metrics.errorRates),
        memoryUsage: this.metrics.memoryUsage,
        throughput: this.metrics.throughput
      },
      report: this.generatePerformanceReport(),
      databaseMetrics: optimizedDbPool.getMetrics()
    };
  }

  /**
   * Stop monitoring and cleanup
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('🛑 Performance monitoring stopped');
  }
}

// Export singleton instance
export const zScorePerformanceMonitor = new ZScorePerformanceMonitor();