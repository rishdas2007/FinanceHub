// ETL Service: Bronze → Silver → Gold
// Standardizes all economic data through the 3-layer model

import { db } from '../db';
import { econSeriesDef, econSeriesRaw, econSeriesObservation, econSeriesFeatures } from '../../shared/economic-data-model';
import { eq, desc, and, gte } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import { formatValue, classifyLevel, classifyTrend, getMultiSignal } from '../../shared/formatters/economic-formatters';

interface StandardizeParams {
  seriesId: string;
  forceRefresh?: boolean;
}

export class EconomicDataStandardizer {
  private readonly PIPELINE_VERSION = 'econ_v3.2';

  /**
   * Main ETL pipeline: Bronze → Silver → Gold
   */
  async standardizeSeries({ seriesId, forceRefresh = false }: StandardizeParams) {
    try {
      logger.info(`Starting standardization for ${seriesId}`);

      // Get series metadata
      const seriesDef = await this.getSeriesDefinition(seriesId);
      if (!seriesDef) {
        throw new Error(`Series definition not found: ${seriesId}`);
      }

      // Step 1: Bronze → Silver (Standardization)
      await this.standardizeToSilver(seriesId, seriesDef);

      // Step 2: Silver → Gold (Feature Engineering)
      await this.computeFeatures(seriesId, seriesDef);

      logger.info(`Standardization completed for ${seriesId}`);
      return { success: true, seriesId };

    } catch (error) {
      logger.error(`Standardization failed for ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Get series metadata
   */
  private async getSeriesDefinition(seriesId: string) {
    const [definition] = await db
      .select()
      .from(econSeriesDef)
      .where(eq(econSeriesDef.seriesId, seriesId))
      .limit(1);
    
    return definition;
  }

  /**
   * Bronze → Silver: Convert raw data to standardized units
   */
  private async standardizeToSilver(seriesId: string, seriesDef: any) {
    // Get latest raw data
    const rawData = await db
      .select()
      .from(econSeriesRaw)
      .where(eq(econSeriesRaw.seriesId, seriesId))
      .orderBy(desc(econSeriesRaw.periodEnd));

    if (rawData.length === 0) {
      logger.warn(`No raw data found for ${seriesId}`);
      return;
    }

    // Transform each raw observation to standardized format
    for (const rawObs of rawData) {
      const standardizedValue = this.standardizeValue(
        rawObs.valueRaw,
        rawObs.unitRaw,
        seriesDef.standardUnit
      );

      // Apply transformation (LEVEL, YOY, etc.)
      const transformedValue = await this.applyTransform(
        standardizedValue,
        seriesDef.defaultTransform,
        rawObs.periodEnd,
        seriesId
      );

      // Insert/update silver observation
      await db.insert(econSeriesObservation).values({
        seriesId,
        periodStart: rawObs.periodEnd, // Assuming point-in-time data
        periodEnd: rawObs.periodEnd,
        freq: 'M', // Most economic data is monthly
        valueStd: transformedValue,
        standardUnit: seriesDef.standardUnit,
        aggMethod: seriesDef.alignPolicy,
        scaleHint: seriesDef.scaleHint,
        displayPrecision: seriesDef.displayPrecision,
        transformCode: seriesDef.defaultTransform
      }).onConflictDoUpdate({
        target: [econSeriesObservation.seriesId, econSeriesObservation.periodEnd, econSeriesObservation.transformCode],
        set: {
          valueStd: transformedValue,
          standardUnit: seriesDef.standardUnit,
          scaleHint: seriesDef.scaleHint,
          displayPrecision: seriesDef.displayPrecision
        }
      });
    }

    logger.info(`Standardized ${rawData.length} observations for ${seriesId}`);
  }

  /**
   * Silver → Gold: Compute features and signals
   */
  private async computeFeatures(seriesId: string, seriesDef: any) {
    // Get silver observations for feature calculation
    const observations = await db
      .select()
      .from(econSeriesObservation)
      .where(and(
        eq(econSeriesObservation.seriesId, seriesId),
        eq(econSeriesObservation.transformCode, seriesDef.defaultTransform)
      ))
      .orderBy(desc(econSeriesObservation.periodEnd));

    if (observations.length < 2) {
      logger.warn(`Insufficient data for features: ${seriesId}`);
      return;
    }

    const windowMonths = seriesDef.preferredWindowMonths || 60;
    
    for (let i = windowMonths; i < observations.length; i++) {
      const currentObs = observations[i];
      const windowData = observations.slice(i - windowMonths, i);
      
      // Calculate features
      const features = this.calculateFeatures(currentObs, windowData);
      
      // Compute z-scores
      const levelZ = (currentObs.valueStd - features.meanLevel) / features.sdLevel;
      const changeZ = (features.deltaT - features.meanDelta) / features.sdDelta;
      
      // Generate classifications
      const levelClass = classifyLevel(levelZ);
      const trendClass = classifyTrend(changeZ);
      const multiSignal = getMultiSignal(levelZ, changeZ);

      // Insert/update gold features
      await db.insert(econSeriesFeatures).values({
        seriesId,
        periodEnd: currentObs.periodEnd,
        transformCode: seriesDef.defaultTransform,
        refWindowMonths: windowMonths,
        valueT: currentObs.valueStd,
        deltaT: features.deltaT,
        meanLevel: features.meanLevel,
        sdLevel: features.sdLevel,
        meanDelta: features.meanDelta,
        sdDelta: features.sdDelta,
        levelZ,
        changeZ,
        levelClass,
        trendClass,
        multiSignal,
        pipelineVersion: this.PIPELINE_VERSION,
        provenance: {
          windowMonths,
          transform: seriesDef.defaultTransform,
          alignPolicy: seriesDef.alignPolicy,
          computedAt: new Date().toISOString()
        }
      }).onConflictDoUpdate({
        target: [
          econSeriesFeatures.seriesId, 
          econSeriesFeatures.periodEnd, 
          econSeriesFeatures.transformCode,
          econSeriesFeatures.pipelineVersion
        ],
        set: {
          valueT: currentObs.valueStd,
          deltaT: features.deltaT,
          meanLevel: features.meanLevel,
          sdLevel: features.sdLevel,
          meanDelta: features.meanDelta,
          sdDelta: features.sdDelta,
          levelZ,
          changeZ,
          levelClass,
          trendClass,
          multiSignal
        }
      });
    }

    logger.info(`Computed features for ${observations.length - windowMonths} periods: ${seriesId}`);
  }

  /**
   * Standardize raw value to canonical unit
   */
  private standardizeValue(rawValue: number, rawUnit: string, targetUnit: string): number {
    // Convert based on unit patterns
    if (targetUnit === 'PCT_DECIMAL') {
      // Convert percentage to decimal
      if (rawUnit.toLowerCase().includes('percent') || rawUnit.includes('%')) {
        return rawValue / 100; // 4.2% → 0.042
      }
    }

    if (targetUnit === 'USD') {
      // Handle different dollar scales
      if (rawUnit.includes('Billions')) {
        return rawValue * 1000000000;
      }
      if (rawUnit.includes('Millions')) {
        return rawValue * 1000000;
      }
      if (rawUnit.includes('Thousands')) {
        return rawValue * 1000;
      }
    }

    if (targetUnit === 'COUNT') {
      // Handle count scales
      if (rawUnit.includes('Thous')) {
        return rawValue * 1000;
      }
    }

    // Default: return as-is for INDEX_PT, HOURS, RATIO_DECIMAL
    return rawValue;
  }

  /**
   * Apply transformation (LEVEL, YOY, MOM, etc.)
   */
  private async applyTransform(
    value: number, 
    transform: string, 
    periodEnd: Date, 
    seriesId: string
  ): Promise<number> {
    switch (transform) {
      case 'LEVEL':
        return value;
        
      case 'YOY': {
        // Get value from 12 months ago
        const yearAgo = new Date(periodEnd);
        yearAgo.setMonth(yearAgo.getMonth() - 12);
        
        const [priorObs] = await db
          .select()
          .from(econSeriesObservation)
          .where(and(
            eq(econSeriesObservation.seriesId, seriesId),
            eq(econSeriesObservation.periodEnd, yearAgo)
          ))
          .limit(1);
          
        if (!priorObs) return value; // Fallback to level
        return (value - priorObs.valueStd) / priorObs.valueStd; // YoY change
      }
      
      case 'MOM': {
        // Get value from 1 month ago
        const monthAgo = new Date(periodEnd);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        const [priorObs] = await db
          .select()
          .from(econSeriesObservation)
          .where(and(
            eq(econSeriesObservation.seriesId, seriesId),
            eq(econSeriesObservation.periodEnd, monthAgo)
          ))
          .limit(1);
          
        if (!priorObs) return value; // Fallback to level
        return (value - priorObs.valueStd) / priorObs.valueStd; // MoM change
      }

      case 'LOG_LEVEL':
        return Math.log(Math.max(value, 0.001)); // Avoid log(0)
        
      default:
        return value;
    }
  }

  /**
   * Calculate rolling window features
   */
  private calculateFeatures(currentObs: any, windowData: any[]) {
    const values = windowData.map(obs => obs.valueStd);
    const deltas = [];
    
    // Calculate deltas (first differences)
    for (let i = 1; i < values.length; i++) {
      deltas.push(values[i] - values[i - 1]);
    }
    
    const currentDelta = deltas.length > 0 ? currentObs.valueStd - values[values.length - 1] : 0;

    return {
      deltaT: currentDelta,
      meanLevel: values.reduce((sum, v) => sum + v, 0) / values.length,
      sdLevel: this.standardDeviation(values),
      meanDelta: deltas.length > 0 ? deltas.reduce((sum, d) => sum + d, 0) / deltas.length : 0,
      sdDelta: deltas.length > 0 ? this.standardDeviation(deltas) : 1
    };
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
    return Math.sqrt(variance);
  }
}

export const economicDataStandardizer = new EconomicDataStandardizer();