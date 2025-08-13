import { Router } from 'express';
import { fredRecentIndicatorsService } from '../services/fred-recent-indicators';

const router = Router();

// GET /api/fred-recent-readings - Get 6 most recent FRED indicators with AI analysis
router.get('/fred-recent-readings', async (req, res) => {
  try {
    console.log('🏦 API Request: GET /api/fred-recent-readings');
    
    const result = await fredRecentIndicatorsService.getRecentEconomicReadings();
    
    console.log(`✅ Returning ${result.indicators.length} recent FRED indicators with analysis`);
    
    res.json(result);
  } catch (error) {
    console.error('Error in /api/fred-recent-readings:', error);
    res.status(500).json({
      error: 'Failed to fetch recent economic readings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as fredRecentRoutes };