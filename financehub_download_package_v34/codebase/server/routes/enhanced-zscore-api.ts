import { Router } from 'express';
import { enhancedZScoreService } from '../services/enhanced-zscore-service';
import { zScorePerformanceMonitor } from '../services/zscore-performance-monitor';
import { parallelZScoreProcessor } from '../services/parallel-zscore-processor';
import { optimizedDbPool } from '../services/optimized-db-pool';
import { logger } from '../middleware/logging';

const router = Router();

/**
 * Enhanced Z-Score API Routes with advanced optimizations
 */

// Initialize enhanced z-score service
router.get('/initialize', async (req, res) => {
  try {
    await enhancedZScoreService.initialize();
    
    res.json({
      success: true,
      message: 'Enhanced Z-Score Service initialized successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('💥 Enhanced Z-Score Service initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service initialization failed',
      message: (error as Error).message
    });
  }
});

// Calculate enhanced z-score for single symbol
router.get('/calculate/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { 
      useCache = 'true',
      useParallel = 'false', 
      vixLevel = '20' 
    } = req.query;

    const options = {
      useCache: useCache === 'true',
      useParallel: useParallel === 'true',
      vixLevel: parseInt(vixLevel as string) || 20
    };

    const result = await enhancedZScoreService.calculateEnhancedZScore(symbol, options);

    res.json({
      success: true,
      symbol,
      data: result,
      options,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`💥 Enhanced z-score calculation failed for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Z-score calculation failed',
      message: (error as Error).message
    });
  }
});

// Batch calculate z-scores for multiple symbols
router.post('/batch', async (req, res) => {
  try {
    const { symbols, vixLevel = 20 } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'symbols array is required'
      });
    }

    const startTime = Date.now();
    const results = await enhancedZScoreService.calculateBatchZScores(symbols, { vixLevel });
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      totalSymbols: symbols.length,
      processedSymbols: results.size,
      processingTime: `${duration}ms`,
      data: Object.fromEntries(results),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Batch z-score calculation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Batch calculation failed',
      message: (error as Error).message
    });
  }
});

// Get performance report
router.get('/performance', async (req, res) => {
  try {
    const report = enhancedZScoreService.getPerformanceReport();

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Performance report generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Performance report failed',
      message: (error as Error).message
    });
  }
});

// Get performance metrics for specific symbol
router.get('/performance/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const metrics = zScorePerformanceMonitor.getSymbolMetrics(symbol);

    res.json({
      success: true,
      symbol,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`💥 Symbol performance metrics failed for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Symbol metrics failed',
      message: (error as Error).message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await enhancedZScoreService.healthCheck();
    const status = isHealthy ? 200 : 503;

    res.status(status).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      components: {
        enhancedZScoreService: isHealthy,
        database: await optimizedDbPool.healthCheck(),
        performanceMonitor: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      message: (error as Error).message
    });
  }
});

// Refresh materialized view for z-score data
router.post('/refresh-view', async (req, res) => {
  try {
    const startTime = Date.now();
    await optimizedDbPool.refreshZScoreView();
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Z-score materialized view refreshed successfully',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Materialized view refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'View refresh failed',
      message: (error as Error).message
    });
  }
});

// Get parallel processor statistics
router.get('/parallel-stats', async (req, res) => {
  try {
    const stats = parallelZScoreProcessor.getPerformanceStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Parallel processor stats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Parallel stats failed',
      message: (error as Error).message
    });
  }
});

// Export complete performance metrics
router.get('/export-metrics', async (req, res) => {
  try {
    const metrics = zScorePerformanceMonitor.exportMetrics();

    res.json({
      success: true,
      data: metrics,
      exportedAt: new Date().toISOString(),
      note: 'Complete performance metrics export for analysis'
    });

  } catch (error) {
    logger.error('💥 Metrics export failed:', error);
    res.status(500).json({
      success: false,
      error: 'Metrics export failed',
      message: (error as Error).message
    });
  }
});

// Manual circuit breaker reset (administrative)
router.post('/reset-circuit-breaker', async (req, res) => {
  try {
    const { zScoreCalculationCircuitBreaker } = await import('../services/zscore-circuit-breaker');
    zScoreCalculationCircuitBreaker.manualReset();

    res.json({
      success: true,
      message: 'Circuit breaker reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Circuit breaker reset failed:', error);
    res.status(500).json({
      success: false,
      error: 'Circuit breaker reset failed',
      message: (error as Error).message
    });
  }
});

// Reset performance metrics (for testing/maintenance)
router.post('/reset-metrics', async (req, res) => {
  try {
    zScorePerformanceMonitor.resetMetrics();

    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('💥 Metrics reset failed:', error);
    res.status(500).json({
      success: false,
      error: 'Metrics reset failed',
      message: (error as Error).message
    });
  }
});

export default router;