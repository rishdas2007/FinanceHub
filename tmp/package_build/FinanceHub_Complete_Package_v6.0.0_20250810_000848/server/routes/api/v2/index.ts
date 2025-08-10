import { Router } from 'express';
import { ApiController } from '../../../controllers/ApiController';
import { validate } from '../../../middleware/validation-middleware';
import { paginationSchema, stockSymbolSchema } from '../../../../shared/validation';

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

// V2 specific endpoints can be added here
// router.get('/enhanced-features', ...);

export { router as v2Routes };