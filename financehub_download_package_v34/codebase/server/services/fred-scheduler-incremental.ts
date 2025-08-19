import { logger } from '../../shared/utils/logger';
import { fredApiServiceIncremental } from './fred-api-service-incremental';
import { economicDataStorageIncremental } from './economic-data-storage-incremental';

export interface SchedulerConfig {
  enabled: boolean;
  intervalHours: number;
  maxRetries: number;
  retryDelayMinutes: number;
  runOnStartup: boolean;
}

export interface SchedulerStatus {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  lastResult: 'success' | 'failure' | 'partial' | null;
  lastError: string | null;
  totalRuns: number;
  successfulRuns: number;
}

export class FredSchedulerIncremental {
  private config: SchedulerConfig;
  private status: SchedulerStatus;
  private intervalId: NodeJS.Timeout | null = null;
  private isCurrentlyRunning = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      enabled: true,
      intervalHours: 24, // Run daily to catch monthly/weekly releases  
      maxRetries: 3,
      retryDelayMinutes: 15,
      runOnStartup: false,
      ...config
    };

    this.status = {
      isRunning: false,
      lastRun: null,
      nextRun: null,
      lastResult: null,
      lastError: null,
      totalRuns: 0,
      successfulRuns: 0
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('FRED scheduler already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('FRED scheduler is disabled in config');
      return;
    }

    logger.info(`Starting FRED incremental scheduler - running every ${this.config.intervalHours} hours`);

    // Calculate next run time
    this.updateNextRunTime();

    // Set up interval
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.executeUpdate();
    }, intervalMs);

    // Run on startup if configured
    if (this.config.runOnStartup) {
      setTimeout(() => {
        this.executeUpdate();
      }, 5000); // 5 second delay to allow app initialization
    }

    this.status.isRunning = true;
    logger.info('FRED incremental scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.status.isRunning = false;
    this.status.nextRun = null;
    logger.info('FRED incremental scheduler stopped');
  }

  /**
   * Execute a manual update (can be called outside of schedule)
   */
  async executeManualUpdate(): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    newDataPoints: number;
  }> {
    if (this.isCurrentlyRunning) {
      return {
        success: false,
        message: 'Update already in progress',
        sessionId: '',
        newDataPoints: 0
      };
    }

    return this.executeUpdateInternal(true);
  }

  /**
   * Internal update execution with retry logic
   */
  private async executeUpdate(): Promise<void> {
    if (this.isCurrentlyRunning) {
      logger.warn('FRED update already running, skipping this execution');
      return;
    }

    // Check if it's a good time to run (not weekends, not too early/late)
    if (!this.isGoodTimeToRun()) {
      logger.info('Skipping FRED update - not optimal time (weekend or outside market hours)');
      this.updateNextRunTime();
      return;
    }

    await this.executeUpdateInternal(false);
  }

  /**
   * Core update logic with comprehensive error handling
   */
  private async executeUpdateInternal(isManual: boolean): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    newDataPoints: number;
  }> {
    this.isCurrentlyRunning = true;
    const startTime = Date.now();
    const sessionId = `fred_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let attempt = 1;
    let lastError: Error | null = null;

    this.status.totalRuns++;
    this.status.lastRun = new Date();

    try {
      while (attempt <= this.config.maxRetries) {
        try {
          logger.info(`🔄 Starting FRED incremental update (${isManual ? 'manual' : 'scheduled'}) - Attempt ${attempt}/${this.config.maxRetries}, Session: ${sessionId}`);

          // Perform the FRED API update
          const result = await fredApiServiceIncremental.performIncrementalUpdate(sessionId);

          if (result.success) {
            // Update successful
            this.status.lastResult = 'success';
            this.status.lastError = null;
            this.status.successfulRuns++;
            this.updateNextRunTime();

            const executionTime = Date.now() - startTime;
            logger.info(`✅ FRED incremental update completed successfully: ${result.newDataPoints} new data points, ${result.apiCallsUsed} API calls, ${executionTime}ms`);

            // Get storage summary
            const summary = await economicDataStorageIncremental.getSessionSummary(sessionId);
            logger.info(`📊 Update summary: ${summary.successfulInserts} inserts, ${summary.duplicatesSkipped} duplicates, ${summary.errors} errors, ${summary.seriesUpdated.length} series updated`);

            return {
              success: true,
              message: result.message,
              sessionId,
              newDataPoints: result.newDataPoints
            };
          } else {
            throw new Error(result.message);
          }

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          logger.error(`❌ FRED update attempt ${attempt} failed:`, lastError.message);

          if (attempt < this.config.maxRetries) {
            const delayMs = this.config.retryDelayMinutes * 60 * 1000;
            logger.info(`⏳ Retrying in ${this.config.retryDelayMinutes} minutes...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          attempt++;
        }
      }

      // All retries failed
      this.status.lastResult = 'failure';
      this.status.lastError = lastError?.message || 'Unknown error';
      this.updateNextRunTime();

      const errorMessage = `All ${this.config.maxRetries} attempts failed. Last error: ${lastError?.message}`;
      logger.error(`❌ FRED incremental update failed: ${errorMessage}`);

      return {
        success: false,
        message: errorMessage,
        sessionId,
        newDataPoints: 0
      };

    } finally {
      this.isCurrentlyRunning = false;
    }
  }

  /**
   * Check if it's a good time to run FRED updates
   */
  private isGoodTimeToRun(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();

    // Skip weekends (economic data usually released on weekdays)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Skip very early hours (2 AM - 6 AM EST) and late hours (11 PM - 2 AM EST)
    // Adjust these based on your timezone and when economic data is typically released
    if (hour >= 2 && hour < 6) {
      return false;
    }

    if (hour >= 23 || hour < 2) {
      return false;
    }

    return true;
  }

  /**
   * Update next run time based on current schedule
   */
  private updateNextRunTime(): void {
    if (this.config.enabled && this.intervalId) {
      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + this.config.intervalHours);
      this.status.nextRun = nextRun;
    } else {
      this.status.nextRun = null;
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): SchedulerStatus {
    return { ...this.status };
  }

  /**
   * Get current configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const wasRunning = this.status.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning && this.config.enabled) {
      this.start();
    }

    logger.info('FRED scheduler configuration updated:', JSON.stringify(this.config));
  }

  /**
   * Get health check information
   */
  async getHealthCheck(): Promise<{
    schedulerStatus: string;
    lastUpdate: Date | null;
    nextUpdate: Date | null;
    apiHealth: any;
    databaseHealth: string;
  }> {
    try {
      // Check API health
      const apiHealth = await fredApiServiceIncremental.healthCheck();
      
      // Check database health
      const lastDbUpdate = await economicDataStorageIncremental.getLastUpdateTimestamp();
      const seriesCount = (await economicDataStorageIncremental.getAllSeriesIds()).length;
      
      return {
        schedulerStatus: this.status.isRunning ? 'running' : 'stopped',
        lastUpdate: this.status.lastRun,
        nextUpdate: this.status.nextRun,
        apiHealth,
        databaseHealth: `${seriesCount} series tracked, last update: ${lastDbUpdate ? lastDbUpdate.toISOString() : 'never'}`
      };
    } catch (error) {
      logger.error('Health check failed:', error instanceof Error ? error.message : String(error));
      return {
        schedulerStatus: 'error',
        lastUpdate: null,
        nextUpdate: null,
        apiHealth: { status: 'unhealthy', details: 'Health check failed' },
        databaseHealth: 'error'
      };
    }
  }
}

// Export singleton instance
export const fredSchedulerIncremental = new FredSchedulerIncremental({
  enabled: true,
  intervalHours: 4,
  maxRetries: 3,
  retryDelayMinutes: 15,
  runOnStartup: false // Set to true if you want immediate updates on app start
});