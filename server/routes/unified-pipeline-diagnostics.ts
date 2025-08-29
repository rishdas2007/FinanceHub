/**
 * Unified Pipeline Diagnostics
 * 
 * Provides diagnostic endpoints to identify production issues with the unified data pipeline
 * 
 * @author Production Diagnostics
 * @version 1.0.0
 * @since 2025-08-29
 */

import { Router } from 'express';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * Basic health check for unified pipeline components
 */
router.get('/health', async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database_url_configured: !!process.env.DATABASE_URL,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime(),
      components: {}
    };

    // Test unified data access import
    try {
      const { unifiedEconomicDataAccess } = await import('../services/unified-economic-data-access');
      diagnostics.components.unified_data_access = 'imported_successfully';
    } catch (error) {
      diagnostics.components.unified_data_access = `import_failed: ${error.message}`;
    }

    // Test data transformation middleware import
    try {
      const { dataTransformationMiddleware } = await import('../services/data-transformation-middleware');
      diagnostics.components.data_transformation = 'imported_successfully';
    } catch (error) {
      diagnostics.components.data_transformation = `import_failed: ${error.message}`;
    }

    // Test macroeconomic service import
    try {
      const { macroeconomicService } = await import('../services/macroeconomic-indicators');
      diagnostics.components.macroeconomic_service = 'imported_successfully';
    } catch (error) {
      diagnostics.components.macroeconomic_service = `import_failed: ${error.message}`;
    }

    logger.info('🔍 [DIAGNOSTICS] Pipeline health check completed', diagnostics);
    res.json(diagnostics);

  } catch (error) {
    logger.error('❌ [DIAGNOSTICS] Health check failed:', error);
    res.status(500).json({
      error: 'diagnostic_failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * Test database connectivity with detailed error reporting
 */
router.get('/database', async (req, res) => {
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    
    // Test basic database query
    const testQuery = await db.execute(sql`SELECT 1 as test`);
    
    // Test economic indicators tables
    let historyTableTest, currentTableTest;
    
    try {
      historyTableTest = await db.execute(sql`SELECT COUNT(*) as count FROM economic_indicators_history LIMIT 1`);
    } catch (error) {
      historyTableTest = { error: error.message };
    }
    
    try {
      currentTableTest = await db.execute(sql`SELECT COUNT(*) as count FROM economic_indicators_current LIMIT 1`);
    } catch (error) {
      currentTableTest = { error: error.message };
    }

    res.json({
      timestamp: new Date().toISOString(),
      database_connection: 'success',
      basic_query: testQuery.rows,
      history_table: historyTableTest,
      current_table: currentTableTest
    });

  } catch (error) {
    logger.error('❌ [DIAGNOSTICS] Database test failed:', error);
    res.status(500).json({
      error: 'database_test_failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * Test unified pipeline step by step
 */
router.get('/pipeline-test', async (req, res) => {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      steps: {}
    };

    // Step 1: Test unified data access
    try {
      const { unifiedEconomicDataAccess } = await import('../services/unified-economic-data-access');
      const testIndicators = await unifiedEconomicDataAccess.getEconomicIndicators(['ICSA'], {
        preferredSource: 'auto',
        validateUnits: false,
        normalizeValues: false
      });
      
      results.steps.unified_data_access = {
        status: 'success',
        indicators_count: testIndicators.length,
        sample: testIndicators.slice(0, 2)
      };
    } catch (error) {
      results.steps.unified_data_access = {
        status: 'failed',
        error: error.message,
        stack: error.stack
      };
    }

    // Step 2: Test transformation middleware
    try {
      const { dataTransformationMiddleware } = await import('../services/data-transformation-middleware');
      const testData = [{
        seriesId: 'ICSA',
        metric: 'Initial Jobless Claims',
        value: 235000,
        unit: 'thousands',
        periodDate: new Date(),
        source: 'test'
      }];
      
      const transformResult = await dataTransformationMiddleware.transformBatch(testData, {
        enforceUnitStandards: true,
        normalizeValueScales: true,
        validateTransformations: true
      });
      
      results.steps.transformation_middleware = {
        status: 'success',
        transformations_count: transformResult.transformations.length,
        sample: transformResult.data.slice(0, 1)
      };
    } catch (error) {
      results.steps.transformation_middleware = {
        status: 'failed',
        error: error.message,
        stack: error.stack
      };
    }

    // Step 3: Test macroeconomic service (limited to avoid timeout)
    try {
      const { macroeconomicService } = await import('../services/macroeconomic-indicators');
      
      // Use a quick test instead of full data fetch
      results.steps.macroeconomic_service = {
        status: 'imported_successfully',
        note: 'Full test skipped to avoid timeout'
      };
    } catch (error) {
      results.steps.macroeconomic_service = {
        status: 'failed',
        error: error.message,
        stack: error.stack
      };
    }

    logger.info('🔍 [DIAGNOSTICS] Pipeline test completed', results);
    res.json(results);

  } catch (error) {
    logger.error('❌ [DIAGNOSTICS] Pipeline test failed:', error);
    res.status(500).json({
      error: 'pipeline_test_failed',
      message: error.message,
      stack: error.stack
    });
  }
});

export default router;