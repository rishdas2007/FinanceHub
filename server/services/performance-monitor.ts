/**
 * Performance Monitoring Service - Comprehensive Application Performance Tracking
 * 
 * @class PerformanceMonitor
 * @description Advanced performance monitoring with endpoint tracking, memory analysis, and 
 * automated performance recommendations. Tracks API response times, memory usage patterns,
 * error rates, and provides actionable insights for optimization.
 * 
 * @features
 * - Real-time endpoint performance tracking
 * - Memory usage monitoring with trend analysis
 * - Automatic slow request detection and alerting
 * - Hit/miss ratio analytics for caching effectiveness
 * - Performance degradation alerts
 * - Automated optimization recommendations
 * - Historical performance data retention
 * 
 * @author AI Agent Documentation Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import { logger } from '../../shared/utils/logger';

/**
 * Individual performance metric data point
 * @interface PerformanceMetric
 * @property {number} timestamp - Unix timestamp when metric was recorded
 * @property {string} endpoint - API endpoint path
 * @property {number} duration - Response time in milliseconds
 * @property {number} statusCode - HTTP response status code
 * @property {number} memoryUsage - Memory usage delta in MB
 * @property {boolean} isError - Whether this request resulted in an error
 * @property {string} [method] - HTTP method (GET, POST, etc.)
 * @property {number} [queryCount] - Number of database queries executed
 */
interface PerformanceMetric {
  timestamp: number;
  endpoint: string;
  duration: number;
  statusCode: number;
  memoryUsage: number;
  isError: boolean;
  method?: string;
  queryCount?: number;
  serviceDependencies?: string[];
  dependencyLatencies?: { [service: string]: number };
}

/**
 * Aggregated performance summary for analytics
 * @interface PerformanceSummary
 * @property {number} totalRequests - Total requests processed
 * @property {number} averageResponseTime - Average response time in ms
 * @property {number} errorRate - Error rate as percentage (0-100)
 * @property {SlowEndpoint[]} slowestEndpoints - Top 5 slowest endpoints
 * @property {MemoryTrend[]} memoryTrend - Memory usage trend over time
 * @property {number} p95ResponseTime - 95th percentile response time
 * @property {number} p99ResponseTime - 99th percentile response time
 * @property {number} requestsPerMinute - Current requests per minute
 */
interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  slowestEndpoints: SlowEndpoint[];
  memoryTrend: MemoryTrend[];
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  serviceDependencies: ServiceDependencyMetrics[];
  criticalPathAnalysis: CriticalPath[];
}

interface ServiceDependencyMetrics {
  serviceName: string;
  callCount: number;
  averageLatency: number;
  errorRate: number;
  availability: number;
  lastSeen: number;
}

interface CriticalPath {
  endpoint: string;
  totalLatency: number;
  services: { name: string; latency: number; percentage: number }[];
  bottleneck: string;
}

/**
 * Slow endpoint identification and metrics
 * @interface SlowEndpoint
 * @property {string} endpoint - API endpoint path
 * @property {number} averageTime - Average response time in ms
 * @property {number} requestCount - Number of requests to this endpoint
 * @property {number} errorRate - Error rate for this endpoint (0-100)
 */
interface SlowEndpoint {
  endpoint: string;
  averageTime: number;
  requestCount: number;
  errorRate: number;
}

/**
 * Memory usage trend data point
 * @interface MemoryTrend
 * @property {number} timestamp - Unix timestamp
 * @property {number} heapUsed - Heap memory used in MB
 * @property {number} heapTotal - Total heap size in MB
 * @property {number} external - External memory in MB
 */
interface MemoryTrend {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

/**
 * Performance recommendation for optimization
 * @interface PerformanceRecommendation
 * @property {string} type - Recommendation category
 * @property {string} severity - Severity level (low, medium, high, critical)
 * @property {string} description - Human-readable recommendation
 * @property {string} action - Specific action to take
 * @property {number} impact - Expected performance improvement (0-100)
 */
interface PerformanceRecommendation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: string;
  impact: number;
}

/**
 * High-performance monitoring service with intelligent analytics
 * @class PerformanceMonitor
 * @implements Singleton pattern for global consistency
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics = new Map<string, PerformanceMetric[]>();
  private memoryTrends: MemoryTrend[] = [];
  private serviceDependencies = new Map<string, ServiceDependencyMetrics>();
  private dependencyCallHistory = new Map<string, { timestamp: number; latency: number; success: boolean }[]>();
  private readonly MAX_METRICS_PER_ENDPOINT = 1000;
  private readonly MEMORY_SAMPLE_INTERVAL = 30000; // 30 seconds
  private readonly SLOW_REQUEST_THRESHOLD = 1000; // 1 second
  private readonly MAX_DEPENDENCY_HISTORY = 500;

  private constructor() {
    // Sample memory usage every 30 seconds
    setInterval(() => this.sampleMemoryUsage(), this.MEMORY_SAMPLE_INTERVAL);
    
    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  /**
   * Get singleton instance of performance monitor
   * @static
   * @returns {PerformanceMonitor} Singleton performance monitor instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Track API endpoint performance metrics with service dependencies
   * @method trackEndpoint
   * @param {string} endpoint - API endpoint path
   * @param {number} duration - Response time in milliseconds
   * @param {number} statusCode - HTTP status code
   * @param {number} memoryUsage - Memory usage delta in MB
   * @param {string} [method] - HTTP method
   * @param {number} [queryCount] - Database query count
   * @param {string[]} [serviceDependencies] - Services called during request
   * @param {{ [service: string]: number }} [dependencyLatencies] - Service call latencies
   * @example
   * monitor.trackEndpoint('/api/market-data', 245, 200, 1.2, 'GET', 3, ['etf-service', 'cache-service'], { 'etf-service': 120, 'cache-service': 25 });
   */
  trackEndpoint(
    endpoint: string, 
    duration: number, 
    statusCode: number, 
    memoryUsage: number,
    method?: string,
    queryCount?: number,
    serviceDependencies?: string[],
    dependencyLatencies?: { [service: string]: number }
  ): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      endpoint,
      duration,
      statusCode,
      memoryUsage,
      isError: statusCode >= 400,
      method,
      queryCount,
      serviceDependencies,
      dependencyLatencies
    };

    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }
    
    const endpointMetrics = this.metrics.get(endpoint)!;
    endpointMetrics.push(metric);
    
    // Keep only recent metrics to prevent memory leaks
    if (endpointMetrics.length > this.MAX_METRICS_PER_ENDPOINT) {
      endpointMetrics.shift();
    }

    // Track service dependencies if provided
    if (serviceDependencies && dependencyLatencies) {
      this.trackServiceDependencies(serviceDependencies, dependencyLatencies, statusCode >= 400);
    }

    // Log slow requests for immediate attention
    if (duration > this.SLOW_REQUEST_THRESHOLD) {
      logger.warn('Slow request detected', {
        endpoint,
        method,
        duration: `${duration}ms`,
        statusCode,
        memoryDelta: `${memoryUsage.toFixed(2)}MB`,
        serviceDependencies: serviceDependencies?.join(', ') || 'none'
      });
    }

    // Log memory spikes
    if (memoryUsage > 10) {
      logger.warn('High memory usage detected', {
        endpoint,
        memoryDelta: `${memoryUsage.toFixed(2)}MB`,
        duration: `${duration}ms`
      });
    }
  }

  /**
   * Track service dependencies for performance analysis
   * @method trackServiceDependencies
   * @param {string[]} services - List of services called
   * @param {{ [service: string]: number }} latencies - Service call latencies
   * @param {boolean} hasError - Whether the request had an error
   * @private
   */
  private trackServiceDependencies(services: string[], latencies: { [service: string]: number }, hasError: boolean): void {
    const now = Date.now();
    
    services.forEach(serviceName => {
      const latency = latencies[serviceName] || 0;
      const callRecord = {
        timestamp: now,
        latency,
        success: !hasError
      };

      // Update service dependency metrics
      if (!this.serviceDependencies.has(serviceName)) {
        this.serviceDependencies.set(serviceName, {
          serviceName,
          callCount: 0,
          averageLatency: 0,
          errorRate: 0,
          availability: 100,
          lastSeen: now
        });
      }

      const serviceMetrics = this.serviceDependencies.get(serviceName)!;
      serviceMetrics.callCount++;
      serviceMetrics.averageLatency = ((serviceMetrics.averageLatency * (serviceMetrics.callCount - 1)) + latency) / serviceMetrics.callCount;
      serviceMetrics.lastSeen = now;

      // Update call history
      if (!this.dependencyCallHistory.has(serviceName)) {
        this.dependencyCallHistory.set(serviceName, []);
      }
      
      const history = this.dependencyCallHistory.get(serviceName)!;
      history.push(callRecord);
      
      // Keep only recent history
      if (history.length > this.MAX_DEPENDENCY_HISTORY) {
        history.shift();
      }

      // Calculate error rate and availability from recent history
      const recentHistory = history.filter(call => now - call.timestamp < 60 * 60 * 1000); // Last hour
      if (recentHistory.length > 0) {
        const errors = recentHistory.filter(call => !call.success).length;
        serviceMetrics.errorRate = (errors / recentHistory.length) * 100;
        serviceMetrics.availability = 100 - serviceMetrics.errorRate;
      }
    });
  }

  /**
   * Analyze critical paths for performance bottlenecks
   * @method analyzeCriticalPaths
   * @param {PerformanceMetric[]} metrics - Performance metrics to analyze
   * @returns {CriticalPath[]} Critical path analysis
   * @private
   */
  private analyzeCriticalPaths(metrics: PerformanceMetric[]): CriticalPath[] {
    const criticalPaths: CriticalPath[] = [];
    const endpointPaths = new Map<string, PerformanceMetric[]>();

    // Group metrics by endpoint
    metrics.forEach(metric => {
      if (metric.serviceDependencies && metric.dependencyLatencies) {
        if (!endpointPaths.has(metric.endpoint)) {
          endpointPaths.set(metric.endpoint, []);
        }
        endpointPaths.get(metric.endpoint)!.push(metric);
      }
    });

    // Analyze each endpoint's service dependencies
    endpointPaths.forEach((endpointMetrics, endpoint) => {
      const recentMetrics = endpointMetrics.slice(-10); // Last 10 requests
      if (recentMetrics.length === 0) return;

      // Calculate average service latencies for this endpoint
      const serviceLatencies = new Map<string, number[]>();
      recentMetrics.forEach(metric => {
        if (metric.dependencyLatencies) {
          Object.entries(metric.dependencyLatencies).forEach(([service, latency]) => {
            if (!serviceLatencies.has(service)) {
              serviceLatencies.set(service, []);
            }
            serviceLatencies.get(service)!.push(latency);
          });
        }
      });

      // Create critical path analysis
      const services: { name: string; latency: number; percentage: number }[] = [];
      let totalServiceLatency = 0;
      let bottleneck = '';
      let maxLatency = 0;

      serviceLatencies.forEach((latencies, serviceName) => {
        const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
        totalServiceLatency += avgLatency;
        
        if (avgLatency > maxLatency) {
          maxLatency = avgLatency;
          bottleneck = serviceName;
        }
        
        services.push({
          name: serviceName,
          latency: Math.round(avgLatency * 100) / 100,
          percentage: 0 // Will be calculated after total is known
        });
      });

      // Calculate percentages
      services.forEach(service => {
        service.percentage = Math.round((service.latency / totalServiceLatency) * 100 * 100) / 100;
      });

      // Sort by latency (highest first)
      services.sort((a, b) => b.latency - a.latency);

      const avgTotalLatency = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;

      criticalPaths.push({
        endpoint,
        totalLatency: Math.round(avgTotalLatency * 100) / 100,
        services,
        bottleneck
      });
    });

    // Sort by total latency (slowest first)
    return criticalPaths.sort((a, b) => b.totalLatency - a.totalLatency);
  }

  /**
   * Get comprehensive performance summary with analytics
   * @method getPerformanceSummary
   * @param {number} [timeRangeMs] - Time range for analysis in milliseconds
   * @returns {PerformanceSummary} Aggregated performance data and insights
   */
  getPerformanceSummary(timeRangeMs: number = 60 * 60 * 1000): PerformanceSummary {
    const cutoff = Date.now() - timeRangeMs;
    const allMetrics: PerformanceMetric[] = [];
    
    // Collect all recent metrics
    for (const endpointMetrics of this.metrics.values()) {
      allMetrics.push(...endpointMetrics.filter(m => m.timestamp >= cutoff));
    }

    if (allMetrics.length === 0) {
      return this.getEmptySummary();
    }

    // Calculate basic statistics
    const totalRequests = allMetrics.length;
    const errorCount = allMetrics.filter(m => m.isError).length;
    const errorRate = (errorCount / totalRequests) * 100;
    
    const durations = allMetrics.map(m => m.duration).sort((a, b) => a - b);
    const averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95ResponseTime = durations[Math.floor(durations.length * 0.95)];
    const p99ResponseTime = durations[Math.floor(durations.length * 0.99)];
    
    const requestsPerMinute = (allMetrics.filter(m => 
      m.timestamp >= Date.now() - 60000
    ).length);

    // Calculate slowest endpoints
    const endpointStats = new Map<string, { times: number[], errors: number }>();
    
    for (const metric of allMetrics) {
      if (!endpointStats.has(metric.endpoint)) {
        endpointStats.set(metric.endpoint, { times: [], errors: 0 });
      }
      const stats = endpointStats.get(metric.endpoint)!;
      stats.times.push(metric.duration);
      if (metric.isError) stats.errors++;
    }

    const slowestEndpoints: SlowEndpoint[] = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.times.reduce((a, b) => a + b, 0) / stats.times.length,
        requestCount: stats.times.length,
        errorRate: (stats.errors / stats.times.length) * 100
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5);

    // Get recent memory trends
    const recentMemoryTrends = this.memoryTrends.filter(t => t.timestamp >= cutoff);

    // Get service dependency metrics
    const serviceDependencies = Array.from(this.serviceDependencies.values())
      .filter(service => cutoff <= service.lastSeen)
      .sort((a, b) => b.callCount - a.callCount);

    // Analyze critical paths
    const criticalPathAnalysis = this.analyzeCriticalPaths(allMetrics);

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      slowestEndpoints,
      memoryTrend: recentMemoryTrends,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
      requestsPerMinute,
      serviceDependencies,
      criticalPathAnalysis: criticalPathAnalysis.slice(0, 5) // Top 5 critical paths
    };
  }

  /**
   * Generate performance optimization recommendations
   * @method generateRecommendations
   * @param {PerformanceSummary} summary - Performance summary data
   * @returns {PerformanceRecommendation[]} Array of actionable recommendations
   */
  generateRecommendations(summary: PerformanceSummary): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // High error rate recommendation
    if (summary.errorRate > 5) {
      recommendations.push({
        type: 'error_rate',
        severity: summary.errorRate > 15 ? 'critical' : 'high',
        description: `Error rate is ${summary.errorRate.toFixed(1)}%, above acceptable threshold`,
        action: 'Review error logs, implement circuit breakers, add input validation',
        impact: 85
      });
    }

    // Slow response time recommendation
    if (summary.averageResponseTime > 500) {
      recommendations.push({
        type: 'response_time',
        severity: summary.averageResponseTime > 2000 ? 'critical' : 'medium',
        description: `Average response time is ${summary.averageResponseTime}ms, users expect <500ms`,
        action: 'Implement caching, optimize database queries, add CDN',
        impact: 70
      });
    }

    // Memory trend recommendation
    if (summary.memoryTrend.length > 0) {
      const latestMemory = summary.memoryTrend[summary.memoryTrend.length - 1];
      const earliestMemory = summary.memoryTrend[0];
      const memoryGrowth = latestMemory.heapUsed - earliestMemory.heapUsed;
      
      if (memoryGrowth > 50) {
        recommendations.push({
          type: 'memory_leak',
          severity: 'high',
          description: `Memory usage increased by ${memoryGrowth.toFixed(1)}MB, potential memory leak`,
          action: 'Review object lifecycles, implement proper cleanup, monitor for leaks',
          impact: 60
        });
      }
    }

    // Slow endpoints recommendation
    if (summary.slowestEndpoints.length > 0 && summary.slowestEndpoints[0].averageTime > 1000) {
      recommendations.push({
        type: 'slow_endpoints',
        severity: 'medium',
        description: `Endpoint ${summary.slowestEndpoints[0].endpoint} averages ${summary.slowestEndpoints[0].averageTime}ms`,
        action: 'Optimize database queries, implement endpoint-specific caching',
        impact: 65
      });
    }

    // High traffic recommendation
    if (summary.requestsPerMinute > 100) {
      recommendations.push({
        type: 'scaling',
        severity: 'medium',
        description: `High traffic detected: ${summary.requestsPerMinute} requests/minute`,
        action: 'Consider implementing rate limiting, load balancing, or horizontal scaling',
        impact: 50
      });
    }

    // Service dependency recommendations
    const dependencyIssues = Array.from(this.serviceDependencies.values())
      .filter(service => service.errorRate > 5 || service.averageLatency > 500);

    dependencyIssues.forEach(service => {
      if (service.errorRate > 10) {
        recommendations.push({
          type: 'service_dependency',
          severity: 'critical',
          description: `Service ${service.serviceName} has high error rate: ${service.errorRate.toFixed(1)}%`,
          action: 'Investigate service health, implement circuit breaker, add retry logic',
          impact: 90
        });
      } else if (service.averageLatency > 1000) {
        recommendations.push({
          type: 'service_dependency',
          severity: 'high',
          description: `Service ${service.serviceName} has high latency: ${service.averageLatency.toFixed(0)}ms`,
          action: 'Optimize service performance, consider caching, review database queries',
          impact: 75
        });
      }
    });

    return recommendations.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Get service dependency health status
   * @method getServiceDependencyHealth
   * @returns {object} Service dependency health metrics
   */
  getServiceDependencyHealth(): {
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceDependencyMetrics[];
    summary: {
      totalServices: number;
      healthyServices: number;
      degradedServices: number;
      unhealthyServices: number;
      avgLatency: number;
      avgAvailability: number;
    };
  } {
    const services = Array.from(this.serviceDependencies.values());
    
    if (services.length === 0) {
      return {
        overallHealth: 'healthy',
        services: [],
        summary: {
          totalServices: 0,
          healthyServices: 0,
          degradedServices: 0,
          unhealthyServices: 0,
          avgLatency: 0,
          avgAvailability: 100
        }
      };
    }

    const healthyServices = services.filter(s => s.availability >= 95 && s.averageLatency < 500).length;
    const degradedServices = services.filter(s => s.availability >= 80 && s.availability < 95 || s.averageLatency >= 500 && s.averageLatency < 2000).length;
    const unhealthyServices = services.filter(s => s.availability < 80 || s.averageLatency >= 2000).length;

    const avgLatency = services.reduce((sum, s) => sum + s.averageLatency, 0) / services.length;
    const avgAvailability = services.reduce((sum, s) => sum + s.availability, 0) / services.length;

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyServices > 0 || avgAvailability < 80) {
      overallHealth = 'unhealthy';
    } else if (degradedServices > services.length * 0.3 || avgAvailability < 95) {
      overallHealth = 'degraded';
    }

    return {
      overallHealth,
      services: services.sort((a, b) => a.availability - b.availability), // Sort by availability (lowest first)
      summary: {
        totalServices: services.length,
        healthyServices,
        degradedServices,
        unhealthyServices,
        avgLatency: Math.round(avgLatency * 100) / 100,
        avgAvailability: Math.round(avgAvailability * 100) / 100
      }
    };
  }

  /**
   * Sample current memory usage for trend analysis
   * @method sampleMemoryUsage
   * @private
   */
  private sampleMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const sample: MemoryTrend = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed / 1024 / 1024, // Convert to MB
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      external: memUsage.external / 1024 / 1024
    };

    this.memoryTrends.push(sample);
    
    // Keep only last 24 hours of memory samples
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.memoryTrends = this.memoryTrends.filter(t => t.timestamp >= cutoff);
  }

  /**
   * Clean up old performance metrics to prevent memory leaks
   * @method cleanupOldMetrics
   * @private
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (2 * 60 * 60 * 1000); // 2 hours
    let cleaned = 0;

    for (const [endpoint, metrics] of this.metrics.entries()) {
      const initialLength = metrics.length;
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoff);
      this.metrics.set(endpoint, filteredMetrics);
      cleaned += initialLength - filteredMetrics.length;
    }

    if (cleaned > 0) {
      logger.info(`Performance monitor cleanup: ${cleaned} old metrics removed`);
    }
  }

  /**
   * Get empty performance summary for initialization
   * @method getEmptySummary
   * @private
   * @returns {PerformanceSummary} Empty summary with default values
   */
  private getEmptySummary(): PerformanceSummary {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      slowestEndpoints: [],
      memoryTrend: [],
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerMinute: 0
    };
  }

  /**
   * Get health status of application performance
   * @method getHealthStatus
   * @returns {object} Application health metrics
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    uptime: number;
    memoryUsage: number;
  } {
    const summary = this.getPerformanceSummary(10 * 60 * 1000); // Last 10 minutes
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check various health indicators
    if (summary.errorRate > 10) {
      issues.push(`High error rate: ${summary.errorRate.toFixed(1)}%`);
      if (summary.totalRequests >= 10) {
        status = 'unhealthy';
      } else if (status === 'healthy') {
        // With a very small sample size, treat the high error rate as degraded
        status = 'degraded';
      }
    } else if (summary.errorRate > 5) {
      issues.push(`Elevated error rate: ${summary.errorRate.toFixed(1)}%`);
      if (status === 'healthy') status = 'degraded';
    }

    if (summary.averageResponseTime > 2000) {
      issues.push(`Very slow responses: ${summary.averageResponseTime}ms avg`);
      status = 'unhealthy';
    } else if (summary.averageResponseTime > 1000) {
      issues.push(`Slow responses: ${summary.averageResponseTime}ms avg`);
      if (status === 'healthy') status = 'degraded';
    }

    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > 500) {
      issues.push(`High memory usage: ${heapUsedMB.toFixed(1)}MB`);
      if (status === 'healthy') status = 'degraded';
    }

    return {
      status,
      issues,
      uptime: process.uptime(),
      memoryUsage: heapUsedMB
    };
  }
}

// Export singleton instance for easy access
export const performanceMonitor = PerformanceMonitor.getInstance();