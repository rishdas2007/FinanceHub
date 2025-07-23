import { fredDataUpdaterService } from './fred-data-updater';
import { logger } from '../utils/logger';

export class FREDSchedulerService {
  private schedulerId: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

  async startScheduler(): Promise<void> {
    logger.info('📅 Starting FRED data scheduler - updates every 4 hours');
    
    // Perform initial update
    setTimeout(async () => {
      await this.performScheduledUpdate();
    }, 5000); // 5 seconds delay for server startup
    
    // Schedule recurring updates
    this.schedulerId = setInterval(async () => {
      await this.performScheduledUpdate();
    }, this.UPDATE_INTERVAL);
  }

  stopScheduler(): void {
    if (this.schedulerId) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
      logger.info('🛑 FRED data scheduler stopped');
    }
  }

  private async performScheduledUpdate(): Promise<void> {
    try {
      logger.info('🕐 Scheduled FRED data update starting...');
      
      const result = await fredDataUpdaterService.updateFREDData();
      
      if (result.success) {
        logger.info(`✅ Scheduled FRED update completed: ${result.indicatorsCount} indicators processed`);
      } else {
        logger.error(`❌ Scheduled FRED update failed: ${result.message}`);
      }
    } catch (error) {
      logger.error('💥 Scheduled FRED update error:', error);
    }
  }

  getSchedulerStatus(): { 
    isRunning: boolean; 
    nextUpdate: string | null; 
    updateInterval: string;
  } {
    return {
      isRunning: this.schedulerId !== null,
      nextUpdate: this.schedulerId ? new Date(Date.now() + this.UPDATE_INTERVAL).toISOString() : null,
      updateInterval: '4 hours'
    };
  }
}

export const fredSchedulerService = new FREDSchedulerService();