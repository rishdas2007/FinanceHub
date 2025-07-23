import { Router } from 'express';
import { fredDataUpdaterService } from '../services/fred-data-updater';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/fred-data/update
 * Manually trigger FRED data update
 */
router.get('/update', async (req, res) => {
  try {
    logger.info('🚀 Manual FRED data update requested');
    
    const result = await fredDataUpdaterService.updateFREDData();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        indicatorsCount: result.indicatorsCount,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('❌ FRED data update API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during FRED data update',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/fred-data/latest
 * Get the latest FRED data from CSV file
 */
router.get('/latest', async (req, res) => {
  try {
    const indicators = await fredDataUpdaterService.getLatestFREDData();
    
    if (indicators) {
      res.json({
        success: true,
        data: indicators,
        count: indicators.length,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No FRED data available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('❌ FRED data retrieval API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during FRED data retrieval',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/fred-data/status
 * Get status information about FRED data updates
 */
router.get('/status', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = 'server/data/macroeconomic_indicators_dataset.csv';
    
    let fileStats = null;
    let dataAge = null;
    
    try {
      const stats = await fs.stat(path);
      fileStats = {
        size: stats.size,
        lastModified: stats.mtime.toISOString()
      };
      dataAge = Date.now() - stats.mtime.getTime();
    } catch (error) {
      // File doesn't exist
    }
    
    res.json({
      success: true,
      status: {
        dataFileExists: fileStats !== null,
        lastUpdate: fileStats?.lastModified || null,
        dataAgeMinutes: dataAge ? Math.floor(dataAge / (60 * 1000)) : null,
        nextScheduledUpdate: '4 hours after last update',
        fredApiKey: process.env.FRED_API_KEY ? 'Configured' : 'Not configured'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ FRED data status API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during status check',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as fredDataRoutes };