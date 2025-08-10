import { Router } from 'express';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { ResponseUtils } from '../utils/ResponseUtils';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Validation schemas for monitoring data
const errorReportSchema = z.object({
  errorId: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  timestamp: z.string(),
  url: z.string(),
  userAgent: z.string(),
  retryCount: z.number().default(0)
});

const performanceDataSchema = z.object({
  type: z.enum(['custom', 'api-error', 'full-metrics', 'core-web-vital']),
  name: z.string().optional(),
  duration: z.number().optional(),
  value: z.number().optional(),
  error: z.string().optional(),
  metrics: z.any().optional(),
  timestamp: z.number(),
  url: z.string().optional()
});

// Store metrics in memory (in production, use a proper metrics store)
const metricsStore = new Map<string, any[]>();
const MAX_METRICS_PER_TYPE = 1000;

// Error reporting endpoint
router.post('/errors', asyncHandler(async (req, res) => {
  try {
    const errorData = errorReportSchema.parse(req.body);
    
    // Log error with structured format
    logger.error('Frontend error reported', {
      errorId: errorData.errorId,
      message: errorData.message,
      url: errorData.url,
      userAgent: errorData.userAgent,
      retryCount: errorData.retryCount,
      timestamp: errorData.timestamp
    });

    // Store error for analytics (implement based on your needs)
    const errors = metricsStore.get('errors') || [];
    errors.push({
      ...errorData,
      serverTimestamp: new Date().toISOString()
    });
    
    // Keep only recent errors
    if (errors.length > MAX_METRICS_PER_TYPE) {
      errors.splice(0, errors.length - MAX_METRICS_PER_TYPE);
    }
    
    metricsStore.set('errors', errors);

    // In production, you might want to:
    // - Send to external monitoring service (Sentry, DataDog, etc.)
    // - Store in database for analysis
    // - Send alerts for critical errors

    ResponseUtils.success(res, { received: true });
  } catch (error) {
    logger.error('Failed to process error report', { error });
    ResponseUtils.badRequest(res, 'Invalid error report format');
  }
}));

// Performance monitoring endpoint
router.post('/performance', asyncHandler(async (req, res) => {
  try {
    const performanceData = performanceDataSchema.parse(req.body);
    
    // Log performance data
    logger.info('Performance data received', {
      type: performanceData.type,
      name: performanceData.name,
      duration: performanceData.duration,
      value: performanceData.value,
      timestamp: performanceData.timestamp
    });

    // Store performance metrics
    const typeKey = `performance-${performanceData.type}`;
    const metrics = metricsStore.get(typeKey) || [];
    metrics.push({
      ...performanceData,
      serverTimestamp: new Date().toISOString()
    });
    
    if (metrics.length > MAX_METRICS_PER_TYPE) {
      metrics.splice(0, metrics.length - MAX_METRICS_PER_TYPE);
    }
    
    metricsStore.set(typeKey, metrics);

    ResponseUtils.success(res, { received: true });
  } catch (error) {
    logger.error('Failed to process performance data', { error });
    ResponseUtils.badRequest(res, 'Invalid performance data format');
  }
}));

// Get error analytics
router.get('/analytics/errors', asyncHandler(async (req, res) => {
  const errors = metricsStore.get('errors') || [];
  
  // Basic analytics
  const analytics = {
    totalErrors: errors.length,
    recentErrors: errors.filter(e => 
      new Date(e.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length,
    errorsByType: errors.reduce((acc: any, error: any) => {
      const type = error.message.split(':')[0] || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}),
    topErrors: Object.entries(
      errors.reduce((acc: any, error: any) => {
        acc[error.message] = (acc[error.message] || 0) + 1;
        return acc;
      }, {})
    )
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 10)
  };

  ResponseUtils.success(res, analytics);
}));

// Get performance analytics
router.get('/analytics/performance', asyncHandler(async (req, res) => {
  const allMetrics = Array.from(metricsStore.entries())
    .filter(([key]) => key.startsWith('performance-'))
    .reduce((acc, [key, metrics]) => {
      acc[key.replace('performance-', '')] = metrics;
      return acc;
    }, {} as any);

  // Calculate basic stats
  const analytics = Object.entries(allMetrics).reduce((acc: any, [type, metrics]) => {
    const values = (metrics as any[])
      .map(m => m.duration || m.value)
      .filter(v => typeof v === 'number');
    
    if (values.length > 0) {
      const sorted = values.sort((a, b) => a - b);
      acc[type] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p90: sorted[Math.floor(sorted.length * 0.9)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      };
    }
    
    return acc;
  }, {});

  ResponseUtils.success(res, analytics);
}));

// Health check for monitoring system
router.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    metricsStored: Object.fromEntries(
      Array.from(metricsStore.entries()).map(([key, values]) => [key, values.length])
    ),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  ResponseUtils.success(res, health);
}));

export { router as monitoringRoutes };