import { Router } from 'express';
import { circuitBreakers } from '../middleware/circuit-breaker';
import { performanceMonitor } from '../middleware/performance-monitor';
import { serviceSizeMonitor } from '../utils/service-size-monitor';
import { codeDocumentationAnalyzer } from '../utils/code-documentation';
import { queryOptimizer } from '../utils/query-optimizer';
import { loadTester } from '../utils/load-testing';
import { logger } from '../utils/logger';
import { dataIntegrityValidator } from '../services/data-integrity-validator';
import { dataStalenessPrevention } from '../services/data-staleness-prevention';

const router = Router();

// System health endpoint
router.get('/health', async (req, res) => {
  try {
    const dbHealth = await performanceMonitor.checkDatabaseHealth();
    const performanceStats = performanceMonitor.getStats();
    
    // Get circuit breaker statuses
    const circuitBreakerHealth = {
      openai: circuitBreakers.openai.getHealth(),
      twelveData: circuitBreakers.twelveData.getHealth(),
      fred: circuitBreakers.fred.getHealth(),
      sendgrid: circuitBreakers.sendgrid.getHealth()
    };

    const overallStatus = dbHealth.status === 'healthy' && 
      Object.values(circuitBreakerHealth).every(cb => cb.status === 'healthy')
        ? 'healthy' 
        : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      database: dbHealth,
      circuitBreakers: circuitBreakerHealth,
      performance: {
        averageQueryTime: performanceStats.averageQueryTime,
        queriesInLastHour: performanceStats.queriesInLastHour,
        slowQueries: performanceStats.slowQueries.length
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed performance stats endpoint
router.get('/performance', async (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Performance stats request failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to retrieve performance stats' });
  }
});

// Circuit breaker status endpoint
router.get('/circuit-breakers', (req, res) => {
  try {
    const status = {
      openai: circuitBreakers.openai.getState(),
      twelveData: circuitBreakers.twelveData.getState(),
      fred: circuitBreakers.fred.getState(),
      sendgrid: circuitBreakers.sendgrid.getState()
    };

    res.json({
      timestamp: new Date().toISOString(),
      circuitBreakers: status
    });
  } catch (error) {
    logger.error('Circuit breaker status request failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to retrieve circuit breaker status' });
  }
});

// Service size governance endpoint
router.get('/service-sizes', async (req, res) => {
  try {
    const reports = await serviceSizeMonitor.checkAllServices();
    res.json({
      timestamp: new Date().toISOString(),
      services: reports,
      summary: {
        total: reports.length,
        critical: reports.filter(r => r.status === 'critical').length,
        warning: reports.filter(r => r.status === 'warning').length,
        healthy: reports.filter(r => r.status === 'healthy').length
      }
    });
  } catch (error) {
    logger.error('Service size check failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to check service sizes' });
  }
});

// Generate detailed governance report
router.get('/governance-report', async (req, res) => {
  try {
    const report = await serviceSizeMonitor.generateReport();
    res.type('text/plain').send(report);
  } catch (error) {
    logger.error('Governance report generation failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to generate governance report' });
  }
});

// Code documentation analysis endpoint
router.get('/code-documentation', async (req, res) => {
  try {
    const analysis = await codeDocumentationAnalyzer.analyzeProject();
    res.json({
      timestamp: new Date().toISOString(),
      analysis,
      summary: {
        total: analysis.length,
        wellDocumented: analysis.filter(a => a.status === 'well-documented').length,
        needsImprovement: analysis.filter(a => a.status === 'needs-improvement').length,
        poorlyDocumented: analysis.filter(a => a.status === 'poorly-documented').length,
        averageCommentRatio: analysis.reduce((sum, a) => sum + a.commentRatio, 0) / analysis.length
      }
    });
  } catch (error) {
    logger.error('Code documentation analysis failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to analyze code documentation' });
  }
});

// Generate documentation report
router.get('/documentation-report', async (req, res) => {
  try {
    const report = await codeDocumentationAnalyzer.generateDocumentationReport();
    res.type('text/plain').send(report);
  } catch (error) {
    logger.error('Documentation report generation failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to generate documentation report' });
  }
});

// Query optimization analysis
router.get('/query-optimization', async (req, res) => {
  try {
    const slowQueries = queryOptimizer.getSlowQueries();
    res.json({
      timestamp: new Date().toISOString(),
      slowQueries,
      count: slowQueries.length,
      threshold: '100ms'
    });
  } catch (error) {
    logger.error('Query optimization analysis failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to analyze query performance' });
  }
});

// Generate query optimization report
router.get('/optimization-report', async (req, res) => {
  try {
    const report = await queryOptimizer.generateOptimizationReport();
    res.type('text/plain').send(report);
  } catch (error) {
    logger.error('Optimization report generation failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to generate optimization report' });
  }
});

// Load testing endpoint
router.post('/load-test', async (req, res) => {
  try {
    const { endpoint = '/api/health/ping', concurrentUsers = 5, duration = 10 } = req.body;
    
    if (duration > 60) {
      return res.status(400).json({ error: 'Maximum test duration is 60 seconds' });
    }
    
    const result = await loadTester.runLoadTest({
      endpoint,
      concurrentUsers,
      duration
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      testConfig: { endpoint, concurrentUsers, duration },
      results: result
    });
  } catch (error) {
    logger.error('Load test failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to run load test' });
  }
});

// Comprehensive system status
router.get('/system-status', async (req, res) => {
  try {
    const [dbHealth, performanceStats, serviceReports] = await Promise.all([
      performanceMonitor.checkDatabaseHealth(),
      performanceMonitor.getStats(),
      serviceSizeMonitor.checkAllServices()
    ]);

    const circuitBreakerHealth = {
      openai: circuitBreakers.openai.getHealth(),
      twelveData: circuitBreakers.twelveData.getHealth(),
      fred: circuitBreakers.fred.getHealth(),
      sendgrid: circuitBreakers.sendgrid.getHealth()
    };

    const overallStatus = 
      dbHealth.status === 'healthy' && 
      Object.values(circuitBreakerHealth).every(cb => cb.status === 'healthy') &&
      serviceReports.filter(s => s.status === 'critical').length === 0
        ? 'healthy' 
        : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        database: dbHealth,
        circuitBreakers: circuitBreakerHealth,
        performance: {
          averageQueryTime: performanceStats.averageQueryTime,
          queriesInLastHour: performanceStats.queriesInLastHour,
          slowQueries: performanceStats.slowQueries.length
        },
        services: {
          total: serviceReports.length,
          critical: serviceReports.filter(s => s.status === 'critical').length,
          warning: serviceReports.filter(s => s.status === 'warning').length,
          healthy: serviceReports.filter(s => s.status === 'healthy').length
        }
      }
    });
  } catch (error) {
    logger.error('System status check failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'System status check failed'
    });
  }
});

// Basic ping endpoint
router.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong', 
    timestamp: new Date().toISOString() 
  });
});

// Data integrity validation endpoint
router.post('/data-integrity/validate', async (req, res) => {
  try {
    logger.info('Manual data integrity validation triggered');
    const report = await dataIntegrityValidator.validateAndFixStaleData();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      report
    });
  } catch (error) {
    logger.error('Data integrity validation failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Data integrity validation failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Data staleness prevention status
router.get('/data-integrity/status', async (req, res) => {
  try {
    const status = dataStalenessPrevention.getMonitoringStatus();
    
    res.json({
      monitoring: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get data integrity status', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'Failed to get data integrity status',
      timestamp: new Date().toISOString()
    });
  }
});

// Manual stale data fix
router.post('/data-integrity/fix-stale', async (req, res) => {
  try {
    logger.info('Manual stale data fix triggered');
    const result = await dataStalenessPrevention.manualStaleDataFix();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      fixed: result.fixed,
      errors: result.errors
    });
  } catch (error) {
    logger.error('Manual stale data fix failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Manual stale data fix failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;