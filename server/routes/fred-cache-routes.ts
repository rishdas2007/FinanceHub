import { Router } from 'express';
import { fredCacheStrategy } from '../services/fred-cache-strategy';
import { fredDatabaseCache } from '../services/fred-database-cache';
import { fredCacheScheduler } from '../services/fred-cache-scheduler';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /api/fred-cache/statistics
 * Get comprehensive cache statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const [memoryStats, dbStats] = await Promise.all([
      fredCacheStrategy.getCacheStatistics(),
      fredDatabaseCache.getCacheStatistics()
    ]);
    
    const combinedStats = {
      memory_cache: memoryStats,
      database_cache: dbStats,
      efficiency: {
        estimated_api_calls_saved: memoryStats.api_calls_saved,
        cache_hit_rate: memoryStats.cache_hit_rate,
        daily_api_reduction: `${288 - 24} calls saved (from 288 to 24)`
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: combinedStats
    });
    
  } catch (error) {
    logger.error('Failed to get FRED cache statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/fred-cache/refresh
 * Trigger batch refresh of all FRED indicators
 */
router.post('/refresh', async (req, res) => {
  try {
    logger.info('🔄 Manual FRED cache refresh requested...');
    
    const result = await fredCacheStrategy.batchRefreshAllIndicators();
    
    res.json({
      success: result.success,
      message: `Refreshed ${result.refreshed.length} indicators, ${result.failed.length} failed`,
      data: {
        refreshed: result.refreshed,
        failed: result.failed,
        total_api_calls: result.totalApiCalls,
        estimated_time: `${Math.ceil(result.totalApiCalls * 0.5)} seconds`
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to refresh FRED cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh FRED cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/fred-cache/cleanup
 * Clean up expired cache entries
 */
router.post('/cleanup', async (req, res) => {
  try {
    const result = await fredDatabaseCache.cleanupExpiredEntries();
    
    const totalCleaned = result.current + result.historical + result.yoy;
    
    res.json({
      success: true,
      message: `Cleaned up ${totalCleaned} expired cache entries`,
      data: {
        current_readings: result.current,
        historical_series: result.historical,
        yoy_calculations: result.yoy,
        total_cleaned: totalCleaned
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to cleanup FRED cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/fred-cache/indicator/:id
 * Get cached data for specific indicator
 */
router.get('/indicator/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [current, historical, yoy] = await Promise.all([
      fredCacheStrategy.getCurrentReading(id),
      fredCacheStrategy.getHistoricalSeries(id),
      fredCacheStrategy.getYoYCalculation(id)
    ]);
    
    res.json({
      success: true,
      data: {
        indicator_id: id,
        current_reading: current,
        historical_series: historical,
        yoy_calculation: yoy,
        cache_status: {
          current_cached: !!current,
          historical_cached: !!historical,
          yoy_cached: !!yoy
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Failed to get cached data for indicator ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get indicator cache data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/fred-cache/indicator/:id
 * Invalidate cache for specific indicator
 */
router.delete('/indicator/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await fredCacheStrategy.invalidateCurrentReading(id);
    
    res.json({
      success: true,
      message: `Cache invalidated for indicator ${id}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Failed to invalidate cache for indicator ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate indicator cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/fred-cache/scheduler/status
 * Get scheduler status and job information
 */
router.get('/scheduler/status', async (req, res) => {
  try {
    const status = fredCacheScheduler.getSchedulerStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/fred-cache/scheduler/trigger/:jobName
 * Manually trigger a specific scheduled job
 */
router.post('/scheduler/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    const success = await fredCacheScheduler.triggerJob(jobName);
    
    res.json({
      success,
      message: success ? `Job ${jobName} executed successfully` : `Job ${jobName} failed or not found`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Failed to trigger job ${req.params.jobName}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger scheduled job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as fredCacheRoutes };