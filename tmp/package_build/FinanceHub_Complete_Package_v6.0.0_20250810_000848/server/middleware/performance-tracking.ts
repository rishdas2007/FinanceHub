/**
 * Performance Tracking Middleware - Automatic Request Performance Monitoring
 * 
 * @middleware performanceTrackingMiddleware
 * @description Express middleware that automatically tracks performance metrics for all API endpoints.
 * Integrates with PerformanceMonitor service to provide comprehensive request analytics including
 * response times, memory usage, error rates, and slow request detection.
 * 
 * @features
 * - Automatic response time tracking
 * - Memory usage delta calculation
 * - Error rate monitoring by status code
 * - Slow request detection and logging
 * - Database query count tracking (when available)
 * - Request method and endpoint classification
 * 
 * @author AI Agent Documentation Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../services/performance-monitor';
import { logger } from '../../shared/utils/logger';

/**
 * Extended Request interface with performance tracking data
 * @interface PerformanceRequest
 * @extends Request
 * @property {number} startTime - Request start timestamp
 * @property {number} startMemory - Memory usage at request start
 * @property {number} [queryCount] - Number of database queries executed
 */
interface PerformanceRequest extends Request {
  startTime?: number;
  startMemory?: number;
  queryCount?: number;
}

/**
 * Performance tracking middleware for comprehensive request monitoring
 * @function performanceTrackingMiddleware
 * @param {PerformanceRequest} req - Express request object with performance tracking
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * 
 * @example
 * // Apply to all routes
 * app.use(performanceTrackingMiddleware);
 * 
 * // Apply to specific route
 * app.get('/api/data', performanceTrackingMiddleware, handler);
 */
export function performanceTrackingMiddleware(
  req: PerformanceRequest, 
  res: Response, 
  next: NextFunction
): void {
  // Record start time and memory usage
  req.startTime = Date.now();
  const memUsage = process.memoryUsage();
  req.startMemory = memUsage.heapUsed;

  // Initialize query counter if not present
  if (!req.queryCount) {
    req.queryCount = 0;
  }

  // Override res.end to capture response metrics
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: (() => void)) {
    // Calculate performance metrics
    const endTime = Date.now();
    const duration = endTime - (req.startTime || endTime);
    const endMemUsage = process.memoryUsage();
    const memoryDelta = (endMemUsage.heapUsed - (req.startMemory || 0)) / 1024 / 1024; // Convert to MB

    // Get endpoint information
    const endpoint = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;
    const queryCount = req.queryCount || 0;

    // Track performance metrics
    performanceMonitor.trackEndpoint(
      endpoint,
      duration,
      statusCode,
      memoryDelta,
      method,
      queryCount
    );

    // Log detailed metrics for analysis
    logger.debug(`Request performance tracked: ${endpoint} ${method} ${duration}ms status:${statusCode}`);

    // Log warnings for performance issues
    if (duration > 1000) {
      logger.warn(`Slow request: ${endpoint} ${method} took ${duration}ms`);
    }

    if (memoryDelta > 10) {
      logger.warn(`High memory usage: ${endpoint} used ${memoryDelta.toFixed(2)}MB`);
    }

    if (statusCode >= 500) {
      logger.error(`Server error: ${endpoint} ${method} status:${statusCode} duration:${duration}ms`);
    }

    // Call original end method
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    }
    return originalEnd(chunk, encoding || 'utf8', cb);
  };

  next();
}

/**
 * Database query tracking middleware helper
 * @function trackDatabaseQuery
 * @param {PerformanceRequest} req - Express request object
 * @description Helper function to increment database query count for a request
 * 
 * @example
 * // In database service
 * trackDatabaseQuery(req);
 * const result = await db.query('SELECT * FROM users');
 */
export function trackDatabaseQuery(req: PerformanceRequest): void {
  if (req.queryCount !== undefined) {
    req.queryCount++;
  } else {
    req.queryCount = 1;
  }
}

/**
 * Performance summary middleware for health checks
 * @function performanceSummaryMiddleware
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @description Middleware that adds performance summary to health check responses
 */
export function performanceSummaryMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Only apply to health check endpoints
  if (req.path.includes('/health') || req.path.includes('/status')) {
    const summary = performanceMonitor.getPerformanceSummary(10 * 60 * 1000); // Last 10 minutes
    const health = performanceMonitor.getHealthStatus();
    
    res.locals.performanceSummary = summary;
    res.locals.healthStatus = health;
  }
  
  next();
}

/**
 * Rate limiting check based on performance metrics
 * @function performanceBasedRateLimit
 * @param {number} threshold - Response time threshold in milliseconds
 * @returns {Function} Express middleware function
 * @description Creates middleware that applies rate limiting when system performance degrades
 * 
 * @example
 * // Apply rate limiting when average response time > 2000ms
 * app.use('/api/', performanceBasedRateLimit(2000));
 */
export function performanceBasedRateLimit(threshold: number = 2000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const summary = performanceMonitor.getPerformanceSummary(5 * 60 * 1000); // Last 5 minutes
    
    if (summary.averageResponseTime > threshold && summary.totalRequests > 10) {
      logger.warn(`Performance-based rate limiting: avg response ${summary.averageResponseTime}ms > ${threshold}ms`);
      
      res.status(503).json({
        error: 'Service temporarily unavailable due to high load',
        retryAfter: 60,
        averageResponseTime: summary.averageResponseTime
      });
      return;
    }
    
    next();
  };
}

/**
 * Circuit breaker middleware based on error rates
 * @function errorRateCircuitBreaker
 * @param {number} errorThreshold - Error rate threshold (0-100)
 * @param {number} requestThreshold - Minimum requests before circuit breaker activates
 * @returns {Function} Express middleware function
 * @description Creates middleware that implements circuit breaker pattern based on error rates
 * 
 * @example
 * // Open circuit when error rate > 50% with at least 10 requests
 * app.use('/api/external', errorRateCircuitBreaker(50, 10));
 */
export function errorRateCircuitBreaker(
  errorThreshold: number = 50, 
  requestThreshold: number = 10
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const summary = performanceMonitor.getPerformanceSummary(5 * 60 * 1000); // Last 5 minutes
    
    if (summary.totalRequests >= requestThreshold && summary.errorRate > errorThreshold) {
      logger.error(`Circuit breaker opened: error rate ${summary.errorRate}% > ${errorThreshold}%`);
      
      res.status(503).json({
        error: 'Service circuit breaker opened due to high error rate',
        errorRate: summary.errorRate,
        retryAfter: 300 // 5 minutes
      });
      return;
    }
    
    next();
  };
}

/**
 * Performance monitoring configuration
 * @interface PerformanceConfig
 * @property {number} slowRequestThreshold - Threshold for slow request warnings (ms)
 * @property {number} highMemoryThreshold - Threshold for high memory warnings (MB)
 * @property {boolean} enableDetailedLogging - Enable detailed performance logging
 * @property {boolean} enableCircuitBreaker - Enable circuit breaker functionality
 * @property {string[]} excludePaths - Paths to exclude from performance monitoring
 */
export interface PerformanceConfig {
  slowRequestThreshold: number;
  highMemoryThreshold: number;
  enableDetailedLogging: boolean;
  enableCircuitBreaker: boolean;
  excludePaths: string[];
}

/**
 * Default performance monitoring configuration
 */
export const defaultPerformanceConfig: PerformanceConfig = {
  slowRequestThreshold: 1000, // 1 second
  highMemoryThreshold: 10, // 10 MB
  enableDetailedLogging: process.env.NODE_ENV === 'development',
  enableCircuitBreaker: process.env.NODE_ENV === 'production',
  excludePaths: ['/health', '/ping', '/favicon.ico', '/robots.txt']
};

/**
 * Create configured performance tracking middleware
 * @function createPerformanceMiddleware
 * @param {Partial<PerformanceConfig>} config - Performance configuration options
 * @returns {Function} Configured Express middleware function
 * 
 * @example
 * const perfMiddleware = createPerformanceMiddleware({
 *   slowRequestThreshold: 500,
 *   enableDetailedLogging: true
 * });
 * app.use(perfMiddleware);
 */
export function createPerformanceMiddleware(config: Partial<PerformanceConfig> = {}) {
  const finalConfig = { ...defaultPerformanceConfig, ...config };
  
  return (req: PerformanceRequest, res: Response, next: NextFunction): void => {
    // Skip monitoring for excluded paths
    if (finalConfig.excludePaths.some(path => req.path.includes(path))) {
      return next();
    }
    
    // Apply performance tracking with custom config
    performanceTrackingMiddleware(req, res, next);
  };
}