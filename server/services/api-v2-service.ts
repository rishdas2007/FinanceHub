import { Request, Response } from 'express';
import { createApiResponse, createApiError } from '@shared/types/api-contracts';
import { logger } from '../middleware/logging';
import { equityFeaturesETL } from './equity-features-etl';
import { economicFeaturesETL } from './economic-features-etl';
import { historicalDataService } from './historical-data-service';
import { cacheService } from './cache-unified';
import { getMarketHoursInfo } from '@shared/utils/marketHours';
import { circuitBreakers } from './circuit-breaker';

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
        isPremarket: marketInfo.session === 'premarket',
        isAfterHours: marketInfo.session === 'afterhours',
        nextOpen: marketInfo.nextOpen,
        nextClose: marketInfo.nextClose,
        session: marketInfo.session,
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
      
      // Use circuit breaker for protection
      const response = await circuitBreakers.database.execute(async () => {
        return await historicalDataService.getStockHistory(symbol, window);
      });
      
      await cacheService.set(cacheKey, response, 300); // 5 minute cache
      
      res.json(createApiResponse(response, { 
        source: response.fallback ? 'provider' : 'db', 
        version: 'v2',
        warning: response.fallback ? 'Using fallback data - limited historical coverage' : undefined
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
      
      // Use circuit breaker and historical data service
      const response = await circuitBreakers.database.execute(async () => {
        return await historicalDataService.getSparkline(symbol, days);
      });
      
      await cacheService.set(cacheKey, response, 300); // 5 minute cache
      
      res.json(createApiResponse(response, { 
        source: response.fallback ? 'provider' : 'db', 
        version: 'v2',
        warning: response.fallback ? 'Limited sparkline data available' : undefined
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
      // Comprehensive health checks with circuit breaker status
      const circuitBreakerHealth = Object.entries(circuitBreakers).reduce((acc, [name, breaker]) => {
        const stats = breaker.getStats();
        acc[name] = {
          state: stats.state,
          healthy: stats.state === 'CLOSED',
          failures: stats.failures,
          successes: stats.successes
        };
        return acc;
      }, {} as Record<string, any>);
      
      const dbHealthy = circuitBreakers.database.getState() === 'CLOSED';
      const providersHealthy = circuitBreakers.fredApi.getState() === 'CLOSED' && 
                               circuitBreakers.twelveData.getState() === 'CLOSED';
      
      // Get feature store metrics
      const etfFeatures = await equityFeaturesETL.getLatestFeatures(['SPY', 'XLK', 'XLF']);
      const validFeaturesCount = etfFeatures.filter(f => !f.fallback).length;
      const validFeaturesPercent = etfFeatures.length > 0 ? 
        (validFeaturesCount / etfFeatures.length) * 100 : 0;
      
      const health = {
        ok: dbHealthy && providersHealthy,
        db: dbHealthy,
        provider: providersHealthy,
        lastEtlAt: new Date().toISOString(),
        validFeatures: Math.round(validFeaturesPercent * 10) / 10,
        uptime: process.uptime(),
        circuitBreakers: circuitBreakerHealth,
        featureStore: {
          totalSymbols: etfFeatures.length,
          validSymbols: validFeaturesCount,
          fallbackSymbols: etfFeatures.length - validFeaturesCount
        }
      };
      
      res.json(createApiResponse(health, { version: 'v2' }));
      
    } catch (error) {
      logger.error('Failed to get health:', error);
      res.status(500).json(createApiError('Failed to get health status'));
    }
  }
  
  /**
   * GET /api/v2/economic-indicators
   */
  async getEconomicIndicators(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'economic-indicators-v2';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        res.json(createApiResponse(cached, { cached: true, source: 'cache' }));
        return;
      }
      
      // Get features from economic feature store
      const features = await economicFeaturesETL.getLatestFeatures();
      
      const response = {
        indicators: features,
        count: features.length,
        pipelineVersion: 'v1.0.0',
        dataSource: 'economic_feature_store'
      };
      
      await cacheService.set(cacheKey, response, 300); // 5 minute cache
      
      res.json(createApiResponse(response, { 
        source: 'db', 
        version: 'v2',
        warning: features.length === 0 ? 'Economic features not yet computed' : undefined
      }));
      
    } catch (error) {
      logger.error('Failed to get economic indicators:', error);
      res.status(500).json(createApiError('Failed to get economic indicators'));
    }
  }
}

export const apiV2Service = new ApiV2Service();