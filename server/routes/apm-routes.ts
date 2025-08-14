// APM monitoring routes for performance analytics
// Provides endpoints for monitoring application performance

import { Router } from 'express';
import { apmService } from '../middleware/apm-monitoring.js';
import { smartCompression } from '../middleware/smart-compression.js';
import { poolManager } from '../utils/object-pool.js';

const router = Router();

// Get overall performance statistics
router.get('/stats', (req, res) => {
  try {
    const performanceStats = apmService.getPerformanceStats();
    const compressionStats = smartCompression.getCompressionStats();
    const poolStats = poolManager.getTotalStats();

    res.json({
      success: true,
      data: {
        performance: performanceStats,
        compression: compressionStats,
        objectPools: poolStats,
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get APM statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get detailed endpoint performance breakdown
router.get('/endpoints', (req, res) => {
  try {
    const endpointBreakdown = apmService.getEndpointBreakdown();
    
    res.json({
      success: true,
      data: endpointBreakdown,
      summary: {
        totalEndpoints: endpointBreakdown.length,
        slowestEndpoint: endpointBreakdown[0]?.endpoint || 'None',
        fastestEndpoint: endpointBreakdown[endpointBreakdown.length - 1]?.endpoint || 'None'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get endpoint breakdown',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get compression performance details
router.get('/compression', (req, res) => {
  try {
    const compressionStats = smartCompression.getCompressionStats();
    
    res.json({
      success: true,
      data: compressionStats,
      recommendations: generateCompressionRecommendations(compressionStats),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get compression statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get object pool performance details
router.get('/pools', (req, res) => {
  try {
    const poolStats = poolManager.getPoolStats();
    const totalStats = poolManager.getTotalStats();
    
    res.json({
      success: true,
      data: {
        individual: poolStats,
        total: totalStats,
        recommendations: generatePoolRecommendations(poolStats)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get pool statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint with performance insights
router.get('/health', (req, res) => {
  try {
    const performanceStats = apmService.getPerformanceStats();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Determine health status
    const isHealthy = 
      performanceStats.errorRate < 0.05 && // Less than 5% error rate
      performanceStats.averageResponseTime < 1000 && // Less than 1 second average
      memoryUsage.heapUsed < 500 * 1024 * 1024; // Less than 500MB heap

    const healthStatus = isHealthy ? 'healthy' : 'degraded';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: healthStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        errorRate: {
          status: performanceStats.errorRate < 0.05 ? 'pass' : 'fail',
          value: performanceStats.errorRate,
          threshold: 0.05
        },
        responseTime: {
          status: performanceStats.averageResponseTime < 1000 ? 'pass' : 'fail',
          value: performanceStats.averageResponseTime,
          threshold: 1000
        },
        memoryUsage: {
          status: memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'pass' : 'fail',
          value: memoryUsage.heapUsed,
          threshold: 500 * 1024 * 1024
        }
      },
      metrics: {
        activeRequests: performanceStats.activeRequests,
        totalRequests: performanceStats.totalRequests,
        recentAlerts: performanceStats.recentAlerts.slice(-3)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Reset performance counters (admin endpoint)
router.post('/reset', (req, res) => {
  try {
    apmService.reset();
    smartCompression.resetStats();
    poolManager.clearAllPools();

    res.json({
      success: true,
      message: 'APM counters reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset APM counters',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate compression recommendations
function generateCompressionRecommendations(stats: any): string[] {
  const recommendations: string[] = [];

  const compressionRate = parseFloat(stats.compressionRate);
  if (compressionRate < 50) {
    recommendations.push('Consider increasing compression level for better bandwidth savings');
  }

  const avgTime = parseFloat(stats.avgCompressionTime);
  if (avgTime > 50) {
    recommendations.push('Compression time is high - consider lowering compression level');
  }

  if (stats.totalRequests > 100 && compressionRate < 30) {
    recommendations.push('Low compression rate detected - review compression filters');
  }

  if (recommendations.length === 0) {
    recommendations.push('Compression performance is optimal');
  }

  return recommendations;
}

// Generate object pool recommendations
function generatePoolRecommendations(poolStats: any): string[] {
  const recommendations: string[] = [];

  Object.entries(poolStats).forEach(([poolName, stats]: [string, any]) => {
    const hitRate = parseFloat(stats.hitRate);
    
    if (hitRate < 60) {
      recommendations.push(`${poolName} pool has low hit rate (${stats.hitRate}) - consider increasing pool size`);
    }

    if (stats.active > stats.maxSize * 0.8) {
      recommendations.push(`${poolName} pool is near capacity - consider increasing max size`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('All object pools are performing optimally');
  }

  return recommendations;
}

export { router as apmRoutes };