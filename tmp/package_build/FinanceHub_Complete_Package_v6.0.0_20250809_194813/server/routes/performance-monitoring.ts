import { Router } from 'express';
import { performanceOptimizer } from '../utils/performance-optimizer';
import { resourceManager } from '../utils/resource-manager';
import { logger } from '../utils/logger';

const router = Router();

// Performance metrics endpoint
router.get('/performance-metrics', (req, res) => {
  try {
    const performanceReport = performanceOptimizer.getPerformanceReport();
    const resourceStatus = resourceManager.getResourceStatus();
    const systemMetrics = performanceOptimizer.getSystemMetrics();
    
    const memoryMB = systemMetrics.memoryUsage.heapUsed / 1024 / 1024;
    const rssMB = systemMetrics.memoryUsage.rss / 1024 / 1024;
    
    const response = {
      timestamp: new Date().toISOString(),
      performance: {
        memory: {
          heapUsed: `${memoryMB.toFixed(0)}MB`,
          rss: `${rssMB.toFixed(0)}MB`,
          external: `${(systemMetrics.memoryUsage.external / 1024 / 1024).toFixed(0)}MB`,
          arrayBuffers: `${(systemMetrics.memoryUsage.arrayBuffers / 1024 / 1024).toFixed(0)}MB`
        },
        loadAverage: {
          '1min': systemMetrics.loadAverage[0]?.toFixed(2) || '0.00',
          '5min': systemMetrics.loadAverage[1]?.toFixed(2) || '0.00', 
          '15min': systemMetrics.loadAverage[2]?.toFixed(2) || '0.00'
        },
        uptime: `${(systemMetrics.uptime / 3600).toFixed(1)}h`,
        alerts: performanceReport.alerts
      },
      resources: {
        activeRequests: resourceStatus.activeRequests,
        queuedRequests: resourceStatus.queuedRequests,
        memoryUsage: resourceStatus.memoryUsageMB,
        memoryLimit: resourceStatus.memoryLimitMB,
        isHighLoadMode: resourceStatus.isHighLoadMode,
        canAcceptRequests: resourceStatus.canAcceptRequests
      },
      recommendations: generateRecommendations(performanceReport, resourceStatus)
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Traffic analysis endpoint
router.get('/traffic-analysis', async (req, res) => {
  try {
    // This would integrate with your database to analyze traffic patterns
    const trafficAnalysis = {
      current: {
        activeConnections: resourceManager.getResourceStatus().activeRequests,
        queueSize: resourceManager.getResourceStatus().queuedRequests
      },
      recommendations: [
        'Implement Redis caching for high-traffic endpoints',
        'Enable CDN for static assets',
        'Consider horizontal scaling if traffic exceeds capacity',
        'Monitor database connection pool usage'
      ]
    };
    
    res.json(trafficAnalysis);
  } catch (error) {
    logger.error('Error analyzing traffic:', error);
    res.status(500).json({ error: 'Failed to analyze traffic' });
  }
});

// Health check with performance data
router.get('/health-detailed', (req, res) => {
  try {
    const metrics = performanceOptimizer.getSystemMetrics();
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    const loadAvg = metrics.loadAverage[0] || 0;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${(metrics.uptime / 3600).toFixed(1)}h`,
      memory: `${memoryMB.toFixed(0)}MB`,
      loadAverage: loadAvg.toFixed(2),
      performance: {
        memory: memoryMB < 1024 ? 'good' : memoryMB < 2048 ? 'warning' : 'critical',
        load: loadAvg < 2.0 ? 'good' : loadAvg < 4.0 ? 'warning' : 'critical'
      }
    };
    
    // Set status based on performance
    if (memoryMB > 2048 || loadAvg > 6.0) {
      health.status = 'critical';
      res.status(503);
    } else if (memoryMB > 1024 || loadAvg > 4.0) {
      health.status = 'degraded';
    }
    
    res.json(health);
  } catch (error) {
    logger.error('Error in detailed health check:', error);
    res.status(500).json({ 
      status: 'error', 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Force optimization endpoint (admin use)
router.post('/optimize', (req, res) => {
  try {
    // Trigger immediate optimization
    resourceManager.performMaintenance();
    
    if (global.gc) {
      global.gc();
    }
    
    logger.info('🚀 Manual optimization triggered');
    
    res.json({
      success: true,
      message: 'Optimization executed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error during manual optimization:', error);
    res.status(500).json({ error: 'Optimization failed' });
  }
});

function generateRecommendations(performanceReport: any, resourceStatus: any): string[] {
  const recommendations: string[] = [];
  
  if (performanceReport.alerts.length > 0) {
    recommendations.push('Address performance alerts immediately');
  }
  
  if (resourceStatus.queuedRequests > 10) {
    recommendations.push('High request queue - consider scaling');
  }
  
  if (parseFloat(resourceStatus.memoryUsageMB) > 1500) {
    recommendations.push('High memory usage - monitor for memory leaks');
  }
  
  if (!resourceStatus.canAcceptRequests) {
    recommendations.push('System at capacity - enable high load mode');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System performance is optimal');
  }
  
  return recommendations;
}

export { router as performanceMonitoringRoutes };