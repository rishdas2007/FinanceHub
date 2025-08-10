import { Router } from 'express';
import { logger } from '../utils/logger';
import { OptimizedBackfillOrchestrator } from '../scripts/execute-optimized-backfill';

const backfillRoutes = Router();

/**
 * POST /api/backfill/execute
 * Execute optimized dual-API backfill operation
 */
backfillRoutes.post('/execute', async (req, res) => {
  try {
    const {
      symbols = [
        'SPY', 'QQQ', 'IWM',  // Market indices
        'XLF', 'XLK', 'XLV', 'XLE', // Core sectors
        'XLI', 'XLY', 'XLP', 'XLB', 'XLRE', 'XLU', 'XLC' // Remaining sectors
      ],
      yearsBack = 2,
      parallelExecution = true,
      aggressiveRates = true
    } = req.body;

    logger.info('🚀 Starting optimized backfill via API', {
      symbols: symbols.length,
      yearsBack,
      parallelExecution,
      aggressiveRates
    });

    const orchestrator = new OptimizedBackfillOrchestrator();
    
    const config = {
      equitySymbols: symbols,
      economicIndicators: [
        'GDP', 'INDPRO', 'RSAFS', 'UNRATE', 'PAYEMS', 'ICSA',
        'CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE',
        'FEDFUNDS', 'DGS10', 'T10Y2Y', 'HOUST', 'UMCSENT'
      ],
      yearsBack,
      parallelExecution,
      aggressiveRates
    };

    // Execute backfill operation
    const results = await orchestrator.executeOptimizedBackfill(config);

    logger.info('✅ Backfill completed successfully via API', {
      totalDurationMinutes: Math.round(results.totalDuration / 1000 / 60),
      efficiency: `${Math.round(results.efficiency)}%`,
      equityRecords: results.equityResults.recordsAdded,
      economicRecords: results.economicResults.recordsAdded
    });

    res.json({
      success: true,
      data: {
        results,
        summary: {
          totalRecords: results.equityResults.recordsAdded + results.economicResults.recordsAdded,
          totalCalls: results.equityResults.totalCalls + results.economicResults.totalCalls,
          durationMinutes: Math.round(results.totalDuration / 1000 / 60),
          efficiency: Math.round(results.efficiency)
        }
      }
    });

  } catch (error) {
    logger.error('❌ Backfill execution failed via API', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Backfill execution failed',
      details: error.message
    });
  }
});

/**
 * GET /api/backfill/status
 * Get current backfill status and progress
 */
backfillRoutes.get('/status', async (req, res) => {
  try {
    // Return current backfill status (this would be enhanced with actual status tracking)
    res.json({
      success: true,
      data: {
        isRunning: false,
        lastExecution: null,
        progress: 0,
        status: 'ready'
      }
    });
  } catch (error) {
    logger.error('❌ Failed to get backfill status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get backfill status'
    });
  }
});

export { backfillRoutes };