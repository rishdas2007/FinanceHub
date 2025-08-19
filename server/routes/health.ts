import { Router } from 'express';
import { healthCheckHandler, DatabaseHealthChecker } from '../middleware/database-health-check';

const router = Router();

// Basic health check endpoint
router.get('/health', async (req, res) => {
  try {
    res.json({ 
      ok: true, 
      db: true,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error: any) {
    res.status(503).json({ 
      ok: false, 
      db: false, 
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Comprehensive database health check endpoint - RCA Implementation
router.get('/health/db', healthCheckHandler);

// Database schema validation endpoint
router.get('/health/db/detailed', async (req, res) => {
  try {
    const healthChecker = DatabaseHealthChecker.getInstance();
    const result = await healthChecker.performFullHealthCheck();
    
    res.status(result.healthy ? 200 : 503).json({
      healthy: result.healthy,
      timestamp: result.timestamp,
      summary: {
        totalTables: result.checks.length,
        healthyTables: result.checks.filter(c => c.exists && c.missingColumns.length === 0).length,
        tablesWithData: result.checks.filter(c => c.hasData).length,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length
      },
      checks: result.checks,
      warnings: result.warnings,
      errors: result.errors,
      recommendations: generateHealthRecommendations(result)
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ETF-specific health check endpoint
router.get('/health/etf-metrics', async (req, res) => {
  try {
    const healthChecker = DatabaseHealthChecker.getInstance();
    const quickCheck = await healthChecker.quickHealthCheck();
    
    // Check specifically for ETF metrics dependencies
    const etfHealthCheck = await performETFHealthCheck();
    
    res.json({
      healthy: quickCheck.healthy && etfHealthCheck.healthy,
      message: quickCheck.message,
      etfMetrics: etfHealthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error instanceof Error ? error.message : 'ETF health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

function generateHealthRecommendations(result: any): string[] {
  const recommendations: string[] = [];
  
  // Check for empty equity_features_daily
  const featuresTable = result.checks.find((c: any) => c.table === 'equity_features_daily');
  if (featuresTable && featuresTable.exists && !featuresTable.hasData) {
    recommendations.push('Run ETL pipeline to populate equity_features_daily with precomputed Z-scores');
    recommendations.push('ETF metrics currently using fallback data from stock_data and technical_indicators');
  }
  
  // Check for missing tables
  const missingTables = result.checks.filter((c: any) => !c.exists);
  if (missingTables.length > 0) {
    recommendations.push(`Run database migrations to create missing tables: ${missingTables.map((t: any) => t.table).join(', ')}`);
  }
  
  // Check for missing columns
  const columnsIssues = result.checks.filter((c: any) => c.missingColumns.length > 0);
  if (columnsIssues.length > 0) {
    recommendations.push('Update database schema to add missing columns');
  }
  
  if (result.errors.length === 0 && result.warnings.length === 0) {
    recommendations.push('All systems operational - no action required');
  }
  
  return recommendations;
}

async function performETFHealthCheck(): Promise<{ healthy: boolean; details: any }> {
  try {
    // Import ETF fallback service to check data availability
    const { ETFMetricsFallbackService } = await import('../services/etf-metrics-fallback');
    const fallbackService = new ETFMetricsFallbackService();
    
    const hasPrecomputed = await fallbackService.hasPrecomputedFeatures();
    const metrics = await fallbackService.getETFMetrics();
    
    return {
      healthy: metrics.success,
      details: {
        hasPrecomputedFeatures: hasPrecomputed,
        dataSource: metrics.source,
        fallbackReason: metrics.fallbackReason,
        etfCount: metrics.data.length,
        expectedETFs: 12,
        completeness: `${metrics.data.length}/12 ETFs available`
      }
    };
  } catch (error) {
    return {
      healthy: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasPrecomputedFeatures: false
      }
    };
  }
}

export default router;