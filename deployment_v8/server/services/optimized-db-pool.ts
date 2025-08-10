import pkg from 'pg';
const { Pool } = pkg;
import type { PoolConfig } from 'pg';
import { logger } from '../middleware/logging';

interface OptimizedPoolConfig extends PoolConfig {
  // Z-score workload specific optimizations
  enableQueryTimeout?: boolean;
  enableConnectionMetrics?: boolean;
  preWarmConnections?: boolean;
}

/**
 * Optimized PostgreSQL connection pool for Z-Score workloads
 * Implements connection reuse, query timeouts, and performance monitoring
 */
export class OptimizedDatabasePool {
  private pool: Pool;
  private connectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    totalQueries: 0,
    avgQueryTime: 0,
    queryTimes: [] as number[]
  };

  constructor(config: OptimizedPoolConfig = {}) {
    const optimizedConfig: PoolConfig = {
      host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
      database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
      user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
      password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
      port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432'),
      
      // Use DATABASE_URL if provided (for production)
      connectionString: process.env.DATABASE_URL,

      // Optimized settings for z-score workload
      max: 10,                    // Reduced from default 20 for z-score workload
      idleTimeoutMillis: 30000,   // Close idle connections faster
      connectionTimeoutMillis: 2000, // 2 second connection timeout

      // Query optimization
      statement_timeout: 30000,   // 30 second query timeout
      query_timeout: 25000,       // 25 second query timeout

      // Connection reuse optimization
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

      ...config
    };

    this.pool = new Pool(optimizedConfig);
    this.setupEventHandlers();
    
    logger.info('🔧 Optimized database pool initialized', {
      maxConnections: optimizedConfig.max,
      connectionTimeout: optimizedConfig.connectionTimeoutMillis,
      queryTimeout: optimizedConfig.query_timeout
    });

    if (config.preWarmConnections) {
      this.preWarmConnections();
    }
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.connectionMetrics.totalConnections++;
      logger.debug('🔗 Database client connected', {
        totalConnections: this.connectionMetrics.totalConnections
      });
    });

    this.pool.on('remove', (client) => {
      this.connectionMetrics.totalConnections--;
      logger.debug('🔌 Database client disconnected', {
        totalConnections: this.connectionMetrics.totalConnections
      });
    });

    this.pool.on('error', (err, client) => {
      logger.error('💥 Database pool error:', err);
    });
  }

  /**
   * Pre-warm database connections for faster initial queries
   */
  private async preWarmConnections(): Promise<void> {
    try {
      logger.info('🔥 Pre-warming database connections...');
      
      const warmUpPromises = Array.from({ length: 3 }, async () => {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
      });

      await Promise.all(warmUpPromises);
      logger.info('✅ Database connections pre-warmed successfully');
      
    } catch (error) {
      logger.warn('⚠️ Connection pre-warming failed:', error);
    }
  }

  /**
   * Execute query with performance tracking
   */
  async query(text: string, params?: any[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      
      // Track performance metrics
      const queryTime = Date.now() - startTime;
      this.updateQueryMetrics(queryTime);
      
      if (queryTime > 1000) {
        logger.warn('🐌 Slow query detected', {
          queryTime: `${queryTime}ms`,
          query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        });
      }
      
      return result;
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('💥 Query failed', {
        queryTime: `${queryTime}ms`,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Execute query with connection from pool
   */
  async queryWithClient<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  /**
   * Execute transaction with optimistic concurrency control
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('🔄 Transaction rolled back:', error);
      throw error;
      
    } finally {
      client.release();
    }
  }

  /**
   * Optimized query for z-score base data using materialized view
   */
  async getZScoreBaseData(symbol: string, days: number = 756): Promise<any[]> {
    const query = `
      SELECT symbol, date, close, ma_252, stddev_252, ma_756, stddev_756
      FROM zscore_base_data 
      WHERE symbol = $1 
      AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
      LIMIT $2
    `;
    
    const result = await this.query(query, [symbol, days]);
    return result.rows;
  }

  /**
   * Batch insert with conflict resolution for technical indicators
   */
  async batchInsertTechnicalIndicators(indicators: any[]): Promise<void> {
    if (indicators.length === 0) return;
    
    const values = indicators.map(indicator => 
      `('${indicator.symbol}', '${indicator.timestamp}', ${indicator.rsi}, ${indicator.adx}, ${indicator.bb_upper}, ${indicator.bb_lower}, ${indicator.sma_20}, ${indicator.sma_50})`
    ).join(', ');
    
    const query = `
      INSERT INTO technical_indicators 
      (symbol, timestamp, rsi, adx, bb_upper, bb_lower, sma_20, sma_50)
      VALUES ${values}
      ON CONFLICT (symbol, timestamp) 
      DO UPDATE SET
        rsi = EXCLUDED.rsi,
        adx = EXCLUDED.adx,
        bb_upper = EXCLUDED.bb_upper,
        bb_lower = EXCLUDED.bb_lower,
        sma_20 = EXCLUDED.sma_20,
        sma_50 = EXCLUDED.sma_50,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await this.query(query);
  }

  /**
   * Update query metrics
   */
  private updateQueryMetrics(queryTime: number): void {
    this.connectionMetrics.totalQueries++;
    this.connectionMetrics.queryTimes.push(queryTime);
    
    // Keep only last 1000 query times
    if (this.connectionMetrics.queryTimes.length > 1000) {
      this.connectionMetrics.queryTimes = this.connectionMetrics.queryTimes.slice(-1000);
    }
    
    // Update average
    this.connectionMetrics.avgQueryTime = 
      this.connectionMetrics.queryTimes.reduce((sum, time) => sum + time, 0) / 
      this.connectionMetrics.queryTimes.length;
  }

  /**
   * Get pool performance metrics
   */
  getMetrics(): any {
    return {
      ...this.connectionMetrics,
      poolStats: {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      }
    };
  }

  /**
   * Refresh materialized view for z-score calculations
   */
  async refreshZScoreView(): Promise<void> {
    try {
      logger.info('🔄 Refreshing z-score materialized view...');
      const startTime = Date.now();
      
      await this.query('REFRESH MATERIALIZED VIEW CONCURRENTLY zscore_base_data');
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Z-score materialized view refreshed in ${duration}ms`);
      
    } catch (error) {
      logger.error('💥 Failed to refresh z-score materialized view:', error);
      throw error;
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as healthy');
      return result.rows[0]?.healthy === 1;
      
    } catch (error) {
      logger.error('💥 Database health check failed:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    try {
      logger.info('🛑 Closing database pool gracefully...');
      await this.pool.end();
      logger.info('✅ Database pool closed successfully');
      
    } catch (error) {
      logger.error('💥 Error closing database pool:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const optimizedDbPool = new OptimizedDatabasePool({
  enableQueryTimeout: true,
  enableConnectionMetrics: true,
  preWarmConnections: true
});