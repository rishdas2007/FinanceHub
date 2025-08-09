import { Router } from 'express';
import { logger } from '../middleware/logging';
import { economicDeltaCalculator } from '../services/economic-delta-calculator';
import { optimizedFredScheduler } from '../services/optimized-fred-scheduler';

const router = Router();

/**
 * Economic Data Recovery API
 * Addresses missing historical data and delta calculations
 */

// Get assessment of missing economic data
router.get('/assess-missing-data', async (req, res) => {
  try {
    logger.info('🔍 Assessing missing economic data status');

    const [deltaStatus, fredStatus] = await Promise.all([
      economicDeltaCalculator.getProcessingStatus(),
      optimizedFredScheduler.assessMissingData()
    ]);

    const summary = {
      timestamp: new Date(),
      deltaCalculations: {
        processed: deltaStatus.filter((s: any) => s.processedRecords > 0).length,
        needsProcessing: deltaStatus.filter((s: any) => s.needsProcessing).length,
        total: deltaStatus.length,
        details: deltaStatus
      },
      historicalData: {
        adequate: fredStatus.filter(s => s.currentRecords >= s.targetRecords * 0.8).length,
        insufficient: fredStatus.filter(s => s.currentRecords < s.targetRecords * 0.5).length,
        total: fredStatus.length,
        details: fredStatus
      }
    };

    res.json({
      success: true,
      assessment: summary,
      recommendations: {
        immediate: summary.deltaCalculations.needsProcessing > 0 
          ? 'Process delta calculations for existing raw data'
          : 'Delta calculations up to date',
        mediumTerm: summary.historicalData.insufficient > 0
          ? 'Run historical backfill for insufficient indicators'
          : 'Historical data coverage adequate',
        impact: 'Missing data primarily affects economic analysis, not z-score trading signals'
      }
    });

  } catch (error) {
    logger.error('❌ Error assessing missing data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess missing economic data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Process delta calculations for missing indicators
router.post('/process-deltas', async (req, res) => {
  try {
    logger.info('🧮 Starting delta calculation processing');

    const { indicators } = req.body;
    
    if (indicators && Array.isArray(indicators)) {
      // Process specific indicators
      for (const seriesId of indicators) {
        const indicatorName = getIndicatorName(seriesId);
        await economicDeltaCalculator.processIndicatorDeltas(seriesId, indicatorName);
      }
    } else {
      // Process all missing deltas
      await economicDeltaCalculator.processAllMissingDeltas();
    }

    const updatedStatus = await economicDeltaCalculator.getProcessingStatus();

    res.json({
      success: true,
      message: 'Delta calculations completed',
      processed: indicators || 'all indicators',
      status: updatedStatus,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('❌ Error processing deltas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process delta calculations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start optimized FRED data collection
router.post('/start-fred-collection', async (req, res) => {
  try {
    logger.info('🚀 Starting optimized FRED data collection');

    await optimizedFredScheduler.start();
    const status = optimizedFredScheduler.getStatus();

    res.json({
      success: true,
      message: 'Optimized FRED data collection started',
      status,
      features: [
        'Rate limiting to prevent API exhaustion',
        'Focus on priority indicators only',
        'Daily collection schedule',
        'Smart backfill for missing data'
      ]
    });

  } catch (error) {
    logger.error('❌ Error starting FRED collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start FRED data collection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stop FRED data collection
router.post('/stop-fred-collection', async (req, res) => {
  try {
    await optimizedFredScheduler.stop();

    res.json({
      success: true,
      message: 'FRED data collection stopped',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('❌ Error stopping FRED collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop FRED data collection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Force backfill specific indicators
router.post('/backfill-indicators', async (req, res) => {
  try {
    const { series, years } = req.body;
    
    if (!series || !Array.isArray(series)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid series parameter'
      });
    }

    logger.info(`🔄 Force backfilling indicators: ${series.join(', ')}`);

    await optimizedFredScheduler.forceBackfill(series);

    // After backfill, process deltas for the backfilled data
    for (const seriesId of series) {
      const indicatorName = getIndicatorName(seriesId);
      await economicDeltaCalculator.processIndicatorDeltas(seriesId, indicatorName);
    }

    const updatedStatus = await optimizedFredScheduler.assessMissingData();

    res.json({
      success: true,
      message: `Backfill completed for ${series.length} indicators`,
      backfilled: series,
      status: updatedStatus.filter(s => series.includes(s.series)),
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('❌ Error during backfill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to backfill indicators',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recovery status
router.get('/recovery-status', async (req, res) => {
  try {
    const [deltaStatus, fredStatus, schedulerStatus] = await Promise.all([
      economicDeltaCalculator.getProcessingStatus(),
      optimizedFredScheduler.assessMissingData(),
      Promise.resolve(optimizedFredScheduler.getStatus())
    ]);

    res.json({
      success: true,
      recovery: {
        deltaCalculations: deltaStatus,
        historicalData: fredStatus,
        scheduler: schedulerStatus,
        summary: {
          processedDeltas: deltaStatus.filter((s: any) => s.processedRecords > 0).length,
          adequateData: fredStatus.filter(s => s.currentRecords >= s.targetRecords * 0.8).length,
          schedulerActive: schedulerStatus.isRunning
        }
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('❌ Error getting recovery status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recovery status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to get indicator name by series ID
function getIndicatorName(seriesId: string): string {
  const mapping: Record<string, string> = {
    'CCSA': 'Continuing Jobless Claims',
    'ICSA': 'Initial Jobless Claims',
    'PAYEMS': 'Nonfarm Payrolls',
    'CPIAUCSL': 'CPI All Items',
    'CPILFESL': 'Core CPI',
    'A191RL1Q225SBEA': 'GDP Growth Rate',
    'RSAFS': 'Retail Sales',
    'HOUST': 'Housing Starts',
    'MORTGAGE30US': '30-Year Mortgage Rate',
    'DEXUSEU': 'US Dollar Index',
    'GASREGCOVW': 'Gasoline Prices'
  };
  
  return mapping[seriesId] || seriesId;
}

export default router;