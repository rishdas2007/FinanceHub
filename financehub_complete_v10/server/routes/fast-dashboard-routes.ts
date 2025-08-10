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
router.get('/etf-metrics', async (req, res) => {
  try {
    logger.info('📊 ETF metrics request - using database-first pipeline');
    const { etfMetricsService } = await import('../services/etf-metrics-service');
    
    const metrics = await etfMetricsService.getConsolidatedETFMetrics();
    
    res.json({
      success: true,
      data: metrics, // PRIMARY: Universal client unwrapping compatibility
      metrics, // LEGACY: Backward compatibility 
      count: metrics.length,
      timestamp: new Date().toISOString(),
      source: 'database-first-pipeline'
    });
    
  } catch (error) {
    logger.error('❌ ETF metrics error:', error);
    res.status(500).json({
      success: false,
      data: [], // Always provide empty array for client consistency
      error: error instanceof Error ? error.message : 'Unknown error'
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
    logger.info('📊 Technical indicators request - using database');
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

// Add route debugging for troubleshooting
router.use('*', (req, res, next) => {
  console.log(`🔍 Fast Dashboard Route: ${req.method} ${req.originalUrl}`);
  next();
});

export default router;