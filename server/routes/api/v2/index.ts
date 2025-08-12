import { Router } from 'express';
import { ApiController } from '../../../controllers/ApiController';
import { validate } from '../../../middleware/validation-middleware';
import { paginationSchema, stockSymbolSchema } from '../../../../shared/validation';
import { getEtfMetricsBulk } from '../../../controllers/EtfController';

const router = Router();

// API Version 2 Routes - Enhanced with additional features
router.get('/ai-summary', ApiController.getAISummary);
router.get('/sectors', ApiController.getSectors);

// Enhanced stock endpoint with additional metadata
router.get('/stocks/:symbol', 
  validate({ params: { symbol: stockSymbolSchema } }), 
  async (req, res, next) => {
    // Add version metadata to response
    req.apiVersion = 'v2';
    next();
  },
  ApiController.getStockQuote
);

router.get('/stocks/:symbol/history', 
  validate({ 
    params: { symbol: stockSymbolSchema },
    query: paginationSchema 
  }), 
  ApiController.getStockHistory
);

router.get('/technical/:symbol', 
  validate({ params: { symbol: stockSymbolSchema } }), 
  ApiController.getTechnicalIndicators
);

router.get('/health', ApiController.getHealthCheck);

// ETF Bulk Endpoint - High priority, mount first
router.get('/etf-metrics', async (req, res, next) => {
  try {
    if (req.query.bulk === 'true') {
      // Ensure proper content type for all responses
      res.setHeader('Content-Type', 'application/json');
      return await getEtfMetricsBulk(req, res);
    }
    // Fall back to individual ETF endpoint if needed
    res.status(400).json({ error: 'Bulk parameter required' });
  } catch (error) {
    console.error('ETF Bulk endpoint error:', error);
    res.status(502).json({ error: 'Failed to load ETF data', details: error.message });
  }
});

// V2 specific endpoints can be added here
// router.get('/enhanced-features', ...);

export { router as v2Routes };