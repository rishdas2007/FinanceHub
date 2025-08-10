import { Router } from 'express';
import { EconomicCorrelationAnalyzer } from '../services/economic-correlation-analyzer.js';
import { DynamicThresholdService } from '../services/dynamic-threshold-service.js';
import { logger } from '../../shared/utils/logger.js';

const router = Router();
const correlationAnalyzer = new EconomicCorrelationAnalyzer();
const thresholdService = new DynamicThresholdService();

// Get correlation matrix for specified indicators
router.get('/correlation-matrix', async (req, res) => {
  try {
    const { indicators, timeframe = '12m' } = req.query;
    
    if (!indicators) {
      return res.status(400).json({ error: 'Indicators parameter is required' });
    }
    
    const indicatorList = Array.isArray(indicators) 
      ? indicators as string[]
      : (indicators as string).split(',');
    
    const correlations = await correlationAnalyzer.calculateCorrelationMatrix(
      indicatorList, 
      timeframe as string
    );
    
    res.json({ correlations, timeframe, indicatorCount: indicatorList.length });
  } catch (error) {
    logger.error('Failed to calculate correlation matrix:', error);
    res.status(500).json({ error: 'Failed to calculate correlations' });
  }
});

// Get leading correlations for a target indicator
router.get('/leading-correlations/:indicator', async (req, res) => {
  try {
    const { indicator } = req.params;
    
    const leadingCorrelations = await correlationAnalyzer.getLeadingCorrelations(indicator);
    
    res.json({ 
      targetIndicator: indicator,
      leadingCorrelations,
      count: leadingCorrelations.length 
    });
  } catch (error) {
    logger.error(`Failed to get leading correlations for ${req.params.indicator}:`, error);
    res.status(500).json({ error: 'Failed to calculate leading correlations' });
  }
});

// Get correlation breakdowns (regime changes)
router.get('/correlation-breakdowns', async (req, res) => {
  try {
    const breakdowns = await correlationAnalyzer.detectCorrelationBreakdowns();
    
    res.json({ 
      breakdowns,
      count: breakdowns.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to detect correlation breakdowns:', error);
    res.status(500).json({ error: 'Failed to detect correlation breakdowns' });
  }
});

// Get dynamic threshold for an indicator
router.get('/dynamic-threshold/:indicator', async (req, res) => {
  try {
    const { indicator } = req.params;
    
    const threshold = await thresholdService.calculateDynamicThreshold(indicator);
    
    res.json({ 
      indicator,
      threshold,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to calculate dynamic threshold for ${req.params.indicator}:`, error);
    res.status(500).json({ error: 'Failed to calculate dynamic threshold' });
  }
});

// Check if indicator exceeds dynamic threshold
router.post('/threshold-check', async (req, res) => {
  try {
    const { indicator, zScore } = req.body;
    
    if (!indicator || zScore === undefined) {
      return res.status(400).json({ error: 'Indicator and zScore are required' });
    }
    
    const result = await thresholdService.exceedsThreshold(indicator, parseFloat(zScore));
    
    res.json({
      indicator,
      zScore: parseFloat(zScore),
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to check threshold:', error);
    res.status(500).json({ error: 'Failed to check threshold' });
  }
});

export default router;