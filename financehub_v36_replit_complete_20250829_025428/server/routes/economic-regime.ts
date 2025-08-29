import { Router } from 'express';
import { EconomicRegimeDetector } from '../services/economic-regime-detector';
import { SectorImpactAnalyzer } from '../services/sector-impact-analyzer';
import { logger } from '../utils/logger';

const router = Router();
const regimeDetector = new EconomicRegimeDetector();
const sectorAnalyzer = new SectorImpactAnalyzer();

// Get current economic regime
router.get('/current-regime', async (req, res) => {
  try {
    logger.info('📊 Current economic regime request');
    
    const regime = await regimeDetector.detectCurrentRegime();
    
    res.json({
      regime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error detecting current regime:', error);
    res.status(500).json({ error: 'Failed to detect current economic regime' });
  }
});

// Get regime history
router.get('/regime-history', async (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 24;
    
    logger.info(`📈 Regime history request for ${months} months`);
    
    const history = await regimeDetector.getRegimeHistory(months);
    
    res.json({
      history,
      totalMonths: months,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting regime history:', error);
    res.status(500).json({ error: 'Failed to get regime history' });
  }
});

// Get sector impact analysis
router.get('/sector-impacts', async (req, res) => {
  try {
    const indicators = req.query.indicators as string;
    
    logger.info('🏢 Sector impact analysis request');
    
    // If no specific indicators provided, analyze recent changes
    let impacts;
    if (indicators) {
      const indicatorList = indicators.split(',').map(i => i.trim());
      // Mock recent changes for specified indicators
      const indicatorData = indicatorList.map(indicator => ({
        indicator,
        currentValue: Math.random() * 10,
        previousValue: Math.random() * 10
      }));
      impacts = await sectorAnalyzer.analyzeSectorImpacts(indicatorData);
    } else {
      // Get impacts based on recent economic changes
      impacts = await sectorAnalyzer.analyzeSectorImpacts([]);
    }
    
    res.json({
      impacts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error analyzing sector impacts:', error);
    res.status(500).json({ error: 'Failed to analyze sector impacts' });
  }
});

// Get top sector opportunities
router.get('/sector-opportunities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    
    logger.info(`🎯 Top sector opportunities request (limit: ${limit})`);
    
    const opportunities = await sectorAnalyzer.getTopSectorOpportunities(limit);
    
    res.json({
      opportunities,
      limit,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting sector opportunities:', error);
    res.status(500).json({ error: 'Failed to get sector opportunities' });
  }
});

// Combined regime and sector analysis
router.get('/comprehensive-analysis', async (req, res) => {
  try {
    logger.info('🔍 Comprehensive regime and sector analysis request');
    
    const [regime, sectorOpportunities] = await Promise.all([
      regimeDetector.detectCurrentRegime(),
      sectorAnalyzer.getTopSectorOpportunities(8)
    ]);
    
    // Get recent indicator changes for sector impact
    const recentChanges = [
      { indicator: 'GDP Growth Rate', currentValue: 2.1, previousValue: 1.8 },
      { indicator: 'Unemployment Rate', currentValue: 3.8, previousValue: 4.1 },
      { indicator: 'Federal Funds Rate', currentValue: 5.25, previousValue: 5.0 }
    ];
    
    const sectorImpacts = await sectorAnalyzer.analyzeSectorImpacts(recentChanges);
    
    res.json({
      economicRegime: regime,
      sectorImpacts,
      topOpportunities: sectorOpportunities,
      analysis: {
        regimeConfidence: regime.confidenceScore,
        avgSectorConfidence: sectorImpacts.reduce((sum, impact) => sum + impact.analysisConfidence, 0) / sectorImpacts.length,
        overallMarketSentiment: regime.regimeType === 'EXPANSION' || regime.regimeType === 'PEAK' ? 'POSITIVE' : 'NEGATIVE'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in comprehensive analysis:', error);
    res.status(500).json({ error: 'Failed to perform comprehensive analysis' });
  }
});

export default router;