import { fredDataUpdaterService } from './fred-data-updater';
import { historicalEconomicIndicatorsService } from './historical-economic-indicators';
import { logger } from '../utils/logger';

export class FREDSchedulerService {
  private schedulerId: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  async startScheduler(): Promise<void> {
    logger.info('📅 Starting FRED data scheduler - updates every 2 hours (within 120 req/min FRED limit)');
    
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
      logger.info('🕐 Scheduled FRED data update starting (2-hour interval)...');
      
      // Update historical data directly from FRED API
      const historicalResult = await historicalEconomicIndicatorsService.updateAllIndicators();
      
      if (historicalResult.success) {
        logger.info(`✅ Historical FRED update completed: ${historicalResult.updatedCount} indicators updated`);
        
        // Also run the Python script for backup CSV generation
        const csvResult = await fredDataUpdaterService.updateFREDData();
        if (csvResult.success) {
          logger.info(`✅ Backup CSV generation completed: ${csvResult.indicatorsCount} indicators`);
        }
      } else {
        logger.error(`❌ Scheduled FRED update failed: ${historicalResult.message}`);
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
      updateInterval: '2 hours'
    };
  }
}

export const fredSchedulerService = new FREDSchedulerService();