import express from 'express';
import { DataQualityValidator } from '../services/data-quality-validator';
import { dataLineageTracker } from '../services/data-lineage-tracker';
import { enhancedFredService } from '../services/enhanced-fred-service';
import { logger } from '../../shared/utils/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = express.Router();

/**
 * PHASE 1: Data Quality Foundation Routes
 */

// Get data quality metrics for all economic indicators
router.get('/quality-metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get quality metrics from database
    const qualityData = await db.execute(sql`
      SELECT 
        series_id,
        metric_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as valid_records,
        AVG(value) as mean_value,
        STDDEV(value) as std_deviation,
        MIN(period_date) as earliest_date,
        MAX(period_date) as latest_date
      FROM economic_indicators_history 
      GROUP BY series_id, metric_name
      ORDER BY total_records DESC
    `);
    
    const processedMetrics = qualityData.rows.map((row: any) => {
      const validityRate = (row.valid_records / row.total_records) * 100;
      const dataAge = Math.floor((Date.now() - new Date(row.latest_date).getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        seriesId: row.series_id,
        metricName: row.metric_name,
        totalRecords: row.total_records,
        validRecords: row.valid_records,
        validityRate: Math.round(validityRate * 100) / 100,
        meanValue: parseFloat(row.mean_value || 0).toFixed(4),
        standardDeviation: parseFloat(row.std_deviation || 0).toFixed(4),
        earliestDate: row.earliest_date,
        latestDate: row.latest_date,
        dataAge: dataAge,
        qualityScore: validityRate > 95 && dataAge < 30 ? 'HIGH' : 
                     validityRate > 80 && dataAge < 60 ? 'MEDIUM' : 'LOW'
      };
    });
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      metrics: processedMetrics,
      summary: {
        totalSeries: processedMetrics.length,
        highQuality: processedMetrics.filter(m => m.qualityScore === 'HIGH').length,
        mediumQuality: processedMetrics.filter(m => m.qualityScore === 'MEDIUM').length,
        lowQuality: processedMetrics.filter(m => m.qualityScore === 'LOW').length,
        avgValidityRate: Math.round(processedMetrics.reduce((sum, m) => sum + m.validityRate, 0) / processedMetrics.length * 100) / 100
      },
      processingTime
    });
    
  } catch (error) {
    logger.error('Failed to get quality metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve quality metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Run comprehensive data validation on a specific series
router.post('/validate-series/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const startTime = Date.now();
    
    // Get historical data for the series
    const historicalData = await db.execute(sql`
      SELECT value, period_date
      FROM economic_indicators_history 
      WHERE series_id = ${seriesId}
      ORDER BY period_date DESC
      LIMIT 50
    `);
    
    if (historicalData.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No data found for series ${seriesId}`
      });
    }
    
    const values = historicalData.rows.map((row: any) => parseFloat(row.value)).filter(v => !isNaN(v));
    const latestValue = values[0];
    
    // Run validation
    const validation = dataQualityValidator.validateEconomicData(latestValue, seriesId, values.slice(1));
    
    // Generate quality report
    const validationResults = [{
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      confidence: validation.confidence
    }];
    
    const qualityReport = dataQualityValidator.generateQualityReport(validationResults);
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      seriesId,
      validation,
      qualityReport,
      statisticalSummary: {
        recordCount: values.length,
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        standardDeviation: Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length),
        latestValue,
        zScore: validation.isValid ? Math.abs((latestValue - (values.reduce((a, b) => a + b, 0) / values.length)) / Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length)) : null
      },
      processingTime
    });
    
  } catch (error) {
    logger.error(`Failed to validate series ${req.params.seriesId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: 'Validation failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PHASE 2: Complete Audit Trail Routes
 */

// Get data lineage for a specific series
router.get('/lineage/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const report = await dataLineageTracker.generateLineageReport(seriesId);
    
    res.json({
      success: true,
      lineageReport: report
    });
    
  } catch (error) {
    logger.error(`Failed to get lineage for ${req.params.seriesId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve lineage data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get system-wide lineage health
router.get('/lineage/health', async (req, res) => {
  try {
    const healthMetrics = await dataLineageTracker.getSystemLineageHealth();
    
    res.json({
      success: true,
      healthMetrics
    });
    
  } catch (error) {
    logger.error('Failed to get system lineage health:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve system health metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PHASE 3: Enhanced Analytics Routes
 */

// Execute full gold standard pipeline
router.post('/execute-pipeline', async (req, res) => {
  try {
    const startTime = Date.now();
    logger.info('🏗️ Starting gold standard pipeline execution via API');
    
    const pipelineResult = await enhancedFredService.executeFullPipeline();
    
    const totalTime = Date.now() - startTime;
    
    res.json({
      success: true,
      ...pipelineResult,
      apiProcessingTime: totalTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Pipeline execution failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Pipeline execution failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get enhanced metrics with feature engineering
router.get('/enhanced-metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    const enhancedMetrics = await featureEngineeringService.generateEnhancedMetrics();
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      metrics: enhancedMetrics,
      processingTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to generate enhanced metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Enhanced metrics generation failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Generate comprehensive data quality dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get overall system health
    const systemHealth = await dataLineageTracker.getSystemLineageHealth();
    
    // Get quality metrics summary
    const qualityMetrics = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT series_id) as total_series,
        COUNT(*) as total_records,
        COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as valid_records,
        COUNT(CASE WHEN period_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_records
      FROM economic_indicators_history
    `);
    
    const row = qualityMetrics.rows[0] as any;
    const validityRate = (row.valid_records / row.total_records) * 100;
    const recencyRate = (row.recent_records / row.total_records) * 100;
    
    // Get series with insufficient data
    const insufficientData = await db.execute(sql`
      SELECT 
        series_id,
        metric_name,
        COUNT(*) as record_count
      FROM economic_indicators_history 
      GROUP BY series_id, metric_name
      HAVING COUNT(*) < 12
      ORDER BY record_count ASC
    `);
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      dashboard: {
        systemHealth,
        dataQuality: {
          totalSeries: row.total_series,
          totalRecords: row.total_records,
          validityRate: Math.round(validityRate * 100) / 100,
          recencyRate: Math.round(recencyRate * 100) / 100,
          healthScore: Math.round((validityRate * 0.7 + recencyRate * 0.3) * 100) / 100
        },
        dataGaps: {
          seriesWithInsufficientData: insufficientData.rows.length,
          examples: insufficientData.rows.slice(0, 5)
        },
        lastUpdated: new Date().toISOString()
      },
      processingTime
    });
    
  } catch (error) {
    logger.error('Failed to generate dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Dashboard generation failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Manual data refresh trigger for immediate updates
router.post('/refresh-economic-data', async (req, res) => {
  try {
    const startTime = Date.now();
    const { reason = 'manual_api_trigger' } = req.body;
    
    logger.info(`🚀 [MANUAL API] Triggering immediate economic data refresh - reason: ${reason}`);
    
    // Import the scheduler service
    const { economicDataScheduler } = await import('../services/economic-data-scheduler');
    
    // Trigger immediate refresh
    await economicDataScheduler.triggerImmediateRefresh(reason);
    
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: 'Economic data refresh completed successfully',
      processingTime,
      timestamp: new Date().toISOString(),
      trigger: reason
    });
    
  } catch (error) {
    logger.error('Manual economic data refresh failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Economic data refresh failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get scheduler status
router.get('/scheduler-status', async (req, res) => {
  try {
    const { economicDataScheduler } = await import('../services/economic-data-scheduler');
    const status = economicDataScheduler.getStatus();
    
    res.json({
      success: true,
      schedulerStatus: status,
      systemTime: new Date().toISOString(),
      timezone: 'America/New_York',
      nextScheduledRuns: {
        earlyRefresh: '8:45 AM ET (employment data)',
        mainRefresh: '10:15 AM ET (comprehensive update)', 
        afternoonRefresh: '2:15 PM ET (late releases)',
        qualityCheck: '11:00 AM ET (data validation)'
      }
    });
    
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve scheduler status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;