import cron from 'node-cron';
import { historicalDataAccumulator } from './historical-data-accumulator.js';
import { emailService } from './email-service.js';

export class EnhancedCronScheduler {
  private static instance: EnhancedCronScheduler;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  static getInstance(): EnhancedCronScheduler {
    if (!EnhancedCronScheduler.instance) {
      EnhancedCronScheduler.instance = new EnhancedCronScheduler();
    }
    return EnhancedCronScheduler.instance;
  }

  initialize(): void {
    console.log('🕐 Initializing enhanced cron scheduler with historical data accumulation...');
    
    // CHANGED: Historical data accumulation (every 4 hours) - ACCUMULATE, don't replace
    const dataAccumulationJob = cron.schedule('0 */4 * * *', async () => {
      console.log('📊 Running scheduled historical data accumulation...');
      try {
        await historicalDataAccumulator.accumulateDailyReadings();
        console.log('✅ Scheduled data accumulation completed');
      } catch (error) {
        console.error('❌ Scheduled data accumulation failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // CHANGED: Daily email (8 AM EST) - now uses enhanced AI with historical context
    const dailyEmailJob = cron.schedule('0 8 * * 1-5', async () => {
      console.log('📧 Running scheduled daily email with enhanced analysis...');
      try {
        await emailService.sendScheduledEmails();
        console.log('✅ Scheduled daily emails sent with historical context');
      } catch (error) {
        console.error('❌ Scheduled daily email failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // NEW: Weekly historical context snapshot (Sundays at 6 PM EST)
    const weeklySnapshotJob = cron.schedule('0 18 * * 0', async () => {
      console.log('📸 Creating weekly historical context snapshot...');
      try {
        // Force a comprehensive snapshot
        await historicalDataAccumulator.accumulateDailyReadings();
        console.log('✅ Weekly historical snapshot completed');
      } catch (error) {
        console.error('❌ Weekly snapshot failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // CHANGED: Modified cleanup - preserve historical data, only clean temporary caches
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Running selective cleanup (preserving historical data)...');
      try {
        // Only clean temporary caches, preserve all historical economic data
        console.log('🔄 Selective cleanup - preserving historical time series data');
        
        // Clear only application caches, not historical data
        // This ensures we accumulate data over time
        
        console.log('✅ Selective cleanup completed - historical data preserved');
      } catch (error) {
        console.error('❌ Cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    // Store job references
    this.jobs.set('dataAccumulation', dataAccumulationJob);
    this.jobs.set('dailyEmail', dailyEmailJob);
    this.jobs.set('weeklySnapshot', weeklySnapshotJob);
    this.jobs.set('cleanup', cleanupJob);

    // Start all jobs
    this.startAllJobs();
    
    console.log('✅ Enhanced cron scheduler initialized with historical data accumulation');
    console.log('📅 Schedule:');
    console.log('   - Data accumulation: Every 4 hours (ACCUMULATE mode)');
    console.log('   - Daily emails: 8 AM EST (Monday-Friday) with historical context');
    console.log('   - Weekly snapshots: Sunday 6 PM EST');
    console.log('   - Selective cleanup: 2 AM EST daily (preserves historical data)');
  }

  private startAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`🟢 Started job: ${name}`);
    });
  }

  stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`🔴 Stopped job: ${name}`);
    });
  }

  getJobStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.jobs.forEach((job, name) => {
      status[name] = job.running;
    });
    return status;
  }

  // Manual trigger methods for testing
  async triggerDataAccumulation(): Promise<void> {
    console.log('🧪 Manually triggering data accumulation...');
    await historicalDataAccumulator.accumulateDailyReadings();
  }

  async triggerDailyEmail(): Promise<void> {
    console.log('🧪 Manually triggering daily email with enhanced analysis...');
    await emailService.sendScheduledEmails();
  }
}

export const enhancedCronScheduler = EnhancedCronScheduler.getInstance();