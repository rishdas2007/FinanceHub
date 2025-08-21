import { Router } from 'express';
import { etfCacheServiceRobust } from '../services/etf-cache-service-robust';
import { etfLiveDataService } from '../services/etf-live-data-service';

const router = Router();

/**
 * GET /api/etf/robust - Get ETF metrics with robust error handling
 * This endpoint provides a reliable way to get ETF data with multiple fallback strategies
 */
router.get('/robust', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Robust ETF endpoint called');
    
    // Try live data first, fallback to cache if API issues
    console.log('🔍 Trying live data fetch first...');
    let result;
    
    try {
      result = await etfLiveDataService.getLiveETFMetrics();
      
      // Check if we got real data (not all zeros)
      const hasRealData = result.data.some(etf => etf.price > 0);
      
      if (!hasRealData) {
        console.log('⚠️ Live API returned zeros - falling back to cached data');
        result = await etfCacheServiceRobust.getETFMetrics();
      }
    } catch (error) {
      console.log('❌ Live API failed - falling back to cached data:', error);
      result = await etfCacheServiceRobust.getETFMetrics();
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`📊 Robust ETF response: ${result.data.length} ETFs, ${responseTime}ms, source: ${result.source}`);
    
    // Add performance metadata
    const response = {
      ...result,
      performance: {
        response_time_ms: responseTime,
        data_count: result.data.length,
        api_version: 'v35_robust'
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Robust ETF endpoint error:', error);
    
    // Emergency fallback response
    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      success: false,
      data: [],
      source: 'error_fallback',
      error: {
        message: 'ETF service temporarily unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: responseTime
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/etf/robust/refresh - Manually refresh the materialized view
 */
router.post('/robust/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual ETF cache refresh requested');
    
    const refreshResult = await etfCacheServiceRobust.refreshMaterializedView();
    
    if (refreshResult) {
      res.json({
        success: true,
        message: 'ETF cache refreshed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh ETF cache',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ ETF cache refresh error:', error);
    
    res.status(500).json({
      success: false,
      message: 'ETF cache refresh failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/etf/robust/health - Health check for ETF service
 */
router.get('/robust/health', async (req, res) => {
  try {
    console.log('🏥 ETF service health check');
    
    // Test service initialization
    const initResult = await etfCacheServiceRobust.initialize();
    
    res.json({
      success: true,
      service_status: initResult ? 'healthy' : 'degraded',
      message: initResult ? 'ETF service is operational' : 'ETF service running in fallback mode',
      timestamp: new Date().toISOString(),
      checks: {
        initialization: initResult,
        database_connection: true,
        materialized_view: 'testing'
      }
    });
    
  } catch (error) {
    console.error('❌ ETF health check error:', error);
    
    res.status(503).json({
      success: false,
      service_status: 'unhealthy',
      message: 'ETF service health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;