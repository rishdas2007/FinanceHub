import QueryStream from 'pg-query-stream';
// Database pool configuration removed for startup optimization
import { redisCache } from '../config/redis-cache';
import pino from 'pino';
import { Transform, PassThrough } from 'stream';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

/**
 * Streaming Query Service for Large Historical Data Exports
 * Optimized for 10-year dataset performance with memory-efficient streaming
 */
export class StreamingQueryService {
  private static instance: StreamingQueryService;

  public static getInstance(): StreamingQueryService {
    if (!StreamingQueryService.instance) {
      StreamingQueryService.instance = new StreamingQueryService();
    }
    return StreamingQueryService.instance;
  }

  /**
   * Stream historical stock data with pagination and caching
   */
  async streamHistoricalData(
    symbol?: string,
    startDate?: Date,
    endDate?: Date,
    batchSize: number = 1000
  ): Promise<NodeJS.ReadableStream> {
    const cacheKey = `stream_historical_${symbol || 'all'}_${startDate?.toISOString()}_${endDate?.toISOString()}`;
    
    // Check cache first for metadata
    const cachedMetadata = await redisCache.get(cacheKey + '_metadata');
    
    let query = `
      SELECT h.symbol, h.date, h.open, h.high, h.low, h.close, h.volume,
             ROUND(((h.close - LAG(h.close) OVER (PARTITION BY h.symbol ORDER BY h.date)) / LAG(h.close) OVER (PARTITION BY h.symbol ORDER BY h.date) * 100), 2) as change_percent
      FROM historical_stock_data h
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    if (symbol) {
      params.push(symbol);
      query += ` AND h.symbol = $${++paramCount}`;
    }
    
    if (startDate) {
      params.push(startDate.toISOString());
      query += ` AND h.date >= $${++paramCount}`;
    }
    
    if (endDate) {
      params.push(endDate.toISOString());
      query += ` AND h.date <= $${++paramCount}`;
    }
    
    query += ` ORDER BY h.symbol, h.date DESC`;

    const pool = dbPool.getPool();
    const client = await pool.connect();
    
    try {
      const queryStream = new QueryStream(query, params, { batchSize });
      const dbStream = client.query(queryStream);
      
      // Create transform stream for data processing
      const transformStream = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          // Add computed fields and formatting
          const processedData = {
            ...chunk,
            date: chunk.date.toISOString().split('T')[0],
            open: parseFloat(chunk.open),
            high: parseFloat(chunk.high),
            low: parseFloat(chunk.low), 
            close: parseFloat(chunk.close),
            volume: parseInt(chunk.volume),
            change_percent: chunk.change_percent ? parseFloat(chunk.change_percent) : null
          };
          
          callback(null, JSON.stringify(processedData) + '\n');
        }
      });

      // Handle cleanup when stream ends
      dbStream.on('end', () => {
        client.release();
        logger.info('Historical data stream completed', { symbol, batchSize });
      });

      dbStream.on('error', (error) => {
        client.release();
        logger.error('Historical data stream error', { error: error.message });
      });

      return dbStream.pipe(transformStream);
      
    } catch (error) {
      client.release();
      logger.error('Stream setup error', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Stream z-score calculations with real-time processing
   */
  async streamZScoreCalculations(
    symbols: string[],
    lookbackPeriod: number = 252,
    batchSize: number = 500
  ): Promise<NodeJS.ReadableStream> {
    const cacheKey = `stream_zscore_${symbols.join(',')}_${lookbackPeriod}`;
    
    const query = `
      WITH z_calculations AS (
        SELECT 
          z.symbol,
          z.date,
          z.rsi,
          z.macd,
          z.composite_zscore,
          z.signal,
          z.signal_strength,
          z.lookback_period,
          z.data_quality,
          ROW_NUMBER() OVER (PARTITION BY z.symbol ORDER BY z.date DESC) as row_num
        FROM zscore_technical_indicators z
        WHERE z.symbol = ANY($1)
          AND z.lookback_period >= $2
      )
      SELECT * FROM z_calculations
      WHERE row_num <= 1000  -- Limit recent calculations
      ORDER BY symbol, date DESC
    `;

    const pool = dbPool.getPool();
    const client = await pool.connect();
    
    try {
      const queryStream = new QueryStream(query, [symbols, lookbackPeriod], { batchSize });
      const dbStream = client.query(queryStream);
      
      const transformStream = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          const processedData = {
            symbol: chunk.symbol,
            date: chunk.date.toISOString().split('T')[0],
            indicators: {
              rsi: chunk.rsi ? parseFloat(chunk.rsi) : null,
              macd: chunk.macd ? parseFloat(chunk.macd) : null,
              composite_zscore: chunk.composite_zscore ? parseFloat(chunk.composite_zscore) : null
            },
            signal: chunk.signal,
            signal_strength: chunk.signal_strength ? parseFloat(chunk.signal_strength) : null,
            metadata: {
              lookback_period: chunk.lookback_period,
              data_quality: chunk.data_quality
            }
          };
          
          callback(null, JSON.stringify(processedData) + '\n');
        }
      });

      dbStream.on('end', () => {
        client.release();
        logger.info('Z-Score stream completed', { symbols: symbols.length, lookbackPeriod });
      });

      dbStream.on('error', (error) => {
        client.release();
        logger.error('Z-Score stream error', { error: error.message });
      });

      return dbStream.pipe(transformStream);
      
    } catch (error) {
      client.release();
      throw error;
    }
  }

  /**
   * Stream economic indicators with historical context
   */
  async streamEconomicIndicators(
    startDate?: Date,
    endDate?: Date,
    categories?: string[],
    batchSize: number = 200
  ): Promise<NodeJS.ReadableStream> {
    let query = `
      SELECT 
        metric,
        type,
        category,
        period_date,
        release_date,
        current_reading,
        prior_reading,
        variance_vs_prior,
        z_score,
        delta_z_score,
        frequency,
        unit
      FROM economic_indicators_current e
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    if (startDate) {
      params.push(startDate.toISOString());
      query += ` AND e.period_date >= $${++paramCount}`;
    }
    
    if (endDate) {
      params.push(endDate.toISOString());
      query += ` AND e.period_date <= $${++paramCount}`;
    }
    
    if (categories && categories.length > 0) {
      params.push(categories);
      query += ` AND e.category = ANY($${++paramCount})`;
    }
    
    query += ` ORDER BY e.period_date DESC, e.category`;

    const pool = dbPool.getPool();
    const client = await pool.connect();
    
    try {
      const queryStream = new QueryStream(query, params, { batchSize });
      const dbStream = client.query(queryStream);
      
      const transformStream = new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          const processedData = {
            metric: chunk.metric,
            type: chunk.type,
            category: chunk.category,
            period_date: chunk.period_date.toISOString().split('T')[0],
            release_date: chunk.release_date.toISOString().split('T')[0],
            readings: {
              current: chunk.current_reading,
              prior: chunk.prior_reading,
              variance: chunk.variance_vs_prior
            },
            statistics: {
              z_score: chunk.z_score ? parseFloat(chunk.z_score) : null,
              delta_z_score: chunk.delta_z_score ? parseFloat(chunk.delta_z_score) : null
            },
            metadata: {
              frequency: chunk.frequency,
              unit: chunk.unit
            }
          };
          
          callback(null, JSON.stringify(processedData) + '\n');
        }
      });

      dbStream.on('end', () => {
        client.release();
        logger.info('Economic indicators stream completed', { categories });
      });

      dbStream.on('error', (error) => {
        client.release();
        logger.error('Economic indicators stream error', { error: error.message });
      });

      return dbStream.pipe(transformStream);
      
    } catch (error) {
      client.release();
      throw error;
    }
  }

  /**
   * Get stream statistics and performance metrics
   */
  async getStreamingStats(): Promise<{
    activeStreams: number;
    poolStats: any;
    cacheStats: any;
  }> {
    const poolStats = dbPool.getStats();
    const cacheStats = await redisCache.getStats();
    
    return {
      activeStreams: poolStats.activeConnections,
      poolStats,
      cacheStats
    };
  }
}

export const streamingService = StreamingQueryService.getInstance();