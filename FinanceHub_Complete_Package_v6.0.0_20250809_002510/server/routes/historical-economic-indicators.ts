import { Router } from 'express';
import { historicalEconomicIndicatorsService } from '../services/historical-economic-indicators';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/historical-economic-indicators/update
 * Manually trigger FRED data update for all indicators
 */
router.post('/update', async (req, res) => {
  try {
    logger.info('🔄 Manual FRED historical data update requested...');
    
    const result = await historicalEconomicIndicatorsService.updateAllIndicators();
    
    res.json({
      success: result.success,
      message: result.message,
      updatedCount: result.updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Manual FRED update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Manual FRED update failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/historical-economic-indicators/summary
 * Get summary of historical data available
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await historicalEconomicIndicatorsService.getHistoricalDataSummary();
    
    res.json({
      success: true,
      data: summary,
      totalIndicators: summary.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get historical summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get historical data summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/historical-economic-indicators/enhanced
 * Get enhanced indicators with historical context
 */
router.get('/enhanced', async (req, res) => {
  try {
    const indicators = await historicalEconomicIndicatorsService.getIndicatorsWithHistoricalContext();
    
    res.json({
      success: true,
      data: indicators,
      count: indicators.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get enhanced indicators:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get enhanced economic indicators',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as historicalEconomicIndicatorsRoutes };