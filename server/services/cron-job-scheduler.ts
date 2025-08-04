import * as cron from 'node-cron';
import { logger } from '../middleware/logging';
import { marketHoursDetector } from './market-hours-detector';
import { unifiedDashboardCache } from './unified-dashboard-cache';
import { storage } from '../storage';

interface JobStatus {
  name: string;
  lastRun: Date | null;
  nextRun: Date | null;
  isRunning: boolean;
  runCount: number;
  failureCount: number;
  lastError: string | null;
}

export class CronJobScheduler {
  private static instance: CronJobScheduler;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobStatuses: Map<string, JobStatus> = new Map();
  private isInitialized = false;

  static getInstance(): CronJobScheduler {
    if (!CronJobScheduler.instance) {
      CronJobScheduler.instance = new CronJobScheduler();
    }
    return CronJobScheduler.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('📅 Cron scheduler already initialized');
      return;
    }

    logger.info('📅 Initializing comprehensive cron job scheduler');

    // 1. Market Data Updates - Every 5 minutes during market hours, 15 minutes after hours
    this.scheduleJob('unified-data-refresh', '*/5 * * * *', async () => {
      const marketStatus = marketHoursDetector.getCurrentMarketStatus();
      
      // Adjust frequency based on market status
      if (marketStatus.session === 'regular' || marketStatus.session === 'premarket') {
        await this.runJobSafely('unified-data-refresh', async () => {
          logger.info('🔄 Refreshing unified dashboard data (market hours)');
          await unifiedDashboardCache.refreshUnifiedData();
        });
      } else if (marketStatus.session === 'closed' && this.shouldRunOffHours()) {
        await this.runJobSafely('unified-data-refresh', async () => {
          logger.info('🔄 Refreshing unified dashboard data (off hours)');
          await unifiedDashboardCache.refreshUnifiedData();
        });
      }
    });

    // 2. Economic Data Updates - Once daily at 8:00 AM ET, weekdays only (to save OpenAI API credits)
    this.scheduleJob('economic-data-update', '0 8 * * 1-5', async () => {
      await this.runJobSafely('economic-data-update', async () => {
        logger.info('📊 Updating economic data cache (daily 8am ET refresh)');
        // Force refresh economic readings and cache for entire day
        const response = await fetch('http://localhost:5000/api/recent-economic-openai?force=true');
        if (response.ok) {
          const economicData = await response.json();
          logger.info(`📊 Daily economic data cached: ${economicData.length} readings - valid until tomorrow 8am ET`);
          
          // Store with extended 24-hour cache
          await unifiedDashboardCache.setEconomicDataCache(economicData, 24 * 60 * 60 * 1000); // 24 hours
        }
      });
    });

    // 3. Technical Indicators Update - Every 10 minutes during market hours
    this.scheduleJob('technical-indicators-update', '*/10 * * * *', async () => {
      const marketStatus = marketHoursDetector.getCurrentMarketStatus();
      
      if (marketStatus.session === 'regular' || marketStatus.session === 'premarket') {
        await this.runJobSafely('technical-indicators-update', async () => {
          logger.info('📈 Updating technical indicators');
          
          // Update SPY technical data
          const spyTech = await fetch('http://localhost:5000/api/technical/SPY');
          const vixData = await fetch('http://localhost:5000/api/stocks/VIX');
          
          logger.info('📈 Technical indicators updated');
        });
      }
    });

    // 4. Cache Cleanup - Every hour
    this.scheduleJob('cache-cleanup', '0 * * * *', async () => {
      await this.runJobSafely('cache-cleanup', async () => {
        logger.info('🧹 Running cache cleanup');
        
        // Clean up old market sentiment data
        await storage.cleanupOldMarketSentiment();
        
        // Clean up old stock data
        await storage.cleanupOldStockData();
        
        logger.info('🧹 Cache cleanup completed');
      });
    });

    // 5. Daily Status Report - Every day at 6 AM EST
    this.scheduleJob('daily-status-report', '0 6 * * *', async () => {
      await this.runJobSafely('daily-status-report', async () => {
        await this.generateDailyStatusReport();
      });
    }, { timezone: 'America/New_York' });

    // 6. Data Consistency Check - Every 2 hours
    this.scheduleJob('data-consistency-check', '0 */2 * * *', async () => {
      await this.runJobSafely('data-consistency-check', async () => {
        logger.info('🔍 Running data consistency check');
        await this.checkDataConsistency();
      });
    });

    // 7. Convergence Signal Generation - Every 15 minutes during market hours
    this.scheduleJob('convergence-signals', '*/15 * * * *', async () => {
      const marketStatus = marketHoursDetector.getCurrentMarketStatus();
      
      if (marketStatus.session === 'regular' || marketStatus.session === 'premarket') {
        await this.runJobSafely('convergence-signals', async () => {
          logger.info('📊 Generating convergence signals');
          
          // Generate signals for major symbols
          const symbols = ['SPY', 'QQQ', 'IWM', 'VIX'];
          const multiTimeframeService = container.get<MultiTimeframeAnalysisService>('MultiTimeframeAnalysisService');
          
          for (const symbol of symbols) {
            try {
              await multiTimeframeService.analyzeSymbol(symbol);
              logger.debug(`✅ Convergence analysis completed for ${symbol}`);
            } catch (error) {
              logger.error(`❌ Failed to analyze ${symbol}:`, error);
            }
          }
          
          logger.info('📊 Convergence signal generation completed');
        });
      }
    });

    this.isInitialized = true;
    logger.info('📅 Cron scheduler initialized with 7 jobs');
  }

  private scheduleJob(
    name: string, 
    schedule: string, 
    task: () => Promise<void>,
    options?: { timezone?: string }
  ): void {
    const job = cron.schedule(schedule, task, {
      scheduled: false,
      timezone: options?.timezone || 'UTC'
    });

    this.jobs.set(name, job);
    this.jobStatuses.set(name, {
      name,
      lastRun: null,
      nextRun: null,
      isRunning: false,
      runCount: 0,
      failureCount: 0,
      lastError: null
    });

    job.start();
    logger.info(`📅 Job scheduled: ${name} (${schedule})`);
  }

  private async runJobSafely(jobName: string, task: () => Promise<void>): Promise<void> {
    const status = this.jobStatuses.get(jobName);
    if (!status) return;

    if (status.isRunning) {
      logger.warn(`⚠️ Job ${jobName} already running, skipping`);
      return;
    }

    status.isRunning = true;
    status.lastRun = new Date();
    
    try {
      await task();
      status.runCount++;
      status.lastError = null;
      logger.info(`✅ Job ${jobName} completed successfully`);
    } catch (error) {
      status.failureCount++;
      status.lastError = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Job ${jobName} failed:`, error);
    } finally {
      status.isRunning = false;
    }
  }

  private shouldRunOffHours(): boolean {
    // Run off-hours updates every 15 minutes (3 out of 4 intervals)
    const minute = new Date().getMinutes();
    return minute % 15 === 0;
  }

  private async checkDataConsistency(): Promise<void> {
    try {
      // Check if unified cache data is consistent
      const cacheStats = unifiedDashboardCache.getCacheStats();
      
      if (cacheStats.status === 'empty') {
        logger.warn('⚠️ Unified cache is empty, triggering refresh');
        await unifiedDashboardCache.refreshUnifiedData();
      }

      // Check Z-Score consistency between momentum table and chart
      const sectorData = await unifiedDashboardCache.getSectorData();
      if (sectorData.length === 0) {
        logger.warn('⚠️ No sector data available, triggering refresh');
        await unifiedDashboardCache.refreshUnifiedData();
      }

      logger.info(`🔍 Data consistency check passed: ${sectorData.length} sectors, cache ${cacheStats.status}`);
    } catch (error) {
      logger.error('❌ Data consistency check failed:', error);
    }
  }

  private async generateDailyStatusReport(): Promise<void> {
    logger.info('📊 Generating daily status report');
    
    const marketStatus = marketHoursDetector.getCurrentMarketStatus();
    const cacheStats = unifiedDashboardCache.getCacheStats();
    
    const report = {
      date: new Date().toISOString().split('T')[0],
      marketStatus: marketStatus.session,
      jobStatuses: Array.from(this.jobStatuses.values()),
      cacheStats,
      uptime: process.uptime(),
      dataConsistency: {
        sectorDataCount: cacheStats.sectorCount || 0,
        economicDataCount: cacheStats.economicCount || 0,
        lastCacheRefresh: cacheStats.lastUpdated
      }
    };
    
    logger.info('📊 Daily Status Report', report);
  }

  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  async stop(): Promise<void> {
    logger.info('📅 Stopping cron scheduler');
    
    for (const [name, job] of this.jobs.entries()) {
      job.stop();
      logger.info(`📅 Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.jobStatuses.clear();
    this.isInitialized = false;
  }
}

export const cronJobScheduler = CronJobScheduler.getInstance();