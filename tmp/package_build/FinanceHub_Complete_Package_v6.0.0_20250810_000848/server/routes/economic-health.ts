import { Router } from 'express';
import { EconomicHealthCalculator } from '../services/economic-health-calculator.js';
import { StatisticalHealthCalculator } from '../services/statistical-health-calculator.js';
import { EconomicInsightsSynthesizer } from '../services/economic-insights-synthesizer.js';
import { logger } from '../utils/logger.js';

const router = Router();
const healthCalculator = new EconomicHealthCalculator();
const statisticalHealthCalculator = new StatisticalHealthCalculator();
const insightsSynthesizer = new EconomicInsightsSynthesizer();

// Get comprehensive economic health score (original method)
router.get('/health-score', async (req, res) => {
  try {
    logger.info('🏥 Economic health score request');
    
    const healthScore = await healthCalculator.calculateEconomicHealthScore();
    
    res.json({
      healthScore,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error calculating economic health score:', error);
    res.status(500).json({ error: 'Failed to calculate economic health score' });
  }
});

// Get statistical economic health score (data-driven method with confidence intervals)
router.get('/statistical-score', async (req, res) => {
  try {
    logger.info('🧮 Statistical economic health score request');
    
    const statisticalScore = await statisticalHealthCalculator.calculateStatisticalHealthScore();
    
    res.json({
      statisticalScore,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error calculating statistical health score:', error);
    res.status(500).json({ error: 'Failed to calculate statistical health score' });
  }
});

// Get economic insights and recommendations
router.get('/insights', async (req, res) => {
  try {
    logger.info('🧠 Economic insights request');
    
    const healthScore = await healthCalculator.calculateEconomicHealthScore();
    const insights = await insightsSynthesizer.generateInsights(healthScore);
    
    res.json({
      insights,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating economic insights:', error);
    res.status(500).json({ error: 'Failed to generate economic insights' });
  }
});

// Get combined health dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    logger.info('📊 Economic health dashboard request');
    
    const [healthScore, insights] = await Promise.all([
      healthCalculator.calculateEconomicHealthScore(),
      healthCalculator.calculateEconomicHealthScore().then(score => 
        insightsSynthesizer.generateInsights(score)
      )
    ]);
    
    res.json({
      economicHealthScore: healthScore.overallScore,
      scoreBreakdown: healthScore.scoreBreakdown,
      componentScores: healthScore.componentScores,
      healthGrade: healthScore.healthGrade,
      trendDirection: healthScore.trendDirection,
      monthlyChange: healthScore.monthlyChange,
      historicalPercentile: healthScore.historicalPercentile,
      recessonProbability: healthScore.recessonProbability,
      narrative: insights.narrative,
      recommendations: insights.recommendations,
      nextKeyEvent: insights.nextKeyEvent,
      alertLevel: insights.alertLevel,
      sectorGuidance: insights.sectorGuidance,
      riskFactors: insights.riskFactors,
      confidence: insights.confidence,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating economic health dashboard:', error);
    res.status(500).json({ error: 'Failed to generate economic health dashboard' });
  }
});

// Get historical health score trend
router.get('/historical-trend', async (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    
    logger.info(`📈 Historical health trend request for ${months} months`);
    
    // Mock historical data - in production would be stored in database
    const historicalData = [];
    const currentDate = new Date();
    
    for (let i = months; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      
      // Mock score progression with some realistic variation
      let score = 70 + Math.sin(i * 0.3) * 15 + Math.random() * 10 - 5;
      score = Math.max(25, Math.min(95, score));
      
      historicalData.push({
        date: date.toISOString().slice(0, 7), // YYYY-MM format
        score: Math.round(score),
        grade: score >= 85 ? 'EXCELLENT' : score >= 70 ? 'STRONG' : score >= 55 ? 'MODERATE' : score >= 40 ? 'WEAK' : 'CRITICAL'
      });
    }
    
    res.json({
      historicalTrend: historicalData,
      averageScore: Math.round(historicalData.reduce((sum, data) => sum + data.score, 0) / historicalData.length),
      totalMonths: months,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting historical health trend:', error);
    res.status(500).json({ error: 'Failed to get historical health trend' });
  }
});

// Get component score details
router.get('/component-analysis', async (req, res) => {
  try {
    logger.info('🔍 Component analysis request');
    
    const healthScore = await healthCalculator.calculateEconomicHealthScore();
    
    // Provide detailed breakdown of each component
    const componentAnalysis = {
      coreHealth: {
        score: healthScore.scoreBreakdown.coreHealth,
        components: {
          gdpHealth: {
            score: healthScore.componentScores.gdpHealth,
            weight: 15,
            description: 'GDP growth trend and consistency'
          },
          employmentHealth: {
            score: healthScore.componentScores.employmentHealth,
            weight: 15,
            description: 'Employment indicators including payrolls and unemployment'
          },
          inflationStability: {
            score: healthScore.componentScores.inflationStability,
            weight: 10,
            description: 'Price stability and inflation trend consistency'
          }
        }
      },
      correlationHarmony: {
        score: healthScore.scoreBreakdown.correlationHarmony,
        components: {
          signalClarity: {
            score: healthScore.componentScores.signalClarity,
            weight: 25,
            description: 'How definitively indicators point in economic direction'
          },
          crossIndicatorHarmony: {
            score: healthScore.componentScores.crossIndicatorHarmony,
            weight: 35,
            description: 'Level-trend alignment across economic categories'
          },
          conflictResolution: {
            score: healthScore.componentScores.conflictResolution,
            weight: 20,
            description: 'Handling of mixed and contradictory economic signals'
          },
          forwardLookingAccuracy: {
            score: healthScore.componentScores.forwardLookingAccuracy,
            weight: 20,
            description: 'Predictive capability with leading indicators'
          }
        }
      },
      marketStress: {
        score: healthScore.scoreBreakdown.marketStress,
        components: {
          alertFrequency: {
            score: healthScore.componentScores.alertFrequency,
            weight: 10,
            description: 'Frequency of economic alerts and stress signals'
          },
          regimeStability: {
            score: healthScore.componentScores.regimeStability,
            weight: 10,
            description: 'Economic regime stability and transition risk'
          }
        }
      },
      confidence: {
        score: healthScore.scoreBreakdown.confidence,
        components: {
          dataQuality: {
            score: healthScore.componentScores.dataQuality,
            weight: 8,
            description: 'Data freshness and quality metrics'
          },
          sectorAlignment: {
            score: healthScore.componentScores.sectorAlignment,
            weight: 7,
            description: 'Sector prediction accuracy and alignment'
          }
        }
      }
    };
    
    res.json({
      componentAnalysis,
      overallScore: healthScore.overallScore,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating component analysis:', error);
    res.status(500).json({ error: 'Failed to generate component analysis' });
  }
});

export default router;