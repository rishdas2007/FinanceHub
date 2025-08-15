import { logger } from '../utils/logger.js';
import { ZScoreDataQualityValidator, ZScoreValidationResult } from './data-quality/zscore-validator.js';
import { DataSufficiencyGates } from './data-quality/sufficiency-gates.js';
import { ETFMetric } from '../../shared/validation/etf-contracts.js';
// Database pool configuration removed for startup optimization

export interface ETFMetricsV2Response {
  success: boolean;
  data: ETFMetric[];
  horizon: string;
  timestamp: string;
  source: string;
  dataQuality: {
    validated: boolean;
    confidence: number;
    errors: number;
    warnings: number;
    recommendation: 'PROCEED' | 'DEGRADE' | 'SKIP';
    sufficiency: {
      historicalDataPoints: number;
      technicalIndicatorsAvailable: number;
      lastDataUpdate: string | null;
    };
  };
}

/**
 * Enhanced ETF Metrics Service with Data Quality-First Architecture
 * Implements runtime validation, sufficiency gates, and fail-fast mechanisms
 */
export class ETFMetricsServiceV2 {
  private validator: ZScoreDataQualityValidator;
  private sufficiencyGates: DataSufficiencyGates;
  private dbPool: DatabasePool;

  constructor() {
    this.validator = new ZScoreDataQualityValidator();
    this.sufficiencyGates = new DataSufficiencyGates();
    this.dbPool = DatabasePool.getInstance();
  }

  async getETFMetricsWithValidation(): Promise<ETFMetricsV2Response> {
    const startTime = Date.now();
    logger.info('🔍 Starting ETF metrics fetch with Data Quality-First validation');

    try {
      // Step 1: Check data sufficiency before calculation
      const sufficiencyCheck = await this.performSufficiencyCheck();
      if (sufficiencyCheck.recommendation === 'SKIP') {
        return this.createFailedResponse('Insufficient data quality for ETF metrics calculation', sufficiencyCheck);
      }

      // Step 2: Fetch raw ETF data with circuit breaker
      const rawETFData = await this.fetchRawETFData();

      // Step 3: Validate raw data against contracts
      const validationResult = await this.validator.validateETFMetricsArray(rawETFData);

      // Step 4: Apply quality-based processing logic
      const processedData = await this.processETFDataWithQuality(rawETFData, validationResult);

      // Step 5: Final quality assessment
      const finalValidation = await this.validator.validateETFMetricsArray(processedData);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ ETF metrics with validation completed in ${processingTime}ms`, {
        itemCount: processedData.length,
        confidence: finalValidation.confidence,
        recommendation: finalValidation.recommendation
      });

      return {
        success: true,
        data: processedData,
        horizon: '60d',
        timestamp: new Date().toISOString(),
        source: 'enhanced-etf-metrics-v2',
        dataQuality: {
          validated: true,
          confidence: finalValidation.confidence,
          errors: finalValidation.errors.length,
          warnings: finalValidation.warnings.length,
          recommendation: finalValidation.recommendation,
          sufficiency: {
            historicalDataPoints: finalValidation.sufficiency.metadata.historicalDataPoints,
            technicalIndicatorsAvailable: finalValidation.sufficiency.metadata.technicalIndicatorsAvailable,
            lastDataUpdate: finalValidation.sufficiency.metadata.lastDataUpdate
          }
        }
      };

    } catch (error) {
      logger.error('❌ Error in ETF metrics with validation:', error);
      return this.createErrorResponse(error.message);
    }
  }

  private async performSufficiencyCheck(): Promise<ZScoreValidationResult> {
    const majorETFs = ['SPY', 'XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLY', 'XLP', 'XLU', 'XLB', 'XLC', 'XLRE'];
    
    // Check sufficiency for major ETFs
    const sufficiencyChecks = await Promise.all(
      majorETFs.map(async symbol => {
        const result = await this.sufficiencyGates.checkZScoreCalculationReadiness(symbol);
        return { symbol, result };
      })
    );

    const sufficientCount = sufficiencyChecks.filter(check => check.result.sufficient).length;
    const averageConfidence = sufficiencyChecks.reduce((sum, check) => sum + check.result.confidence, 0) / sufficiencyChecks.length;

    logger.info(`📊 ETF data sufficiency check: ${sufficientCount}/${majorETFs.length} ETFs have sufficient data (avg confidence: ${averageConfidence.toFixed(2)})`);

    return {
      valid: sufficientCount >= 8, // At least 8 out of 12 major ETFs should have sufficient data
      confidence: averageConfidence,
      recommendation: sufficientCount >= 10 ? 'PROCEED' : sufficientCount >= 8 ? 'DEGRADE' : 'SKIP',
      errors: sufficientCount < 6 ? ['Insufficient data for majority of major ETFs'] : [],
      warnings: sufficientCount < 10 ? [`Only ${sufficientCount}/12 major ETFs have sufficient data`] : [],
      sufficiency: {
        sufficient: sufficientCount >= 8,
        missingComponents: sufficiencyChecks
          .filter(check => !check.result.sufficient)
          .map(check => check.symbol),
        confidence: averageConfidence,
        recommendation: sufficientCount >= 10 ? 'PROCEED' : sufficientCount >= 8 ? 'DEGRADE' : 'SKIP',
        metadata: {
          historicalDataPoints: sufficientCount,
          technicalIndicatorsAvailable: sufficiencyChecks.filter(c => c.result.metadata.technicalIndicatorsAvailable > 2).length,
          lastDataUpdate: new Date().toISOString(),
          dataQualityScore: averageConfidence
        }
      }
    };
  }

  private async fetchRawETFData(): Promise<ETFMetric[]> {
    logger.info('📊 Fetching raw ETF data with enhanced queries');

    const query = `
      WITH recent_equity_features AS (
        SELECT DISTINCT ON (symbol)
          symbol,
          composite_z_60d as compositeZ,
          macd_z_60d as macdZ,
          rsi_z_60d as rsiZ,
          bb_z_60d as bbZ,
          ma_gap_z_60d as maGapZ,
          mom5d_z_60d as mom5dZ,
          asof_date
        FROM equity_features_daily
        WHERE asof_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY symbol, asof_date DESC
      ),
      recent_stock_data AS (
        SELECT DISTINCT ON (symbol)
          symbol,
          close_price as price,
          timestamp
        FROM stock_data
        WHERE timestamp >= NOW() - INTERVAL '2 days'
          AND symbol IN ('SPY', 'XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLY', 'XLP', 'XLU', 'XLB', 'XLC', 'XLRE')
        ORDER BY symbol, timestamp DESC
      ),
      recent_technical AS (
        SELECT DISTINCT ON (symbol)
          symbol,
          rsi14,
          bb_pctb,
          atr14,
          timestamp
        FROM technical_indicators
        WHERE timestamp >= NOW() - INTERVAL '7 days'
          AND symbol IN ('SPY', 'XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLY', 'XLP', 'XLU', 'XLB', 'XLC', 'XLRE')
        ORDER BY symbol, timestamp DESC
      ),
      price_changes AS (
        SELECT 
          current.symbol,
          CASE 
            WHEN previous.close_price > 0 THEN 
              (current.close_price - previous.close_price) / previous.close_price
            ELSE 0
          END as pctChange
        FROM recent_stock_data current
        LEFT JOIN LATERAL (
          SELECT close_price
          FROM stock_data prev
          WHERE prev.symbol = current.symbol
            AND prev.timestamp < current.timestamp
            AND prev.timestamp >= current.timestamp - INTERVAL '2 days'
          ORDER BY prev.timestamp DESC
          LIMIT 1
        ) previous ON true
      )
      SELECT 
        sd.symbol,
        sd.price,
        COALESCE(pc.pctChange, 0) as pctChange,
        ef.compositeZ,
        NULL::numeric as dz1,
        NULL::numeric as dz5,
        CASE 
          WHEN ef.compositeZ > 1.5 THEN 'SELL'
          WHEN ef.compositeZ < -1.5 THEN 'BUY'
          ELSE 'HOLD'
        END as signal,
        jsonb_build_object(
          'macdZ', ef.macdZ,
          'rsi14', rt.rsi14,
          'rsiZ', ef.rsiZ,
          'bbPctB', rt.bb_pctb,
          'bbZ', ef.bbZ,
          'maGapPct', NULL,
          'maGapZ', ef.maGapZ,
          'mom5dZ', ef.mom5dZ
        ) as components,
        jsonb_build_object(
          'ma50', NULL,
          'ma200', NULL,
          'gapPct', NULL
        ) as ma,
        rt.atr14,
        jsonb_build_object(
          'rs30', NULL,
          'rs90', NULL,
          'beta252', NULL,
          'corr252', NULL
        ) as rs,
        jsonb_build_object(
          'avgDollarVol20d', NULL
        ) as liq
      FROM recent_stock_data sd
      LEFT JOIN recent_equity_features ef ON sd.symbol = ef.symbol
      LEFT JOIN recent_technical rt ON sd.symbol = rt.symbol
      LEFT JOIN price_changes pc ON sd.symbol = pc.symbol
      WHERE sd.price IS NOT NULL
      ORDER BY sd.symbol
    `;

    const result = await this.dbPool.query(query);
    
    logger.info(`📊 Raw ETF data fetched: ${result.rows.length} records`);

    return result.rows.map(row => this.transformDatabaseRowToETFMetric(row));
  }

  private transformDatabaseRowToETFMetric(row: any): ETFMetric {
    return {
      symbol: row.symbol,
      price: Number(row.price),
      pctChange: Number(row.pctchange || 0),
      compositeZ: row.compositez ? Number(row.compositez) : null,
      dz1: row.dz1 ? Number(row.dz1) : null,
      dz5: row.dz5 ? Number(row.dz5) : null,
      signal: row.signal,
      components: {
        macdZ: row.components?.macdZ ? Number(row.components.macdZ) : null,
        rsi14: row.components?.rsi14 ? Number(row.components.rsi14) : null,
        rsiZ: row.components?.rsiZ ? Number(row.components.rsiZ) : null,
        bbPctB: row.components?.bbPctB ? Number(row.components.bbPctB) : null,
        bbZ: row.components?.bbZ ? Number(row.components.bbZ) : null,
        maGapPct: row.components?.maGapPct ? Number(row.components.maGapPct) : null,
        maGapZ: row.components?.maGapZ ? Number(row.components.maGapZ) : null,
        mom5dZ: row.components?.mom5dZ ? Number(row.components.mom5dZ) : null
      },
      ma: {
        ma50: row.ma?.ma50 ? Number(row.ma.ma50) : null,
        ma200: row.ma?.ma200 ? Number(row.ma.ma200) : null,
        gapPct: row.ma?.gapPct ? Number(row.ma.gapPct) : null
      },
      atr14: row.atr14 ? Number(row.atr14) : null,
      rs: {
        rs30: row.rs?.rs30 ? Number(row.rs.rs30) : null,
        rs90: row.rs?.rs90 ? Number(row.rs.rs90) : null,
        beta252: row.rs?.beta252 ? Number(row.rs.beta252) : null,
        corr252: row.rs?.corr252 ? Number(row.rs.corr252) : null
      },
      liq: {
        avgDollarVol20d: row.liq?.avgDollarVol20d ? Number(row.liq.avgDollarVol20d) : null
      }
    };
  }

  private async processETFDataWithQuality(rawData: ETFMetric[], validation: ZScoreValidationResult): Promise<ETFMetric[]> {
    logger.info(`🔧 Processing ${rawData.length} ETF records with quality validation`);

    const processedData: ETFMetric[] = [];

    for (const etf of rawData) {
      try {
        // Individual validation for each ETF
        const etfValidation = await this.validator.validateForZScoreCalculation(etf.symbol, etf);

        if (etfValidation.recommendation === 'SKIP') {
          logger.warn(`⚠️ Skipping ${etf.symbol} due to quality issues:`, etfValidation.errors);
          continue;
        }

        // Apply quality-based adjustments
        const processedETF = this.applyQualityAdjustments(etf, etfValidation);
        processedData.push(processedETF);

        if (etfValidation.recommendation === 'DEGRADE') {
          logger.info(`📊 ${etf.symbol} processed with degraded quality (confidence: ${etfValidation.confidence.toFixed(2)})`);
        }

      } catch (error) {
        logger.error(`❌ Error processing ${etf.symbol}:`, error);
      }
    }

    logger.info(`✅ ETF data processing complete: ${processedData.length}/${rawData.length} records passed quality validation`);
    return processedData;
  }

  private applyQualityAdjustments(etf: ETFMetric, validation: ZScoreValidationResult): ETFMetric {
    const adjustedETF = { ...etf };

    // Adjust composite Z-score based on confidence
    if (adjustedETF.compositeZ !== null && validation.confidence < 0.8) {
      // Dampen extreme Z-scores for low confidence data
      const dampingFactor = Math.max(0.5, validation.confidence);
      adjustedETF.compositeZ = adjustedETF.compositeZ * dampingFactor;
    }

    // Adjust signal based on validation warnings
    if (validation.warnings.some(w => w.includes('Signal') && w.includes('inconsistent'))) {
      adjustedETF.signal = 'HOLD'; // Conservative approach for inconsistent signals
    }

    // Set null values for components with very low confidence
    if (validation.confidence < 0.5) {
      adjustedETF.components.maGapZ = null;
      adjustedETF.components.mom5dZ = null;
    }

    return adjustedETF;
  }

  private createFailedResponse(error: string, sufficiencyCheck: ZScoreValidationResult): ETFMetricsV2Response {
    return {
      success: false,
      data: [],
      horizon: '60d',
      timestamp: new Date().toISOString(),
      source: 'enhanced-etf-metrics-v2',
      dataQuality: {
        validated: true,
        confidence: sufficiencyCheck.confidence,
        errors: sufficiencyCheck.errors.length,
        warnings: sufficiencyCheck.warnings.length,
        recommendation: sufficiencyCheck.recommendation,
        sufficiency: {
          historicalDataPoints: sufficiencyCheck.sufficiency.metadata.historicalDataPoints,
          technicalIndicatorsAvailable: sufficiencyCheck.sufficiency.metadata.technicalIndicatorsAvailable,
          lastDataUpdate: sufficiencyCheck.sufficiency.metadata.lastDataUpdate
        }
      }
    };
  }

  private createErrorResponse(error: string): ETFMetricsV2Response {
    return {
      success: false,
      data: [],
      horizon: '60d',
      timestamp: new Date().toISOString(),
      source: 'enhanced-etf-metrics-v2',
      dataQuality: {
        validated: false,
        confidence: 0,
        errors: 1,
        warnings: 0,
        recommendation: 'SKIP',
        sufficiency: {
          historicalDataPoints: 0,
          technicalIndicatorsAvailable: 0,
          lastDataUpdate: null
        }
      }
    };
  }
}