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
    console.log('🔍 [ETF DIAGNOSTIC] Robust ETF endpoint called');
    console.log('🔍 [ETF DIAGNOSTIC] Request headers:', req.headers['user-agent']?.substring(0, 50));
    console.log('🔍 [ETF DIAGNOSTIC] Request timestamp:', new Date().toISOString());
    
    // Try live data first, fallback to cache if API issues
    console.log('🔍 [ETF DIAGNOSTIC] Trying live data fetch first...');
    let result;
    
    try {
      const liveDataStartTime = Date.now();
      result = await etfLiveDataService.getLiveETFMetrics();
      const liveDataDuration = Date.now() - liveDataStartTime;
      
      console.log('✅ [ETF DIAGNOSTIC] Live API call completed:', {
        duration: `${liveDataDuration}ms`,
        dataLength: result.data.length,
        hasSuccess: result.success,
        source: result.source
      });
      
      // Check if we got real data (not all zeros)
      const hasRealData = result.data.some(etf => etf.price > 0);
      
      if (!hasRealData) {
        console.error('🚨 [ETF DIAGNOSTIC] Live API returned zeros - data corruption detected:', {
          responseData: result,
          firstETF: result.data[0],
          allPricesZero: result.data.every(etf => etf.price === 0)
        });
        result = await etfCacheServiceRobust.getETFMetrics();
      }
    } catch (error) {
      console.error('❌ [ETF DIAGNOSTIC] Live API failed - capturing error details:', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      
      // Check if this is a rate limiting error
      if (error instanceof Error && error.message.includes('429')) {
        console.error('🚨 [ETF DIAGNOSTIC] RATE LIMITING DETECTED - Twelve Data API hit limits');
      } else if (error instanceof Error && error.message.includes('500')) {
        console.error('🚨 [ETF DIAGNOSTIC] SERVER ERROR DETECTED - Internal server error from API');
      }
      
      result = await etfCacheServiceRobust.getETFMetrics();
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`📊 [ETF DIAGNOSTIC] Final response: ${result.data.length} ETFs, ${responseTime}ms, source: ${result.source}`);
    
    // Additional diagnostics for production debugging
    if (result.data.length === 0) {
      console.error('🚨 [ETF DIAGNOSTIC] ZERO DATA RESPONSE - This will cause frontend error:', {
        resultSuccess: result.success,
        resultSource: result.source,
        resultError: result.error,
        responseTime: `${responseTime}ms`
      });
    }
    
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
    console.error('❌ [ETF DIAGNOSTIC] Robust ETF endpoint critical error:', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Emergency fallback response
    const responseTime = Date.now() - startTime;
    
    console.error('🚨 [ETF DIAGNOSTIC] RETURNING EMPTY DATA RESPONSE - This will trigger frontend error state');
    
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