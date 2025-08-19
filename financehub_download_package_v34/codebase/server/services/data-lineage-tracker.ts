import { logger } from '../../shared/utils/logger';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

/**
 * Gold Standard Data Lineage & Audit Trail
 * Tracks complete data journey from source to final output
 */

export interface LineageRecord {
  id: string;
  seriesId: string;
  operation: 'ingestion' | 'validation' | 'transformation' | 'calculation' | 'output';
  stage: 'ingress' | 'processing' | 'egress';
  timestamp: Date;
  sourceValue?: number;
  transformedValue?: number;
  metadata: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  processingTimeMs: number;
}

export interface DataLineageReport {
  seriesId: string;
  totalOperations: number;
  successRate: number;
  avgProcessingTime: number;
  lastUpdate: Date;
  transformationChain: string[];
  dataQualityScore: number;
}

export class DataLineageTracker {
  private operationLog: LineageRecord[] = [];
  
  /**
   * Track data ingestion from FRED API
   */
  async trackIngestion(
    seriesId: string, 
    rawData: any[], 
    cleanedData: any[], 
    processingTimeMs: number
  ): Promise<void> {
    const record: LineageRecord = {
      id: this.generateId(),
      seriesId,
      operation: 'ingestion',
      stage: 'ingress',
      timestamp: new Date(),
      metadata: {
        rawRecords: rawData.length,
        cleanedRecords: cleanedData.length,
        filterRate: ((rawData.length - cleanedData.length) / rawData.length * 100).toFixed(2) + '%',
        source: 'FRED_API',
        apiVersion: 'v1'
      },
      success: cleanedData.length > 0,
      processingTimeMs
    };
    
    this.operationLog.push(record);
    await this.persistToDatabase(record);
    
    logger.info(`📝 Lineage tracked: ${seriesId} ingestion - ${cleanedData.length} records processed in ${processingTimeMs}ms`);
  }
  
  /**
   * Track data validation results
   */
  async trackValidation(
    seriesId: string,
    totalRecords: number,
    validRecords: number,
    errors: string[],
    processingTimeMs: number
  ): Promise<void> {
    const record: LineageRecord = {
      id: this.generateId(),
      seriesId,
      operation: 'validation',
      stage: 'processing',
      timestamp: new Date(),
      metadata: {
        totalRecords,
        validRecords,
        errorRate: ((totalRecords - validRecords) / totalRecords * 100).toFixed(2) + '%',
        errors: errors.slice(0, 5), // Store first 5 errors
        validationRules: ['schema', 'bounds', 'outliers']
      },
      success: validRecords > 0,
      errorMessage: errors.length > 0 ? errors[0] : undefined,
      processingTimeMs
    };
    
    this.operationLog.push(record);
    await this.persistToDatabase(record);
  }
  
  /**
   * Track statistical calculations (z-scores)
   */
  async trackCalculation(
    seriesId: string,
    calculationType: string,
    inputValue: number,
    outputValue: number,
    metadata: Record<string, any>,
    processingTimeMs: number
  ): Promise<void> {
    const record: LineageRecord = {
      id: this.generateId(),
      seriesId,
      operation: 'calculation',
      stage: 'processing',
      timestamp: new Date(),
      sourceValue: inputValue,
      transformedValue: outputValue,
      metadata: {
        calculationType,
        historicalDataPoints: metadata.dataPoints || 0,
        mean: metadata.mean,
        stdDev: metadata.stdDev,
        confidence: metadata.confidence || 'medium',
        ...metadata
      },
      success: !isNaN(outputValue),
      processingTimeMs
    };
    
    this.operationLog.push(record);
    await this.persistToDatabase(record);
  }
  
  /**
   * Track data transformation (unit conversion, formatting)
   */
  async trackTransformation(
    seriesId: string,
    transformationType: string,
    beforeValue: number,
    afterValue: string,
    unit: string,
    processingTimeMs: number
  ): Promise<void> {
    const record: LineageRecord = {
      id: this.generateId(),
      seriesId,
      operation: 'transformation',
      stage: 'egress',
      timestamp: new Date(),
      sourceValue: beforeValue,
      metadata: {
        transformationType,
        originalUnit: unit,
        formattedOutput: afterValue,
        conversionRules: 'K/M/B/T formatting'
      },
      success: afterValue !== 'N/A',
      processingTimeMs
    };
    
    this.operationLog.push(record);
    await this.persistToDatabase(record);
  }
  
  /**
   * Generate comprehensive lineage report for a series
   */
  async generateLineageReport(seriesId: string): Promise<DataLineageReport> {
    const seriesOperations = this.operationLog.filter(op => op.seriesId === seriesId);
    
    if (seriesOperations.length === 0) {
      throw new Error(`No lineage data found for series: ${seriesId}`);
    }
    
    const successfulOps = seriesOperations.filter(op => op.success);
    const successRate = (successfulOps.length / seriesOperations.length) * 100;
    const avgProcessingTime = seriesOperations.reduce((sum, op) => sum + op.processingTimeMs, 0) / seriesOperations.length;
    
    const transformationChain = seriesOperations
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(op => `${op.stage}:${op.operation}`);
    
    // Calculate data quality score based on success rate and error frequency
    const dataQualityScore = Math.round(successRate * 0.7 + (100 - (seriesOperations.filter(op => op.errorMessage).length / seriesOperations.length * 100)) * 0.3);
    
    return {
      seriesId,
      totalOperations: seriesOperations.length,
      successRate: Math.round(successRate * 100) / 100,
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      lastUpdate: seriesOperations[seriesOperations.length - 1]?.timestamp || new Date(),
      transformationChain: [...new Set(transformationChain)], // Remove duplicates
      dataQualityScore
    };
  }
  
  /**
   * Get system-wide data lineage health metrics
   */
  async getSystemLineageHealth(): Promise<{
    totalSeries: number;
    avgQualityScore: number;
    recentErrors: string[];
    processingTrends: { stage: string; avgTime: number }[];
  }> {
    const uniqueSeries = [...new Set(this.operationLog.map(op => op.seriesId))];
    
    // Calculate average quality score across all series
    let totalQuality = 0;
    for (const seriesId of uniqueSeries) {
      try {
        const report = await this.generateLineageReport(seriesId);
        totalQuality += report.dataQualityScore;
      } catch (error) {
        // Skip series with no data
      }
    }
    const avgQualityScore = Math.round(totalQuality / uniqueSeries.length);
    
    // Get recent errors (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = this.operationLog
      .filter(op => op.timestamp > yesterday && op.errorMessage)
      .map(op => `${op.seriesId}: ${op.errorMessage}`)
      .slice(0, 10);
    
    // Processing time trends by stage
    const stageGroups = this.operationLog.reduce((acc, op) => {
      if (!acc[op.stage]) acc[op.stage] = [];
      acc[op.stage].push(op.processingTimeMs);
      return acc;
    }, {} as Record<string, number[]>);
    
    const processingTrends = Object.entries(stageGroups).map(([stage, times]) => ({
      stage,
      avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length * 100) / 100
    }));
    
    return {
      totalSeries: uniqueSeries.length,
      avgQualityScore,
      recentErrors,
      processingTrends
    };
  }
  
  /**
   * Persist lineage record to database
   */
  private async persistToDatabase(record: LineageRecord): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO data_lineage_log (
          id, series_id, operation, stage, timestamp, 
          source_value, transformed_value, metadata, 
          success, error_message, processing_time_ms
        ) VALUES (
          ${record.id}, ${record.seriesId}, ${record.operation}, ${record.stage}, ${record.timestamp.toISOString()},
          ${record.sourceValue || null}, ${record.transformedValue || null}, ${JSON.stringify(record.metadata)},
          ${record.success}, ${record.errorMessage || null}, ${record.processingTimeMs}
        )
      `);
    } catch (error) {
      logger.error(`Failed to persist lineage record: ${error}`);
    }
  }
  
  private generateId(): string {
    return `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const dataLineageTracker = new DataLineageTracker();