import { Router } from 'express';
import { ZScoreDataQualityValidator } from '../services/data-quality/zscore-validator';
import { DataSufficiencyGates } from '../services/data-quality/sufficiency-gates';
import { CircuitBreakerRegistry } from '../services/data-quality/circuit-breaker';
import { ContractRegistry } from '../../shared/validation/contract-registry';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Data Quality Dashboard and Management Routes
 * Provides endpoints for monitoring and managing the Data Quality-First Architecture
 */

// Get overall data quality status
router.get('/status', async (req, res) => {
  try {
    logger.info('📊 Data quality status requested');

    const validator = new ZScoreDataQualityValidator();
    const sufficiencyGates = new DataSufficiencyGates();
    const circuitBreakers = CircuitBreakerRegistry.getInstance();

    // Check major ETFs sufficiency
    const majorETFs = ['SPY', 'XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLY', 'XLP', 'XLU', 'XLB', 'XLC', 'XLRE'];
    
    const sufficiencyResults = await Promise.all(
      majorETFs.map(async symbol => {
        try {
          const result = await sufficiencyGates.checkZScoreCalculationReadiness(symbol);
          return { symbol, result };
        } catch (error) {
          return { 
            symbol, 
            result: { 
              sufficient: false, 
              confidence: 0, 
              recommendation: 'SKIP' as const,
              missingComponents: ['error'],
              metadata: {
                historicalDataPoints: 0,
                technicalIndicatorsAvailable: 0,
                lastDataUpdate: null,
                dataQualityScore: 0
              }
            } 
          };
        }
      })
    );

    const sufficientCount = sufficiencyResults.filter(r => r.result.sufficient).length;
    const averageConfidence = sufficiencyResults.reduce((sum, r) => sum + r.result.confidence, 0) / sufficiencyResults.length;

    // Get circuit breaker status
    const circuitBreakerMetrics = circuitBreakers.getAllHealthMetrics();

    // Get contract registry status
    const availableContracts = ContractRegistry.getAllContracts();

    const status = {
      overall: {
        healthy: sufficientCount >= 8 && averageConfidence >= 0.7,
        confidence: averageConfidence,
        recommendation: sufficientCount >= 10 ? 'PROCEED' : sufficientCount >= 8 ? 'DEGRADE' : 'SKIP'
      },
      etfSufficiency: {
        total: majorETFs.length,
        sufficient: sufficientCount,
        percentage: (sufficientCount / majorETFs.length) * 100,
        details: sufficiencyResults.map(r => ({
          symbol: r.symbol,
          sufficient: r.result.sufficient,
          confidence: r.result.confidence,
          recommendation: r.result.recommendation
        }))
      },
      circuitBreakers: circuitBreakerMetrics,
      contracts: {
        total: availableContracts.size,
        available: Array.from(availableContracts.keys())
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('❌ Error getting data quality status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get data quality status',
      message: error.message
    });
  }
});

// Validate specific ETF data quality
router.get('/validate/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    logger.info(`🔍 Data quality validation requested for ${symbol}`);

    const validator = new ZScoreDataQualityValidator();
    const result = await validator.validateForZScoreCalculation(symbol);

    res.json({
      success: true,
      symbol,
      validation: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error validating ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Validation failed',
      message: error.message
    });
  }
});

// Check data sufficiency for calculations
router.get('/sufficiency/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    logger.info(`📊 Data sufficiency check requested for ${symbol}`);

    const sufficiencyGates = new DataSufficiencyGates();
    const result = await sufficiencyGates.checkZScoreCalculationReadiness(symbol);

    res.json({
      success: true,
      symbol,
      sufficiency: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error checking sufficiency for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Sufficiency check failed',
      message: error.message
    });
  }
});

// Get circuit breaker status
router.get('/circuit-breakers', async (req, res) => {
  try {
    logger.info('🔧 Circuit breaker status requested');

    const circuitBreakers = CircuitBreakerRegistry.getInstance();
    const metrics = circuitBreakers.getAllHealthMetrics();

    res.json({
      success: true,
      circuitBreakers: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error getting circuit breaker status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get circuit breaker status',
      message: error.message
    });
  }
});

// Reset circuit breakers
router.post('/circuit-breakers/reset', async (req, res) => {
  try {
    logger.info('🔄 Circuit breaker reset requested');

    const circuitBreakers = CircuitBreakerRegistry.getInstance();
    circuitBreakers.resetAll();

    res.json({
      success: true,
      message: 'All circuit breakers reset',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error resetting circuit breakers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset circuit breakers',
      message: error.message
    });
  }
});

// Get available data contracts
router.get('/contracts', async (req, res) => {
  try {
    logger.info('📝 Data contracts requested');

    const contracts = ContractRegistry.getAllContracts();
    const contractList = Array.from(contracts.entries()).map(([name, contract]) => ({
      name,
      description: contract.description,
      version: contract.version,
      qualityGatesCount: contract.qualityGates.length,
      tags: contract.tags
    }));

    res.json({
      success: true,
      contracts: contractList,
      total: contractList.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error getting contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contracts',
      message: error.message
    });
  }
});

export default router;