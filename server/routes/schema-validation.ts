import { Router } from 'express';
import { SchemaConformanceLogger } from '../services/schema-conformance-logger';

const router = Router();

/**
 * Endpoint to validate current data state and log schema conformance analysis
 * Call this before implementing the hybrid lazy loading solution
 */
router.get('/validate-schema-conformance', async (req, res) => {
  try {
    console.log('🔍 [SCHEMA VALIDATION] Starting comprehensive analysis...');
    
    await SchemaConformanceLogger.validateCurrentDataState();
    SchemaConformanceLogger.logRecommendedApproach();
    
    res.json({
      success: true,
      message: 'Schema conformance validation completed - check server logs for detailed analysis',
      recommendation: 'Hybrid Lazy Loading with Schema Normalization',
      nextSteps: [
        'Review detailed logs for data gaps and mapping requirements',
        'Implement schema mapping service for FRED API data',
        'Add lazy loading logic to macroeconomic-indicators endpoint',
        'Test z-score calculations with normalized data'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [SCHEMA VALIDATION] Failed:', error);
    res.status(500).json({
      success: false,
      error: 'Schema validation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;