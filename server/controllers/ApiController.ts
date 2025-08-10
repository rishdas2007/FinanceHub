import { Request, Response } from 'express';
import { ResponseUtils } from '../utils/ResponseUtils';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { logger } from '../utils/logger';
import { metricsCollector } from '../utils/MetricsCollector';

// Import services (use existing ones)
import { financialDataService } from '../services/financial-data';
import { storage } from '../storage';

// Helper functions for stock history
function computeUtcDateRange(window: string) {
  // anchor at 00:00:00 UTC today
  const end = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  ));
  const start = new Date(end);
  const days = window === '7D' ? 7 : window === '30D' ? 30 : 90;
  start.setUTCDate(start.getUTCDate() - days);
  const toISO = (d: Date) => d.toISOString().slice(0,10);
  return { startISO: toISO(start), endISO: toISO(end) };
}

function normalizeTwelveData(raw: any) {
  const values = raw?.values ?? raw?.data ?? [];
  return values
    .map((v: any) => ({
      timestamp: (v.datetime || v.date || v.time)?.slice(0,10), // 'YYYY-MM-DD'
      close: Number(v.close ?? v.c ?? v.adj_close),
    }))
    .filter((r: any) => r.timestamp && Number.isFinite(r.close))
    .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
}

function clipRange(rows: any[], startISO: string, endISO: string) {
  return rows.filter(r => r.timestamp >= startISO && r.timestamp <= endISO);
}

async function fetchFromTwelveData(symbol: string, interval: string, startISO: string, endISO: string) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error('TWELVE_DATA_API_KEY not configured');
  
  const params = new URLSearchParams({
    symbol,
    interval,
    start_date: startISO,
    end_date: endISO,
    outputsize: '1000',
    apikey: apiKey,
    ...(symbol.startsWith('XL') ? { exchange: 'ARCA' } : {}) // ETF exchange fix
  });
  
  const response = await fetch(`https://api.twelvedata.com/time_series?${params}`);
  if (!response.ok) throw new Error(`TwelveData API error: ${response.status}`);
  
  return await response.json();
}

export class ApiController {
  static getAISummary = asyncHandler(async (req: Request, res: Response) => {
    const timerId = metricsCollector.startTimer('ai_summary_generation');
    
    try {
      // Import AI service dynamically to avoid circular dependencies
      const { aiAnalysisService } = await import('../services/ai-analysis');
      
      logger.info('Generating AI summary', { 
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      const analysis = await aiAnalysisService.generateMarketSummary();
      
      metricsCollector.endTimer(timerId, 'ai_summary_generation', { 
        version: req.apiVersion || 'v1',
        success: 'true' 
      });
      
      // Add API version metadata for v2
      const response = req.apiVersion === 'v2' 
        ? { ...analysis, apiVersion: 'v2', enhanced: true }
        : analysis;
      
      ResponseUtils.success(res, response);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'ai_summary_generation', { 
        version: req.apiVersion || 'v1',
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
        version: req.apiVersion || 'v1',
        success: 'true' 
      });
      
      ResponseUtils.success(res, sectors);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'sector_data_fetch', { 
        version: req.apiVersion || 'v1',
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
        version: req.apiVersion || 'v1',
        success: 'true' 
      });
      
      ResponseUtils.success(res, quote);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'stock_quote_fetch', { 
        symbol,
        version: req.apiVersion || 'v1',
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
    const window = String(req.query.window || '90D').toUpperCase(); // '7D'|'30D'|'90D'
    const timerId = metricsCollector.startTimer('stock_history_fetch');
    
    try {
      logger.info('📈 Fetching historical data for chart', { 
        symbol: symbol.toUpperCase(),
        window,
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      console.log(`📈 Fetching historical data for ${symbol.toUpperCase()} from database...`);
      
      // ALWAYS use daily interval for consistent date axis display
      const interval = '1day';
      const { startISO, endISO } = computeUtcDateRange(window);
      
      // First try database (for database-backed symbols)
      const { db } = await import('../db');
      const { historicalStockData } = await import('../../shared/schema');
      const { desc, eq, and, gte, lte } = await import('drizzle-orm');
      
      const dbResults = await db.select({
        date: historicalStockData.date,
        close: historicalStockData.close,
        volume: historicalStockData.volume
      })
      .from(historicalStockData)
      .where(and(
        eq(historicalStockData.symbol, symbol.toUpperCase()),
        gte(historicalStockData.date, startISO),
        lte(historicalStockData.date, endISO)
      ))
      .orderBy(historicalStockData.date)
      .limit(200); // Safety limit
      
      if (dbResults.length > 0) {
        console.log(`✅ Historical data returned for ${symbol.toUpperCase()}: ${dbResults.length} records`);
        console.log(`📊 Sample date format:`, typeof dbResults[0]?.date, dbResults[0]?.date);
        
        const normalizedData = dbResults.map((row, index) => {
          let dateStr: string;
          try {
            // Log the first few raw values for debugging
            if (index < 3) {
              console.log(`🔍 Row ${index} date type:`, typeof row.date, 'value:', row.date);
            }
            
            if (!row.date) {
              // Skip rows with null/undefined dates
              return null;
            }
            
            if (row.date instanceof Date) {
              dateStr = row.date.toISOString().slice(0,10);
            } else if (typeof row.date === 'string') {
              // Handle string dates - ensure valid format
              const cleanDate = row.date.slice(0,10);
              if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                dateStr = cleanDate;
              } else {
                dateStr = new Date(row.date).toISOString().slice(0,10);
              }
            } else {
              // Handle other formats by converting to Date first
              const dateObj = new Date(row.date);
              if (isNaN(dateObj.getTime())) {
                console.warn(`⚠️ Invalid date for ${symbol}:`, row.date);
                return null;
              }
              dateStr = dateObj.toISOString().slice(0,10);
            }
          } catch (error) {
            console.warn(`⚠️ Date conversion error for ${symbol}:`, error, 'Raw date:', row.date, 'Type:', typeof row.date);
            return null;
          }
          
          return {
            timestamp: dateStr,
            close: Number(row.close) || 0
          };
        }).filter((row): row is NonNullable<typeof row> => row !== null && row.close > 0);
        
        metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
          symbol: symbol.toUpperCase(),
          version: req.apiVersion || 'v1',
          success: 'true',
          source: 'database'
        });
        
        return res.json({ success: true, data: normalizedData });
      }
      
      // Fallback to external provider for real-time symbols
      try {
        const raw = await fetchFromTwelveData(symbol.toUpperCase(), interval, startISO, endISO);
        const normalized = normalizeTwelveData(raw);
        const clipped = clipRange(normalized, startISO, endISO);
        
        if (clipped.length > 0) {
          console.log(`✅ External data returned for ${symbol.toUpperCase()}: ${clipped.length} records`);
          
          metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
            symbol: symbol.toUpperCase(),
            version: req.apiVersion || 'v1',
            success: 'true',
            source: 'external'
          });
          
          return res.json({ success: true, data: clipped });
        }
      } catch (providerError) {
        console.error(`❌ External provider failed for ${symbol.toUpperCase()}:`, providerError);
      }
      
      // Fail-soft: return empty array with warning (never crash the UI)
      console.warn(`⚠️ No historical data available for ${symbol.toUpperCase()}`);
      
      metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
        symbol: symbol.toUpperCase(),
        version: req.apiVersion || 'v1',
        success: 'true',
        source: 'empty'
      });
      
      return res.json({ success: true, data: [], warning: 'data_unavailable' });
      
    } catch (error) {
      metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
        symbol: symbol.toUpperCase(),
        version: req.apiVersion || 'v1',
        success: 'false' 
      });
      
      logger.error('Stock history fetch failed', { 
        symbol: symbol.toUpperCase(),
        window,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id'] 
      });
      
      // CRITICAL: Never return {error:"Data not found"} - always fail soft
      return res.json({ success: true, data: [], warning: 'data_unavailable' });
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
        version: req.apiVersion || 'v1',
        success: 'true' 
      });
      
      ResponseUtils.success(res, indicators);
    } catch (error) {
      metricsCollector.endTimer(timerId, 'technical_indicators_fetch', { 
        symbol,
        version: req.apiVersion || 'v1',
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