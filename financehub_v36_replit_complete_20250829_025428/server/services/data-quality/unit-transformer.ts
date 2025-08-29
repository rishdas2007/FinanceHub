import { logger } from '../../utils/logger';

export interface EconomicDataPoint {
  seriesId: string;
  value: number;
  originalUnit: string;
  targetUnit: string;
  transformationType: 'INDEX_TO_YOY' | 'LEVEL_TO_CHANGE' | 'SEASONAL_ADJUST' | 'PASSTHROUGH';
  date: string;
  confidence: number;
}

export interface TransformationRule {
  from: string;
  to: string;
  method: 'INDEX_TO_YOY' | 'LEVEL_TO_CHANGE' | 'SEASONAL_ADJUST' | 'PASSTHROUGH';
  description: string;
  windowSize?: number; // For YoY calculations
}

/**
 * Economic Unit Transformer
 * Handles standardization of economic data units for consistent analysis
 */
export class EconomicUnitTransformer {
  private transformationRules: Map<string, TransformationRule> = new Map([
    // Consumer Price Index transformations
    ['CPIAUCSL', {
      from: 'INDEX_1982_84_100',
      to: 'PERCENT_YOY',
      method: 'INDEX_TO_YOY',
      description: 'CPI All Urban Consumers: Index to Year-over-Year percentage',
      windowSize: 12
    }],
    ['CPIENGSL', {
      from: 'INDEX_1982_84_100',
      to: 'PERCENT_YOY',
      method: 'INDEX_TO_YOY',
      description: 'CPI Energy: Index to Year-over-Year percentage',
      windowSize: 12
    }],
    ['CPIFABSL', {
      from: 'INDEX_1982_84_100',
      to: 'PERCENT_YOY',
      method: 'INDEX_TO_YOY',
      description: 'CPI Food and Beverages: Index to Year-over-Year percentage',
      windowSize: 12
    }],

    // GDP transformations
    ['GDP', {
      from: 'BILLIONS_CHAINED_2012_DOLLARS',
      to: 'PERCENT_YOY',
      method: 'INDEX_TO_YOY',
      description: 'GDP: Level to Year-over-Year percentage growth',
      windowSize: 4 // Quarterly data
    }],
    ['GDPC1', {
      from: 'BILLIONS_CHAINED_2012_DOLLARS',
      to: 'PERCENT_YOY',
      method: 'INDEX_TO_YOY',
      description: 'Real GDP: Level to Year-over-Year percentage growth',
      windowSize: 4 // Quarterly data
    }],

    // Employment indicators (already in percent)
    ['UNRATE', {
      from: 'PERCENT',
      to: 'PERCENT',
      method: 'PASSTHROUGH',
      description: 'Unemployment Rate: Already in percentage'
    }],
    ['CIVPART', {
      from: 'PERCENT',
      to: 'PERCENT',
      method: 'PASSTHROUGH',
      description: 'Labor Force Participation Rate: Already in percentage'
    }],

    // Interest rates (already in percent)
    ['FEDFUNDS', {
      from: 'PERCENT',
      to: 'PERCENT',
      method: 'PASSTHROUGH',
      description: 'Federal Funds Rate: Already in percentage'
    }],
    ['DGS10', {
      from: 'PERCENT',
      to: 'PERCENT',
      method: 'PASSTHROUGH',
      description: '10-Year Treasury Rate: Already in percentage'
    }],
    ['DGS2', {
      from: 'PERCENT',
      to: 'PERCENT',
      method: 'PASSTHROUGH',
      description: '2-Year Treasury Rate: Already in percentage'
    }],

    // Industrial Production (convert to YoY)
    ['INDPRO', {
      from: 'INDEX_2017_100',
      to: 'PERCENT_YOY',
      method: 'INDEX_TO_YOY',
      description: 'Industrial Production: Index to Year-over-Year percentage',
      windowSize: 12
    }],

    // Housing indicators
    ['HOUST', {
      from: 'THOUSANDS_ANNUALIZED',
      to: 'PERCENT_YOY',
      method: 'LEVEL_TO_CHANGE',
      description: 'Housing Starts: Level to Year-over-Year percentage change',
      windowSize: 12
    }],

    // Personal Income and Consumption
    ['PI', {
      from: 'BILLIONS_DOLLARS',
      to: 'PERCENT_YOY',
      method: 'LEVEL_TO_CHANGE',
      description: 'Personal Income: Level to Year-over-Year percentage change',
      windowSize: 12
    }],
    ['PCE', {
      from: 'BILLIONS_DOLLARS',
      to: 'PERCENT_YOY',
      method: 'LEVEL_TO_CHANGE',
      description: 'Personal Consumption Expenditures: Level to Year-over-Year percentage change',
      windowSize: 12
    }]
  ]);

  async transformEconomicData(dataPoint: EconomicDataPoint, historicalData?: EconomicDataPoint[]): Promise<EconomicDataPoint> {
    try {
      const rule = this.transformationRules.get(dataPoint.seriesId);
      if (!rule) {
        logger.warn(`🔍 No transformation rule found for series ${dataPoint.seriesId}, using passthrough`);
        return {
          ...dataPoint,
          transformationType: 'PASSTHROUGH',
          targetUnit: dataPoint.originalUnit,
          confidence: Math.max(0.5, dataPoint.confidence - 0.2)
        };
      }

      logger.debug(`🔄 Transforming ${dataPoint.seriesId}: ${rule.description}`);

      const transformedDataPoint = await this.applyTransformation(dataPoint, rule, historicalData);
      
      logger.debug(`✅ Transformation complete for ${dataPoint.seriesId}:`, {
        original: `${dataPoint.value} ${dataPoint.originalUnit}`,
        transformed: `${transformedDataPoint.value} ${transformedDataPoint.targetUnit}`,
        method: rule.method
      });

      return transformedDataPoint;

    } catch (error) {
      logger.error(`❌ Error transforming data for ${dataPoint.seriesId}:`, error);
      return {
        ...dataPoint,
        transformationType: 'PASSTHROUGH',
        targetUnit: dataPoint.originalUnit,
        confidence: Math.max(0.3, dataPoint.confidence - 0.4)
      };
    }
  }

  private async applyTransformation(
    dataPoint: EconomicDataPoint, 
    rule: TransformationRule, 
    historicalData?: EconomicDataPoint[]
  ): Promise<EconomicDataPoint> {
    switch (rule.method) {
      case 'PASSTHROUGH':
        return {
          ...dataPoint,
          targetUnit: rule.to,
          transformationType: 'PASSTHROUGH'
        };

      case 'INDEX_TO_YOY':
        return this.transformIndexToYoY(dataPoint, rule, historicalData);

      case 'LEVEL_TO_CHANGE':
        return this.transformLevelToChange(dataPoint, rule, historicalData);

      case 'SEASONAL_ADJUST':
        return this.applySeasonalAdjustment(dataPoint, rule, historicalData);

      default:
        throw new Error(`Unknown transformation method: ${rule.method}`);
    }
  }

  private transformIndexToYoY(
    dataPoint: EconomicDataPoint, 
    rule: TransformationRule, 
    historicalData?: EconomicDataPoint[]
  ): EconomicDataPoint {
    if (!historicalData || historicalData.length === 0) {
      logger.warn(`⚠️ No historical data available for YoY calculation of ${dataPoint.seriesId}`);
      return {
        ...dataPoint,
        value: 0,
        targetUnit: rule.to,
        transformationType: 'INDEX_TO_YOY',
        confidence: 0.3
      };
    }

    const windowSize = rule.windowSize || 12;
    const currentDate = new Date(dataPoint.date);
    
    // Find data point from windowSize periods ago
    const historicalPoint = this.findHistoricalPoint(currentDate, windowSize, historicalData);
    
    if (!historicalPoint) {
      logger.warn(`⚠️ No historical data found ${windowSize} periods ago for ${dataPoint.seriesId}`);
      return {
        ...dataPoint,
        value: 0,
        targetUnit: rule.to,
        transformationType: 'INDEX_TO_YOY',
        confidence: 0.4
      };
    }

    // Calculate Year-over-Year percentage change
    const yoyChange = ((dataPoint.value - historicalPoint.value) / historicalPoint.value) * 100;

    return {
      ...dataPoint,
      value: Number(yoyChange.toFixed(2)),
      targetUnit: rule.to,
      transformationType: 'INDEX_TO_YOY',
      confidence: Math.min(dataPoint.confidence, 0.9)
    };
  }

  private transformLevelToChange(
    dataPoint: EconomicDataPoint, 
    rule: TransformationRule, 
    historicalData?: EconomicDataPoint[]
  ): EconomicDataPoint {
    if (!historicalData || historicalData.length === 0) {
      return {
        ...dataPoint,
        value: 0,
        targetUnit: rule.to,
        transformationType: 'LEVEL_TO_CHANGE',
        confidence: 0.3
      };
    }

    const windowSize = rule.windowSize || 12;
    const currentDate = new Date(dataPoint.date);
    const historicalPoint = this.findHistoricalPoint(currentDate, windowSize, historicalData);
    
    if (!historicalPoint) {
      return {
        ...dataPoint,
        value: 0,
        targetUnit: rule.to,
        transformationType: 'LEVEL_TO_CHANGE',
        confidence: 0.4
      };
    }

    const percentChange = ((dataPoint.value - historicalPoint.value) / historicalPoint.value) * 100;

    return {
      ...dataPoint,
      value: Number(percentChange.toFixed(2)),
      targetUnit: rule.to,
      transformationType: 'LEVEL_TO_CHANGE',
      confidence: Math.min(dataPoint.confidence, 0.9)
    };
  }

  private applySeasonalAdjustment(
    dataPoint: EconomicDataPoint, 
    rule: TransformationRule, 
    historicalData?: EconomicDataPoint[]
  ): EconomicDataPoint {
    // For now, just return the data as-is since most FRED data is already seasonally adjusted
    // This could be enhanced with actual seasonal adjustment algorithms
    logger.debug(`🔍 Seasonal adjustment requested for ${dataPoint.seriesId} - using data as-is`);
    
    return {
      ...dataPoint,
      targetUnit: rule.to,
      transformationType: 'SEASONAL_ADJUST',
      confidence: dataPoint.confidence * 0.95
    };
  }

  private findHistoricalPoint(currentDate: Date, windowSize: number, historicalData: EconomicDataPoint[]): EconomicDataPoint | null {
    const targetDate = new Date(currentDate);
    
    // For monthly data, subtract months; for quarterly, subtract quarters
    if (windowSize === 4) {
      // Quarterly data - subtract 1 year (4 quarters)
      targetDate.setFullYear(targetDate.getFullYear() - 1);
    } else {
      // Monthly data - subtract windowSize months
      targetDate.setMonth(targetDate.getMonth() - windowSize);
    }

    // Find the closest historical point to the target date
    let closestPoint: EconomicDataPoint | null = null;
    let closestDistance = Infinity;

    for (const point of historicalData) {
      const pointDate = new Date(point.date);
      const distance = Math.abs(pointDate.getTime() - targetDate.getTime());
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = point;
      }
    }

    // Only return the point if it's within a reasonable time window (e.g., 45 days)
    const maxDistance = 45 * 24 * 60 * 60 * 1000; // 45 days in milliseconds
    return closestDistance <= maxDistance ? closestPoint : null;
  }

  /**
   * Get transformation rule for a given series ID
   */
  getTransformationRule(seriesId: string): TransformationRule | null {
    return this.transformationRules.get(seriesId) || null;
  }

  /**
   * Add or update a transformation rule
   */
  addTransformationRule(seriesId: string, rule: TransformationRule): void {
    this.transformationRules.set(seriesId, rule);
    logger.info(`📝 Added transformation rule for ${seriesId}: ${rule.description}`);
  }

  /**
   * Get all available transformation rules
   */
  getAllRules(): Map<string, TransformationRule> {
    return new Map(this.transformationRules);
  }

  /**
   * Validate if a series needs transformation
   */
  needsTransformation(seriesId: string): boolean {
    const rule = this.transformationRules.get(seriesId);
    return rule ? rule.method !== 'PASSTHROUGH' : false;
  }
}