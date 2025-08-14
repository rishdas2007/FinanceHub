import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

interface QueryStats {
  query: string;
  duration: number;
  timestamp: Date;
  endpoint?: string;
}

class PerformanceMonitor {
  private slowQueryThreshold: number = 1000; // 1 second
  private queryStats: QueryStats[] = [];
  private maxStatsSize: number = 1000;

  constructor() {
    // Clear old stats every hour
    setInterval(() => {
      this.cleanupStats();
    }, 3600000);
  }

  // Middleware to track API response times
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      
      res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds
        
        if (duration > 1000) { // Log slow requests (>1s)
          logger.warn('Slow API request detected', {
            endpoint: `${req.method} ${req.path}`,
            duration: `${duration.toFixed(2)}ms`,
            status: res.statusCode
          });
        }

        // Track metrics
        logger.debug('Request completed', {
          endpoint: `${req.method} ${req.path}`,
          duration: `${duration.toFixed(2)}ms`,
          status: res.statusCode
        });
      });

      next();
    };
  }

  // Monitor database query performance
  async monitorQuery<T>(
    queryPromise: Promise<T>,
    queryDescription: string,
    endpoint?: string
  ): Promise<T> {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await queryPromise;
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      this.recordQueryStats({
        query: queryDescription,
        duration,
        timestamp: new Date(),
        endpoint
      });

      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow database query detected', {
          query: queryDescription,
          duration: `${duration.toFixed(2)}ms`,
          endpoint
        });
      }

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      logger.error('Database query failed', {
        query: queryDescription,
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint
      });
      
      throw error;
    }
  }

  private recordQueryStats(stats: QueryStats): void {
    this.queryStats.push(stats);
    
    if (this.queryStats.length > this.maxStatsSize) {
      this.queryStats = this.queryStats.slice(-this.maxStatsSize / 2); // Keep last half
    }
  }

  private cleanupStats(): void {
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.queryStats = this.queryStats.filter(stat => stat.timestamp > oneHourAgo);
  }

  // Get performance statistics
  getStats(): {
    slowQueries: QueryStats[];
    averageQueryTime: number;
    totalQueries: number;
    queriesInLastHour: number;
  } {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentQueries = this.queryStats.filter(stat => stat.timestamp > oneHourAgo);
    const slowQueries = this.queryStats.filter(stat => stat.duration > this.slowQueryThreshold);
    
    const averageQueryTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, stat) => sum + stat.duration, 0) / recentQueries.length
      : 0;

    return {
      slowQueries: slowQueries.slice(-10), // Last 10 slow queries
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      totalQueries: this.queryStats.length,
      queriesInLastHour: recentQueries.length
    };
  }

  // Check database health
  async checkDatabaseHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    activeConnections?: number;
  }> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Simple ping query
      await db.execute(sql`SELECT 1`);
      
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 1000) {
        status = 'degraded';
      }
      if (responseTime > 5000) {
        status = 'unhealthy';
      }

      return {
        status,
        responseTime: Math.round(responseTime * 100) / 100
      };
    } catch (error) {
      logger.error('Database health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        status: 'unhealthy',
        responseTime: -1
      };
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();