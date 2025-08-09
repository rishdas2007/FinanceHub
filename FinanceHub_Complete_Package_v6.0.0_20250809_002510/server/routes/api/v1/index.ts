import { Router } from 'express';
import { ApiController } from '../../../controllers/ApiController';
import { validate } from '../../../middleware/validation-middleware';
import { paginationSchema, stockSymbolSchema } from '../../../../shared/validation';

const router = Router();

// API Version 1 Routes with proper versioning
router.get('/ai-summary', ApiController.getAISummary);
router.get('/sectors', ApiController.getSectors);
router.get('/stocks/:symbol', 
  validate({ params: { symbol: stockSymbolSchema } }), 
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

export { router as v1Routes };