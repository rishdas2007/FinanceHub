import { db } from '../db';
import { econSeriesDef, econSeriesObservation, econSeriesFeatures } from '@shared/schema-v2';
import { eq, desc, and, gte } from 'drizzle-orm';
import { logger } from '../middleware/logging';
import { welfordStats } from '@shared/utils/statistics';

const PIPELINE_VERSION = 'v1.0.0';

// Economic series definitions for Bronze → Silver → Gold transformation
const ECONOMIC_SERIES_DEFINITIONS = [
  {
    seriesId: 'fed_funds_rate',
    displayName: 'Federal Funds Rate',
    category: 'Monetary Policy',
    typeTag: 'Leading',
    nativeUnit: 'PERCENT',
    standardUnit: 'PCT_DECIMAL',
    scaleHint: 'NONE',
    displayPrecision: 2,
    defaultTransform: 'LEVEL',
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/FEDFUNDS'
  },
  {
    seriesId: 'unemployment_rate',
    displayName: 'Unemployment Rate',
    category: 'Employment',
    typeTag: 'Coincident',
    nativeUnit: 'PERCENT',
    standardUnit: 'PCT_DECIMAL',
    scaleHint: 'NONE',
    displayPrecision: 1,
    defaultTransform: 'LEVEL',
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/UNRATE'
  },
  {
    seriesId: 'core_cpi_yoy',
    displayName: 'Core CPI (YoY)',
    category: 'Inflation',
    typeTag: 'Lagging',
    nativeUnit: 'PERCENT',
    standardUnit: 'PCT_DECIMAL',
    scaleHint: 'NONE',
    displayPrecision: 1,
    defaultTransform: 'YOY',
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL'
  },
  {
    seriesId: 'gdp_growth_qoq',
    displayName: 'GDP Growth (QoQ)',
    category: 'Growth',
    typeTag: 'Coincident',
    nativeUnit: 'PERCENT',
    standardUnit: 'PCT_DECIMAL',
    scaleHint: 'NONE',
    displayPrecision: 1,
    defaultTransform: 'QOQ',
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/GDP'
  },
  {
    seriesId: 'payrolls_mom',
    displayName: 'Nonfarm Payrolls (MoM)',
    category: 'Employment',
    typeTag: 'Coincident',
    nativeUnit: 'THOUSANDS',
    standardUnit: 'COUNT',
    scaleHint: 'K',
    displayPrecision: 0,
    defaultTransform: 'MOM',
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PAYEMS'
  }
];

export class EconomicFeaturesETL {
  
  /**
   * Initialize economic series definitions (Bronze layer metadata)
   */
  async initializeSeriesDefinitions(): Promise<void> {
    logger.info('🔧 Initializing economic series definitions');
    
    for (const seriesDef of ECONOMIC_SERIES_DEFINITIONS) {
      await db.insert(econSeriesDef)
        .values(seriesDef)
        .onConflictDoUpdate({
          target: econSeriesDef.seriesId,
          set: {
            displayName: seriesDef.displayName,
            category: seriesDef.category,
            typeTag: seriesDef.typeTag,
            nativeUnit: seriesDef.nativeUnit,
            standardUnit: seriesDef.standardUnit,
            scaleHint: seriesDef.scaleHint,
            displayPrecision: seriesDef.displayPrecision,
            defaultTransform: seriesDef.defaultTransform,
            alignPolicy: seriesDef.alignPolicy,
            preferredWindowMonths: seriesDef.preferredWindowMonths,
            seasonalAdj: seriesDef.seasonalAdj,
            source: seriesDef.source,
            sourceUrl: seriesDef.sourceUrl
          }
        });
    }
    
    logger.info(`✅ Initialized ${ECONOMIC_SERIES_DEFINITIONS.length} economic series definitions`);
  }
  
  /**
   * Transform raw data to Silver layer (standardized observations)
   */
  async processToSilverLayer(seriesId: string, rawData: any[]): Promise<void> {
    logger.info(`🔄 Processing ${seriesId} to Silver layer`);
    
    // Get series definition
    const seriesDef = await db
      .select()
      .from(econSeriesDef)
      .where(eq(econSeriesDef.seriesId, seriesId))
      .limit(1);
    
    if (seriesDef.length === 0) {
      throw new Error(`Series definition not found: ${seriesId}`);
    }
    
    const def = seriesDef[0];
    
    for (const dataPoint of rawData) {
      // Standardize the value based on series definition
      const valueStd = this.standardizeValue(dataPoint.value, def.nativeUnit, def.standardUnit);
      
      const observation = {
        seriesId: seriesId,
        periodStart: new Date(dataPoint.date),
        periodEnd: new Date(dataPoint.date),
        freq: 'M', // Assume monthly for now
        valueStd: valueStd,
        standardUnit: def.standardUnit,
        aggMethod: 'POINT',
        scaleHint: def.scaleHint,
        displayPrecision: def.displayPrecision,
        transformCode: def.defaultTransform
      };
      
      await db.insert(econSeriesObservation)
        .values(observation)
        .onConflictDoNothing();
    }
    
    logger.info(`✅ Processed ${rawData.length} observations for ${seriesId}`);
  }
  
  /**
   * Compute Gold layer features (Z-scores and signals)
   */
  async computeGoldLayerFeatures(seriesId: string, windowMonths: number = 60): Promise<void> {
    logger.info(`🔄 Computing Gold layer features for ${seriesId}`);
    
    // Get Silver layer observations
    const observations = await db
      .select()
      .from(econSeriesObservation)
      .where(eq(econSeriesObservation.seriesId, seriesId))
      .orderBy(desc(econSeriesObservation.periodEnd));
    
    if (observations.length < 24) { // Need at least 2 years of data
      logger.warn(`Insufficient data for ${seriesId}: ${observations.length} observations`);
      return;
    }
    
    // Compute features for each observation with sufficient lookback
    for (let i = windowMonths; i < observations.length; i++) {
      const currentObs = observations[i];
      const windowObs = observations.slice(i - windowMonths, i + 1);
      
      // Extract values and compute deltas
      const values = windowObs.map(obs => parseFloat(obs.valueStd.toString()));
      const deltas = [];
      for (let j = 1; j < values.length; j++) {
        deltas.push(values[j] - values[j - 1]);
      }
      
      // Compute statistics
      const levelStats = welfordStats(values);
      const deltaStats = welfordStats(deltas);
      
      // Current values
      const valueT = parseFloat(currentObs.valueStd.toString());
      const deltaT = i > 0 ? valueT - parseFloat(observations[i - 1].valueStd.toString()) : 0;
      
      // Z-scores
      const levelZ = levelStats.standardDeviation > 1e-8 ? 
        (valueT - levelStats.mean) / levelStats.standardDeviation : 0;
      const changeZ = deltaStats.standardDeviation > 1e-8 ?
        (deltaT - deltaStats.mean) / deltaStats.standardDeviation : 0;
      
      // Classification
      const levelClass = this.classifyLevel(levelZ);
      const trendClass = this.classifyTrend(changeZ);
      const multiSignal = this.deriveMultiSignal(levelClass, trendClass);
      
      const features = {
        seriesId: seriesId,
        periodEnd: currentObs.periodEnd,
        transformCode: currentObs.transformCode,
        refWindowMonths: windowMonths,
        valueT: valueT,
        deltaT: deltaT,
        meanLevel: levelStats.mean,
        sdLevel: levelStats.standardDeviation,
        meanDelta: deltaStats.mean,
        sdDelta: deltaStats.standardDeviation,
        levelZ: levelZ,
        changeZ: changeZ,
        levelClass: levelClass,
        trendClass: trendClass,
        multiSignal: multiSignal,
        pipelineVersion: PIPELINE_VERSION,
        provenance: {
          sourceObservations: windowObs.length,
          computedAt: new Date().toISOString(),
          windowMonths: windowMonths
        }
      };
      
      await db.insert(econSeriesFeatures)
        .values(features)
        .onConflictDoNothing();
    }
    
    logger.info(`✅ Computed Gold layer features for ${seriesId}`);
  }
  
  /**
   * Get latest economic features for API consumption
   */
  async getLatestFeatures(seriesIds?: string[]): Promise<any[]> {
    const targetSeries = seriesIds || ECONOMIC_SERIES_DEFINITIONS.map(def => def.seriesId);
    const results = [];
    
    for (const seriesId of targetSeries) {
      // Get latest feature
      const latestFeature = await db
        .select()
        .from(econSeriesFeatures)
        .where(eq(econSeriesFeatures.seriesId, seriesId))
        .orderBy(desc(econSeriesFeatures.periodEnd))
        .limit(1);
      
      if (latestFeature.length > 0) {
        const feature = latestFeature[0];
        
        // Get series definition
        const seriesDef = await db
          .select()
          .from(econSeriesDef)
          .where(eq(econSeriesDef.seriesId, seriesId))
          .limit(1);
        
        if (seriesDef.length > 0) {
          results.push({
            series_id: seriesId,
            display_name: seriesDef[0].displayName,
            category: seriesDef[0].category,
            value_std: parseFloat(feature.valueT.toString()),
            standard_unit: seriesDef[0].standardUnit,
            level_z: parseFloat(feature.levelZ.toString()),
            change_z: parseFloat(feature.changeZ.toString()),
            level_class: feature.levelClass,
            trend_class: feature.trendClass,
            multi_signal: feature.multiSignal,
            period_end: feature.periodEnd.toISOString().split('T')[0],
            confidence: this.calculateConfidence(feature)
          });
        }
      }
    }
    
    return results;
  }
  
  private standardizeValue(value: number, fromUnit: string, toUnit: string): number {
    // Convert to standard units
    if (fromUnit === 'PERCENT' && toUnit === 'PCT_DECIMAL') {
      return value / 100; // Convert percentage to decimal
    }
    if (fromUnit === 'THOUSANDS' && toUnit === 'COUNT') {
      return value * 1000; // Convert thousands to actual count
    }
    return value; // No conversion needed
  }
  
  private classifyLevel(zScore: number): string {
    if (zScore > 1.5) return 'HIGH';
    if (zScore < -1.5) return 'LOW';
    return 'NORMAL';
  }
  
  private classifyTrend(zScore: number): string {
    if (zScore > 1.0) return 'RISING';
    if (zScore < -1.0) return 'FALLING';
    return 'STABLE';
  }
  
  private deriveMultiSignal(levelClass: string, trendClass: string): string {
    // 3x3 matrix classification
    const signalMatrix: Record<string, Record<string, string>> = {
      'HIGH': { 'RISING': 'EXTREME_HIGH', 'STABLE': 'HIGH', 'FALLING': 'MODERATING' },
      'NORMAL': { 'RISING': 'IMPROVING', 'STABLE': 'NEUTRAL', 'FALLING': 'WEAKENING' },
      'LOW': { 'RISING': 'RECOVERING', 'STABLE': 'LOW', 'FALLING': 'EXTREME_LOW' }
    };
    
    return signalMatrix[levelClass]?.[trendClass] || 'NEUTRAL';
  }
  
  private calculateConfidence(feature: any): number {
    // Confidence based on data quality and recency
    const obsCount = feature.provenance?.sourceObservations || 0;
    const dataQuality = obsCount >= 48 ? 0.9 : obsCount >= 24 ? 0.7 : 0.5;
    
    // Reduce confidence for extreme Z-scores (may be outliers)
    const extremeScore = Math.max(Math.abs(feature.levelZ), Math.abs(feature.changeZ));
    const outlierPenalty = extremeScore > 3 ? 0.8 : 1.0;
    
    return Math.round(dataQuality * outlierPenalty * 100) / 100;
  }
}

export const economicFeaturesETL = new EconomicFeaturesETL();