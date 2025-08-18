import { Router } from 'express';
import { economicYoYTransformer } from '../services/economic-yoy-transformer';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * DEBUG: Check transformation results for key indicators
 */
router.get('/debug-transformation', async (req, res) => {
  try {
    // Test key indicators
    const testSeries = ['CPIAUCSL', 'CPILFESL', 'PPIACO', 'PPIFIS', 'WPUSOP3000', 'PPIENG'];
    const results = [];

    for (const seriesId of testSeries) {
      const transformation = await economicYoYTransformer.transformIndicatorData(seriesId);
      if (transformation) {
        // Get the transformation rule for debugging
        const rule = (economicYoYTransformer as any).TRANSFORMATION_RULES[seriesId];
        
        results.push({
          seriesId,
          displayValue: transformation.displayValue,
          rawCurrent: transformation.currentValue,
          rawPrevious: transformation.previousYearValue,
          yoyPercentage: transformation.yoyPercentage,
          unit: transformation.unit,
          shouldTransform: rule?.transform || 'unknown',
          isAlreadyYoY: rule?.isAlreadyYoY || false,
          transformationApplied: rule?.transform === 'yoy' ? 'YES' : 'NO'
        });
      } else {
        results.push({
          seriesId,
          error: 'No transformation data found',
          shouldTransform: 'unknown'
        });
      }
    }

    res.json({
      status: 'debug',
      timestamp: new Date().toISOString(),
      transformations: results,
      message: "Check if CPI shows proper values and PPI gets transformed",
      explanation: {
        'CPI (CPIAUCSL)': 'Should show existing YoY % from FRED (e.g., +2.9%)',
        'Core CPI (CPILFESL)': 'Should show existing YoY % from FRED (e.g., +3.2%)',
        'PPI (PPIACO)': 'Should calculate YoY from index level (262.5 → +3.1%)',
        'PPI Final Demand (PPIFIS)': 'Should calculate YoY from index level (149.7 → +2.1%)',
        'Core PPI (WPUSOP3000)': 'Should calculate YoY from index level',
        'PPI Energy (PPIENG)': 'Should calculate YoY from index level (225.0 → proper %)'
      }
    });

  } catch (error) {
    logger.error('Transformation debug failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;