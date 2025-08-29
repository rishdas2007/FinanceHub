// Economic Data Backfill Routes
// API endpoints for CSV data import

import { Router } from 'express';
import { economicDataBackfillService } from '../services/economic-data-backfill';
import { join } from 'path';

const router = Router();

// Backfill endpoint for CSV files
router.post('/process-csv', async (req, res) => {
  try {
    console.log('🔄 Processing economic data CSV backfill...');
    
    // Define paths to CSV files in attached_assets
    const definitionsPath = join(process.cwd(), 'attached_assets', 'econ_series_def_upload_1754875461998.csv');
    const observationsPath = join(process.cwd(), 'attached_assets', 'econ_series_observation_upload_1754875461992.csv');
    
    const results = await economicDataBackfillService.processCsvFiles(
      definitionsPath,
      observationsPath
    );
    
    // Validate the backfill
    const validation = await economicDataBackfillService.validateBackfill();
    
    res.json({
      success: true,
      message: 'Economic data backfill completed successfully',
      results,
      validation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CSV backfill failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Validation endpoint
router.get('/validate', async (req, res) => {
  try {
    const validation = await economicDataBackfillService.validateBackfill();
    
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  try {
    // Check if tables exist and have data
    const { db } = await import('../db');
    
    const seriesCount = await db.execute('SELECT COUNT(*) as count FROM econ_series_def');
    const obsCount = await db.execute('SELECT COUNT(*) as count FROM econ_series_observation');
    
    res.json({
      success: true,
      status: {
        seriesDefinitions: seriesCount.rows?.[0]?.count || 0,
        observations: obsCount.rows?.[0]?.count || 0,
        ready: (seriesCount.rows?.[0]?.count || 0) > 0 && (obsCount.rows?.[0]?.count || 0) > 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;