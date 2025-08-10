import { logger } from '../utils/logger';
import { CentralizedZScoreService, ZScoreResult } from './centralized-zscore-service';
import { HistoricalDataBackfillService } from './historical-data-backfill-service';

interface EnhancedZScoreResult extends ZScoreResult {
  sufficiencyWarning?: {
    hasWarning: boolean;
    confidence: number;
    reliability: 'high' | 'medium' | 'low' | 'unreliable';
    message: string;
    recommendedAction: string;
  };
}

/**
 * Enhanced Z-Score Service with Data Sufficiency Integration
 * Addresses the data sufficiency problem by providing warnings and confidence scores
 * Integrates with the historical data backfill service for comprehensive analysis
 */
export class EnhancedZScoreWithSufficiencyService {
  private centralizedZScoreService: CentralizedZScoreService;
  private backfillService: HistoricalDataBackfillService;

  constructor() {
    this.centralizedZScoreService = new CentralizedZScoreService();
    this.backfillService = new HistoricalDataBackfillService();
  }

  /**
   * Calculate Z-Score with comprehensive data sufficiency analysis
   */
  async calculateZScoreWithSufficiency(
    symbol: string,
    metric: string,
    values: number[],
    assetClass: 'equity' | 'etf' | 'economic' | 'volatility',
    dataFrequency: 'realtime' | 'intraday' | 'daily' | 'economic' = 'daily'
  ): Promise<EnhancedZScoreResult> {
    logger.debug(`Calculating enhanced z-score for ${symbol}:${metric}`, {
      dataPoints: values.length,
      assetClass
    });

    // Calculate standard z-score
    const zScoreResult = await this.centralizedZScoreService.getZScore(
      symbol,
      metric,
      values,
      assetClass,
      dataFrequency
    );

    // Get data sufficiency warning
    const sufficiencyWarning = await this.backfillService.getDataSufficiencyWarning(
      symbol,
      values.length
    );

    // Apply confidence adjustments based on data sufficiency
    const adjustedResult: EnhancedZScoreResult = {
      ...zScoreResult,
      sufficiencyWarning: {
        ...sufficiencyWarning,
        recommendedAction: this.getRecommendedAction(sufficiencyWarning.reliability, zScoreResult.zScore)
      }
    };

    // Adjust quality score based on data sufficiency
    if (sufficiencyWarning.hasWarning) {
      adjustedResult.quality = Math.min(adjustedResult.quality, sufficiencyWarning.confidence);
    }

    logger.debug(`Enhanced z-score calculated for ${symbol}`, {
      zScore: adjustedResult.zScore?.toFixed(4),
      originalQuality: zScoreResult.quality.toFixed(3),
      adjustedQuality: adjustedResult.quality.toFixed(3),
      reliability: sufficiencyWarning.reliability,
      hasWarning: sufficiencyWarning.hasWarning
    });

    return adjustedResult;
  }

  /**
   * Get recommended action based on reliability and z-score value
   */
  private getRecommendedAction(
    reliability: 'high' | 'medium' | 'low' | 'unreliable',
    zScore: number | null
  ): string {
    if (!zScore) return 'Insufficient data for analysis';

    const absZScore = Math.abs(zScore);
    const signalStrength = absZScore > 2 ? 'strong' : absZScore > 1 ? 'moderate' : 'weak';

    switch (reliability) {
      case 'high':
        return `Reliable ${signalStrength} signal - proceed with normal confidence`;
      
      case 'medium':
        return `${signalStrength} signal with moderate reliability - reduce position size by 30%`;
      
      case 'low':
        return `${signalStrength} signal with limited reliability - treat as experimental, use small position sizes`;
      
      case 'unreliable':
        return `Signal unreliable due to insufficient data - postpone trading decisions until more data is available`;
      
      default:
        return 'Unable to determine recommended action';
    }
  }

  /**
   * Batch calculate z-scores with sufficiency warnings for multiple symbols
   */
  async batchCalculateWithSufficiency(
    requests: Array<{
      symbol: string;
      metric: string;
      values: number[];
      assetClass: 'equity' | 'etf' | 'economic' | 'volatility';
    }>
  ): Promise<Array<EnhancedZScoreResult & { symbol: string; metric: string }>> {
    const results = await Promise.all(
      requests.map(async (request) => {
        const result = await this.calculateZScoreWithSufficiency(
          request.symbol,
          request.metric,
          request.values,
          request.assetClass
        );
        
        return {
          ...result,
          symbol: request.symbol,
          metric: request.metric
        };
      })
    );

    // Log batch summary
    const reliable = results.filter(r => r.sufficiencyWarning?.reliability === 'high').length;
    const unreliable = results.filter(r => r.sufficiencyWarning?.reliability === 'unreliable').length;
    
    logger.info(`Batch z-score calculation completed`, {
      totalSymbols: results.length,
      reliableSignals: reliable,
      unreliableSignals: unreliable,
      avgQuality: results.reduce((sum, r) => sum + r.quality, 0) / results.length
    });

    return results;
  }

  /**
   * Get symbol-specific data sufficiency report
   */
  async getSymbolDataSufficiency(symbol: string) {
    return await this.backfillService.getDataSufficiencyForSymbol(symbol);
  }

  /**
   * Check if symbol needs data backfill
   */
  async needsBackfill(symbol: string, minConfidence: number = 0.8): Promise<boolean> {
    const report = await this.getSymbolDataSufficiency(symbol);
    return report.confidence < minConfidence;
  }

  /**
   * Get confidence-adjusted signal strength
   */
  getAdjustedSignalStrength(
    zScore: number | null,
    confidence: number,
    reliability: 'high' | 'medium' | 'low' | 'unreliable'
  ): {
    adjustedZScore: number | null;
    signalStrength: 'strong' | 'moderate' | 'weak' | 'unreliable';
    tradingViability: boolean;
  } {
    if (!zScore) {
      return {
        adjustedZScore: null,
        signalStrength: 'unreliable',
        tradingViability: false
      };
    }

    // Apply confidence dampening based on the analysis recommendations
    const dampingFactor = reliability === 'high' ? 1.0 :
                         reliability === 'medium' ? 0.7 :
                         reliability === 'low' ? 0.5 : 0.0;

    const adjustedZScore = zScore * dampingFactor;
    const absAdjustedZScore = Math.abs(adjustedZScore);

    const signalStrength = reliability === 'unreliable' ? 'unreliable' :
                          absAdjustedZScore > 2 ? 'strong' :
                          absAdjustedZScore > 1 ? 'moderate' : 'weak';

    const tradingViability = reliability !== 'unreliable' && confidence > 0.5;

    return {
      adjustedZScore,
      signalStrength,
      tradingViability
    };
  }
}