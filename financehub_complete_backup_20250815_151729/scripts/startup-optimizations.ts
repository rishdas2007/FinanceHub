/**
 * Startup Optimizations
 * Eliminates "server unavailable" errors during initial page load
 */

import { logger } from '../server/utils/logger';
import { memoryOptimizer } from './memory-pressure-relief';

interface StartupConfig {
  warmupEnabled: boolean;
  preloadCriticalData: boolean;
  healthCheckTimeout: number;
  maxStartupTime: number;
}

interface StartupResult {
  success: boolean;
  startupTime: number;
  optimizationsApplied: string[];
  memoryUsage: number;
  errors: string[];
}

/**
 * Application Startup Optimizer
 * Ensures fast, reliable server startup
 */
export class StartupOptimizer {
  private config: StartupConfig;
  private startTime: number;
  private optimizations: string[] = [];
  private errors: string[] = [];

  constructor(config?: Partial<StartupConfig>) {
    this.config = {
      warmupEnabled: true,
      preloadCriticalData: true,
      healthCheckTimeout: 30000, // 30 seconds
      maxStartupTime: 60000, // 1 minute max startup
      ...config
    };
    this.startTime = Date.now();
  }

  /**
   * Warm up critical application components
   */
  private async warmupComponents(): Promise<void> {
    if (!this.config.warmupEnabled) return;

    try {
      logger.info('🔥 Warming up critical components...');

      // 1. Pre-connect to database
      const { db } = await import('../server/db');
      await db.execute(sql`SELECT 1 as test`);
      this.optimizations.push('Database connection pre-warmed');

      // 2. Initialize memory optimizer
      await memoryOptimizer.optimizeApplication();
      this.optimizations.push('Memory optimizer initialized');

      // 3. Pre-load critical cache entries
      if (this.config.preloadCriticalData) {
        await this.preloadCriticalData();
      }

      logger.info('✅ Component warmup completed');

    } catch (error) {
      const errorMsg = `Component warmup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMsg);
      logger.error(errorMsg);
    }
  }

  /**
   * Pre-load critical data to avoid cold start delays
   */
  private async preloadCriticalData(): Promise<void> {
    try {
      logger.info('📊 Pre-loading critical dashboard data...');

      // Import optimized endpoints
      const { 
        getOptimizedETFMetrics, 
        getOptimizedEconomicIndicators,
        getFastDashboardSummary 
      } = await import('./optimized-endpoints');

      // Pre-load data in parallel with timeout protection
      const preloadPromises = [
        this.withTimeout(getOptimizedETFMetrics(), 10000, 'ETF metrics preload'),
        this.withTimeout(getOptimizedEconomicIndicators(), 10000, 'Economic indicators preload'),
        this.withTimeout(getFastDashboardSummary(), 5000, 'Dashboard summary preload')
      ];

      const results = await Promise.allSettled(preloadPromises);
      
      let successCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          const names = ['ETF metrics', 'Economic indicators', 'Dashboard summary'];
          this.errors.push(`${names[index]} preload failed: ${result.reason}`);
        }
      });

      this.optimizations.push(`Critical data preloaded (${successCount}/3 successful)`);
      logger.info(`✅ Critical data preload completed: ${successCount}/3 successful`);

    } catch (error) {
      const errorMsg = `Critical data preload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMsg);
      logger.error(errorMsg);
    }
  }

  /**
   * Wrapper for promises with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number, 
    operation: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Initialize performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    try {
      // Start memory monitoring
      const monitor = memoryOptimizer.getMonitor();
      monitor.start(15000); // Check every 15 seconds during startup

      // Set up performance tracking
      process.on('warning', (warning) => {
        logger.warn(`Performance warning: ${warning.message}`);
      });

      this.optimizations.push('Performance monitoring initialized');

    } catch (error) {
      const errorMsg = `Performance monitoring setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMsg);
      logger.error(errorMsg);
    }
  }

  /**
   * Run comprehensive health checks
   */
  private async runHealthChecks(): Promise<boolean> {
    try {
      logger.info('🏥 Running startup health checks...');

      const healthChecks = [
        this.checkDatabaseHealth(),
        this.checkMemoryHealth(),
        this.checkCacheHealth()
      ];

      const results = await Promise.allSettled(healthChecks);
      let passedChecks = 0;

      results.forEach((result, index) => {
        const checkNames = ['Database', 'Memory', 'Cache'];
        if (result.status === 'fulfilled' && result.value) {
          passedChecks++;
          logger.info(`✅ ${checkNames[index]} health check passed`);
        } else {
          const error = result.status === 'rejected' ? result.reason : 'Check failed';
          logger.error(`❌ ${checkNames[index]} health check failed: ${error}`);
          this.errors.push(`${checkNames[index]} health check failed`);
        }
      });

      const healthScore = passedChecks / healthChecks.length;
      this.optimizations.push(`Health checks completed (${passedChecks}/${healthChecks.length} passed)`);

      return healthScore >= 0.67; // At least 2/3 checks must pass

    } catch (error) {
      const errorMsg = `Health checks failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMsg);
      logger.error(errorMsg);
      return false;
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      const { db } = await import('../server/db');
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      return Array.from(result).length > 0 && Number(result[0].table_count) > 5;
    } catch (error) {
      logger.error('Database health check error:', error);
      return false;
    }
  }

  private async checkMemoryHealth(): Promise<boolean> {
    try {
      const stats = memoryOptimizer.getMonitor().getStats();
      const isHealthy = stats.heapUsed < 150; // Less than 150MB
      
      if (!isHealthy) {
        logger.warn(`Memory usage high: ${stats.heapUsed}MB`);
      }
      
      return isHealthy;
    } catch (error) {
      logger.error('Memory health check error:', error);
      return false;
    }
  }

  private async checkCacheHealth(): Promise<boolean> {
    try {
      const cache = memoryOptimizer.getCache();
      const stats = cache.getStats();
      
      // Cache is healthy if it's not at max capacity
      return stats.utilization < 90;
    } catch (error) {
      logger.error('Cache health check error:', error);
      return false;
    }
  }

  /**
   * Execute complete startup optimization sequence
   */
  async optimize(): Promise<StartupResult> {
    try {
      logger.info('🚀 Starting application optimization sequence...');

      // 1. Setup performance monitoring first
      this.setupPerformanceMonitoring();

      // 2. Warmup components
      await this.warmupComponents();

      // 3. Run health checks
      const healthPassed = await this.runHealthChecks();

      // 4. Calculate final metrics
      const startupTime = Date.now() - this.startTime;
      const memoryStats = memoryOptimizer.getMonitor().getStats();

      const result: StartupResult = {
        success: healthPassed && this.errors.length === 0,
        startupTime,
        optimizationsApplied: this.optimizations,
        memoryUsage: memoryStats.heapUsed,
        errors: this.errors
      };

      if (result.success) {
        logger.info(`✅ Startup optimization completed successfully in ${startupTime}ms`);
        logger.info(`📊 Memory usage: ${result.memoryUsage}MB`);
        logger.info(`🔧 Applied optimizations: ${result.optimizationsApplied.length}`);
      } else {
        logger.error(`❌ Startup optimization completed with errors (${this.errors.length})`);
        this.errors.forEach(error => logger.error(`  • ${error}`));
      }

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown startup error';
      logger.error(`💥 Startup optimization failed: ${errorMsg}`);

      return {
        success: false,
        startupTime: Date.now() - this.startTime,
        optimizationsApplied: this.optimizations,
        memoryUsage: 0,
        errors: [...this.errors, errorMsg]
      };
    }
  }
}

/**
 * Express middleware for startup optimization
 */
export function createStartupMiddleware() {
  let startupComplete = false;
  let startupPromise: Promise<StartupResult> | null = null;

  return async (req: any, res: any, next: any) => {
    // Skip optimization for health checks and static assets
    if (req.path.includes('/health') || req.path.includes('/static')) {
      return next();
    }

    // If startup optimization is already complete, proceed normally
    if (startupComplete) {
      return next();
    }

    // If startup optimization is in progress, wait for it
    if (startupPromise) {
      try {
        await startupPromise;
        startupComplete = true;
        return next();
      } catch (error) {
        logger.error('Startup optimization failed in middleware:', error);
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Server is starting up, please try again in a moment',
          retryAfter: 30
        });
      }
    }

    // Start startup optimization
    startupPromise = new StartupOptimizer().optimize();
    
    try {
      const result = await startupPromise;
      startupComplete = true;

      if (!result.success) {
        logger.warn('Startup optimization completed with issues, continuing with degraded performance');
      }

      return next();

    } catch (error) {
      logger.error('Startup optimization failed:', error);
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Server startup failed, please try again',
        retryAfter: 60
      });
    }
  };
}

/**
 * Initialize startup optimizations (call this early in server startup)
 */
export async function initializeStartupOptimizations(): Promise<StartupResult> {
  const optimizer = new StartupOptimizer({
    warmupEnabled: true,
    preloadCriticalData: process.env.NODE_ENV === 'production',
    healthCheckTimeout: 30000,
    maxStartupTime: 120000
  });

  return await optimizer.optimize();
}