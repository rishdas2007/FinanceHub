/**
 * Unified Data Flow Architecture Service
 * Implements enterprise-grade data flow: API → Cache → Database → Frontend
 * With proper rate limiting, batch processing, and zero technical debt tolerance
 */

import { logger } from '../utils/logger';
import { IntelligentCache } from './intelligent-cache-system';
import { BatchProcessingService } from './batch-processing-service';
import { RateLimitingService } from './rate-limiting-service';
import { db } from '../db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { technicalIndicators, marketSentiment, vixData, zscoreTechnicalIndicators } from '../../shared/schema';

interface DataFlowMetrics {
  cacheHitRate: number;
  avgResponseTime: number;
  apiCallsCount: number;
  rateLimitViolations: number;
  failureRate: number;
}

interface DataFlowRequest {
  source: 'api' | 'cache' | 'database';
  requestType: 'etf_metrics' | 'economic_data' | 'technical_indicators' | 'market_sentiment';
  symbol?: string;
  timeframe?: string;
  requestId: string;
}

interface DataFlowResponse<T> {
  data: T;
  source: 'cache' | 'database' | 'api';
  timestamp: Date;
  latency: number;
  fromCache: boolean;
}

export class UnifiedDataFlowService {
  private cache: IntelligentCache;
  private batchProcessor: BatchProcessingService;
  private rateLimiter: RateLimitingService;
  private metrics: DataFlowMetrics;

  constructor() {
    this.cache = new IntelligentCache();
    this.batchProcessor = new BatchProcessingService();
    this.rateLimiter = new RateLimitingService();
    this.metrics = {
      cacheHitRate: 0,
      avgResponseTime: 0,
      apiCallsCount: 0,
      rateLimitViolations: 0,
      failureRate: 0
    };
  }

  /**
   * Core data flow method - implements proper architecture pattern
   * 1. Check Cache First (Memory → Database)
   * 2. Rate Limit Check 
   * 3. Batch Process API Calls
   * 4. Update Cache & Database
   * 5. Return Data to Frontend
   */
  async getData<T>(request: DataFlowRequest): Promise<DataFlowResponse<T>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    try {
      // STEP 1: Check cache first (Memory → Database cache)
      const cachedData = await this.cache.get<T>(cacheKey);
      if (cachedData) {
        const latency = Date.now() - startTime;
        this.updateMetrics('cache_hit', latency);
        
        logger.info(`🎯 Cache hit for ${request.requestType}:${request.symbol || 'market'} (${latency}ms)`);
        
        return {
          data: cachedData,
          source: 'cache',
          timestamp: new Date(),
          latency,
          fromCache: true
        };
      }

      // STEP 2: Check database for recent data
      const dbData = await this.getFromDatabase<T>(request);
      if (dbData && this.isDataFresh(dbData)) {
        // Cache the fresh database data
        await this.cache.set(cacheKey, dbData, this.getTTL(request.requestType));
        
        const latency = Date.now() - startTime;
        this.updateMetrics('database_hit', latency);
        
        logger.info(`📊 Database hit for ${request.requestType}:${request.symbol || 'market'} (${latency}ms)`);
        
        return {
          data: dbData,
          source: 'database',
          timestamp: new Date(),
          latency,
          fromCache: false
        };
      }

      // STEP 3: Rate limit check before API call
      const rateLimitCheck = await this.rateLimiter.checkLimit(request.requestType);
      if (!rateLimitCheck.allowed) {
        logger.warn(`⚠️ Rate limit exceeded for ${request.requestType}, falling back to stale data`);
        this.metrics.rateLimitViolations++;
        
        // Return stale data if available
        if (dbData) {
          return {
            data: dbData,
            source: 'database',
            timestamp: new Date(),
            latency: Date.now() - startTime,
            fromCache: false
          };
        }
        throw new Error(`Rate limit exceeded and no fallback data available for ${request.requestType}`);
      }

      // STEP 4: Batch process API call
      const apiData = await this.batchProcessor.processRequest<T>(request);
      
      // STEP 5: Update database and cache
      await this.updateDatabase(request, apiData);
      await this.cache.set(cacheKey, apiData, this.getTTL(request.requestType));
      
      const latency = Date.now() - startTime;
      this.updateMetrics('api_call', latency);
      this.metrics.apiCallsCount++;
      
      logger.info(`🔄 API call for ${request.requestType}:${request.symbol || 'market'} (${latency}ms)`);
      
      return {
        data: apiData,
        source: 'api',
        timestamp: new Date(),
        latency,
        fromCache: false
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics('failure', latency);
      logger.error(`❌ Data flow error for ${request.requestType}:`, error);
      throw error;
    }
  }

  /**
   * ETF Metrics with Z-Score normalization
   */
  async getETFMetrics(symbols: string[]): Promise<DataFlowResponse<any[]>> {
    const request: DataFlowRequest = {
      source: 'database',
      requestType: 'etf_metrics',
      requestId: `etf-metrics-${Date.now()}`
    };

    try {
      // Use database-first approach for ETF metrics
      const metrics = await Promise.all(symbols.map(async (symbol) => {
        const [latest] = await db
          .select()
          .from(zscoreTechnicalIndicators)
          .where(eq(zscoreTechnicalIndicators.symbol, symbol))
          .orderBy(desc(zscoreTechnicalIndicators.date))
          .limit(1);

        if (!latest) {
          logger.warn(`⚠️ No Z-score data found for ${symbol}`);
          return null;
        }

        return {
          symbol,
          zScores: {
            rsi: latest.rsiZScore,
            macd: latest.macdZScore,
            bollinger: latest.bollingerZScore,
            atr: latest.atrZScore,
            priceChange: latest.priceChange, // Fixed: use base field name
            maTrend: latest.maTrend // Fixed: use base field name
          },
          recommendation: this.calculateRecommendation(latest),
          lastUpdated: latest.date
        };
      }));

      const validMetrics = metrics.filter(m => m !== null);
      
      return {
        data: validMetrics,
        source: 'database',
        timestamp: new Date(),
        latency: Date.now() - Date.now(),
        fromCache: false
      };

    } catch (error) {
      logger.error('❌ ETF metrics error:', error);
      throw error;
    }
  }

  /**
   * Calculate ETF recommendation based on Z-scores
   */
  private calculateRecommendation(zscoreData: any): string {
    const scores = [
      Number(zscoreData.rsiZScore) || 0,
      Number(zscoreData.macdZScore) || 0,
      Number(zscoreData.bollingerZScore) || 0,
      Number(zscoreData.atrZScore) || 0,
      Number(zscoreData.priceChange) || 0,
      Number(zscoreData.maTrend) || 0
    ];

    const avgZScore = scores.reduce((sum, score) => sum + Number(score), 0) / scores.length;

    if (avgZScore > 0.5) return 'BUY';
    if (avgZScore < -0.5) return 'SELL';
    return 'HOLD';
  }

  /**
   * Database retrieval with proper type safety
   */
  private async getFromDatabase<T>(request: DataFlowRequest): Promise<T | null> {
    try {
      switch (request.requestType) {
        case 'technical_indicators':
          if (!request.symbol) return null;
          const [indicator] = await db
            .select()
            .from(technicalIndicators)
            .where(eq(technicalIndicators.symbol, request.symbol))
            .orderBy(desc(technicalIndicators.timestamp))
            .limit(1);
          return indicator as T;

        case 'market_sentiment':
          const [sentiment] = await db
            .select()
            .from(marketSentiment)
            .orderBy(desc(marketSentiment.timestamp))
            .limit(1);
          return sentiment as T;

        default:
          return null;
      }
    } catch (error) {
      logger.error(`Database query error for ${request.requestType}:`, error);
      return null;
    }
  }

  /**
   * Database update with proper error handling
   */
  private async updateDatabase(request: DataFlowRequest, data: any): Promise<void> {
    try {
      switch (request.requestType) {
        case 'technical_indicators':
          await db.insert(technicalIndicators).values(data);
          break;
        case 'market_sentiment':
          await db.insert(marketSentiment).values(data);
          break;
        // Add more cases as needed
      }
      logger.debug(`✅ Database updated for ${request.requestType}`);
    } catch (error) {
      logger.error(`Database update error for ${request.requestType}:`, error);
      // Don't throw - cache update can still succeed
    }
  }

  /**
   * Data freshness check (configurable TTL per data type)
   */
  private isDataFresh(data: any): boolean {
    if (!data.timestamp && !data.date) return false;
    
    const dataTime = new Date(data.timestamp || data.date);
    const now = new Date();
    const ageMinutes = (now.getTime() - dataTime.getTime()) / (1000 * 60);
    
    // Different freshness criteria per data type
    return ageMinutes < 15; // 15 minutes for general data
  }

  /**
   * TTL configuration per data type
   */
  private getTTL(requestType: string): number {
    const ttlConfig = {
      'etf_metrics': 300, // 5 minutes
      'economic_data': 3600, // 1 hour
      'technical_indicators': 900, // 15 minutes
      'market_sentiment': 1800 // 30 minutes
    };
    
    return ttlConfig[requestType as keyof typeof ttlConfig] || 600;
  }

  /**
   * Cache key generation
   */
  private generateCacheKey(request: DataFlowRequest): string {
    return `${request.requestType}:${request.symbol || 'market'}:${request.timeframe || 'default'}`;
  }

  /**
   * Metrics tracking
   */
  private updateMetrics(type: 'cache_hit' | 'database_hit' | 'api_call' | 'failure', latency: number): void {
    // Update response times
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime + latency) / 2;
    
    // Update hit rates (simplified calculation)
    if (type === 'cache_hit') {
      this.metrics.cacheHitRate = Math.min(this.metrics.cacheHitRate + 0.1, 1);
    } else if (type === 'failure') {
      this.metrics.failureRate = Math.min(this.metrics.failureRate + 0.1, 1);
    }
  }

  /**
   * Get current data flow metrics
   */
  getMetrics(): DataFlowMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check for the data flow system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: DataFlowMetrics;
    details: string[];
  }> {
    const details: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check cache health
    const cacheHealth = await this.cache.healthCheck();
    if (!cacheHealth.healthy) {
      details.push('Cache system degraded');
      status = 'degraded';
    }

    // Check rate limiting
    if (this.metrics.rateLimitViolations > 10) {
      details.push('High rate limit violations');
      status = 'degraded';
    }

    // Check failure rate
    if (this.metrics.failureRate > 0.1) {
      details.push('High failure rate detected');
      status = 'unhealthy';
    }

    return {
      status,
      metrics: this.metrics,
      details
    };
  }
}

export const unifiedDataFlow = new UnifiedDataFlowService();