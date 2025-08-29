/**
 * Service Architecture Dashboard - Real-time Service Health and Optimization Monitoring
 * 
 * @description API routes for monitoring service architecture health, consolidation opportunities,
 * and providing actionable insights for service optimization. Integrates with the service
 * consolidation analyzer and service size monitor for comprehensive architecture governance.
 * 
 * @author AI Agent Architecture Enhancement
 * @version 1.0.0
 * @since 2025-08-29
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { ResponseUtils } from '../utils/ResponseUtils';
import { logger } from '../utils/logger';
import { serviceConsolidationAnalyzer } from '../services/service-consolidation-analyzer';
import { serviceSizeMonitor } from '../utils/service-size-monitor';
import { productionMetricsStorage } from '../services/production-metrics-storage';

const router = Router();

/**
 * Get comprehensive service architecture health overview
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const [architectureReport, sizeReport] = await Promise.all([
      serviceConsolidationAnalyzer.analyzeServiceArchitecture(),
      serviceSizeMonitor.generateJsonSummary()
    ]);

    const healthOverview = {
      timestamp: new Date().toISOString(),
      architectureHealth: {
        score: architectureReport.healthScore,
        status: architectureReport.healthScore >= 80 ? 'excellent' : 
               architectureReport.healthScore >= 60 ? 'good' :
               architectureReport.healthScore >= 40 ? 'needs_attention' : 'critical',
        totalServices: architectureReport.totalServices,
        servicesByDomain: architectureReport.servicesByDomain,
        highPriorityRecommendations: architectureReport.recommendations.filter(r => r.priority === 'high').length
      },
      serviceSize: {
        totalServices: sizeReport.summary.totalServices,
        critical: sizeReport.summary.critical,
        warning: sizeReport.summary.warning,
        healthy: sizeReport.summary.healthy,
        consolidationOpportunities: sizeReport.summary.consolidationOpportunities
      },
      complexity: architectureReport.complexityMetrics,
      dependencies: architectureReport.dependencyMetrics,
      recommendations: {
        immediate: architectureReport.recommendations.filter(r => r.priority === 'high'),
        planned: architectureReport.recommendations.filter(r => r.priority === 'medium'),
        future: architectureReport.recommendations.filter(r => r.priority === 'low')
      }
    };

    // Store architecture health metric
    await productionMetricsStorage.storeMetric({
      timestamp: new Date(),
      metricName: 'architecture_health_score',
      value: architectureReport.healthScore,
      tags: { 
        status: healthOverview.architectureHealth.status,
        total_services: architectureReport.totalServices.toString()
      },
      metadata: {
        critical_services: sizeReport.summary.critical,
        consolidation_opportunities: sizeReport.summary.consolidationOpportunities
      }
    });

    ResponseUtils.success(res, healthOverview);
  } catch (error) {
    logger.error('Failed to get architecture health', { error });
    ResponseUtils.internalError(res, 'Failed to retrieve architecture health data');
  }
}));

/**
 * Get detailed service consolidation analysis
 */
router.get('/consolidation-analysis', asyncHandler(async (req, res) => {
  try {
    const analysisReport = await serviceConsolidationAnalyzer.analyzeServiceArchitecture();
    
    const consolidationAnalysis = {
      timestamp: new Date().toISOString(),
      healthScore: analysisReport.healthScore,
      serviceDistribution: analysisReport.servicesByDomain,
      recommendations: analysisReport.recommendations,
      complexityMetrics: analysisReport.complexityMetrics,
      dependencyIssues: {
        circularDependencies: analysisReport.dependencyMetrics.circularDependencies,
        highCouplingServices: analysisReport.dependencyMetrics.highCouplingServices,
        orphanedServices: analysisReport.dependencyMetrics.orphanedServices
      },
      implementationPriority: {
        immediate: analysisReport.recommendations
          .filter(r => r.priority === 'high')
          .map(r => ({
            type: r.type,
            services: r.services,
            description: r.description,
            expectedBenefits: r.expectedBenefits,
            estimatedEffort: r.estimatedEffort,
            riskLevel: r.riskLevel
          })),
        shortTerm: analysisReport.recommendations
          .filter(r => r.priority === 'medium')
          .slice(0, 3),
        longTerm: analysisReport.recommendations
          .filter(r => r.priority === 'low')
          .slice(0, 5)
      }
    };

    ResponseUtils.success(res, consolidationAnalysis);
  } catch (error) {
    logger.error('Failed to get consolidation analysis', { error });
    ResponseUtils.internalError(res, 'Failed to retrieve consolidation analysis');
  }
}));

/**
 * Get service size and governance report
 */
router.get('/size-governance', asyncHandler(async (req, res) => {
  try {
    const [jsonReport, markdownReport] = await Promise.all([
      serviceSizeMonitor.generateJsonSummary(),
      serviceSizeMonitor.generateReport()
    ]);

    const governanceData = {
      timestamp: new Date().toISOString(),
      summary: jsonReport.summary,
      servicesByStatus: jsonReport.servicesByStatus,
      consolidationOpportunities: jsonReport.consolidationOpportunities,
      markdownReport,
      insights: {
        totalLinesOfCode: jsonReport.servicesByStatus.critical
          .concat(jsonReport.servicesByStatus.warning)
          .reduce((total, service) => total + service.lines, 0),
        averageServiceSize: Math.round(
          jsonReport.servicesByStatus.critical
            .concat(jsonReport.servicesByStatus.warning)
            .reduce((total, service) => total + service.sizeKB, 0) / 
          (jsonReport.servicesByStatus.critical.length + jsonReport.servicesByStatus.warning.length) || 1
        ),
        consolidationPotential: {
          servicesEligible: jsonReport.consolidationOpportunities.length,
          estimatedReduction: Math.round(jsonReport.consolidationOpportunities.length * 0.3),
          complexityReduction: jsonReport.consolidationOpportunities.length > 0 ? '15-25%' : '0%'
        }
      }
    };

    ResponseUtils.success(res, governanceData);
  } catch (error) {
    logger.error('Failed to get size governance data', { error });
    ResponseUtils.internalError(res, 'Failed to retrieve size governance data');
  }
}));

/**
 * Get service dependency mapping
 */
router.get('/dependencies', asyncHandler(async (req, res) => {
  try {
    const architectureReport = await serviceConsolidationAnalyzer.analyzeServiceArchitecture();
    
    // Create dependency graph data structure
    const dependencyGraph = {
      timestamp: new Date().toISOString(),
      nodes: Object.keys(architectureReport.servicesByDomain).flatMap(domain =>
        Array(architectureReport.servicesByDomain[domain]).fill(null).map((_, index) => ({
          id: `${domain.toLowerCase()}-service-${index + 1}`,
          label: `${domain} Service ${index + 1}`,
          domain,
          group: domain.toLowerCase(),
          size: 'medium' // This would be calculated from actual service metrics
        }))
      ),
      edges: [], // Dependencies would be calculated from actual service imports
      clusters: Object.entries(architectureReport.servicesByDomain).map(([domain, count]) => ({
        id: domain.toLowerCase(),
        label: domain,
        serviceCount: count,
        consolidationScore: 0 // Would be calculated from consolidation analysis
      })),
      metrics: {
        totalServices: architectureReport.totalServices,
        totalDomains: Object.keys(architectureReport.servicesByDomain).length,
        averageServicesPerDomain: Math.round(
          architectureReport.totalServices / Object.keys(architectureReport.servicesByDomain).length
        ),
        highCouplingServices: architectureReport.dependencyMetrics.highCouplingServices,
        orphanedServices: architectureReport.dependencyMetrics.orphanedServices,
        circularDependencies: architectureReport.dependencyMetrics.circularDependencies.length
      }
    };

    ResponseUtils.success(res, dependencyGraph);
  } catch (error) {
    logger.error('Failed to get dependency mapping', { error });
    ResponseUtils.internalError(res, 'Failed to retrieve dependency mapping');
  }
}));

/**
 * Get architecture trends and history
 */
router.get('/trends', asyncHandler(async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get historical architecture health scores
    const healthTrends = await productionMetricsStorage.getAggregatedMetrics({
      metricName: 'architecture_health_score',
      startTime: startDate,
      endTime: endDate,
      aggregation: 'avg',
      interval: timeRange === '24h' ? '1h' : timeRange === '7d' ? '1d' : '1d'
    });

    // Get service count trends
    const serviceTrends = await productionMetricsStorage.queryMetrics({
      metricName: 'service_count_change',
      startTime: startDate,
      endTime: endDate
    });

    // Get consolidation progress
    const consolidationProgress = await productionMetricsStorage.queryMetrics({
      metricName: 'service_consolidated',
      startTime: startDate,
      endTime: endDate
    });

    const trends = {
      timestamp: new Date().toISOString(),
      timeRange,
      healthScore: {
        trend: healthTrends.map(point => ({
          timestamp: point.timestamp.toISOString(),
          value: Math.round(point.value * 100) / 100,
          count: point.count
        })),
        currentScore: healthTrends.length > 0 ? 
          healthTrends[healthTrends.length - 1].value : 0,
        change: healthTrends.length >= 2 ? 
          healthTrends[healthTrends.length - 1].value - healthTrends[0].value : 0
      },
      serviceCount: {
        changes: serviceTrends.map(metric => ({
          timestamp: metric.timestamp.toISOString(),
          change: metric.value,
          reason: metric.tags.reason || 'unknown'
        })),
        totalChanges: serviceTrends.reduce((sum, m) => sum + m.value, 0)
      },
      consolidationActivity: {
        events: consolidationProgress.map(metric => ({
          timestamp: metric.timestamp.toISOString(),
          services: metric.tags.services ? metric.tags.services.split(',') : [],
          type: metric.tags.type || 'merge',
          impact: metric.tags.impact || 'medium'
        })),
        totalConsolidations: consolidationProgress.length
      }
    };

    ResponseUtils.success(res, trends);
  } catch (error) {
    logger.error('Failed to get architecture trends', { error });
    ResponseUtils.internalError(res, 'Failed to retrieve architecture trends');
  }
}));

/**
 * Execute architecture recommendations (dry-run analysis)
 */
router.post('/recommendations/:recommendationId/analyze', asyncHandler(async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const architectureReport = await serviceConsolidationAnalyzer.analyzeServiceArchitecture();
    
    const recommendation = architectureReport.recommendations.find(r => 
      r.description.replace(/\s+/g, '-').toLowerCase() === recommendationId
    );

    if (!recommendation) {
      return ResponseUtils.notFound(res, 'Recommendation not found');
    }

    // Simulate recommendation impact
    const impactAnalysis = {
      timestamp: new Date().toISOString(),
      recommendation: {
        id: recommendationId,
        type: recommendation.type,
        services: recommendation.services,
        description: recommendation.description,
        priority: recommendation.priority,
        estimatedEffort: recommendation.estimatedEffort,
        riskLevel: recommendation.riskLevel
      },
      impact: {
        servicesAffected: recommendation.services.length,
        estimatedComplexityReduction: recommendation.type === 'merge_services' ? 
          `${Math.round(recommendation.services.length * 0.2 * 100)}%` : 
          recommendation.type === 'split_service' ? 
          `+${Math.round(recommendation.services.length * 0.1 * 100)}%` : '5-10%',
        expectedBenefits: recommendation.expectedBenefits,
        riskFactors: this.generateRiskFactors(recommendation),
        implementationSteps: recommendation.implementationSteps,
        estimatedTimeframe: this.estimateTimeframe(recommendation),
        prerequisiteChecks: this.generatePrerequisiteChecks(recommendation)
      },
      simulation: {
        beforeState: {
          serviceCount: architectureReport.totalServices,
          healthScore: architectureReport.healthScore,
          complexityScore: this.calculateComplexityScore(architectureReport)
        },
        afterState: {
          serviceCount: this.simulateServiceCountChange(architectureReport.totalServices, recommendation),
          healthScore: this.simulateHealthScoreChange(architectureReport.healthScore, recommendation),
          complexityScore: this.simulateComplexityChange(architectureReport, recommendation)
        }
      }
    };

    // Store analysis request metric
    await productionMetricsStorage.storeMetric({
      timestamp: new Date(),
      metricName: 'recommendation_analyzed',
      value: 1,
      tags: {
        recommendationId,
        type: recommendation.type,
        priority: recommendation.priority,
        serviceCount: recommendation.services.length.toString()
      }
    });

    ResponseUtils.success(res, impactAnalysis);
  } catch (error) {
    logger.error('Failed to analyze recommendation', { recommendationId: req.params.recommendationId, error });
    ResponseUtils.internalError(res, 'Failed to analyze recommendation impact');
  }
}));

/**
 * Get real-time architecture metrics
 */
router.get('/metrics/realtime', asyncHandler(async (req, res) => {
  try {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    
    // Get real-time metrics
    const [
      architectureHealth,
      serviceErrors,
      performanceMetrics,
      dependencyHealth
    ] = await Promise.all([
      productionMetricsStorage.queryMetrics({
        metricName: 'architecture_health_score',
        startTime: last5Minutes,
        endTime: new Date(),
        limit: 1
      }),
      productionMetricsStorage.queryMetrics({
        metricName: 'service_error',
        startTime: last5Minutes,
        endTime: new Date()
      }),
      productionMetricsStorage.queryMetrics({
        metricName: 'service_response_time',
        startTime: last5Minutes,
        endTime: new Date()
      }),
      productionMetricsStorage.queryMetrics({
        metricName: 'dependency_check',
        startTime: last5Minutes,
        endTime: new Date()
      })
    ]);

    const realtimeMetrics = {
      timestamp: new Date().toISOString(),
      health: {
        currentScore: architectureHealth.length > 0 ? architectureHealth[0].value : null,
        status: architectureHealth.length > 0 ? 
          (architectureHealth[0].value >= 80 ? 'excellent' : 
           architectureHealth[0].value >= 60 ? 'good' : 'needs_attention') : 'unknown'
      },
      errors: {
        count: serviceErrors.length,
        recentErrors: serviceErrors.slice(0, 5).map(error => ({
          timestamp: error.timestamp.toISOString(),
          service: error.tags.service || 'unknown',
          error: error.tags.error || 'unknown',
          impact: error.tags.impact || 'low'
        }))
      },
      performance: {
        averageResponseTime: performanceMetrics.length > 0 ? 
          performanceMetrics.reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length : 0,
        slowestServices: performanceMetrics
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map(metric => ({
            service: metric.tags.service || 'unknown',
            responseTime: Math.round(metric.value * 100) / 100,
            timestamp: metric.timestamp.toISOString()
          }))
      },
      dependencies: {
        healthyConnections: dependencyHealth.filter(d => d.value === 1).length,
        failedConnections: dependencyHealth.filter(d => d.value === 0).length,
        totalChecked: dependencyHealth.length
      }
    };

    ResponseUtils.success(res, realtimeMetrics);
  } catch (error) {
    logger.error('Failed to get realtime metrics', { error });
    ResponseUtils.internalError(res, 'Failed to retrieve realtime architecture metrics');
  }
}));

// Helper methods for impact analysis
function generateRiskFactors(recommendation: any): string[] {
  const risks = [];
  
  if (recommendation.riskLevel === 'high') {
    risks.push('High complexity change requiring extensive testing');
    risks.push('Potential service downtime during migration');
  }
  
  if (recommendation.services.length > 5) {
    risks.push('Large number of services affected increases coordination complexity');
  }
  
  if (recommendation.type === 'merge_services') {
    risks.push('Risk of functionality loss during service consolidation');
    risks.push('Potential performance impact during initial deployment');
  }
  
  if (recommendation.type === 'split_service') {
    risks.push('Increased operational overhead with more services to manage');
    risks.push('Network latency increase due to service boundaries');
  }
  
  return risks;
}

function estimateTimeframe(recommendation: any): string {
  const baseTime = {
    'low': 2,
    'medium': 5,
    'high': 10
  }[recommendation.estimatedEffort] || 5;
  
  const serviceMultiplier = Math.max(1, recommendation.services.length * 0.5);
  const totalWeeks = Math.round(baseTime * serviceMultiplier);
  
  return `${totalWeeks} weeks`;
}

function generatePrerequisiteChecks(recommendation: any): string[] {
  const checks = [
    'Comprehensive test coverage for affected services',
    'Database migration scripts prepared and tested',
    'Rollback plan documented and tested'
  ];
  
  if (recommendation.type === 'merge_services') {
    checks.push('Service interface compatibility verified');
    checks.push('Dependency injection configuration updated');
  }
  
  if (recommendation.type === 'split_service') {
    checks.push('New service boundaries clearly defined');
    checks.push('Inter-service communication protocols established');
  }
  
  return checks;
}

function simulateServiceCountChange(currentCount: number, recommendation: any): number {
  switch (recommendation.type) {
    case 'merge_services':
      return currentCount - Math.max(0, recommendation.services.length - 1);
    case 'split_service':
      return currentCount + Math.floor(recommendation.services.length * 0.5);
    default:
      return currentCount;
  }
}

function simulateHealthScoreChange(currentScore: number, recommendation: any): number {
  const improvement = {
    'high': 10,
    'medium': 5,
    'low': 2
  }[recommendation.priority] || 2;
  
  return Math.min(100, currentScore + improvement);
}

function calculateComplexityScore(report: any): number {
  return Math.round(
    (report.complexityMetrics.oversizedServices * 20) +
    (report.dependencyMetrics.highCouplingServices.length * 15) +
    (report.dependencyMetrics.orphanedServices.length * 10)
  );
}

function simulateComplexityChange(report: any, recommendation: any): number {
  const currentComplexity = calculateComplexityScore(report);
  const reduction = {
    'merge_services': 15,
    'split_service': -5,
    'optimize_imports': 8,
    'extract_common': 5
  }[recommendation.type] || 0;
  
  return Math.max(0, currentComplexity - reduction);
}

export { router as serviceArchitectureDashboard };