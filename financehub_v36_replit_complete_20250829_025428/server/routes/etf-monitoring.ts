import { Router } from 'express';
import { etfCacheMonitoring } from '../services/etf-cache-monitoring';

const router = Router();

/**
 * GET /api/etf/monitoring - Get ETF cache monitoring metrics
 */
router.get('/monitoring', async (req, res) => {
  try {
    console.log('📊 ETF monitoring metrics requested');
    
    const metrics = await etfCacheMonitoring.getMonitoringMetrics();
    const performanceReport = etfCacheMonitoring.getPerformanceReport();
    
    res.json({
      success: true,
      metrics,
      performance: performanceReport,
      timestamp: new Date().toISOString(),
      version: 'v35_robust'
    });
    
  } catch (error) {
    console.error('❌ ETF monitoring error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get monitoring metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/etf/monitoring/reset - Reset monitoring metrics
 */
router.post('/monitoring/reset', (req, res) => {
  try {
    etfCacheMonitoring.resetMetrics();
    
    res.json({
      success: true,
      message: 'ETF monitoring metrics reset successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ETF monitoring reset error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to reset monitoring metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;