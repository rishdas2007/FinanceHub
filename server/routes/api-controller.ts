import { Request, Response, Router } from 'express';
import { asyncHandler, HttpError } from '../middleware/standardized-error-handler';
import { ResponseUtils } from '../utils/ResponseUtils';
import { logger } from '../utils/logger';
import { CACHE_DURATION } from '../../shared/config/constants';

const router = Router();

// Standardized route handlers with consistent error handling
export const createStandardRoutes = () => {
  // AI Summary endpoint disabled - OpenAI dependency removed
  // router.get('/ai-summary', asyncHandler(async (req: Request, res: Response) => {
  //   const { default: aiSummaryService } = await import('../services/ai-summary');
  //   
  //   try {
  //     const summary = await aiSummaryService.generateMarketSummary();
  //     ResponseUtils.success(res, summary);
  //   } catch (error: any) {
  //     logger.error('AI summary generation failed', { error: error.message, stack: error.stack });
  //     throw new HttpError(503, 'AI analysis temporarily unavailable');
  //   }
  // }));

  // Sectors endpoint with pagination
  router.get('/sectors', asyncHandler(async (req: Request, res: Response) => {
    const { financialDataService } = await import('../services/financial-data');
    
    try {
      const sectors = await financialDataService.getSectorETFs();
      ResponseUtils.success(res, sectors);
    } catch (error: any) {
      logger.error('Sector data fetch failed', { error: error.message });
      throw new HttpError(503, 'Market data temporarily unavailable');
    }
  }));

  // Stock quotes with caching
  router.get('/stocks/:symbol', asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    
    if (!symbol || !/^[A-Z]+$/.test(symbol)) {
      throw new HttpError(400, 'Invalid stock symbol format');
    }

    const { financialDataService } = await import('../services/financial-data');
    
    try {
      const quote = await financialDataService.getStockQuote(symbol);
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION.STOCK_QUOTES}`);
      ResponseUtils.success(res, quote);
    } catch (error: any) {
      logger.error('Stock quote fetch failed', { symbol, error: error.message });
      throw new HttpError(503, 'Stock data temporarily unavailable');
    }
  }));

  // Technical indicators with validation
  router.get('/technical/:symbol', asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    
    if (!symbol || !/^[A-Z]+$/.test(symbol)) {
      throw new HttpError(400, 'Invalid stock symbol format');
    }

    const { financialDataService } = await import('../services/financial-data');
    
    try {
      const indicators = await financialDataService.getTechnicalIndicators(symbol);
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION.TECHNICAL_INDICATORS}`);
      ResponseUtils.success(res, indicators);
    } catch (error: any) {
      logger.error('Technical indicators fetch failed', { symbol, error: error.message });
      throw new HttpError(503, 'Technical data temporarily unavailable');
    }
  }));

  // Health check endpoint
  router.get('/health', asyncHandler(async (req: Request, res: Response) => {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };
    
    ResponseUtils.success(res, healthCheck);
  }));

  // Emergency ETF Pipeline Fix endpoint
  router.post('/admin/fix-etf-pipeline', asyncHandler(async (req: Request, res: Response) => {
    logger.info('🔧 Starting ETF Pipeline Emergency Fix');
    
    try {
      const { EquityFeaturesETL } = await import('../services/equity-features-etl');
      const etl = new EquityFeaturesETL();
      
      // Step 1: Backfill daily bars from historical data
      logger.info('📊 Backfilling daily bars...');
      await etl.backfillDailyBars();
      
      // Step 2: Compute features for all ETFs  
      logger.info('🧮 Computing features for all ETFs...');
      await etl.computeFeatures();
      
      logger.info('✅ ETF Pipeline fix completed successfully');
      
      ResponseUtils.success(res, {
        message: 'ETF Pipeline fix completed successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      logger.error('❌ ETF Pipeline fix failed:', error);
      throw new HttpError(500, `ETF Pipeline fix failed: ${error.message}`);
    }
  }));

  return router;
};

export default createStandardRoutes;