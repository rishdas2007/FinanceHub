/**
 * Data Integrity Dashboard Routes
 * Provides real-time monitoring of data authenticity and cache performance
 */

import { Router } from 'express';
import { logger } from '../utils/logger';
import { cacheManager } from '../services/intelligent-cache-manager';
import { realDataPreservationService } from '../services/real-data-preservation-service';

const router = Router();

/**
 * Get comprehensive data integrity status
 */
router.get('/data-integrity/status', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get data integrity checks
    const integrityChecks = await realDataPreservationService.performDataIntegrityCheck();
    
    // Get cache statistics
    const cacheStats = cacheManager.getCacheStats();
    
    // Get preservation strategy
    const strategy = await realDataPreservationService.createPreservationStrategy();
    
    // Calculate overall data health score
    const avgConfidence = integrityChecks.reduce((sum, check) => sum + check.confidence, 0) / integrityChecks.length;
    const realDataCount = integrityChecks.filter(check => check.isRealData).length;
    const healthScore = Math.round((avgConfidence * 0.7 + (realDataCount / integrityChecks.length) * 0.3) * 100);
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data_health: {
        overall_score: healthScore,
        grade: healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : 'D',
        real_data_sources: realDataCount,
        total_sources: integrityChecks.length,
        avg_confidence: Math.round(avgConfidence * 100),
        status: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL'
      },
      integrity_checks: integrityChecks.map(check => ({
        source: check.source,
        status: check.isRealData ? 'AUTHENTIC' : 'SYNTHETIC',
        confidence_percent: Math.round(check.confidence * 100),
        recommendation: check.recommendation,
        details: check.details
      })),
      cache_performance: {
        total_entries: cacheStats.total_entries,
        total_hits: cacheStats.total_hits,
        hit_rate_percent: cacheStats.total_hits > 0 ? 
          Math.round((cacheStats.total_hits / (cacheStats.total_entries || 1)) * 100) : 0,
        avg_age_seconds: Math.round(cacheStats.avg_age_seconds),
        memory_usage_mb: Math.round(cacheStats.memory_usage_mb),
        active_keys: Object.keys(cacheStats.hit_rate_by_key),
        refreshing_keys: cacheStats.refreshing_keys
      },
      preservation_strategy: {
        current_strategy: strategy.strategy,
        priority: strategy.priority,
        actions: strategy.actions,
        estimated_improvement: strategy.estimated_improvement
      },
      metadata: {
        response_time_ms: responseTime,
        timestamp: new Date().toISOString(),
        data_preserved: realDataCount > 0,
        cache_active: cacheStats.total_entries > 0
      }
    });

  } catch (error) {
    logger.error('Data integrity status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get data integrity status',
      message: error.message
    });
  }
});

/**
 * Get real-time cache performance metrics
 */
router.get('/data-integrity/cache-metrics', async (req, res) => {
  try {
    const cacheStats = cacheManager.getCacheStats();
    
    // Calculate performance metrics
    const hitRateByKey = Object.entries(cacheStats.hit_rate_by_key).map(([key, data]: [string, any]) => ({
      cache_key: key,
      hits: data.hits,
      age_seconds: Math.round(data.age_seconds),
      performance_rating: data.hits > 5 && data.age_seconds < 300 ? 'EXCELLENT' :
                         data.hits > 2 ? 'GOOD' : 'POOR'
    }));

    res.json({
      success: true,
      cache_metrics: {
        summary: {
          total_entries: cacheStats.total_entries,
          total_hits: cacheStats.total_hits,
          memory_usage_mb: Math.round(cacheStats.memory_usage_mb),
          avg_age_seconds: Math.round(cacheStats.avg_age_seconds)
        },
        performance_by_key: hitRateByKey,
        active_refreshes: cacheStats.refreshing_keys,
        recommendations: [
          cacheStats.total_entries === 0 ? 'Cache is empty - trigger warm-up' : null,
          cacheStats.memory_usage_mb > 100 ? 'High memory usage - consider cleanup' : null,
          hitRateByKey.filter(k => k.performance_rating === 'POOR').length > 0 ? 
            'Some cache keys have poor performance' : null
        ].filter(Boolean)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Cache metrics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache metrics'
    });
  }
});

/**
 * Trigger cache warm-up for all real data sources
 */
router.post('/data-integrity/warm-cache', async (req, res) => {
  try {
    logger.info('🔥 Manual cache warm-up triggered');
    
    // Execute preservation strategy (includes cache warm-up)
    await realDataPreservationService.executePreservationStrategy();
    
    // Get updated cache stats
    const cacheStats = cacheManager.getCacheStats();
    
    res.json({
      success: true,
      message: 'Cache warm-up completed',
      cache_summary: {
        entries_after_warmup: cacheStats.total_entries,
        memory_usage_mb: Math.round(cacheStats.memory_usage_mb),
        active_keys: Object.keys(cacheStats.hit_rate_by_key)
      }
    });

  } catch (error) {
    logger.error('Cache warm-up failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cache warm-up failed',
      message: error.message
    });
  }
});

/**
 * Get data source health report
 */
router.get('/data-integrity/health-report', async (req, res) => {
  try {
    const integrityChecks = await realDataPreservationService.performDataIntegrityCheck();
    
    // Create detailed health report
    const healthReport = {
      overall_status: integrityChecks.every(check => check.isRealData) ? 'ALL_AUTHENTIC' :
                     integrityChecks.some(check => check.isRealData) ? 'PARTIALLY_AUTHENTIC' : 'NO_AUTHENTIC_DATA',
      
      data_sources: integrityChecks.map(check => ({
        source: check.source,
        authentic: check.isRealData,
        confidence: Math.round(check.confidence * 100),
        status: check.isRealData ? 'PASS' : 'FAIL',
        details: check.details,
        action_required: !check.isRealData ? check.recommendation : 'None - data is authentic'
      })),
      
      summary: {
        total_sources: integrityChecks.length,
        authentic_sources: integrityChecks.filter(check => check.isRealData).length,
        avg_confidence: Math.round(integrityChecks.reduce((sum, check) => sum + check.confidence, 0) / integrityChecks.length * 100),
        immediate_actions_needed: integrityChecks.filter(check => !check.isRealData).length
      },
      
      recommendations: integrityChecks
        .filter(check => !check.isRealData)
        .map(check => check.recommendation)
    };

    res.json({
      success: true,
      health_report: healthReport,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health report failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate health report'
    });
  }
});

export default router;