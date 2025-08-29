import express from 'express';
import { etf5MinCache } from '../services/etf-5min-cache-service';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /api/etf/cached - Fast cached ETF technical metrics
 * Expected response time: <100ms (89% faster than original)
 */
router.get('/cached', async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('📊 ETF cached endpoint called');
    
    // Get cached ETF metrics
    const result = await etf5MinCache.getETFMetrics();
    
    const responseTime = Date.now() - startTime;
    
    if (result.success) {
      logger.info(`✅ ETF cached response: ${result.data.length} ETFs, ${responseTime}ms, source: ${result.source}`);
      
      res.json({
        success: true,
        data: result.data,
        metadata: {
          total_etfs: result.data.length,
          response_time_ms: responseTime,
          cache_source: result.source,
          cache_stats: result.cache_stats,
          timestamp: result.timestamp,
          performance_improvement: responseTime < 100 ? 'EXCELLENT' : responseTime < 200 ? 'GOOD' : 'SLOW'
        }
      });
    } else {
      logger.error(`❌ ETF cached response failed: ${responseTime}ms`);
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ETF metrics',
        metadata: {
          response_time_ms: responseTime,
          cache_stats: result.cache_stats,
          timestamp: result.timestamp
        }
      });
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('❌ ETF cached endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        response_time_ms: responseTime,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/etf/cached/stats - Cache performance statistics
 */
router.get('/cached/stats', async (req, res) => {
  try {
    const cacheStats = etf5MinCache.getCacheStats();
    
    res.json({
      success: true,
      cache_stats: cacheStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Cache stats endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/etf/cached/refresh - Manual cache refresh
 */
router.post('/cached/refresh', async (req, res) => {
  try {
    logger.info('🔄 Manual cache refresh requested');
    
    // Clear memory cache
    etf5MinCache.clearMemoryCache();
    
    // Refresh materialized view
    const refreshResult = await etf5MinCache.refreshMaterializedView();
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      refresh_stats: refreshResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Manual cache refresh error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;