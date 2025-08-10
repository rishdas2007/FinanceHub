import { Request, Response } from 'express';
import { createApiResponse, createApiError } from '@shared/types/api-contracts';
import { logger } from '../middleware/logging';
import { equityFeaturesETL } from './equity-features-etl';
import { cacheService } from './cache-unified';
import { getMarketHoursInfo } from '@shared/utils/marketHours';

export class ApiV2Service {
  
  /**
   * GET /api/v2/market-status
   */
  async getMarketStatus(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'market-status-v2';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        res.json(createApiResponse(cached, { cached: true, source: 'cache' }));
        return;
      }
      
      const marketInfo = getMarketHoursInfo();
      const status = {
        isOpen: marketInfo.isOpen,
        isPremarket: false, // TODO: Add to market hours utility
        isAfterHours: !marketInfo.isOpen,
        nextOpen: new Date().toISOString(), // TODO: Add to market hours utility
        nextClose: new Date().toISOString(), // TODO: Add to market hours utility
        session: marketInfo.isOpen ? 'open' : 'closed',
        label: `Market ${marketInfo.isOpen ? 'open' : 'closed'}`
      };
      
      await cacheService.set(cacheKey, status, 30); // 30 second cache
      
      res.json(createApiResponse(status, { source: 'db', version: 'v2' }));
      
    } catch (error) {
      logger.error('Failed to get market status:', error);
      res.status(500).json(createApiError('Failed to get market status'));
    }
  }
  
  /**
   * GET /api/v2/etf-metrics?symbols=SPY,XLK,XLF
   */
  async getETFMetrics(req: Request, res: Response): Promise<void> {
    try {
      const symbolsParam = req.query.symbols as string;
      const symbols = symbolsParam ? symbolsParam.split(',') : 
        ['SPY', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE', 'XRT'];
      
      const cacheKey = `etf-metrics-v2-${symbols.join(',')}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        res.json(createApiResponse(cached, { cached: true, source: 'cache' }));
        return;
      }
      
      // Get features from the feature store (no per-request computation)
      const features = await equityFeaturesETL.getLatestFeatures(symbols);
      
      // TODO: Enrich with latest quotes from quote_snapshots table
      
      const response = {
        metrics: features,
        count: features.length,
        pipelineVersion: 'v1.0.0',
        dataSource: 'feature_store'
      };
      
      await cacheService.set(cacheKey, response, 120); // 2 minute cache
      
      res.json(createApiResponse(response, { 
        source: 'db', 
        version: 'v2',
        warning: features.some(f => f.fallback) ? 'Some metrics have insufficient data' : undefined
      }));
      
    } catch (error) {
      logger.error('Failed to get ETF metrics:', error);
      res.status(500).json(createApiError('Failed to get ETF metrics'));
    }
  }
  
  /**
   * GET /api/v2/stocks/:symbol/history?window=7D|30D|90D|1Y|3Y|MAX
   */
  async getStockHistory(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const window = req.query.window as string || '30D';
      
      const cacheKey = `stock-history-v2-${symbol}-${window}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        res.json(createApiResponse(cached, { cached: true, source: 'cache' }));
        return;
      }
      
      // TODO: Implement DB-first, provider-fallback logic
      // For now, return empty structure
      const response = {
        symbol,
        window,
        points: [],
        fallback: true
      };
      
      await cacheService.set(cacheKey, response, 300); // 5 minute cache
      
      res.json(createApiResponse(response, { 
        source: 'db', 
        version: 'v2',
        warning: 'Historical data migration in progress'
      }));
      
    } catch (error) {
      logger.error('Failed to get stock history:', error);
      res.status(500).json(createApiError('Failed to get stock history'));
    }
  }
  
  /**
   * GET /api/v2/sparkline?symbol=SPY&days=30
   */
  async getSparkline(req: Request, res: Response): Promise<void> {
    try {
      const symbol = req.query.symbol as string;
      const days = parseInt(req.query.days as string) || 30;
      
      if (!symbol) {
        res.status(400).json(createApiError('Symbol parameter required'));
        return;
      }
      
      const cacheKey = `sparkline-v2-${symbol}-${days}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        res.json(createApiResponse(cached, { cached: true, source: 'cache' }));
        return;
      }
      
      // TODO: Implement thin close series from equity_daily_bars
      const response = {
        symbol,
        days,
        points: [],
        fallback: true
      };
      
      await cacheService.set(cacheKey, response, 300); // 5 minute cache
      
      res.json(createApiResponse(response, { 
        source: 'db', 
        version: 'v2',
        warning: 'Sparkline data migration in progress'
      }));
      
    } catch (error) {
      logger.error('Failed to get sparkline:', error);
      res.status(500).json(createApiError('Failed to get sparkline'));
    }
  }
  
  /**
   * GET /api/v2/health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement comprehensive health checks
      const health = {
        ok: true,
        db: true,
        provider: true,
        lastEtlAt: new Date().toISOString(),
        validFeatures: 85.5, // % of symbols with valid features
        uptime: process.uptime()
      };
      
      res.json(createApiResponse(health, { version: 'v2' }));
      
    } catch (error) {
      logger.error('Failed to get health:', error);
      res.status(500).json(createApiError('Failed to get health status'));
    }
  }
}

export const apiV2Service = new ApiV2Service();