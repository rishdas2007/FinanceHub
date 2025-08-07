import * as cron from 'node-cron';
import { logger } from '../middleware/logging';
import { marketHoursDetector } from './market-hours-detector';
import { backgroundDataFetcher } from './background-data-fetcher';
import { unifiedDashboardCache } from './unified-dashboard-cache';

interface JobStatus {
  name: string;
  lastRun: Date | null;
  nextRun: Date | null;
  isRunning: boolean;
  runCount: number;
  failureCount: number;
  lastError: string | null;
}

export class IntelligentCronScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobStatuses: Map<string, JobStatus> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('📅 Cron scheduler already initialized');
      return;
    }

    logger.info('📅 Initializing intelligent cron scheduler');

    // OPTIMIZED: Schedule momentum data updates (market-aware intervals)
    this.scheduleJob('momentum-updates', '*/8 * * * *', async () => {
      const marketInfo = marketHoursDetector.getMarketStatus();
      
      if (marketInfo.isOpen || marketInfo.isPrePostHours) {
        // More frequent during market hours
        await this.runJobSafely('momentum-updates', () => backgroundDataFetcher.fetchMomentumData());
      } else if (this.shouldRunWeekendUpdate()) {
        // Less frequent during weekends/nights
        await this.runJobSafely('momentum-updates', () => backgroundDataFetcher.fetchMomentumDataLight());
      }
    });

    // Schedule economic data updates (every 30-60 minutes based on market hours)
    this.scheduleJob('economic-updates', '*/30 * * * *', async () => {
      if (this.shouldRunEconomicUpdate()) {
        await this.runJobSafely('economic-updates', () => backgroundDataFetcher.fetchEconomicReadings());
      }
    });

    // Schedule AI summary generation (every 30 minutes during market hours)
    this.scheduleJob('ai-summary', '*/30 * * * *', async () => {
      if (this.shouldRunAISummary()) {
        await this.runJobSafely('ai-summary', () => backgroundDataFetcher.generateAISummary());
      }
    });

    // OPTIMIZED: Schedule comprehensive updates (market-aware timing)
    this.scheduleJob('comprehensive-update', '0 */3 * * *', async () => {
      const marketInfo = marketHoursDetector.getMarketStatus();
      
      // Skip comprehensive updates during peak market hours (10 AM - 2 PM EST)
      const currentHour = new Date().getHours();
      const isPeakHours = marketInfo.isOpen && currentHour >= 10 && currentHour <= 14;
      
      if (!isPeakHours) {
        await this.runJobSafely('comprehensive-update', () => backgroundDataFetcher.runCompleteDataUpdate());
      } else {
        logger.info('⏭️ Skipping comprehensive update during peak market hours');
      }
    });

    // Schedule cache cleanup (every 6 hours)
    this.scheduleJob('cache-cleanup', '0 */6 * * *', async () => {
      await this.runJobSafely('cache-cleanup', () => this.cleanupExpiredCache());
    });

    // Schedule daily status report (every day at 6 AM EST)
    this.scheduleJob('daily-status', '0 6 * * *', async () => {
      await this.runJobSafely('daily-status', () => this.generateDailyStatusReport());
    });

    // Run initial data fetch
    setTimeout(async () => {
      logger.info('🚀 Running initial background data fetch');
      await backgroundDataFetcher.runCompleteDataUpdate();
    }, 5000);

    this.isInitialized = true;
    logger.info('✅ Intelligent cron scheduler initialized with 6 jobs');
  }

  private scheduleJob(name: string, cronExpression: string, jobFunction: () => Promise<void>): void {
    const task = cron.schedule(cronExpression, jobFunction, {
      timezone: 'America/New_York'
    });

    this.jobs.set(name, task);
    this.jobStatuses.set(name, {
      name,
      lastRun: null,
      nextRun: null,
      isRunning: false,
      runCount: 0,
      failureCount: 0,
      lastError: null
    });

    task.start();
    logger.info(`📅 Scheduled job: ${name} (${cronExpression})`);
  }

  private async runJobSafely(jobName: string, jobFunction: () => Promise<any>): Promise<void> {
    const status = this.jobStatuses.get(jobName);
    if (!status) return;

    if (status.isRunning) {
      logger.warn(`⏳ Job ${jobName} already running, skipping`);
      return;
    }

    status.isRunning = true;
    status.lastRun = new Date();
    const startTime = Date.now();

    try {
      logger.info(`▶️  Starting job: ${jobName}`);
      
      const result = await jobFunction();
      const duration = Date.now() - startTime;
      
      status.runCount++;
      status.lastError = null;
      
      logger.info(`✅ Job ${jobName} completed successfully in ${duration}ms`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      status.failureCount++;
      status.lastError = errorMsg;
      
      logger.error(`❌ Job ${jobName} failed: ${errorMsg}`);
      
    } finally {
      status.isRunning = false;
    }
  }

  private shouldRunMomentumUpdate(): boolean {
    const marketStatus = marketHoursDetector.getCurrentMarketStatus();
    const frequencies = marketHoursDetector.getUpdateFrequency();
    
    const lastUpdate = unifiedDashboardCache.get('momentum-analysis-background')?.timestamp || new Date(0).getTime();
    const shouldUpdate = marketHoursDetector.shouldUpdateNow(new Date(lastUpdate), 'momentum');
    
    logger.debug(`🔍 Momentum update check: ${shouldUpdate} (market: ${marketStatus.session})`);
    return shouldUpdate;
  }

  private shouldRunEconomicUpdate(): boolean {
    const marketStatus = marketHoursDetector.getCurrentMarketStatus();
    const frequencies = marketHoursDetector.getUpdateFrequency();
    
    const lastUpdate = unifiedDashboardCache.get('economic-readings-background')?.timestamp || new Date(0).getTime();
    const shouldUpdate = marketHoursDetector.shouldUpdateNow(new Date(lastUpdate), 'economic');
    
    logger.debug(`🔍 Economic update check: ${shouldUpdate} (market: ${marketStatus.session})`);
    return shouldUpdate;
  }

  private shouldRunAISummary(): boolean {
    const marketStatus = marketHoursDetector.getCurrentMarketStatus();
    const frequencies = marketHoursDetector.getUpdateFrequency();
    
    const lastUpdate = unifiedDashboardCache.get('ai-summary-background')?.timestamp || new Date(0).getTime();
    const shouldUpdate = marketHoursDetector.shouldUpdateNow(new Date(lastUpdate), 'aiSummary');
    
    logger.debug(`🔍 AI summary check: ${shouldUpdate} (market: ${marketStatus.session})`);
    return shouldUpdate;
  }

  private shouldRunWeekendUpdate(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = now.getHours();
    
    // Run light updates on weekends during reasonable hours
    return (dayOfWeek === 0 || dayOfWeek === 6) && currentHour >= 8 && currentHour <= 20;
  }

  private async cleanupExpiredCache(): Promise<void> {
    logger.info('🧹 Starting cache cleanup');
    
    // Get cache stats for cleanup reporting
    const cacheStats = unifiedDashboardCache.getStats();
    
    logger.info(`🧹 Cache cleanup completed - maintained ${cacheStats.size} active entries`);
  }

  private async generateDailyStatusReport(): Promise<void> {
    logger.info('📊 Generating daily status report');
    
    const marketStatus = marketHoursDetector.getCurrentMarketStatus();
    const cacheStats = smartCache.getStats();
    
    const report = {
      date: new Date().toISOString().split('T')[0],
      marketStatus: marketStatus.session,
      jobStatuses: Array.from(this.jobStatuses.values()),
      cacheStats,
      uptime: process.uptime()
    };
    
    logger.info('📊 Daily Status Report', report);
    
    // Store report in cache for dashboard access
    smartCache.set('daily-status-report', report, '25h');
  }

  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  async triggerManualRefresh(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      logger.info('🔄 Manual refresh triggered');
      
      const result = await backgroundDataFetcher.runCompleteDataUpdate();
      
      return {
        success: true,
        message: `Manual refresh completed in ${result.totalDuration}ms`,
        data: {
          momentum: result.momentum.success,
          economic: result.economic.success,
          aiSummary: result.aiSummary.success,
          duration: result.totalDuration
        }
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Manual refresh failed:', errorMsg);
      
      return {
        success: false,
        message: `Manual refresh failed: ${errorMsg}`
      };
    }
  }

  shutdown(): void {
    logger.info('📅 Shutting down cron scheduler');
    
    this.jobs.forEach((task, name) => {
      task.stop();
      logger.info(`📅 Stopped job: ${name}`);
    });
    
    this.jobs.clear();
    this.jobStatuses.clear();
    this.isInitialized = false;
  }
}

export const intelligentCronScheduler = new IntelligentCronScheduler();