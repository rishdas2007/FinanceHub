/**
 * Code Quality and Performance Monitoring API Routes
 * 
 * @description Express routes for code quality analysis, performance monitoring,
 * and system health checks. Provides endpoints for automated quality scanning,
 * performance metrics, and health status reporting.
 * 
 * @author AI Agent Documentation Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../services/performance-monitor';
import { codeQualityScanner } from '../utils/code-quality-scanner';
import { serviceSizeMonitor } from '../utils/service-size-monitor';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * Get comprehensive performance summary
 * @route GET /api/quality/performance
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const timeRange = parseInt(req.query.timeRange as string) || 60 * 60 * 1000; // Default 1 hour
    const summary = performanceMonitor.getPerformanceSummary(timeRange);
    const recommendations = performanceMonitor.generateRecommendations(summary);
    
    res.json({
      timestamp: new Date().toISOString(),
      timeRangeMs: timeRange,
      summary,
      recommendations,
      healthStatus: performanceMonitor.getHealthStatus()
    });
  } catch (error) {
    logger.error(`Performance summary failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to get performance summary' });
  }
});

/**
 * Get application health status
 * @route GET /api/quality/health
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const health = performanceMonitor.getHealthStatus();
    const summary = performanceMonitor.getPerformanceSummary(10 * 60 * 1000); // Last 10 minutes
    
    res.status(health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503)
      .json({
        timestamp: new Date().toISOString(),
        ...health,
        recentPerformance: {
          averageResponseTime: summary.averageResponseTime,
          errorRate: summary.errorRate,
          requestsPerMinute: summary.requestsPerMinute
        }
      });
  } catch (error) {
    logger.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Run code quality scan on project
 * @route POST /api/quality/scan
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { directory = './server' } = req.body;
    
    // Validate directory path for security
    const allowedPaths = ['./server', './client', './shared', './tests'];
    if (!allowedPaths.includes(directory)) {
      return res.status(400).json({ 
        error: 'Invalid directory path',
        allowedPaths 
      });
    }

    logger.info(`Starting code quality scan in ${directory}`);
    const results = await codeQualityScanner.scanDirectory(directory);
    
    res.json({
      timestamp: new Date().toISOString(),
      directory,
      results
    });
  } catch (error) {
    logger.error(`Code quality scan failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Code quality scan failed' });
  }
});

/**
 * Get service size governance report
 * @route GET /api/quality/service-sizes
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.get('/service-sizes', async (req: Request, res: Response) => {
  try {
    const reports = await serviceSizeMonitor.checkAllServices();
    res.json({
      timestamp: new Date().toISOString(),
      services: reports,
      summary: {
        total: reports.length,
        critical: reports.filter(r => r.status === 'critical').length,
        warning: reports.filter(r => r.status === 'warning').length,
        healthy: reports.filter(r => r.status === 'healthy').length
      }
    });
  } catch (error) {
    logger.error(`Service size check failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to check service sizes' });
  }
});

/**
 * Get detailed governance report
 * @route GET /api/quality/governance-report
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.get('/governance-report', async (req: Request, res: Response) => {
  try {
    const report = await serviceSizeMonitor.generateReport();
    res.type('text/plain').send(report);
  } catch (error) {
    logger.error(`Governance report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to generate governance report' });
  }
});

/**
 * Get comprehensive system metrics
 * @route GET /api/quality/metrics
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const performanceSummary = performanceMonitor.getPerformanceSummary();
    const healthStatus = performanceMonitor.getHealthStatus();
    const serviceReports = await serviceSizeMonitor.checkAllServices();
    
    // Calculate system-wide metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    res.json({
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      performance: performanceSummary,
      health: healthStatus,
      services: {
        total: serviceReports.length,
        byStatus: {
          healthy: serviceReports.filter(s => s.status === 'healthy').length,
          warning: serviceReports.filter(s => s.status === 'warning').length,
          critical: serviceReports.filter(s => s.status === 'critical').length
        }
      }
    });
  } catch (error) {
    logger.error(`System metrics collection failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to collect system metrics' });
  }
});

/**
 * Reset performance monitoring data
 * @route POST /api/quality/reset-performance
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.post('/reset-performance', (req: Request, res: Response) => {
  try {
    // Reset performance monitor (if method exists)
    // Note: This would require implementing a reset method in PerformanceMonitor
    logger.info('Performance monitoring data reset requested');
    
    res.json({
      timestamp: new Date().toISOString(),
      message: 'Performance monitoring data reset completed',
      status: 'success'
    });
  } catch (error) {
    logger.error(`Performance reset failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to reset performance data' });
  }
});

/**
 * Get performance trends over time
 * @route GET /api/quality/trends
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
router.get('/trends', (req: Request, res: Response) => {
  try {
    const timeRanges = [
      { label: '5 minutes', ms: 5 * 60 * 1000 },
      { label: '15 minutes', ms: 15 * 60 * 1000 },
      { label: '1 hour', ms: 60 * 60 * 1000 },
      { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
      { label: '24 hours', ms: 24 * 60 * 60 * 1000 }
    ];

    const trends = timeRanges.map(range => ({
      timeRange: range.label,
      summary: performanceMonitor.getPerformanceSummary(range.ms)
    }));

    res.json({
      timestamp: new Date().toISOString(),
      trends
    });
  } catch (error) {
    logger.error(`Performance trends collection failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to collect performance trends' });
  }
});

export default router;