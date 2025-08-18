import { Router } from 'express';
import { logger } from '../../shared/utils/logger';
import { fredApiServiceIncremental } from '../services/fred-api-service-incremental';
import { fredSchedulerIncremental } from '../services/fred-scheduler-incremental';
import { economicDataStorageIncremental } from '../services/economic-data-storage-incremental';

const router = Router();

/**
 * GET /api/fred-incremental/health
 * Health check for FRED incremental system
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await fredSchedulerIncremental.getHealthCheck();
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      health: healthCheck
    });
  } catch (error) {
    logger.error('FRED health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

/**
 * POST /api/fred-incremental/update
 * Trigger manual FRED incremental update
 */
router.post('/update', async (req, res) => {
  try {
    logger.info('🔄 Manual FRED incremental update requested via API');
    
    const result = await fredSchedulerIncremental.executeManualUpdate();
    
    if (result.success) {
      logger.info(`✅ Manual FRED update completed: ${result.newDataPoints} new data points`);
      res.json({
        status: 'success',
        message: result.message,
        data: {
          sessionId: result.sessionId,
          newDataPoints: result.newDataPoints,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      logger.error(`❌ Manual FRED update failed: ${result.message}`);
      res.status(400).json({
        status: 'error',
        message: result.message,
        data: {
          sessionId: result.sessionId,
          newDataPoints: 0
        }
      });
    }
  } catch (error) {
    logger.error('Manual FRED update failed:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Update failed'
    });
  }
});

/**
 * GET /api/fred-incremental/status
 * Get current scheduler status and configuration
 */
router.get('/status', async (req, res) => {
  try {
    const status = fredSchedulerIncremental.getStatus();
    const config = fredSchedulerIncremental.getConfig();
    const apiUsage = fredApiServiceIncremental.getApiUsage();
    
    res.json({
      status: 'success',
      data: {
        scheduler: status,
        config: config,
        apiUsage: apiUsage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get FRED status:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
});

/**
 * GET /api/fred-incremental/series
 * Get information about tracked series
 */
router.get('/series', async (req, res) => {
  try {
    const allSeriesIds = await economicDataStorageIncremental.getAllSeriesIds();
    const seriesInfo = await Promise.all(
      allSeriesIds.map(async (seriesId) => {
        const recordCount = await economicDataStorageIncremental.getSeriesRecordCount(seriesId);
        const latestDate = await economicDataStorageIncremental.getLatestPeriodDate(seriesId);
        return {
          seriesId,
          recordCount,
          latestDate
        };
      })
    );
    
    res.json({
      status: 'success',
      data: {
        totalSeries: allSeriesIds.length,
        series: seriesInfo,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get series information:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get series information'
    });
  }
});

/**
 * GET /api/fred-incremental/session/:sessionId
 * Get detailed information about a specific update session
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required'
      });
    }
    
    const summary = await economicDataStorageIncremental.getSessionSummary(sessionId);
    
    res.json({
      status: 'success',
      data: {
        sessionId,
        summary,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Failed to get session ${req.params.sessionId} information:`, error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get session information'
    });
  }
});

/**
 * POST /api/fred-incremental/config
 * Update scheduler configuration
 */
router.post('/config', async (req, res) => {
  try {
    const { enabled, intervalHours, maxRetries, retryDelayMinutes, runOnStartup } = req.body;
    
    interface FredConfig {
      enabled?: boolean;
      intervalHours?: number;
      maxRetries?: number;
      retryDelayMinutes?: number;
      runOnStartup?: boolean;
    }
    
    const newConfig: FredConfig = {};
    if (typeof enabled === 'boolean') newConfig.enabled = enabled;
    if (typeof intervalHours === 'number' && intervalHours > 0) newConfig.intervalHours = intervalHours;
    if (typeof maxRetries === 'number' && maxRetries > 0) newConfig.maxRetries = maxRetries;
    if (typeof retryDelayMinutes === 'number' && retryDelayMinutes > 0) newConfig.retryDelayMinutes = retryDelayMinutes;
    if (typeof runOnStartup === 'boolean') newConfig.runOnStartup = runOnStartup;
    
    fredSchedulerIncremental.updateConfig(newConfig);
    
    logger.info(`FRED scheduler configuration updated via API:`, newConfig);
    
    res.json({
      status: 'success',
      message: 'Configuration updated successfully',
      data: {
        updatedConfig: fredSchedulerIncremental.getConfig(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to update FRED configuration:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update configuration'
    });
  }
});

/**
 * GET /api/fred-incremental/database-stats
 * Get comprehensive database statistics
 */
router.get('/database-stats', async (req, res) => {
  try {
    const allSeriesIds = await economicDataStorageIncremental.getAllSeriesIds();
    const lastUpdate = await economicDataStorageIncremental.getLastUpdateTimestamp();
    
    // Get record counts by category
    const seriesStats = await Promise.all(
      allSeriesIds.map(async (seriesId) => {
        const recordCount = await economicDataStorageIncremental.getSeriesRecordCount(seriesId);
        const latestDate = await economicDataStorageIncremental.getLatestPeriodDate(seriesId);
        return { seriesId, recordCount, latestDate };
      })
    );
    
    const totalRecords = seriesStats.reduce((sum, s) => sum + s.recordCount, 0);
    
    res.json({
      status: 'success',
      data: {
        totalSeries: allSeriesIds.length,
        totalRecords: totalRecords,
        lastGlobalUpdate: lastUpdate,
        seriesBreakdown: seriesStats,
        averageRecordsPerSeries: Math.round(totalRecords / allSeriesIds.length),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get database statistics:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to get database statistics'
    });
  }
});

export default router;