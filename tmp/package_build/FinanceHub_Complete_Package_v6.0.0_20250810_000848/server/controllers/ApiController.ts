import { Request, Response } from 'express';
import { ResponseUtils } from '../utils/ResponseUtils';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { logger } from '../utils/logger';
import { metricsCollector } from '../utils/MetricsCollector';

// Import services (use existing ones)
import { financialDataService } from '../services/financial-data';
import { storage } from '../storage';

export class ApiController {
  static getAISummary = asyncHandler(async (req: Request, res: Response) => {
    const timerId = metricsCollector.startTimer('ai_summary_generation');
    
    try {
      // Import AI service dynamically to avoid circular dependencies
      const { aiAnalysisService } = await import('../services/ai-analysis-unified');
      
      logger.info('Generating AI summary', { 
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      const analysis = await aiAnalysisService.generateMarketSummary();
      
      metricsCollector.endTimer(timerId, 'ai_summary_generation', { 
        version: req.apiVersion,
        success: 'true' 
      });
      
      // Add API version metadata for v2
      const response = req.apiVersion === 'v2' 
        ? { ...analysis, apiVersion: 'v2', enhanced: true }
        : analysis;
      
      ResponseUtils.success(res, response);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'ai_summary_generation', { 
        version: req.apiVersion,
        success: 'false' 
      });
      
      logger.error('AI summary generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      ResponseUtils.internalError(res, 'AI analysis temporarily unavailable');
    }
  });

  static getSectors = asyncHandler(async (req: Request, res: Response) => {
    const timerId = metricsCollector.startTimer('sector_data_fetch');
    
    try {
      logger.info('Fetching sector data', { 
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      const sectors = await financialDataService.getSectorETFs();
      
      metricsCollector.endTimer(timerId, 'sector_data_fetch', { 
        version: req.apiVersion,
        success: 'true' 
      });
      
      ResponseUtils.success(res, sectors);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'sector_data_fetch', { 
        version: req.apiVersion,
        success: 'false' 
      });
      
      logger.error('Sector data fetch failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      ResponseUtils.internalError(res, 'Sector data temporarily unavailable');
    }
  });

  static getStockQuote = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const timerId = metricsCollector.startTimer('stock_quote_fetch');
    
    try {
      logger.info('Fetching stock quote', { 
        symbol,
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      const quote = await financialDataService.getStockQuote(symbol.toUpperCase());
      
      metricsCollector.endTimer(timerId, 'stock_quote_fetch', { 
        symbol,
        version: req.apiVersion,
        success: 'true' 
      });
      
      ResponseUtils.success(res, quote);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'stock_quote_fetch', { 
        symbol,
        version: req.apiVersion,
        success: 'false' 
      });
      
      logger.error('Stock quote fetch failed', { 
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      ResponseUtils.internalError(res, `Quote for ${symbol} temporarily unavailable`);
    }
  });

  static getStockHistory = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const timerId = metricsCollector.startTimer('stock_history_fetch');
    
    try {
      console.log(`Fetching fresh historical data for ${symbol}...`);
      logger.info('Fetching stock history', { 
        symbol,
        page,
        limit,
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      // FIXED: Use real database historical data instead of memory storage
      const { db } = await import('../db');
      const { historicalStockData } = await import('../../shared/schema');
      const { desc, eq } = await import('drizzle-orm');
      
      const results = await db.select({
        id: historicalStockData.id,
        symbol: historicalStockData.symbol,
        price: historicalStockData.close,
        change: historicalStockData.close, // Will calculate change properly later
        volume: historicalStockData.volume,
        timestamp: historicalStockData.date
      })
      .from(historicalStockData)
      .where(eq(historicalStockData.symbol, symbol.toUpperCase()))
      .orderBy(desc(historicalStockData.date))
      .limit(Number(limit));

      // DEBUG: Log sample data to verify timestamps
      if (results.length > 0) {
        console.log(`📊 Sample historical data for ${symbol}:`, {
          count: results.length,
          first: { date: results[0].timestamp, price: results[0].price },
          last: { date: results[results.length - 1].timestamp, price: results[results.length - 1].price }
        });
      }

      // CRITICAL FIX: Use historical dates as timestamps - NOT current time
      const stockData = results.map((row, index) => ({
        id: row.id,
        symbol: row.symbol,
        price: parseFloat(row.price).toFixed(2),
        change: index < results.length - 1 ? 
          (parseFloat(row.price) - parseFloat(results[index + 1].price)).toFixed(2) : 
          '0.00',
        changePercent: index < results.length - 1 ? 
          (((parseFloat(row.price) - parseFloat(results[index + 1].price)) / parseFloat(results[index + 1].price)) * 100).toFixed(2) :
          '0.00',
        volume: row.volume,
        marketCap: null,
        timestamp: row.timestamp  // This should be the historical date from database
      }));
      
      metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
        symbol,
        version: req.apiVersion,
        success: 'true' 
      });
      
      // Return the stock data array directly (client expects StockData[])
      ResponseUtils.success(res, stockData);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
        symbol,
        version: req.apiVersion,
        success: 'false' 
      });
      
      logger.error('Stock history fetch failed', { 
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      ResponseUtils.internalError(res, `History for ${symbol} temporarily unavailable`);
    }
  });

  static getTechnicalIndicators = asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const timerId = metricsCollector.startTimer('technical_indicators_fetch');
    
    try {
      logger.info('Fetching technical indicators', { 
        symbol,
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      const indicators = await financialDataService.getTechnicalIndicators(symbol.toUpperCase());
      
      metricsCollector.endTimer(timerId, 'technical_indicators_fetch', { 
        symbol,
        version: req.apiVersion,
        success: 'true' 
      });
      
      ResponseUtils.success(res, indicators);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'technical_indicators_fetch', { 
        symbol,
        version: req.apiVersion,
        success: 'false' 
      });
      
      logger.error('Technical indicators fetch failed', { 
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      ResponseUtils.internalError(res, `Technical data for ${symbol} temporarily unavailable`);
    }
  });

  static getHealthCheck = asyncHandler(async (req: Request, res: Response) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: req.apiVersion || 'unknown',
        memory: process.memoryUsage(),
        metrics: metricsCollector.getMetrics()
      };
      
      metricsCollector.increment('health_check_requests', 1, { 
        version: req.apiVersion 
      });
      
      ResponseUtils.success(res, health);
    } catch (error) {
      logger.error('Health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      ResponseUtils.internalError(res, 'Health check failed');
    }
  });
}