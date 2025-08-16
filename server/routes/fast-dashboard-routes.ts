import { Router } from 'express';
import { fastDashboardService } from '../services/fast-dashboard-service';
import { intelligentCronScheduler } from '../services/intelligent-cron-scheduler';
import { marketHoursDetector } from '../services/market-hours-detector';
import { logger } from '../middleware/logging';

const router = Router();

// Fast dashboard data endpoint - loads all components in parallel
router.get('/fast-dashboard', async (req, res) => {
  try {
    logger.info('🚀 Fast dashboard request received');
    
    const dashboardData = await fastDashboardService.getAllDashboardData();
    
    res.json({
      success: true,
      data: dashboardData,
      loadTime: dashboardData.totalLoadTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Fast dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Momentum analysis endpoint removed to conserve API quota
// The momentum table was consuming excessive API calls for 1-day, 5-day, and 1-month changes

router.get('/fast-economic', async (req, res) => {
  try {
    const data = await fastDashboardService.getFastEconomicReadings();
    const freshness = fastDashboardService.calculateDataFreshness(data.timestamp);
    
    res.json({
      success: true,
      ...data,
      freshness
    });
    
  } catch (error) {
    logger.error('❌ Fast economic error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/fast-mood', async (req, res) => {
  try {
    const data = await fastDashboardService.getFastFinancialMood();
    const freshness = fastDashboardService.calculateDataFreshness(data.timestamp);
    
    res.json({
      success: true,
      ...data,
      freshness
    });
    
  } catch (error) {
    logger.error('❌ Fast mood error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manual refresh endpoint with rate limiting
router.post('/manual-refresh', async (req, res) => {
  try {
    logger.info('🔄 Manual refresh requested');
    
    const result = await intelligentCronScheduler.triggerManualRefresh();
    
    res.json({
      success: result.success,
      message: result.message,
      data: result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Manual refresh error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Market status endpoint
router.get('/market-status', async (req, res) => {
  try {
    const status = marketHoursDetector.getCurrentMarketStatus();
    const frequencies = marketHoursDetector.getUpdateFrequency();
    
    res.json({
      success: true,
      status,
      frequencies,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Market status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cron job status endpoint
router.get('/cron-status', async (req, res) => {
  try {
    const jobStatuses = intelligentCronScheduler.getJobStatuses();
    
    res.json({
      success: true,
      jobs: jobStatuses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Cron status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Data freshness overview
router.get('/data-freshness', async (req, res) => {
  try {
    const dashboardData = await fastDashboardService.getAllDashboardData();
    
    res.json({
      success: true,
      freshness: dashboardData.freshness,
      components: {
        momentum: {
          age: dashboardData.freshness.momentum.age,
          status: dashboardData.freshness.momentum.indicator,
          source: dashboardData.momentum.source
        },
        economic: {
          age: dashboardData.freshness.economic.age,
          status: dashboardData.freshness.economic.indicator,
          source: dashboardData.economic.source
        },
        mood: {
          age: dashboardData.freshness.mood.age,
          status: dashboardData.freshness.mood.indicator,
          source: dashboardData.mood.source
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Data freshness error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ETF Technical Metrics endpoint - Database-first approach
// Cache for last good ETF metrics data
let lastGoodETFMetrics: any[] = [];
let lastGoodETFMetricsAt = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

router.get('/etf-metrics', async (req, res) => {
  try {
    logger.info('📊 ETF metrics request - using database-first pipeline');
    const { etfMetricsService } = await import('../services/etf-metrics-service');
    
    const metrics = await etfMetricsService.getConsolidatedETFMetrics();
    const safeMetrics = Array.isArray(metrics) ? metrics : [];
    
    // Update cache on successful response
    if (safeMetrics.length > 0) {
      lastGoodETFMetrics = safeMetrics;
      lastGoodETFMetricsAt = Date.now();
    }
    
    res.json({
      success: true,
      data: safeMetrics,
      metrics: safeMetrics, // LEGACY: Backward compatibility 
      count: safeMetrics.length,
      timestamp: new Date().toISOString(),
      source: 'database-first-pipeline',
      cached: false
    });
    
  } catch (error) {
    logger.error('❌ ETF metrics database error:', error);
    
    // Try to serve cached data if available and fresh
    if (lastGoodETFMetrics.length > 0 && Date.now() - lastGoodETFMetricsAt < CACHE_DURATION) {
      logger.info('📊 Serving cached ETF metrics due to database error');
      return res.json({
        success: true,
        data: lastGoodETFMetrics,
        metrics: lastGoodETFMetrics,
        count: lastGoodETFMetrics.length,
        timestamp: new Date().toISOString(),
        source: 'cached-fallback',
        cached: true,
        warning: 'database_unavailable'
      });
    }
    
    // Return empty array with clear indication of issue
    res.json({
      success: true,
      data: [],
      metrics: [],
      count: 0,
      timestamp: new Date().toISOString(),
      source: 'fallback-empty',
      cached: false,
      warning: 'database_unavailable'
    });
  }
});

// Legacy sector ETFs endpoint - Now uses database-first approach
router.get('/sector-etfs', async (req, res) => {
  try {
    logger.info('📊 Sector ETFs request - redirecting to database-first pipeline');
    const { etfMetricsService } = await import('../services/etf-metrics-service');
    
    const metrics = await etfMetricsService.getConsolidatedETFMetrics();
    
    // Transform to legacy format for backward compatibility
    const sectorData = metrics.map(metric => ({
      symbol: metric.symbol,
      name: metric.name,
      price: metric.price,
      changePercent: metric.changePercent
    }));
    
    res.json(sectorData);
    
  } catch (error) {
    logger.error('❌ Sector ETFs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Technical indicators endpoint - Database-first
router.get('/technical-indicators', async (req, res) => {
  try {
    logger.warn('🚨 CACHE BYPASS: Technical indicators request - forcing fresh database data');
    const { etfMetricsService } = await import('../services/etf-metrics-service');
    
    const metrics = await etfMetricsService.getConsolidatedETFMetrics();
    
    // Transform to technical indicators format
    const indicators = metrics.map(metric => ({
      symbol: metric.symbol,
      rsi: metric.rsi,
      atr: metric.atr,
      bollingerPosition: metric.bollingerPosition,
      vwapSignal: metric.vwapSignal
    }));
    
    res.json({
      success: true,
      indicators,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Technical indicators error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stock history endpoint with proper window/interval handling
router.get('/stocks/:symbol/history', async (req, res) => {
  const { symbol } = req.params;
  const window = String(req.query.window || '30D').toUpperCase();
  
  try {
    console.log(`🔍 Sparkline data request: ${symbol}`);
    logger.info('📈 Fast stock history request', { symbol, window });
    
    // Import the fixed controller method
    const { ApiController } = await import('../controllers/ApiController');
    
    // Delegate to the comprehensive fixed implementation
    return await ApiController.getStockHistory(req, res);
    
  } catch (error) {
    logger.error('❌ Fast stock history error:', error);
    res.json({
      success: true,
      data: [], // Fail-soft
      warning: 'data_unavailable'
    });
  }
});

// Add route debugging for troubleshooting
router.use('*', (req, res, next) => {
  console.log(`🔍 Fast Dashboard Route: ${req.method} ${req.originalUrl}`);
  next();
});

export default router;