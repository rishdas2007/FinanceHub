import { performance } from 'perf_hooks';
import os from 'os';
import { logger } from './logger.js';

interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  loadAverage: number[];
}

interface PerformanceThresholds {
  maxMemoryMB: number;
  maxResponseTimeMs: number;
  maxCpuUsage: number;
  maxLoadAverage: number;
}

class PerformanceOptimizer {
  private thresholds: PerformanceThresholds = {
    maxMemoryMB: 1024, // 1GB threshold
    maxResponseTimeMs: 500, // 500ms max response time
    maxCpuUsage: 80, // 80% CPU usage threshold
    maxLoadAverage: 4.0 // Load average threshold
  };

  private metricsHistory: SystemMetrics[] = [];
  private readonly maxHistorySize = 100;

  public getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    const loadAverage = process.platform === 'linux' ? os.loadavg() : [0, 0, 0];

    return {
      memoryUsage,
      cpuUsage,
      uptime,
      loadAverage
    };
  }

  public recordMetrics(): void {
    const metrics = this.getSystemMetrics();
    this.metricsHistory.push(metrics);

    // Keep only recent metrics
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    this.analyzePerformance(metrics);
  }

  private analyzePerformance(metrics: SystemMetrics): void {
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    const loadAvg1Min = metrics.loadAverage[0];

    // Memory pressure detection
    if (memoryMB > this.thresholds.maxMemoryMB) {
      logger.warn(`🚨 High memory usage: ${memoryMB.toFixed(0)}MB (threshold: ${this.thresholds.maxMemoryMB}MB)`);
      this.triggerMemoryOptimization();
    }

    // Load average monitoring
    if (loadAvg1Min > this.thresholds.maxLoadAverage) {
      logger.warn(`🚨 High system load: ${loadAvg1Min.toFixed(2)} (threshold: ${this.thresholds.maxLoadAverage})`);
      this.triggerLoadOptimization();
    }

    // Log performance summary every 10 metrics
    if (this.metricsHistory.length % 10 === 0) {
      this.logPerformanceSummary();
    }
  }

  private triggerMemoryOptimization(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      logger.info('🧹 Forced garbage collection executed');
    }

    // Clear unnecessary caches
    this.clearCaches();
  }

  private triggerLoadOptimization(): void {
    logger.info('⚡ Implementing load optimization strategies');
    
    // Reduce background task frequency during high load
    process.env.HIGH_LOAD_MODE = 'true';
    
    // Log current load for monitoring
    const metrics = this.getSystemMetrics();
    logger.info(`📊 Load Details - 1min: ${metrics.loadAverage[0].toFixed(2)}, 5min: ${metrics.loadAverage[1].toFixed(2)}, 15min: ${metrics.loadAverage[2].toFixed(2)}`);
  }

  private clearCaches(): void {
    // This would integrate with your cache system
    logger.info('🧹 Clearing non-essential caches');
  }

  private logPerformanceSummary(): void {
    if (this.metricsHistory.length === 0) return;

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const memoryMB = latest.memoryUsage.heapUsed / 1024 / 1024;
    
    logger.info(`📊 Performance Summary:
      Memory: ${memoryMB.toFixed(0)}MB (RSS: ${(latest.memoryUsage.rss / 1024 / 1024).toFixed(0)}MB)
      Load Avg: ${latest.loadAverage.map(l => l.toFixed(2)).join(', ')}
      Uptime: ${(latest.uptime / 3600).toFixed(1)}h
    `);
  }

  public getPerformanceReport(): {
    current: SystemMetrics;
    averages: any;
    alerts: string[];
  } {
    const current = this.getSystemMetrics();
    const alerts: string[] = [];
    
    const memoryMB = current.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryMB > this.thresholds.maxMemoryMB) {
      alerts.push(`High memory usage: ${memoryMB.toFixed(0)}MB`);
    }
    
    if (current.loadAverage[0] > this.thresholds.maxLoadAverage) {
      alerts.push(`High load average: ${current.loadAverage[0].toFixed(2)}`);
    }

    const averages = this.calculateAverages();

    return { current, averages, alerts };
  }

  private calculateAverages() {
    if (this.metricsHistory.length === 0) return null;

    const totalMemory = this.metricsHistory.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0);
    const avgMemoryMB = (totalMemory / this.metricsHistory.length) / 1024 / 1024;

    const totalLoad = this.metricsHistory.reduce((sum, m) => sum + m.loadAverage[0], 0);
    const avgLoad = totalLoad / this.metricsHistory.length;

    return {
      memoryMB: avgMemoryMB.toFixed(0),
      loadAverage: avgLoad.toFixed(2),
      sampleSize: this.metricsHistory.length
    };
  }

  public startMonitoring(intervalMs: number = 30000): void {
    logger.info(`🔍 Starting performance monitoring (every ${intervalMs/1000}s)`);
    
    setInterval(() => {
      this.recordMetrics();
    }, intervalMs);

    // Initial metrics
    this.recordMetrics();
  }

  // Request-level performance tracking
  public trackRequest(endpoint: string, startTime: number): void {
    const duration = performance.now() - startTime;
    
    if (duration > this.thresholds.maxResponseTimeMs) {
      logger.warn(`🐌 Slow request: ${endpoint} took ${duration.toFixed(0)}ms`);
    }

    // Track in metrics for trend analysis
    logger.debug(`⚡ ${endpoint}: ${duration.toFixed(0)}ms`);
  }
}

export const performanceOptimizer = new PerformanceOptimizer();