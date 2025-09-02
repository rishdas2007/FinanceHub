import { Router } from 'express';
// Database pool configuration removed for startup optimization
import { redisCache } from '../config/redis-cache';
import { streamingService } from '../services/streaming-query-service';
import { CentralizedZScoreService } from '../services/centralized-zscore-service';

const centralizedZScoreService = CentralizedZScoreService.getInstance();
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Enhanced Performance Optimization Routes
 * Optimized for 10-year dataset handling with institutional-grade performance
 */

// Database Performance Statistics
router.get('/db-stats', async (req, res) => {
  try {
    const dbStats = dbPool.getStats();
    const streamStats = await streamingService.getStreamingStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        poolStats: dbStats,
        performanceOptimizations: {
          connectionPooling: 'active',
          maxConnections: 20,
          queryTimeout: '60s',
          indexOptimization: 'enhanced',
          compositeIndexes: [
            'idx_zscore_composite',
            'idx_economic_current_metric', 
            'idx_technical_indicators_symbol_timestamp',
            'idx_historical_sector_performance'
          ]
        }
      },
      streaming: streamStats,
      optimization: '10-year-dataset-enhanced'
    });
  } catch (error) {
    logger.error('Database stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to get database statistics' });
  }
});

// Redis Cache Performance Statistics  
router.get('/cache-stats', async (req, res) => {
  try {
    const cacheStats = await redisCache.getStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      ttlConfiguration: {
        realtime: '30s',
        intraday: '5min', 
        daily: '10min',
        economic: '1hr',
        statistical: '2hr',
        historical: '6hr',
        zScore: '30min',
        batchResults: '1hr'
      },
      optimization: 'volume-optimized-ttl'
    });
  } catch (error) {
    logger.error('Cache stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to get cache statistics' });
  }
});

// Batch Z-Score Calculation Endpoint
router.post('/batch-zscore', async (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({
        success: false,
        error: 'Requests array is required'
      });
    }
    
    const startTime = Date.now();
    const results = await centralizedZScoreService.getBatchZScores(requests);
    const processingTime = Date.now() - startTime;
    
    // Cache results with batch-specific TTL
    const cacheKey = `batch-zscore-${Date.now()}`;
    await redisCache.set(cacheKey, results, 'BATCH_RESULTS');
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: Object.fromEntries(results),
      performance: {
        processingTimeMs: processingTime,
        requestCount: requests.length,
        batchSize: 20,
        optimization: '10-year-dataset-enhanced'
      },
      cacheKey
    });
    
  } catch (error) {
    logger.error('Batch Z-Score error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to process batch Z-Score calculations' });
  }
});

// Historical Data Streaming Endpoint
router.get('/stream/historical-data', async (req, res) => {
  try {
    const { symbol, startDate, endDate, batchSize } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const batch = batchSize ? parseInt(batchSize as string) : 1000;
    
    // Set streaming headers
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const dataStream = await streamingService.streamHistoricalData(
      symbol as string, 
      start, 
      end, 
      batch
    );
    
    dataStream.pipe(res);
    
    dataStream.on('end', () => {
      logger.info('Historical data stream completed', { symbol, batchSize: batch });
    });
    
    dataStream.on('error', (error) => {
      logger.error('Historical data stream error', { error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Stream error' });
      }
    });
    
  } catch (error) {
    logger.error('Stream setup error', { error: error instanceof Error ? error.message : 'Unknown' });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to initialize data stream' });
    }
  }
});

// Z-Score Calculations Streaming Endpoint
router.get('/stream/zscore-calculations', async (req, res) => {
  try {
    const { symbols, lookbackPeriod, batchSize } = req.query;
    
    if (!symbols) {
      return res.status(400).json({
        success: false,
        error: 'Symbols parameter is required'
      });
    }
    
    const symbolArray = (symbols as string).split(',');
    const lookback = lookbackPeriod ? parseInt(lookbackPeriod as string) : 252;
    const batch = batchSize ? parseInt(batchSize as string) : 500;
    
    // Set streaming headers
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const dataStream = await streamingService.streamZScoreCalculations(
      symbolArray,
      lookback,
      batch
    );
    
    dataStream.pipe(res);
    
    dataStream.on('end', () => {
      logger.info('Z-Score stream completed', { symbols: symbolArray.length, lookback });
    });
    
    dataStream.on('error', (error) => {
      logger.error('Z-Score stream error', { error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Stream error' });
      }
    });
    
  } catch (error) {
    logger.error('Z-Score stream setup error', { error: error instanceof Error ? error.message : 'Unknown' });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to initialize Z-Score stream' });
    }
  }
});

// Economic Indicators Streaming Endpoint
router.get('/stream/economic-indicators', async (req, res) => {
  try {
    const { startDate, endDate, categories, batchSize } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const categoryArray = categories ? (categories as string).split(',') : undefined;
    const batch = batchSize ? parseInt(batchSize as string) : 200;
    
    // Set streaming headers
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const dataStream = await streamingService.streamEconomicIndicators(
      start,
      end,
      categoryArray,
      batch
    );
    
    dataStream.pipe(res);
    
    dataStream.on('end', () => {
      logger.info('Economic indicators stream completed', { categories: categoryArray });
    });
    
    dataStream.on('error', (error) => {
      logger.error('Economic indicators stream error', { error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Stream error' });
      }
    });
    
  } catch (error) {
    logger.error('Economic stream setup error', { error: error instanceof Error ? error.message : 'Unknown' });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to initialize economic indicators stream' });
    }
  }
});

// Cache Management Endpoints
router.post('/cache/flush', async (req, res) => {
  try {
    await redisCache.flushAll();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Cache flushed successfully'
    });
  } catch (error) {
    logger.error('Cache flush error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to flush cache' });
  }
});

router.delete('/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    await redisCache.del(key);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Cache key '${key}' deleted successfully`
    });
  } catch (error) {
    logger.error('Cache delete error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to delete cache key' });
  }
});

// Performance Health Check
router.get('/health', async (req, res) => {
  try {
    const dbStats = dbPool.getStats();
    const cacheStats = await redisCache.getStats();
    const streamStats = await streamingService.getStreamingStats();
    
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      database: {
        connected: dbStats.totalCount > 0,
        activeConnections: dbStats.activeConnections,
        poolUtilization: `${((dbStats.activeConnections / 20) * 100).toFixed(1)}%`
      },
      cache: {
        connected: cacheStats.connected,
        type: cacheStats.type
      },
      performance: {
        optimizationLevel: '10-year-dataset-enhanced',
        batchProcessing: 'active',
        streaming: 'active',
        indexOptimization: 'enhanced'
      }
    };
    
    res.json(health);
  } catch (error) {
    logger.error('Performance health check error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'Performance monitoring unavailable' 
    });
  }
});

export default router;