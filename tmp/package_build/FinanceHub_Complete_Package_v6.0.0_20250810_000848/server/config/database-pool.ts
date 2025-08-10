import pkg from 'pg';
const { Pool } = pkg;
import pino from 'pino';

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
 * Enhanced Database Connection Pool for 10-Year Dataset Performance
 * Optimized for handling large historical data queries efficiently
 */
class DatabasePool {
  private static instance: DatabasePool;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Enhanced configuration for 10-year dataset performance
      max: 20,          // Maximum connections in the pool
      min: 5,           // Minimum connections to maintain
      idleTimeoutMillis: 30000,     // Close connections after 30s idle
      connectionTimeoutMillis: 5000, // Wait 5s for connection
      maxUses: 7500,    // Recycle connections after 7500 uses
      
      // Enhanced for large dataset queries
      statement_timeout: 60000,     // 60s query timeout for large historical queries
      query_timeout: 60000,         // 60s query timeout
      
      // Connection health monitoring
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Pool event listeners for monitoring
    this.pool.on('connect', () => {
      logger.debug('New database client connected');
    });

    this.pool.on('acquire', () => {
      logger.debug('Client acquired from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });

    this.pool.on('remove', () => {
      logger.debug('Client removed from pool');
    });

    logger.info('Database connection pool initialized for 10-year dataset performance');
  }

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Execute query with automatic connection management
   */
  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', {
          query: text.substring(0, 100) + '...',
          duration: `${duration}ms`,
          rowCount: result.rowCount
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Database query error', {
        query: text.substring(0, 100) + '...',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get pool statistics for monitoring
   */
  public getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: 20,
      activeConnections: this.pool.totalCount - this.pool.idleCount
    };
  }

  /**
   * Graceful shutdown
   */
  public async end(): Promise<void> {
    logger.info('Shutting down database connection pool');
    await this.pool.end();
  }
}

export const dbPool = DatabasePool.getInstance();
export default dbPool;