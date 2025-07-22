import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { ResponseUtils } from '../utils/ResponseUtils';
import { logger } from '../utils/logger';
import { validateStockSymbol, paginationSchema } from '../../shared/validation';
import { CACHE_DURATION } from '../../shared/config/constants';

export class ApiController {
  static getAISummary = asyncHandler(async (req: Request, res: Response) => {
    const { AISummaryService } = await import('../services/ai-summary');
    
    try {
      const summary = await AISummaryService.generateMarketSummary();
      ResponseUtils.success(res, summary);
    } catch (error: any) {
      logger.error('AI summary generation failed', { error: error.message });
      ResponseUtils.internalError(res, 'AI analysis temporarily unavailable');
    }
  });

  static getSectors = asyncHandler(async (req: Request, res: Response) => {
    const { FinancialDataService } = await import('../services/financial-data');
    
    try {
      const sectors = await FinancialDataService.getSectorETFs();
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION.SECTOR_DATA}`);
      ResponseUtils.success(res, sectors);
    } catch (error: any) {
      logger.error('Sector data fetch failed', { error: error.message });
      ResponseUtils.internalError(res, 'Market data temporarily unavailable');
    }
  });

  static getStockQuote = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    
    if (!validateStockSymbol(symbol)) {
      return ResponseUtils.badRequest(res, 'Invalid stock symbol format');
    }

    const { FinancialDataService } = await import('../services/financial-data');
    
    try {
      const quote = await FinancialDataService.getStockQuote(symbol);
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION.STOCK_QUOTES}`);
      ResponseUtils.success(res, quote);
    } catch (error: any) {
      logger.error('Stock quote fetch failed', { symbol, error: error.message });
      ResponseUtils.internalError(res, 'Stock data temporarily unavailable');
    }
  });

  static getStockHistory = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const pagination = paginationSchema.parse(req.query);
    
    if (!validateStockSymbol(symbol)) {
      return ResponseUtils.badRequest(res, 'Invalid stock symbol format');
    }

    const { StockDataRepository } = await import('../repositories/StockDataRepository');
    const repository = new StockDataRepository();
    
    try {
      // Calculate offset for pagination
      const offset = (pagination.page - 1) * pagination.limit;
      
      // Get total count and paginated data
      const allData = await repository.findBySymbol(symbol);
      const total = allData.length;
      const paginatedData = allData.slice(offset, offset + pagination.limit);
      
      ResponseUtils.paginated(res, paginatedData, total, pagination.page, pagination.limit);
    } catch (error: any) {
      logger.error('Stock history fetch failed', { symbol, error: error.message });
      ResponseUtils.internalError(res, 'Historical data temporarily unavailable');
    }
  });

  static getTechnicalIndicators = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    
    if (!validateStockSymbol(symbol)) {
      return ResponseUtils.badRequest(res, 'Invalid stock symbol format');
    }

    const { FinancialDataService } = await import('../services/financial-data');
    
    try {
      const indicators = await FinancialDataService.getTechnicalIndicators(symbol);
      res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION.TECHNICAL_INDICATORS}`);
      ResponseUtils.success(res, indicators);
    } catch (error: any) {
      logger.error('Technical indicators fetch failed', { symbol, error: error.message });
      ResponseUtils.internalError(res, 'Technical data temporarily unavailable');
    }
  });

  static getHealthCheck = asyncHandler(async (req: Request, res: Response) => {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      memory: process.memoryUsage(),
      pid: process.pid
    };
    
    ResponseUtils.success(res, healthCheck);
  });
}