import { Router } from 'express';
import { DataConfidenceService } from '../services/data-confidence-service';
import { logger } from '../utils/logger';

const router = Router();
const dataConfidenceService = new DataConfidenceService();

// Get data confidence scores for indicators
router.get('/confidence-scores', async (req, res) => {
  try {
    const indicators = req.query.indicators as string;
    
    if (!indicators) {
      return res.status(400).json({ error: 'Indicators parameter is required' });
    }

    const indicatorList = indicators.split(',').map(i => i.trim());
    
    logger.info(`📊 Data confidence request for: ${indicatorList.join(', ')}`);
    
    const confidenceScores = await dataConfidenceService.calculateDataConfidence(indicatorList);
    
    res.json({
      confidenceScores,
      timestamp: new Date().toISOString(),
      totalIndicators: confidenceScores.length
    });
    
  } catch (error) {
    logger.error('Error calculating data confidence:', error);
    res.status(500).json({ error: 'Failed to calculate data confidence' });
  }
});

// Get historical context for indicators
router.get('/historical-context', async (req, res) => {
  try {
    const indicators = req.query.indicators as string;
    
    if (!indicators) {
      return res.status(400).json({ error: 'Indicators parameter is required' });
    }

    const indicatorList = indicators.split(',').map(i => i.trim());
    
    logger.info(`📈 Historical context request for: ${indicatorList.join(', ')}`);
    
    const historicalContext = await dataConfidenceService.generateHistoricalContext(indicatorList);
    
    res.json({
      historicalContext,
      timestamp: new Date().toISOString(),
      totalIndicators: historicalContext.length
    });
    
  } catch (error) {
    logger.error('Error generating historical context:', error);
    res.status(500).json({ error: 'Failed to generate historical context' });
  }
});

// Get combined confidence and context data
router.get('/comprehensive-analysis', async (req, res) => {
  try {
    const indicators = req.query.indicators as string;
    
    if (!indicators) {
      return res.status(400).json({ error: 'Indicators parameter is required' });
    }

    const indicatorList = indicators.split(',').map(i => i.trim());
    
    logger.info(`🔍 Comprehensive analysis request for: ${indicatorList.join(', ')}`);
    
    const [confidenceScores, historicalContext] = await Promise.all([
      dataConfidenceService.calculateDataConfidence(indicatorList),
      dataConfidenceService.generateHistoricalContext(indicatorList)
    ]);
    
    // Combine data by indicator
    const combinedAnalysis = indicatorList.map(indicator => {
      const confidence = confidenceScores.find(c => c.indicator === indicator);
      const context = historicalContext.find(h => h.indicator === indicator);
      
      return {
        indicator,
        confidence,
        context,
        overallScore: confidence ? confidence.confidenceScore : 0,
        riskLevel: confidence?.dataQuality === 'LOW' ? 'HIGH' : 
                  confidence?.dataQuality === 'MEDIUM' ? 'MEDIUM' : 'LOW'
      };
    });
    
    res.json({
      analysis: combinedAnalysis,
      summary: {
        averageConfidence: confidenceScores.reduce((sum, c) => sum + c.confidenceScore, 0) / confidenceScores.length,
        highQualityCount: confidenceScores.filter(c => c.dataQuality === 'HIGH').length,
        lowQualityCount: confidenceScores.filter(c => c.dataQuality === 'LOW').length,
        totalIndicators: indicatorList.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating comprehensive analysis:', error);
    res.status(500).json({ error: 'Failed to generate comprehensive analysis' });
  }
});

export default router;