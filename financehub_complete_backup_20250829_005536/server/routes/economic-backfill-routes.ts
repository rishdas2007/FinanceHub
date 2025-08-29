import { Router } from 'express';
import EconomicDataBackfillService from '../services/economic-data-backfill-service.js';
import pino from 'pino';

const router = Router();
const logger = pino({ name: 'EconomicBackfillRoutes' });

/**
 * POST /api/economic/backfill
 * Execute critical backfill for July-August 2025 missing economic data
 */
router.post('/backfill', async (req, res) => {
  try {
    logger.info('🚀 Starting critical economic data backfill via API request');
    
    const backfillService = new EconomicDataBackfillService();
    const results = await backfillService.runCriticalBackfill();
    
    // Update latest flags after backfill
    await backfillService.updateLatestFlags();
    
    // Generate summary report
    const report = await backfillService.generateBackfillReport();
    
    res.json({
      success: results.success,
      message: 'Economic data backfill completed',
      results: {
        indicatorsProcessed: results.indicatorsProcessed,
        recordsInserted: results.recordsInserted,
        errors: results.errors,
        hasErrors: results.errors.length > 0
      },
      report,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Critical error during economic data backfill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute economic data backfill',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic/backfill/status
 * Check current status of economic data coverage
 */
router.get('/status', async (req, res) => {
  try {
    const backfillService = new EconomicDataBackfillService();
    const report = await backfillService.generateBackfillReport();
    
    res.json({
      success: true,
      status: 'Coverage report generated',
      report,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating backfill status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate backfill status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;