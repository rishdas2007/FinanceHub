import { Router } from 'express';
import { etfCacheService } from '../services/etf-cache-service-clean';

const router = Router();

/**
 * GET /api/etf/cached - Get cached ETF technical metrics
 * Returns ETF metrics with 5-minute caching for optimal performance
 */
router.get('/cached', async (req, res) => {
  try {
    const startTime = Date.now();
    const result = await etfCacheService.getETFMetrics();
    
    // Add response timing
    result.cache_stats.response_time_ms = Date.now() - startTime;
    
    res.json(result);
    
    console.log(`📊 ETF cached endpoint served in ${result.cache_stats.response_time_ms}ms (source: ${result.source})`);
    
  } catch (error) {
    console.error('❌ ETF cached endpoint error:', error);
    
    res.status(500).json({
      success: false,
      data: [],
      source: 'error',
      cache_stats: {
        hit: false,
        age_seconds: 0,
        next_refresh_in: 0,
        response_time_ms: Date.now() - parseInt(req.headers['x-request-start'] as string || '0'),
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/etf/cached/stats - Get cache performance statistics
 */
router.get('/cached/stats', async (req, res) => {
  try {
    const stats = etfCacheService.getCacheStats();
    
    res.json({
      success: true,
      cache_statistics: stats,
      server_info: {
        cache_ttl_minutes: 5,
        cache_type: 'memory + materialized_view',
        refresh_strategy: 'background_cron',
        fallback_strategy: 'twelve_data_api'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ETF cache stats error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/etf/cached/clear - Clear memory cache (admin function)
 */
router.post('/cached/clear', async (req, res) => {
  try {
    etfCacheService.clearMemoryCache();
    
    res.json({
      success: true,
      message: 'ETF memory cache cleared successfully',
      timestamp: new Date().toISOString()
    });
    
    console.log('🧹 ETF memory cache cleared via API');
    
  } catch (error) {
    console.error('❌ ETF cache clear error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;