import { Router } from 'express';
import { EconomicHealthFallback } from '../services/economic-health-fallback.js';
import { StatisticalHealthCalculator } from '../services/statistical-health-calculator.js';
import { economicDataFreshnessMonitor } from '../services/economic-data-freshness-monitor.js';
import { logger } from '../utils/logger.js';
import type { EconomicHealthScore } from '../services/economic-health-fallback.js';

const router = Router();
const healthCalculator = new EconomicHealthFallback();
const statisticalHealthCalculator = new StatisticalHealthCalculator();
// Static insights generation (no AI required)
function generateStaticInsights(healthScore: EconomicHealthScore) {
  const { overallScore, healthGrade, trendDirection } = healthScore;
  
  const insights = {
    narrative: `Economic conditions show ${healthGrade.toLowerCase()} performance with an overall score of ${overallScore}. Core indicators reveal ${
      overallScore >= 70 ? 'strong fundamentals' :
      overallScore >= 55 ? 'mixed signals' :
      'challenging conditions'
    } across key metrics. Market relationships ${
      overallScore >= 65 ? 'remain well-coordinated' : 'show some volatility'
    }.`,
    
    recommendations: overallScore >= 70 ? [
      'Consider growth-oriented strategies',
      'Monitor for potential cycle peaks',
      'Maintain balanced allocation'
    ] : overallScore >= 55 ? [
      'Adopt defensive positioning',
      'Increase diversification',
      'Monitor key indicators closely'
    ] : [
      'Implement risk-off strategies',
      'Focus on capital preservation',
      'Prepare for potential downturn'
    ],
    
    nextKeyEvent: {
      date: '2025-08-15',
      event: 'Consumer Price Index',
      expectedImpact: 'HIGH' as const
    },
    
    alertLevel: overallScore < 35 ? 'CRITICAL' as const :
                overallScore < 50 ? 'HIGH' as const :
                overallScore < 65 ? 'MEDIUM' as const :
                'LOW' as const,
    
    sectorGuidance: {
      opportunities: overallScore >= 70 ? 
        ['Technology growth potential', 'Financial sector strength'] :
        ['Defensive healthcare', 'Utility stability'],
      risks: overallScore >= 70 ? 
        ['Interest rate sensitivity'] :
        ['Cyclical sector exposure', 'Credit risks']
    },
    
    riskFactors: overallScore < 50 ? 
      ['Economic weakness across indicators', 'Elevated market stress'] :
      ['Normal market volatility'],
    
    confidence: Math.max(60, Math.min(90, 70 + (overallScore - 50) * 0.4))
  };
  
  return insights;
}

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

// Get economic insights and recommendations (static version)
router.get('/insights', async (req, res) => {
  try {
    logger.info('📊 Economic insights request');
    
    const healthScore = await healthCalculator.calculateEconomicHealthScore();
    const insights = generateStaticInsights(healthScore);
    
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
    
    const healthScore = await healthCalculator.calculateEconomicHealthScore();
    
    // Generate static insights based on health score (no AI required)
    const insights = generateStaticInsights(healthScore);
    
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

// Get component score details (simplified for fallback compatibility)
router.get('/component-analysis', async (req, res) => {
  try {
    logger.info('🔍 Component analysis request');
    
    const healthScore = await healthCalculator.calculateEconomicHealthScore();
    
    // Use the actual available properties from our fallback service
    const componentAnalysis = {
      coreHealth: {
        score: (healthScore.componentScores.growthMomentum + healthScore.componentScores.laborHealth) / 2,
        components: {
          growthMomentum: {
            score: healthScore.componentScores.growthMomentum,
            weight: 30,
            description: 'Economic growth momentum indicators'
          },
          laborHealth: {
            score: healthScore.componentScores.laborHealth,
            weight: 20,
            description: 'Employment and labor market health'
          },
          inflationTrajectory: {
            score: healthScore.componentScores.inflationTrajectory,
            weight: 15,
            description: 'Inflation trend and price stability'
          }
        }
      },
      financialStress: {
        score: healthScore.componentScores.financialStress,
        components: {
          policyEffectiveness: {
            score: healthScore.componentScores.policyEffectiveness,
            weight: 10,
            description: 'Monetary policy effectiveness indicators'
          }
        }
      }
    };
    
    res.json({
      componentAnalysis,
      overallScore: healthScore.overallScore,
      healthGrade: healthScore.healthGrade,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating component analysis:', error);
    res.status(500).json({ error: 'Failed to generate component analysis' });
  }
});

// Get economic data freshness monitoring report
router.get('/freshness', async (req, res) => {
  try {
    logger.info('🕐 Economic data freshness check request');
    
    const freshnessSummary = await economicDataFreshnessMonitor.getFreshnessSummary();
    const detailedChecks = await economicDataFreshnessMonitor.checkAllSeries();
    
    res.json({
      summary: freshnessSummary,
      detailedChecks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error checking data freshness:', error);
    res.status(500).json({ error: 'Failed to check data freshness' });
  }
});

export default router;