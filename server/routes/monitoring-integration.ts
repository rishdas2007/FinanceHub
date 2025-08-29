/**
 * Monitoring Integration Routes - Centralized Monitoring Route Registration
 * 
 * @description Integrates all monitoring and architecture dashboard routes
 * into the main application router for easy access and organization.
 * 
 * @author AI Agent Integration
 * @version 1.0.0
 * @since 2025-08-29
 */

import { Router } from 'express';
import { serviceArchitectureDashboard } from './service-architecture-dashboard';
import { productionMonitoringDashboard } from './production-monitoring-dashboard';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { ResponseUtils } from '../utils/ResponseUtils';
import { serviceSizeMonitor } from '../utils/service-size-monitor';
import { serviceConsolidationAnalyzer } from '../services/service-consolidation-analyzer';
import { financialAlertingSystem } from '../services/financial-alerting-system';
import { performanceMonitor } from '../services/performance-monitor';
import { productionMetricsStorage } from '../services/production-metrics-storage';

const router = Router();

// Mount dashboard routes
router.use('/architecture', serviceArchitectureDashboard);
router.use('/production', productionMonitoringDashboard);

/**
 * Get overall monitoring system status
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const [
      metricsHealth,
      performanceHealth,
      financialStats,
      architectureReport
    ] = await Promise.all([
      productionMetricsStorage.healthCheck(),
      performanceMonitor.getServiceDependencyHealth(),
      financialAlertingSystem.getFinancialAlertStats(),
      serviceConsolidationAnalyzer.analyzeServiceArchitecture().catch(() => null)
    ]);

    const systemStatus = {
      timestamp: new Date().toISOString(),
      overall: calculateOverallMonitoringStatus({
        metrics: metricsHealth.status,
        performance: performanceHealth.overallHealth,
        financial: financialStats.active.total === 0 ? 'healthy' : 'degraded',
        architecture: architectureReport ? (architectureReport.healthScore >= 70 ? 'healthy' : 'degraded') : 'unknown'
      }),
      components: {
        metricsStorage: {
          status: metricsHealth.status,
          details: metricsHealth.details
        },
        performanceMonitoring: {
          status: performanceHealth.overallHealth,
          totalServices: performanceHealth.summary.totalServices,
          avgLatency: performanceHealth.summary.avgLatency,
          avgAvailability: performanceHealth.summary.avgAvailability
        },
        financialAlerting: {
          status: financialStats.active.critical > 0 ? 'critical' : 
                 financialStats.active.total > 5 ? 'warning' : 'healthy',
          activeAlerts: financialStats.active.total,
          criticalAlerts: financialStats.active.critical,
          lastHealthCheck: financialStats.lastHealthCheck
        },
        architectureMonitoring: {
          status: architectureReport ? 
            (architectureReport.healthScore >= 80 ? 'excellent' : 
             architectureReport.healthScore >= 60 ? 'good' : 'needs_attention') : 'unknown',
          healthScore: architectureReport?.healthScore || 0,
          totalServices: architectureReport?.totalServices || 0,
          recommendations: architectureReport?.recommendations.filter(r => r.priority === 'high').length || 0
        }
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      features: {
        serviceConsolidation: 'active',
        financialAlerting: 'active', 
        productionMetrics: 'active',
        performanceDependencies: 'active',
        architectureDashboard: 'active',
        productionDashboard: 'active'
      }
    };

    // Store monitoring status metric
    await productionMetricsStorage.storeMetric({
      timestamp: new Date(),
      metricName: 'monitoring_system_status',
      value: systemStatus.overall === 'healthy' ? 1 : 0,
      tags: {
        overall_status: systemStatus.overall,
        metrics_status: metricsHealth.status,
        performance_status: performanceHealth.overallHealth
      },
      metadata: {
        active_alerts: financialStats.active.total,
        health_score: architectureReport?.healthScore || 0
      }
    });

    ResponseUtils.success(res, systemStatus);
  } catch (error) {
    console.error('Failed to get monitoring status:', error);
    ResponseUtils.internalError(res, 'Failed to retrieve monitoring system status');
  }
}));

/**
 * Get quick health summary for all monitoring components
 */
router.get('/health-summary', asyncHandler(async (req, res) => {
  try {
    const healthSummary = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        nodeVersion: process.version,
        platform: process.platform
      },
      monitoring: {
        metricsStorage: await getQuickHealthCheck(productionMetricsStorage.healthCheck),
        performanceMonitor: getPerformanceQuickHealth(),
        financialAlerting: getFinancialQuickHealth(),
        architectureAnalysis: await getArchitectureQuickHealth()
      },
      alerts: {
        system: performanceMonitor.getHealthStatus().issues.length,
        financial: financialAlertingSystem.getActiveFinancialAlerts().length,
        total: performanceMonitor.getHealthStatus().issues.length + 
               financialAlertingSystem.getActiveFinancialAlerts().length
      }
    };

    ResponseUtils.success(res, healthSummary);
  } catch (error) {
    console.error('Failed to get health summary:', error);
    ResponseUtils.internalError(res, 'Failed to retrieve health summary');
  }
}));

/**
 * Get monitoring system metrics
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    
    // Calculate time range
    const endDate = new Date();
    const startDate = new Date();
    const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
    startDate.setHours(startDate.getHours() - hours);

    const metrics = {
      timestamp: new Date().toISOString(),
      timeRange,
      performance: performanceMonitor.getPerformanceSummary(hours * 60 * 60 * 1000),
      financial: financialAlertingSystem.getFinancialAlertStats(),
      system: performanceMonitor.getHealthStatus(),
      serviceDependencies: performanceMonitor.getServiceDependencyHealth(),
      storage: await productionMetricsStorage.getMetricStats()
    };

    ResponseUtils.success(res, metrics);
  } catch (error) {
    console.error('Failed to get monitoring metrics:', error);
    ResponseUtils.internalError(res, 'Failed to retrieve monitoring metrics');
  }
}));

/**
 * Initialize monitoring system
 */
router.post('/initialize', asyncHandler(async (req, res) => {
  try {
    // Initialize production metrics storage
    await productionMetricsStorage.initialize();
    
    // Register core metrics
    await productionMetricsStorage.registerMetric(
      'system_health_score',
      'Overall system health score (0-100)',
      'score',
      'gauge',
      30
    );

    await productionMetricsStorage.registerMetric(
      'architecture_health_score', 
      'Service architecture health score (0-100)',
      'score',
      'gauge',
      30
    );

    await productionMetricsStorage.registerMetric(
      'financial_alert_created',
      'Financial alerts created',
      'count',
      'counter',
      90
    );

    await productionMetricsStorage.registerMetric(
      'service_dependency_latency',
      'Service dependency call latency',
      'milliseconds', 
      'gauge',
      7
    );

    const initializationResult = {
      timestamp: new Date().toISOString(),
      status: 'initialized',
      components: {
        metricsStorage: 'initialized',
        performanceMonitor: 'active',
        financialAlerting: 'active',
        architectureAnalyzer: 'active'
      },
      metrics: {
        registered: 4,
        storageInitialized: true
      }
    };

    ResponseUtils.success(res, initializationResult);
  } catch (error) {
    console.error('Failed to initialize monitoring system:', error);
    ResponseUtils.internalError(res, 'Failed to initialize monitoring system');
  }
}));

// Helper functions
function calculateOverallMonitoringStatus(components: {
  metrics: string;
  performance: string;
  financial: string;
  architecture: string;
}): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(components);
  
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.filter(s => s === 'degraded').length >= 2) return 'degraded';
  if (statuses.includes('degraded')) return 'degraded';
  
  return 'healthy';
}

async function getQuickHealthCheck(healthCheckFn: () => Promise<any>): Promise<string> {
  try {
    const result = await healthCheckFn();
    return result.status;
  } catch {
    return 'unhealthy';
  }
}

function getPerformanceQuickHealth(): string {
  try {
    const health = performanceMonitor.getHealthStatus();
    return health.status;
  } catch {
    return 'unhealthy';
  }
}

function getFinancialQuickHealth(): string {
  try {
    const stats = financialAlertingSystem.getFinancialAlertStats();
    return stats.active.critical > 0 ? 'unhealthy' : 
           stats.active.total > 5 ? 'degraded' : 'healthy';
  } catch {
    return 'unhealthy';
  }
}

async function getArchitectureQuickHealth(): Promise<string> {
  try {
    const summary = await serviceSizeMonitor.generateJsonSummary();
    return summary.summary.critical > 5 ? 'unhealthy' :
           summary.summary.warning > 10 ? 'degraded' : 'healthy';
  } catch {
    return 'unknown';
  }
}

export { router as monitoringIntegrationRoutes };