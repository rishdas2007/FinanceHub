import { logger } from '../../shared/utils/logger';
import { DataQualityValidator } from './data-quality-validator';
import { dataLineageTracker } from './data-lineage-tracker';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { CURATED_SERIES } from './fred-api-service-incremental';

/**
 * Enhanced FRED Service with Gold Standard Data Pipeline
 * Implements comprehensive ingress → processing → egress pipeline
 */

export interface EnhancedFredData {
  seriesId: string;
  value: number;
  date: string;
  qualityScore: number;
  validationWarnings: string[];
  lineageId: string;
}

export class EnhancedFredService {
  
  /**
   * INGRESS STAGE: Data sourcing & initial validation
   */
  async ingestSeriesData(seriesId: string): Promise<EnhancedFredData[]> {
    const startTime = Date.now();
    logger.info(`📥 INGRESS: Starting enhanced data ingestion for ${seriesId}`);
    
    try {
      // Step 1: Fetch raw data from FRED API
      const rawData = await this.fetchFromFredApi(seriesId);
      const ingestionTime = Date.now() - startTime;
      
      // Step 2: Track ingestion lineage
      await dataLineageTracker.trackIngestion(
        seriesId, 
        rawData, 
        rawData.filter(d => d.value !== '.' && d.value !== null), 
        ingestionTime
      );
      
      // Step 3: Schema validation
      const validatedData: EnhancedFredData[] = [];
      const validationErrors: string[] = [];
      
      for (const observation of rawData) {
        if (observation.value === '.' || observation.value === null) continue;
        
        const validation = dataQualityValidator.validateSchema(observation, seriesId);
        
        if (validation.isValid && validation.cleanedValue !== undefined) {
          validatedData.push({
            seriesId,
            value: validation.cleanedValue,
            date: observation.date,
            qualityScore: validation.confidence === 'high' ? 100 : validation.confidence === 'medium' ? 75 : 50,
            validationWarnings: validation.warnings,
            lineageId: this.generateLineageId()
          });
        } else {
          validationErrors.push(...validation.errors);
        }
      }
      
      // Step 4: Track validation results
      await dataLineageTracker.trackValidation(
        seriesId,
        rawData.length,
        validatedData.length,
        validationErrors,
        Date.now() - startTime - ingestionTime
      );
      
      logger.info(`✅ INGRESS: ${seriesId} processed - ${validatedData.length}/${rawData.length} valid records`);
      return validatedData;
      
    } catch (error) {
      logger.error(`❌ INGRESS: Failed to ingest ${seriesId}: ${String(error)}`);
      throw error;
    }
  }
  
  /**
   * PROCESSING STAGE: Statistical calculations with historical context
   */
  async processStatisticalAnalysis(data: EnhancedFredData[]): Promise<{
    zScores: Array<{ seriesId: string; zScore: number; confidence: string; historicalPoints: number }>;
    qualityMetrics: { avgQualityScore: number; totalProcessed: number };
  }> {
    const startTime = Date.now();
    logger.info(`📊 PROCESSING: Starting statistical analysis for ${data.length} series`);
    
    const zScores: Array<{ seriesId: string; zScore: number; confidence: string; historicalPoints: number }> = [];
    let totalQualityScore = 0;
    
    for (const seriesData of data) {
      try {
        // Get 12-month historical data for z-score calculation
        const historicalData = await this.getHistoricalData(seriesData.seriesId, 12);
        
        if (historicalData.length < 12) {
          logger.warn(`⚠️  PROCESSING: Insufficient data for ${seriesData.seriesId} (${historicalData.length} points)`);
          continue;
        }
        
        // Calculate z-score with economic validation
        const mean = historicalData.reduce((sum, val) => sum + val, 0) / historicalData.length;
        const variance = historicalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalData.length;
        const stdDev = Math.sqrt(variance);
        const zScore = (seriesData.value - mean) / stdDev;
        
        // Validate economic reasonableness
        const economicValidation = dataQualityValidator.validateEconomicData(
          seriesData.value, 
          seriesData.seriesId, 
          historicalData
        );
        
        const confidence = economicValidation.confidence;
        
        // Track calculation lineage
        await dataLineageTracker.trackCalculation(
          seriesData.seriesId,
          'z_score',
          seriesData.value,
          zScore,
          {
            mean,
            stdDev,
            dataPoints: historicalData.length,
            confidence,
            warnings: economicValidation.warnings
          },
          Date.now() - startTime
        );
        
        zScores.push({
          seriesId: seriesData.seriesId,
          zScore,
          confidence,
          historicalPoints: historicalData.length
        });
        
        totalQualityScore += seriesData.qualityScore;
        
      } catch (error) {
        logger.error(`❌ PROCESSING: Failed statistical analysis for ${seriesData.seriesId}: ${String(error)}`);
      }
    }
    
    const avgQualityScore = totalQualityScore / data.length;
    
    logger.info(`✅ PROCESSING: Completed statistical analysis - ${zScores.length} z-scores calculated`);
    
    return {
      zScores,
      qualityMetrics: {
        avgQualityScore: Math.round(avgQualityScore * 100) / 100,
        totalProcessed: data.length
      }
    };
  }
  
  /**
   * EGRESS STAGE: Formatting & delivery with transformation tracking
   */
  async formatForOutput(
    zScoreData: Array<{ seriesId: string; zScore: number; confidence: string; historicalPoints: number }>,
    originalData: EnhancedFredData[]
  ): Promise<Array<{
    metric: string;
    currentReading: string;
    zScore: number;
    category: string;
    confidence: string;
    lastUpdated: string;
  }>> {
    const startTime = Date.now();
    logger.info(`📤 EGRESS: Starting output formatting for ${zScoreData.length} indicators`);
    
    const formattedOutput: Array<{
      metric: string;
      currentReading: string;
      zScore: number;
      category: string;
      confidence: string;
      lastUpdated: string;
    }> = [];
    
    for (const zData of zScoreData) {
      try {
        const originalEntry = originalData.find(d => d.seriesId === zData.seriesId);
        if (!originalEntry) continue;
        
        const curatedSeries = CURATED_SERIES.find(s => s.id === zData.seriesId);
        if (!curatedSeries) continue;
        
        // Apply unit-based formatting (CURATED_SERIES doesn't have unit field, use default formatting)
        const formattedValue = this.formatByUnit(originalEntry.value, 'index', curatedSeries.label);
        
        // Track transformation
        await dataLineageTracker.trackTransformation(
          zData.seriesId,
          'unit_formatting',
          originalEntry.value,
          formattedValue,
          'index',
          Date.now() - startTime
        );
        
        formattedOutput.push({
          metric: curatedSeries.label,
          currentReading: formattedValue,
          zScore: Math.round(zData.zScore * 1000) / 1000,
          category: curatedSeries.category || 'Economic',
          confidence: zData.confidence,
          lastUpdated: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error(`❌ EGRESS: Failed formatting for ${zData.seriesId}: ${String(error)}`);
      }
    }
    
    logger.info(`✅ EGRESS: Completed output formatting - ${formattedOutput.length} indicators ready`);
    return formattedOutput;
  }
  
  /**
   * Complete gold standard pipeline execution
   */
  async executeFullPipeline(): Promise<{
    indicators: Array<any>;
    pipelineMetrics: {
      totalSeries: number;
      successfulIngestion: number;
      validZScores: number;
      avgQualityScore: number;
      totalProcessingTime: number;
    };
  }> {
    const pipelineStart = Date.now();
    logger.info('🏗️  PIPELINE: Starting complete gold standard data pipeline');
    
    // STAGE 1: INGRESS
    const allSeriesData: EnhancedFredData[] = [];
    let successfulIngestion = 0;
    
    for (const series of CURATED_SERIES.slice(0, 10)) { // Process first 10 for demo
      try {
        const seriesData = await this.ingestSeriesData(series.id);
        allSeriesData.push(...seriesData);
        successfulIngestion++;
      } catch (error) {
        logger.error(`Pipeline ingestion failed for ${series.id}: ${String(error)}`);
      }
    }
    
    // STAGE 2: PROCESSING
    const statisticalResults = await this.processStatisticalAnalysis(allSeriesData);
    
    // STAGE 3: EGRESS
    const finalOutput = await this.formatForOutput(statisticalResults.zScores, allSeriesData);
    
    const totalProcessingTime = Date.now() - pipelineStart;
    
    const pipelineMetrics = {
      totalSeries: CURATED_SERIES.slice(0, 10).length,
      successfulIngestion,
      validZScores: statisticalResults.zScores.length,
      avgQualityScore: statisticalResults.qualityMetrics.avgQualityScore,
      totalProcessingTime
    };
    
    logger.info(`🎯 PIPELINE: Complete - processed ${pipelineMetrics.totalSeries} series in ${totalProcessingTime}ms`);
    
    return {
      indicators: finalOutput,
      pipelineMetrics
    };
  }
  
  /**
   * Private helper methods
   */
  
  private async fetchFromFredApi(seriesId: string): Promise<any[]> {
    // Simulated FRED API call - in real implementation, this would make HTTP request
    // For now, return mock structure that matches FRED API response
    return [
      { date: '2025-01-01', value: '100.5' },
      { date: '2025-02-01', value: '101.2' },
      { date: '2025-03-01', value: '.' }, // Invalid value
      { date: '2025-04-01', value: '102.1' }
    ];
  }
  
  private async getHistoricalData(seriesId: string, months: number): Promise<number[]> {
    try {
      const result = await db.execute(sql`
        SELECT value 
        FROM economic_indicators_history 
        WHERE series_id = ${seriesId} 
          AND period_date >= CURRENT_DATE - INTERVAL '${months} months'
        ORDER BY period_date DESC
        LIMIT ${months * 2}
      `);
      
      return result.rows.map((row: any) => parseFloat(row.value)).filter(v => !isNaN(v));
    } catch (error) {
      logger.error(`Failed to get historical data for ${seriesId}: ${String(error)}`);
      return [];
    }
  }
  
  private formatByUnit(value: number, unit: string, metric: string): string {
    if (isNaN(value)) return 'N/A';
    
    // Economic-specific formatting
    if (metric.toLowerCase().includes('cpi') || metric.toLowerCase().includes('inflation')) {
      return value.toFixed(1) + '%';
    }
    
    switch (unit) {
      case 'percent':
        return value.toFixed(1) + '%';
      case 'thousands':
        return value >= 1000 ? (value/1000).toFixed(1) + 'M' : value.toFixed(0) + 'K';
      case 'millions_dollars':
        return '$' + value.toFixed(1) + 'M';
      case 'billions_dollars':
        return '$' + value.toFixed(1) + 'B';
      default:
        return value.toFixed(2);
    }
  }
  
  private generateLineageId(): string {
    return `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const enhancedFredService = new EnhancedFredService();