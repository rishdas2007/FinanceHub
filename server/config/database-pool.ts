// Enhanced database connection pool configuration
// Optimized for high-performance financial data processing

export const dbConfig = {
  // Increased connection limits for better concurrent handling
  connectionLimit: 20,        // Up from default 10
  acquireTimeoutMillis: 60000, // 1 minute timeout for acquiring connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  reapIntervalMillis: 1000,   // Check for idle connections every second
  createRetryIntervalMillis: 2000, // Retry failed connections after 2 seconds
  
  // Connection pool settings
  pool: {
    min: 2,                   // Minimum connections to maintain
    max: 20,                  // Maximum connections in pool
    acquireTimeoutMillis: 60000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 2000,
    
    // Additional performance settings
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    
    // Health check configuration
    propagateCreateError: false,
    
    // Connection validation
    validate: (connection: any) => {
      return connection && !connection.destroyed;
    }
  },

  // Query timeout settings
  statement_timeout: 30000,   // 30 second query timeout
  query_timeout: 30000,       // 30 second query timeout
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,

  // Additional connection options
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: process.env.NODE_ENV === 'production'
  }
};

// Connection pool monitoring utilities
export const poolMonitoring = {
  // Get current pool statistics
  getPoolStats: (pool: any) => ({
    size: pool.size,
    available: pool.available,
    borrowed: pool.borrowed,
    invalid: pool.invalid,
    pending: pool.pending
  }),

  // Log pool performance metrics
  logPoolMetrics: (pool: any, logger: any) => {
    const stats = poolMonitoring.getPoolStats(pool);
    logger.info('📊 Database Pool Stats:', stats);
    
    // Alert if pool utilization is high
    if (stats.borrowed / stats.size > 0.8) {
      logger.warn('⚠️ High database pool utilization:', stats);
    }
  }
};

// Enhanced error handling for database connections
export const connectionErrorHandler = {
  handleConnectionError: (error: any, logger: any) => {
    logger.error('🚨 Database connection error:', error);
    
    // Specific error handling
    if (error.code === 'ECONNREFUSED') {
      logger.error('❌ Database server is not responding');
    } else if (error.code === 'ENOTFOUND') {
      logger.error('❌ Database host not found');
    } else if (error.code === 'ECONNRESET') {
      logger.error('❌ Database connection was reset');
    }
    
    return {
      success: false,
      error: 'Database connection failed',
      details: error.message
    };
  }
};