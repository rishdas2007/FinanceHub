// Enhanced streaming query service for large dataset processing
// Implements result streaming with backpressure handling and memory optimization

import { Readable, Transform, PassThrough } from 'stream';
import { performance } from 'perf_hooks';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

interface StreamingConfig {
  batchSize: number;
  maxConcurrentStreams: number;
  bufferHighWaterMark: number;
  backpressureThreshold: number;
  timeoutMs: number;
}

interface StreamMetrics {
  totalRows: number;
  processedRows: number;
  batchesProcessed: number;
  averageBatchTime: number;
  memoryUsage: number;
  streamId: string;
  startTime: number;
  status: 'active' | 'completed' | 'error' | 'cancelled';
}

export class EnhancedStreamingQueryService {
  private config: StreamingConfig;
  private activeStreams = new Map<string, StreamMetrics>();
  private streamCounter = 0;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = {
      batchSize: 1000,
      maxConcurrentStreams: 5,
      bufferHighWaterMark: 16 * 1024, // 16KB
      backpressureThreshold: 100 * 1024 * 1024, // 100MB
      timeoutMs: 30000, // 30 seconds
      ...config
    };
  }

  // Stream large datasets with intelligent batching
  async *streamLargeResults<T>(
    query: string, 
    params: any[] = [],
    transformer?: (batch: T[]) => T[]
  ): AsyncGenerator<T[], void, unknown> {
    const streamId = this.generateStreamId();
    const startTime = performance.now();

    // Check concurrent streams limit
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error(`Maximum concurrent streams (${this.config.maxConcurrentStreams}) exceeded`);
    }

    // Initialize stream metrics
    const metrics: StreamMetrics = {
      totalRows: 0,
      processedRows: 0,
      batchesProcessed: 0,
      averageBatchTime: 0,
      memoryUsage: 0,
      streamId,
      startTime,
      status: 'active'
    };

    this.activeStreams.set(streamId, metrics);

    try {
      console.log(`🚀 Starting stream ${streamId} with batch size ${this.config.batchSize}`);

      let offset = 0;
      let batchTimes: number[] = [];
      let hasMoreData = true;

      while (hasMoreData) {
        // Check memory pressure
        this.checkMemoryPressure();

        const batchStartTime = performance.now();

        // Fetch batch with offset
        const batchQuery = `${query} LIMIT ${this.config.batchSize} OFFSET ${offset}`;
        const result = await db.execute(sql.raw(batchQuery, params));
        const batch = result.rows as T[];

        const batchEndTime = performance.now();
        const batchTime = batchEndTime - batchStartTime;
        batchTimes.push(batchTime);

        // Update metrics
        metrics.processedRows += batch.length;
        metrics.batchesProcessed++;
        metrics.averageBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
        metrics.memoryUsage = process.memoryUsage().heapUsed;

        // Check if we have more data
        hasMoreData = batch.length === this.config.batchSize;

        if (batch.length > 0) {
          // Apply transformation if provided
          const processedBatch = transformer ? transformer(batch) : batch;
          
          // Yield the batch
          yield processedBatch;

          console.log(`📊 Stream ${streamId}: Processed batch ${metrics.batchesProcessed} (${batch.length} rows, ${batchTime.toFixed(2)}ms)`);
        }

        offset += this.config.batchSize;

        // Adaptive delay based on performance
        if (batchTime > 1000) { // If batch took more than 1 second
          await this.sleep(100); // Add 100ms delay
        }

        // Keep only recent batch times for average calculation
        if (batchTimes.length > 10) {
          batchTimes = batchTimes.slice(-10);
        }
      }

      metrics.status = 'completed';
      metrics.totalRows = metrics.processedRows;

      const totalTime = performance.now() - startTime;
      console.log(`✅ Stream ${streamId} completed: ${metrics.totalRows} rows in ${totalTime.toFixed(2)}ms`);

    } catch (error) {
      metrics.status = 'error';
      console.error(`❌ Stream ${streamId} failed:`, error);
      throw error;

    } finally {
      // Clean up stream tracking
      setTimeout(() => {
        this.activeStreams.delete(streamId);
      }, 5000); // Keep metrics for 5 seconds for debugging
    }
  }

  // Stream large ETF historical data
  async *streamETFHistoricalData(
    symbols: string[], 
    startDate: Date, 
    endDate: Date
  ): AsyncGenerator<any[], void, unknown> {
    const query = `
      SELECT symbol, date, open, high, low, close, volume, 
             adjusted_close, dividend_amount, split_coefficient
      FROM stock_data 
      WHERE symbol = ANY($1) 
        AND date BETWEEN $2 AND $3 
      ORDER BY symbol, date DESC
    `;

    const params = [symbols, startDate.toISOString(), endDate.toISOString()];

    yield* this.streamLargeResults(query, params, (batch) => {
      // Transform and enrich each batch
      return batch.map(row => ({
        ...row,
        price_change: row.close - row.open,
        price_change_percent: ((row.close - row.open) / row.open) * 100,
        high_low_spread: row.high - row.low
      }));
    });
  }

  // Stream economic time series data
  async *streamEconomicTimeSeries(
    seriesIds: string[], 
    startDate: Date, 
    endDate: Date
  ): AsyncGenerator<any[], void, unknown> {
    const query = `
      SELECT eso.series_id, eso.period_end, eso.value_std, eso.transform_code,
             esf.level_z, esf.trend_z, esf.volatility_z
      FROM econ_series_observation eso
      LEFT JOIN econ_series_features esf ON eso.series_id = esf.series_id
      WHERE eso.series_id = ANY($1) 
        AND eso.period_end BETWEEN $2 AND $3
        AND eso.value_std IS NOT NULL
      ORDER BY eso.series_id, eso.period_end DESC
    `;

    const params = [seriesIds, startDate.toISOString(), endDate.toISOString()];

    yield* this.streamLargeResults(query, params, (batch) => {
      // Calculate additional metrics for each batch
      return batch.map(row => ({
        ...row,
        z_score_composite: (row.level_z + row.trend_z + row.volatility_z) / 3,
        signal_strength: Math.abs(row.level_z || 0),
        data_quality: row.value_std !== null ? 'valid' : 'missing'
      }));
    });
  }

  // Stream with custom processing pipeline
  async streamWithPipeline<T, R>(
    query: string,
    params: any[] = [],
    pipeline: Transform[]
  ): Promise<Readable> {
    const streamId = this.generateStreamId();
    let processedRows = 0;

    const sourceStream = new Readable({
      objectMode: true,
      highWaterMark: this.config.bufferHighWaterMark,
      read() {} // Will be pushed to externally
    });

    // Start streaming in background
    (async () => {
      try {
        for await (const batch of this.streamLargeResults<T>(query, params)) {
          for (const row of batch) {
            if (!sourceStream.push(row)) {
              // Backpressure - wait for drain
              await new Promise(resolve => sourceStream.once('drain', resolve));
            }
            processedRows++;
          }
        }
        sourceStream.push(null); // End stream
        console.log(`✅ Pipeline stream ${streamId} completed: ${processedRows} rows`);
      } catch (error) {
        sourceStream.destroy(error as Error);
      }
    })();

    // Connect pipeline
    let currentStream: Readable = sourceStream;
    for (const transform of pipeline) {
      currentStream = currentStream.pipe(transform);
    }

    return currentStream;
  }

  // Create data transformation streams
  createETFTransform(): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        try {
          // Add calculated fields to ETF data
          const enhanced = {
            ...chunk,
            market_cap_category: chunk.market_cap > 10e9 ? 'large' : 
                               chunk.market_cap > 2e9 ? 'mid' : 'small',
            volatility_category: Math.abs(chunk.percent_change) > 2 ? 'high' :
                               Math.abs(chunk.percent_change) > 0.5 ? 'medium' : 'low',
            processed_at: new Date().toISOString()
          };
          callback(null, enhanced);
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  createAggregationTransform(groupBy: string): Transform {
    const groups = new Map();

    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        const key = chunk[groupBy];
        if (!groups.has(key)) {
          groups.set(key, { count: 0, sum: 0, items: [] });
        }

        const group = groups.get(key);
        group.count++;
        group.sum += chunk.value || 0;
        group.items.push(chunk);

        callback(); // Don't emit until flush
      },
      flush(callback) {
        for (const [key, group] of groups) {
          this.push({
            [groupBy]: key,
            count: group.count,
            average: group.sum / group.count,
            total: group.sum,
            items: group.items
          });
        }
        callback();
      }
    });
  }

  // Utility methods
  private generateStreamId(): string {
    return `stream_${++this.streamCounter}_${Date.now()}`;
  }

  private checkMemoryPressure(): void {
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > this.config.backpressureThreshold) {
      console.warn(`⚠️ Memory pressure detected: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get streaming statistics
  getStreamingStats() {
    const activeStreams = Array.from(this.activeStreams.values());
    const completedStreams = activeStreams.filter(s => s.status === 'completed');
    const errorStreams = activeStreams.filter(s => s.status === 'error');

    return {
      activeStreamCount: activeStreams.filter(s => s.status === 'active').length,
      totalStreamsToday: this.streamCounter,
      completedStreams: completedStreams.length,
      errorStreams: errorStreams.length,
      averageProcessingTime: completedStreams.length > 0 
        ? completedStreams.reduce((sum, s) => sum + (performance.now() - s.startTime), 0) / completedStreams.length
        : 0,
      totalRowsProcessed: activeStreams.reduce((sum, s) => sum + s.processedRows, 0),
      memoryUsage: process.memoryUsage(),
      config: this.config
    };
  }

  // Cancel specific stream
  cancelStream(streamId: string): boolean {
    const metrics = this.activeStreams.get(streamId);
    if (metrics && metrics.status === 'active') {
      metrics.status = 'cancelled';
      console.log(`🛑 Stream ${streamId} cancelled`);
      return true;
    }
    return false;
  }

  // Cancel all active streams
  cancelAllStreams(): number {
    let cancelled = 0;
    for (const [streamId, metrics] of this.activeStreams) {
      if (metrics.status === 'active') {
        metrics.status = 'cancelled';
        cancelled++;
      }
    }
    console.log(`🛑 Cancelled ${cancelled} active streams`);
    return cancelled;
  }
}

// Export singleton instance
export const enhancedStreamingService = new EnhancedStreamingQueryService({
  batchSize: 500, // Smaller batches for financial data
  maxConcurrentStreams: 3,
  bufferHighWaterMark: 8 * 1024,
  backpressureThreshold: 200 * 1024 * 1024, // 200MB
  timeoutMs: 60000 // 1 minute timeout
});