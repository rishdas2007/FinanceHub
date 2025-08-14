// Database pool configuration removed for startup optimization
import { logger } from '../../utils/logger.js';

export interface DataSufficiencyResult {
  sufficient: boolean;
  missingComponents: string[];
  confidence: number; // 0-1 scale
  recommendation: 'PROCEED' | 'DEGRADE' | 'SKIP';
  metadata: {
    historicalDataPoints: number;
    technicalIndicatorsAvailable: number;
    lastDataUpdate: string | null;
    dataQualityScore: number;
  };
}

export interface ZScoreDataRequirements {
  minimumHistoricalDays: number;
  requiredTechnicalIndicators: string[];
  minimumConfidenceThreshold: number;
  stalenessThresholdHours: number;
}

export class DataSufficiencyGates {
  private dbPool: DatabasePool;
  
  constructor() {
    this.dbPool = DatabasePool.getInstance();
  }

  private readonly zScoreRequirements: ZScoreDataRequirements = {
    minimumHistoricalDays: 60, // 60 days for 3-month Z-score calculation
    requiredTechnicalIndicators: ['macd_line', 'rsi14', 'bb_pctb', 'atr14'],
    minimumConfidenceThreshold: 0.7,
    stalenessThresholdHours: 24
  };

  async checkZScoreCalculationReadiness(symbol: string): Promise<DataSufficiencyResult> {
    try {
      logger.info(`🔍 Checking Z-score calculation readiness for ${symbol}`);

      // Check historical data availability
      const historicalDataCheck = await this.checkHistoricalDataSufficiency(symbol);
      
      // Check technical indicators availability
      const technicalIndicatorsCheck = await this.checkTechnicalIndicatorsSufficiency(symbol);
      
      // Check data freshness
      const freshnessCheck = await this.checkDataFreshness(symbol);
      
      // Check equity features data
      const equityFeaturesCheck = await this.checkEquityFeaturesSufficiency(symbol);

      // Calculate overall confidence and sufficiency
      const confidence = this.calculateOverallConfidence([
        historicalDataCheck,
        technicalIndicatorsCheck,
        freshnessCheck,
        equityFeaturesCheck
      ]);

      const missingComponents = this.identifyMissingComponents([
        historicalDataCheck,
        technicalIndicatorsCheck,
        freshnessCheck,
        equityFeaturesCheck
      ]);

      const sufficient = confidence >= this.zScoreRequirements.minimumConfidenceThreshold;
      
      const recommendation = this.determineRecommendation(confidence, missingComponents.length);

      logger.info(`📊 Z-score readiness for ${symbol}: ${sufficient ? 'SUFFICIENT' : 'INSUFFICIENT'} (confidence: ${confidence.toFixed(2)})`);

      return {
        sufficient,
        missingComponents,
        confidence,
        recommendation,
        metadata: {
          historicalDataPoints: historicalDataCheck.dataPoints,
          technicalIndicatorsAvailable: technicalIndicatorsCheck.availableIndicators,
          lastDataUpdate: freshnessCheck.lastUpdate,
          dataQualityScore: confidence
        }
      };

    } catch (error) {
      logger.error(`❌ Error checking Z-score calculation readiness for ${symbol}:`, error);
      return {
        sufficient: false,
        missingComponents: ['error-during-check'],
        confidence: 0,
        recommendation: 'SKIP',
        metadata: {
          historicalDataPoints: 0,
          technicalIndicatorsAvailable: 0,
          lastDataUpdate: null,
          dataQualityScore: 0
        }
      };
    }
  }

  private async checkHistoricalDataSufficiency(symbol: string): Promise<{
    sufficient: boolean;
    confidence: number;
    dataPoints: number;
    missingComponent?: string;
  }> {
    const query = `
      SELECT COUNT(*) as data_points,
             MAX(timestamp) as latest_date,
             MIN(timestamp) as earliest_date
      FROM stock_data 
      WHERE symbol = $1 
        AND timestamp >= NOW() - INTERVAL '90 days'
        AND close_price IS NOT NULL
    `;

    const result = await this.dbPool.query(query, [symbol]);
    const dataPoints = parseInt(result.rows[0]?.data_points || '0');
    
    const sufficient = dataPoints >= this.zScoreRequirements.minimumHistoricalDays;
    const confidence = Math.min(1.0, dataPoints / this.zScoreRequirements.minimumHistoricalDays);

    logger.debug(`📊 Historical data for ${symbol}: ${dataPoints} points (required: ${this.zScoreRequirements.minimumHistoricalDays})`);

    return {
      sufficient,
      confidence,
      dataPoints,
      missingComponent: sufficient ? undefined : 'historical-data'
    };
  }

  private async checkTechnicalIndicatorsSufficiency(symbol: string): Promise<{
    sufficient: boolean;
    confidence: number;
    availableIndicators: number;
    missingComponent?: string;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(macd_line) as macd_count,
        COUNT(rsi14) as rsi_count,
        COUNT(bb_pctb) as bb_count,
        COUNT(atr14) as atr_count,
        MAX(timestamp) as latest_update
      FROM technical_indicators 
      WHERE symbol = $1 
        AND timestamp >= NOW() - INTERVAL '30 days'
    `;

    const result = await this.dbPool.query(query, [symbol]);
    const row = result.rows[0];
    
    if (!row || parseInt(row.total_records) === 0) {
      return {
        sufficient: false,
        confidence: 0,
        availableIndicators: 0,
        missingComponent: 'technical-indicators'
      };
    }

    const indicators = {
      macd: parseInt(row.macd_count || '0'),
      rsi: parseInt(row.rsi_count || '0'),
      bb: parseInt(row.bb_count || '0'),
      atr: parseInt(row.atr_count || '0')
    };

    const availableCount = Object.values(indicators).filter(count => count > 0).length;
    const requiredCount = this.zScoreRequirements.requiredTechnicalIndicators.length;
    
    const sufficient = availableCount >= Math.ceil(requiredCount * 0.75); // 75% of required indicators
    const confidence = availableCount / requiredCount;

    logger.debug(`📊 Technical indicators for ${symbol}: ${availableCount}/${requiredCount} available`);

    return {
      sufficient,
      confidence,
      availableIndicators: availableCount,
      missingComponent: sufficient ? undefined : 'technical-indicators'
    };
  }

  private async checkDataFreshness(symbol: string): Promise<{
    sufficient: boolean;
    confidence: number;
    lastUpdate: string | null;
    missingComponent?: string;
  }> {
    const query = `
      SELECT MAX(timestamp) as last_update
      FROM (
        SELECT timestamp FROM stock_data WHERE symbol = $1
        UNION ALL
        SELECT timestamp FROM technical_indicators WHERE symbol = $1
        UNION ALL
        SELECT asof_date::timestamp FROM equity_features_daily WHERE symbol = $1
      ) combined_data
    `;

    const result = await this.dbPool.query(query, [symbol]);
    const lastUpdate = result.rows[0]?.last_update;

    if (!lastUpdate) {
      return {
        sufficient: false,
        confidence: 0,
        lastUpdate: null,
        missingComponent: 'data-freshness'
      };
    }

    const lastUpdateTime = new Date(lastUpdate);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
    
    const sufficient = hoursSinceUpdate <= this.zScoreRequirements.stalenessThresholdHours;
    const confidence = sufficient ? Math.max(0.5, 1 - (hoursSinceUpdate / (this.zScoreRequirements.stalenessThresholdHours * 2))) : 0.3;

    logger.debug(`📊 Data freshness for ${symbol}: ${hoursSinceUpdate.toFixed(1)} hours old (threshold: ${this.zScoreRequirements.stalenessThresholdHours}h)`);

    return {
      sufficient,
      confidence,
      lastUpdate: lastUpdate,
      missingComponent: sufficient ? undefined : 'data-freshness'
    };
  }

  private async checkEquityFeaturesSufficiency(symbol: string): Promise<{
    sufficient: boolean;
    confidence: number;
    featuresCount: number;
    missingComponent?: string;
  }> {
    const query = `
      SELECT 
        COUNT(*) as feature_records,
        COUNT(composite_z_60d) as composite_z_count,
        COUNT(macd_z_60d) as macd_z_count,
        COUNT(rsi_z_60d) as rsi_z_count,
        COUNT(bb_z_60d) as bb_z_count,
        MAX(asof_date) as latest_features
      FROM equity_features_daily 
      WHERE symbol = $1 
        AND asof_date >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const result = await this.dbPool.query(query, [symbol]);
    const row = result.rows[0];
    
    if (!row || parseInt(row.feature_records) === 0) {
      return {
        sufficient: false,
        confidence: 0.2, // Some confidence from other data sources
        featuresCount: 0,
        missingComponent: 'equity-features'
      };
    }

    const features = {
      composite: parseInt(row.composite_z_count || '0'),
      macd: parseInt(row.macd_z_count || '0'),
      rsi: parseInt(row.rsi_z_count || '0'),
      bb: parseInt(row.bb_z_count || '0')
    };

    const availableFeatures = Object.values(features).filter(count => count > 0).length;
    const requiredFeatures = 3; // At least 3 z-score features for good analysis
    
    const sufficient = availableFeatures >= requiredFeatures;
    const confidence = Math.min(1.0, availableFeatures / requiredFeatures);

    logger.debug(`📊 Equity features for ${symbol}: ${availableFeatures}/${requiredFeatures} Z-score features`);

    return {
      sufficient,
      confidence,
      featuresCount: availableFeatures,
      missingComponent: sufficient ? undefined : 'equity-features'
    };
  }

  private calculateOverallConfidence(checks: Array<{ confidence: number }>): number {
    if (checks.length === 0) return 0;
    
    // Weighted average with higher weight on critical components
    const weights = [0.3, 0.3, 0.2, 0.2]; // historical, technical, freshness, features
    let weightedSum = 0;
    let totalWeight = 0;

    checks.forEach((check, index) => {
      const weight = weights[index] || 0.25;
      weightedSum += check.confidence * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private identifyMissingComponents(checks: Array<{ missingComponent?: string }>): string[] {
    return checks
      .filter(check => check.missingComponent)
      .map(check => check.missingComponent!)
      .filter((component, index, array) => array.indexOf(component) === index); // Remove duplicates
  }

  private determineRecommendation(confidence: number, missingComponentsCount: number): 'PROCEED' | 'DEGRADE' | 'SKIP' {
    if (confidence >= 0.8 && missingComponentsCount === 0) {
      return 'PROCEED';
    } else if (confidence >= 0.5 && missingComponentsCount <= 2) {
      return 'DEGRADE';
    } else {
      return 'SKIP';
    }
  }

  async checkEconomicDataSufficiency(): Promise<DataSufficiencyResult> {
    try {
      logger.info('🔍 Checking economic data sufficiency');

      const query = `
        SELECT 
          COUNT(*) as total_indicators,
          COUNT(CASE WHEN last_updated >= NOW() - INTERVAL '30 days' THEN 1 END) as fresh_indicators,
          COUNT(CASE WHEN current_reading IS NOT NULL AND current_reading != '' THEN 1 END) as valid_readings,
          MAX(last_updated) as latest_update
        FROM economic_indicators_history
      `;

      const result = await this.dbPool.query(query);
      const row = result.rows[0];

      const totalIndicators = parseInt(row.total_indicators || '0');
      const freshIndicators = parseInt(row.fresh_indicators || '0');
      const validReadings = parseInt(row.valid_readings || '0');

      const sufficient = totalIndicators >= 20 && freshIndicators >= 15 && validReadings >= 18;
      const confidence = Math.min(1.0, (freshIndicators / 20) * (validReadings / 20));

      const missingComponents = [];
      if (totalIndicators < 20) missingComponents.push('insufficient-indicators');
      if (freshIndicators < 15) missingComponents.push('stale-economic-data');
      if (validReadings < 18) missingComponents.push('invalid-readings');

      const recommendation = this.determineRecommendation(confidence, missingComponents.length);

      logger.info(`📊 Economic data sufficiency: ${sufficient ? 'SUFFICIENT' : 'INSUFFICIENT'} (${totalIndicators} indicators, ${freshIndicators} fresh)`);

      return {
        sufficient,
        missingComponents,
        confidence,
        recommendation,
        metadata: {
          historicalDataPoints: totalIndicators,
          technicalIndicatorsAvailable: freshIndicators,
          lastDataUpdate: row.latest_update,
          dataQualityScore: confidence
        }
      };

    } catch (error) {
      logger.error('❌ Error checking economic data sufficiency:', error);
      return {
        sufficient: false,
        missingComponents: ['error-during-economic-check'],
        confidence: 0,
        recommendation: 'SKIP',
        metadata: {
          historicalDataPoints: 0,
          technicalIndicatorsAvailable: 0,
          lastDataUpdate: null,
          dataQualityScore: 0
        }
      };
    }
  }
}