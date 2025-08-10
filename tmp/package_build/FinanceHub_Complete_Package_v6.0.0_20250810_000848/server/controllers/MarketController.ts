import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../container/types';
import { IFinancialDataService } from '../services/financial-data';
import { ICacheService } from '../services/cache-unified';
import { IAIAnalysisService } from '../services/ai-analysis-unified';
import { asyncHandler } from '../middleware/error-handler';
import { ResponseUtils } from '../utils/ResponseUtils';
import { validateStockSymbol } from '../shared/validation';

@injectable()
export class MarketController {
  constructor(
    @inject(TYPES.FinancialDataService) private financialService: IFinancialDataService,
    @inject(TYPES.CacheService) private cacheService: ICacheService,
    @inject(TYPES.AIAnalysisService) private aiService: IAIAnalysisService
  ) {}

  getStockQuote = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    
    if (!validateStockSymbol(symbol)) {
      return ResponseUtils.badRequest(res, 'Invalid stock symbol format');
    }

    const cacheKey = `stock-${symbol}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return ResponseUtils.success(res, cached);
    }

    const quote = await this.financialService.getStockQuote(symbol);
    await this.cacheService.set(cacheKey, quote, 60); // 1 minute cache
    
    return ResponseUtils.success(res, quote);
  });

  getTechnicalIndicators = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    
    if (!validateStockSymbol(symbol)) {
      return ResponseUtils.badRequest(res, 'Invalid stock symbol format');
    }

    const cacheKey = `technical-${symbol}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return ResponseUtils.success(res, cached);
    }

    const indicators = await this.financialService.getTechnicalIndicators(symbol);
    await this.cacheService.set(cacheKey, indicators, 180); // 3 minute cache
    
    return ResponseUtils.success(res, indicators);
  });

  getAIAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = 'ai-analysis';
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return ResponseUtils.success(res, cached);
    }

    const analysis = await this.aiService.generateAnalysis();
    await this.cacheService.set(cacheKey, analysis, 300); // 5 minute cache
    
    return ResponseUtils.success(res, analysis);
  });
}