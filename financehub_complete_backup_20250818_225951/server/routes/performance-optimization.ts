import { Router, Request, Response } from 'express';
import { schedulerOptimizer } from '../services/scheduler-optimization';
import { cachePerformanceMonitor } from '../services/cache-performance-monitor';
import { apiRateLimit } from '../middleware/auth';

/**
 * ✅ PHASE 3 TASK 4: Performance Optimization Routes
 * Real-time performance monitoring and optimization endpoints
 */

const router = Router();

// Apply rate limiting to performance endpoints
router.use(apiRateLimit);

/**
 * GET /api/performance/scheduler
 * Get current scheduler optimization status
 */
router.get('/scheduler', (req: Request, res: Response) => {
  try {
    const status = schedulerOptimizer.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/performance/cache
 * Get comprehensive cache performance metrics
 */
router.get('/cache', (req: Request, res: Response) => {
  try {
    const summary = cachePerformanceMonitor.getPerformanceSummary();
    const recommendations = cachePerformanceMonitor.getOptimizationRecommendations();
    
    res.json({
      success: true,
      data: {
        performance: summary,
        recommendations,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache performance',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/performance/cache/:cacheKey
 * Get performance metrics for a specific cache key
 */
router.get('/cache/:cacheKey', (req: Request, res: Response) => {
  try {
    const { cacheKey } = req.params;
    const metrics = cachePerformanceMonitor.getMetrics(cacheKey);
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Cache key not found',
        cacheKey,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: {
        cacheKey,
        metrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache metrics',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/performance/cache/reset
 * Reset cache performance metrics
 */
router.post('/cache/reset', (req: Request, res: Response) => {
  try {
    const { cacheKey } = req.body;
    cachePerformanceMonitor.resetMetrics(cacheKey);
    
    res.json({
      success: true,
      message: cacheKey ? `Metrics reset for ${cacheKey}` : 'All cache metrics reset',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset cache metrics',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/performance/scheduler/register
 * Register a new job with the scheduler
 */
router.post('/scheduler/register', (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID',
        message: 'Job ID must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }
    
    schedulerOptimizer.registerJob(jobId);
    
    res.json({
      success: true,
      message: `Job ${jobId} registered successfully`,
      status: schedulerOptimizer.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to register job',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/performance/scheduler/unregister
 * Unregister a completed job
 */
router.post('/scheduler/unregister', (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;
    
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID',
        message: 'Job ID must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }
    
    schedulerOptimizer.unregisterJob(jobId);
    
    res.json({
      success: true,
      message: `Job ${jobId} unregistered successfully`,
      status: schedulerOptimizer.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to unregister job',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/performance/overview
 * Get comprehensive performance overview
 */
router.get('/overview', (req: Request, res: Response) => {
  try {
    const schedulerStatus = schedulerOptimizer.getStatus();
    const cachePerformance = cachePerformanceMonitor.getPerformanceSummary();
    const cacheRecommendations = cachePerformanceMonitor.getOptimizationRecommendations();
    
    res.json({
      success: true,
      data: {
        scheduler: schedulerStatus,
        cache: cachePerformance,
        recommendations: cacheRecommendations,
        systemHealth: {
          activeJobs: schedulerStatus.totalActiveJobs,
          cacheHitRate: cachePerformance.overall.overallHitRate,
          totalCacheOperations: cachePerformance.overall.totalOperations,
          recommendationsCount: cacheRecommendations.length
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get performance overview',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

export { router as performanceOptimizationRoutes };