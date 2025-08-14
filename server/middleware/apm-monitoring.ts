// APM (Application Performance Monitoring) integration
// Real-time performance tracking and alerting

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage: NodeJS.MemoryUsage;
  path: string;
  method: string;
  statusCode?: number;
  queryCount?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

interface APMConfig {
  slowRequestThreshold: number;
  highMemoryThreshold: number;
  errorRateThreshold: number;
  enableTracing: boolean;
  sampleRate: number;
}

export class APMMonitoringService {
  private config: APMConfig;
  private activeRequests = new Map<string, RequestMetrics>();
  private requestHistory: RequestMetrics[] = [];
  private performanceAlerts: string[] = [];

  constructor(config: Partial<APMConfig> = {}) {
    this.config = {
      slowRequestThreshold: 1000, // 1 second
      highMemoryThreshold: 200, // 200MB
      errorRateThreshold: 0.05, // 5%
      enableTracing: true,
      sampleRate: 0.1, // 10% sampling
      ...config
    };
  }

  // Main middleware for request tracing
  requestTracing = (req: Request, res: Response, next: NextFunction) => {
    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Initialize request metrics
    const metrics: RequestMetrics = {
      startTime,
      memoryUsage: process.memoryUsage(),
      path: req.path,
      method: req.method
    };

    this.activeRequests.set(requestId, metrics);

    // Track response completion
    res.on('finish', () => {
      this.completeRequest(requestId, res.statusCode);
    });

    // Track errors
    res.on('error', (error) => {
      this.handleRequestError(requestId, error);
    });

    next();
  };

  // Complete request tracking
  private completeRequest(requestId: string, statusCode: number) {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    const endTime = performance.now();
    const duration = endTime - metrics.startTime;
    const finalMemory = process.memoryUsage();

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = statusCode;

    // Add to history (keep last 1000 requests)
    this.requestHistory.push(metrics);
    if (this.requestHistory.length > 1000) {
      this.requestHistory.shift();
    }

    // Check for performance issues
    this.analyzePerformance(metrics, finalMemory);

    // Clean up active requests
    this.activeRequests.delete(requestId);
  }

  // Analyze request performance
  private analyzePerformance(metrics: RequestMetrics, finalMemory: NodeJS.MemoryUsage) {
    const alerts: string[] = [];

    // Check slow requests
    if (metrics.duration && metrics.duration > this.config.slowRequestThreshold) {
      alerts.push(`🐌 Slow request: ${metrics.method} ${metrics.path} took ${metrics.duration.toFixed(2)}ms`);
    }

    // Check memory usage
    const memoryMB = finalMemory.heapUsed / 1024 / 1024;
    if (memoryMB > this.config.highMemoryThreshold) {
      alerts.push(`🧠 High memory usage: ${memoryMB.toFixed(2)}MB on ${metrics.path}`);
    }

    // Check error rates
    if (metrics.statusCode && metrics.statusCode >= 500) {
      const errorRate = this.calculateErrorRate();
      if (errorRate > this.config.errorRateThreshold) {
        alerts.push(`🚨 High error rate: ${(errorRate * 100).toFixed(2)}% (${metrics.statusCode} on ${metrics.path})`);
      }
    }

    // Store alerts
    this.performanceAlerts.push(...alerts);

    // Keep only recent alerts (last 100)
    if (this.performanceAlerts.length > 100) {
      this.performanceAlerts = this.performanceAlerts.slice(-100);
    }

    // Log critical issues immediately
    alerts.forEach(alert => console.warn(alert));
  }

  // Calculate error rate from recent requests
  private calculateErrorRate(): number {
    const recentRequests = this.requestHistory.slice(-50); // Last 50 requests
    if (recentRequests.length === 0) return 0;

    const errorCount = recentRequests.filter(req => 
      req.statusCode && req.statusCode >= 500
    ).length;

    return errorCount / recentRequests.length;
  }

  // Generate unique request ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle request errors
  private handleRequestError(requestId: string, error: Error) {
    console.error(`🚨 Request error for ${requestId}:`, error.message);
    this.performanceAlerts.push(`❌ Request error: ${error.message}`);
  }

  // Get performance statistics
  getPerformanceStats() {
    const recentRequests = this.requestHistory.slice(-100);
    
    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeRequests: this.activeRequests.size,
        recentAlerts: this.performanceAlerts.slice(-10)
      };
    }

    const totalDuration = recentRequests.reduce((sum, req) => sum + (req.duration || 0), 0);
    const errorCount = recentRequests.filter(req => req.statusCode && req.statusCode >= 500).length;

    return {
      totalRequests: this.requestHistory.length,
      averageResponseTime: totalDuration / recentRequests.length,
      errorRate: errorCount / recentRequests.length,
      activeRequests: this.activeRequests.size,
      recentAlerts: this.performanceAlerts.slice(-10),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  // Get detailed performance breakdown by endpoint
  getEndpointBreakdown() {
    const endpointStats = new Map<string, {
      count: number;
      totalDuration: number;
      avgDuration: number;
      errorCount: number;
      errorRate: number;
    }>();

    this.requestHistory.forEach(req => {
      const key = `${req.method} ${req.path}`;
      const stats = endpointStats.get(key) || {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        errorCount: 0,
        errorRate: 0
      };

      stats.count++;
      stats.totalDuration += req.duration || 0;
      stats.avgDuration = stats.totalDuration / stats.count;

      if (req.statusCode && req.statusCode >= 500) {
        stats.errorCount++;
      }
      stats.errorRate = stats.errorCount / stats.count;

      endpointStats.set(key, stats);
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }

  // Reset performance data
  reset() {
    this.requestHistory = [];
    this.performanceAlerts = [];
    this.activeRequests.clear();
  }
}

// Export singleton instance
export const apmService = new APMMonitoringService({
  slowRequestThreshold: 500, // 500ms for financial app
  highMemoryThreshold: 150, // 150MB threshold
  errorRateThreshold: 0.02, // 2% error rate threshold
  enableTracing: true,
  sampleRate: 1.0 // 100% sampling in development
});

// Middleware export
export const apmMiddleware = apmService.requestTracing;