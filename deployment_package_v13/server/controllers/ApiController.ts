import { Request, Response } from 'express';
import { ResponseUtils } from '../utils/ResponseUtils';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { logger } from '../utils/logger';
import { metricsCollector } from '../utils/MetricsCollector';
import { computeUtcDateRange, isoDate, createChartPoint } from '../../shared/dates';

// Import services (use existing ones)
import { financialDataService } from '../services/financial-data';
import { storage } from '../storage';

// Helper functions for stock history
// computeUtcDateRange now imported from shared/dates.ts

function normalizeTwelveData(raw: any) {
  const values = raw?.values ?? raw?.data ?? [];
  return values
    .map((v: any) => {
      const dateValue = v.datetime || v.date || v.time;
      const priceValue = Number(v.close ?? v.c ?? v.adj_close);
      
      // Use safe chart point creation
      const chartPoint = createChartPoint(dateValue, priceValue);
      if (!chartPoint) return null;
      
      return {
        timestamp: chartPoint.date, // ISO string
        t: chartPoint.t,           // numeric timestamp
        close: chartPoint.close
      };
    })
    .filter((r: any) => r !== null)
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
    const symbol = String(req.params.symbol || '').toUpperCase();
    const window = String(req.query.window || '90D').toUpperCase(); // '7D'|'30D'|'90D'
    const timerId = metricsCollector.startTimer('stock_history_fetch');
    
    try {
      logger.info('📈 Fetching historical data for chart', { 
        symbol,
        window,
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion 
      });
      
      // Calculate UTC day bounds (end-exclusive) - CRITICAL for TIMESTAMPTZ comparison
      const days = window === '7D' ? 7 : window === '30D' ? 30 : 90;
      const todayUTC = new Date(Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      ));
      const startTs = new Date(todayUTC); 
      startTs.setUTCDate(startTs.getUTCDate() - days);
      const endTs = new Date(todayUTC); 
      endTs.setUTCDate(endTs.getUTCDate() + 1);

      console.log(`📈 Querying ${symbol} from ${startTs.toISOString().slice(0,10)} to ${endTs.toISOString().slice(0,10)}`);
      
      // 1) Database first - using raw SQL for TIMESTAMPTZ compatibility
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');
      
      const rows = await db.execute(sql`
        SELECT date, close, volume
        FROM historical_stock_data
        WHERE symbol = ${symbol}
          AND date >= ${startTs}::timestamptz
          AND date <  ${endTs}::timestamptz
        ORDER BY date ASC
        LIMIT 200
      `);

      let series = rows.map((r: any) => ({
        t: new Date(r.date).getTime(),
        date: new Date(r.date).toISOString().slice(0, 10),
        close: Number(r.close),
        source: 'db' as const,
      })).filter(d => Number.isFinite(d.close) && d.t);

      // 2) External provider fallback if database empty
      if (series.length === 0) {
        console.log(`📡 Falling back to external provider for ${symbol}`);
        try {
          const { fetchFromTwelveData } = await import('../utils/data-fetchers');
          const raw = await fetchFromTwelveData(symbol, '1day', 
            startTs.toISOString().slice(0, 10), 
            endTs.toISOString().slice(0, 10)
          );
          
          const vals = raw?.values ?? raw?.data ?? [];
          series = vals
            .map((v: any) => ({
              date: String(v.datetime ?? v.date ?? v.time).slice(0, 10),
              t: Date.parse(String(v.datetime ?? v.date ?? v.time)),
              close: Number(v.close ?? v.c ?? v.adj_close),
              source: 'provider' as const,
            }))
            .filter((d: any) => Number.isFinite(d.close) && d.t)
            .sort((a: any, b: any) => a.t - b.t);
        } catch (providerError) {
          console.error(`❌ Provider fallback failed for ${symbol}:`, providerError);
        }
      }

      console.log(`✅ Returning ${series.length} data points for ${symbol} (${window})`);
      
      metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
        symbol,
        version: req.apiVersion || 'v1',
        success: 'true',
        source: series.length > 0 ? series[0].source : 'empty'
      });
      
      return res.json({ success: true, data: series });
      
    } catch (error) {
      console.error('HISTORY ERROR', symbol, error);
      metricsCollector.endTimer(timerId, 'stock_history_fetch', { 
        symbol,
        version: req.apiVersion || 'v1',
        success: 'false'
      });
      
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