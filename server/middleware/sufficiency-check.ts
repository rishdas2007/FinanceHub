/**
 * Data Sufficiency Check Middleware
 * Pre-calculation validation middleware for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { DataSufficiencyGates, DataSufficiencyResult } from '../services/data-quality/sufficiency-gates';
import { logger } from '../services/logger';
import { db } from '../db';

export interface SufficiencyCheckRequest extends Request {
  sufficiencyResult?: DataSufficiencyResult;
  symbol?: string;
}

export class SufficiencyCheckMiddleware {
  private sufficiencyGates: DataSufficiencyGates;

  constructor() {
    this.sufficiencyGates = new DataSufficiencyGates(db);
  }

  /**
   * Check Z-score calculation readiness for single symbol
   */
  checkZScoreReadiness = async (
    req: SufficiencyCheckRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const symbol = req.params.symbol || req.query.symbol as string || req.symbol;
      
      if (!symbol) {
        res.status(400).json({
          error: 'Symbol parameter required for sufficiency check',
          code: 'MISSING_SYMBOL'
        });
        return;
      }

      logger.info(`🔍 Performing sufficiency check for ${symbol}`);

      const sufficiencyResult = await this.sufficiencyGates.checkZScoreCalculationReadiness(symbol);
      req.sufficiencyResult = sufficiencyResult;
      req.symbol = symbol;

      // Handle different sufficiency levels
      switch (sufficiencyResult.recommendation) {
        case 'PROCEED':
          logger.info(`✅ Sufficiency check passed for ${symbol} (confidence: ${sufficiencyResult.confidence.toFixed(2)})`);
          next();
          break;

        case 'DEGRADE':
          logger.warn(`⚠️ Degraded data quality for ${symbol} (confidence: ${sufficiencyResult.confidence.toFixed(2)})`);
          // Add degradation warning headers
          res.set({
            'X-Data-Quality': 'DEGRADED',
            'X-Data-Confidence': sufficiencyResult.confidence.toString(),
            'X-Data-Issues': sufficiencyResult.missingComponents.join(', ')
          });
          next();
          break;

        case 'SKIP':
          logger.error(`❌ Insufficient data for ${symbol}: ${sufficiencyResult.missingComponents.join(', ')}`);
          res.status(422).json({
            error: 'Insufficient data for reliable calculation',
            symbol,
            confidence: sufficiencyResult.confidence,
            missingComponents: sufficiencyResult.missingComponents,
            details: sufficiencyResult.details,
            code: 'INSUFFICIENT_DATA'
          });
          break;

        default:
          logger.error(`❌ Unknown sufficiency recommendation: ${sufficiencyResult.recommendation}`);
          res.status(500).json({
            error: 'Internal error in sufficiency check',
            code: 'SUFFICIENCY_CHECK_ERROR'
          });
      }

    } catch (error) {
      logger.error('❌ Error in sufficiency check middleware:', error);
      res.status(500).json({
        error: 'Sufficiency check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SUFFICIENCY_CHECK_FAILURE'
      });
    }
  };

  /**
   * Check economic data sufficiency
   */
  checkEconomicDataReadiness = async (
    req: SufficiencyCheckRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      logger.info('🔍 Performing economic data sufficiency check');

      const sufficiencyResult = await this.sufficiencyGates.checkEconomicDataSufficiency();
      req.sufficiencyResult = sufficiencyResult;

      switch (sufficiencyResult.recommendation) {
        case 'PROCEED':
          logger.info(`✅ Economic data sufficiency check passed (confidence: ${sufficiencyResult.confidence.toFixed(2)})`);
          next();
          break;

        case 'DEGRADE':
          logger.warn(`⚠️ Degraded economic data quality (confidence: ${sufficiencyResult.confidence.toFixed(2)})`);
          res.set({
            'X-Data-Quality': 'DEGRADED',
            'X-Data-Confidence': sufficiencyResult.confidence.toString(),
            'X-Data-Issues': sufficiencyResult.missingComponents.join(', ')
          });
          next();
          break;

        case 'SKIP':
          logger.error(`❌ Insufficient economic data: ${sufficiencyResult.missingComponents.join(', ')}`);
          res.status(422).json({
            error: 'Insufficient economic data for reliable analysis',
            confidence: sufficiencyResult.confidence,
            missingComponents: sufficiencyResult.missingComponents,
            details: sufficiencyResult.details,
            code: 'INSUFFICIENT_ECONOMIC_DATA'
          });
          break;

        default:
          res.status(500).json({
            error: 'Internal error in economic data sufficiency check',
            code: 'ECONOMIC_SUFFICIENCY_CHECK_ERROR'
          });
      }

    } catch (error) {
      logger.error('❌ Error in economic data sufficiency check:', error);
      res.status(500).json({
        error: 'Economic data sufficiency check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'ECONOMIC_SUFFICIENCY_CHECK_FAILURE'
      });
    }
  };

  /**
   * Batch check sufficiency for multiple symbols
   */
  checkBatchZScoreReadiness = async (
    req: SufficiencyCheckRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const symbols = req.body?.symbols || req.query.symbols;
      
      if (!symbols || !Array.isArray(symbols)) {
        res.status(400).json({
          error: 'Symbols array required for batch sufficiency check',
          code: 'MISSING_SYMBOLS'
        });
        return;
      }

      logger.info(`🔍 Performing batch sufficiency check for ${symbols.length} symbols`);

      const results = await this.sufficiencyGates.batchCheckZScoreReadiness(symbols);
      
      // Categorize results
      const sufficient: string[] = [];
      const degraded: string[] = [];
      const insufficient: string[] = [];

      results.forEach((result, symbol) => {
        switch (result.recommendation) {
          case 'PROCEED':
            sufficient.push(symbol);
            break;
          case 'DEGRADE':
            degraded.push(symbol);
            break;
          case 'SKIP':
            insufficient.push(symbol);
            break;
        }
      });

      // Store results for downstream use
      req.sufficiencyResult = {
        sufficient: sufficient.length === symbols.length,
        missingComponents: insufficient,
        confidence: sufficient.length / symbols.length,
        recommendation: insufficient.length > symbols.length / 2 ? 'SKIP' : 
                       degraded.length > 0 ? 'DEGRADE' : 'PROCEED',
        details: {
          dataPoints: sufficient.length,
          requiredMinimum: symbols.length,
          qualityScore: sufficient.length / symbols.length,
          lastUpdate: new Date(),
          staleness: 0
        }
      };

      // Add batch results to response headers
      res.set({
        'X-Batch-Sufficient': sufficient.length.toString(),
        'X-Batch-Degraded': degraded.length.toString(),
        'X-Batch-Insufficient': insufficient.length.toString(),
        'X-Batch-Total': symbols.length.toString()
      });

      if (insufficient.length > 0) {
        logger.warn(`⚠️ Batch check: ${insufficient.length}/${symbols.length} symbols insufficient`);
      }

      next();

    } catch (error) {
      logger.error('❌ Error in batch sufficiency check:', error);
      res.status(500).json({
        error: 'Batch sufficiency check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'BATCH_SUFFICIENCY_CHECK_FAILURE'
      });
    }
  };

  /**
   * Get sufficiency monitoring data
   */
  getSufficiencyMonitoring = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const summary = await this.sufficiencyGates.getSufficiencySummary();
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        sufficiencySummary: summary,
        healthScore: summary.overallHealth,
        status: summary.overallHealth > 0.8 ? 'HEALTHY' : 
                summary.overallHealth > 0.6 ? 'DEGRADED' : 'CRITICAL'
      });

    } catch (error) {
      logger.error('❌ Error getting sufficiency monitoring data:', error);
      res.status(500).json({
        error: 'Failed to get sufficiency monitoring data',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'SUFFICIENCY_MONITORING_ERROR'
      });
    }
  };
}

// Export singleton instance
export const sufficiencyCheckMiddleware = new SufficiencyCheckMiddleware();

// Export individual middleware functions for easier use
export const {
  checkZScoreReadiness,
  checkEconomicDataReadiness,
  checkBatchZScoreReadiness,
  getSufficiencyMonitoring
} = sufficiencyCheckMiddleware;