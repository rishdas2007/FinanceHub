import { logger } from '../middleware/logging';
import { fredDataService } from './fred-data-service';

interface OptimizedFredConfig {
  runFrequency: 'daily' | 'weekly' | 'manual';
  maxConcurrentCalls: number;
  priorityIndicators: string[];
  backfillYears?: number;
}

interface IndicatorBackfillStatus {
  series: string;
  name: string;
  targetRecords: number;
  currentRecords: number;
  lastUpdate: Date | null;
  priority: number;
}

/**
 * Optimized FRED Scheduler
 * Addresses missing economic data while maintaining performance optimization
 * Focuses on essential indicators with rate limiting and smart scheduling
 */
export class OptimizedFredScheduler {
  private config: OptimizedFredConfig;
  private isRunning = false;
  private schedulerInterval: NodeJS.Timeout | null = null;

  private readonly MISSING_DATA_PRIORITY = [
    // High priority - needed for trading decisions
    { series: 'CCSA', name: 'Continuing Jobless Claims', priority: 1, targetRecords: 60 },
    { series: 'ICSA', name: 'Initial Jobless Claims', priority: 1, targetRecords: 60 },
    { series: 'PAYEMS', name: 'Nonfarm Payrolls', priority: 1, targetRecords: 120 },

    // Medium priority - useful for analysis
    { series: 'CPIAUCSL', name: 'CPI All Items', priority: 2, targetRecords: 36 },
    { series: 'CPILFESL', name: 'Core CPI', priority: 2, targetRecords: 36 },
    { series: 'MORTGAGE30US', name: '30-Year Mortgage Rate', priority: 2, targetRecords: 36 },
    { series: 'DEXUSEU', name: 'US Dollar Index', priority: 2, targetRecords: 36 },

    // Low priority - nice to have
    { series: 'GASREGCOVW', name: 'Gasoline Prices', priority: 3, targetRecords: 24 },
    { series: 'RSAFS', name: 'Retail Sales', priority: 3, targetRecords: 24 },
    { series: 'HOUST', name: 'Housing Starts', priority: 3, targetRecords: 24 }
  ];

  constructor(config: OptimizedFredConfig) {
    this.config = {
      runFrequency: 'daily',
      maxConcurrentCalls: 2,
      priorityIndicators: ['CCSA', 'ICSA', 'PAYEMS'],
      backfillYears: 5,
      ...config
    };

    logger.info('📊 Optimized FRED Scheduler initialized', {
      frequency: this.config.runFrequency,
      maxConcurrent: this.config.maxConcurrentCalls,
      indicators: this.config.priorityIndicators.length
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ FRED Scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting optimized FRED data collection');

    // Run initial assessment
    await this.assessMissingData();

    // Set up scheduled runs based on frequency
    if (this.config.runFrequency === 'daily') {
      // Run once per day at 6 AM EST
      this.schedulerInterval = setInterval(() => {
        this.runScheduledCollection();
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Also run immediately for testing
      setTimeout(() => this.runScheduledCollection(), 5000);
    } else if (this.config.runFrequency === 'weekly') {
      // Run once per week
      this.schedulerInterval = setInterval(() => {
        this.runScheduledCollection();
      }, 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    logger.info('✅ Optimized FRED Scheduler started successfully');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    logger.info('⏹️ Optimized FRED Scheduler stopped');
  }

  private async runScheduledCollection(): Promise<void> {
    if (!this.isRunning) return;

    try {
      logger.info('🔄 Running scheduled FRED data collection');

      // Focus on priority indicators first
      const priorityIndicators = this.MISSING_DATA_PRIORITY
        .filter(indicator => indicator.priority <= 2)
        .slice(0, this.config.maxConcurrentCalls);

      await this.collectDataForIndicators(priorityIndicators);

      logger.info('✅ Scheduled FRED data collection completed');
    } catch (error) {
      logger.error('❌ Scheduled FRED collection failed:', error);
    }
  }

  async assessMissingData(): Promise<IndicatorBackfillStatus[]> {
    logger.info('🔍 Assessing missing economic data status');

    const status: IndicatorBackfillStatus[] = [];

    for (const indicator of this.MISSING_DATA_PRIORITY) {
      try {
        const currentRecords = await this.getIndicatorRecordCount(indicator.series);
        const lastUpdate = await this.getLastUpdateDate(indicator.series);

        status.push({
          series: indicator.series,
          name: indicator.name,
          targetRecords: indicator.targetRecords,
          currentRecords,
          lastUpdate,
          priority: indicator.priority
        });

        if (currentRecords < indicator.targetRecords * 0.5) {
          logger.warn(`📉 ${indicator.name} (${indicator.series}): ${currentRecords}/${indicator.targetRecords} records (${Math.round(currentRecords/indicator.targetRecords*100)}%)`);
        } else {
          logger.info(`📊 ${indicator.name} (${indicator.series}): ${currentRecords}/${indicator.targetRecords} records (${Math.round(currentRecords/indicator.targetRecords*100)}%)`);
        }
      } catch (error) {
        logger.error(`❌ Error assessing ${indicator.series}:`, error);
        status.push({
          series: indicator.series,
          name: indicator.name,
          targetRecords: indicator.targetRecords,
          currentRecords: 0,
          lastUpdate: null,
          priority: indicator.priority
        });
      }
    }

    return status;
  }

  private async collectDataForIndicators(indicators: typeof this.MISSING_DATA_PRIORITY): Promise<void> {
    const promises = indicators.map(async (indicator, index) => {
      // Stagger requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, index * 1000));
      
      try {
        await this.collectIndicatorData(indicator.series, indicator.name);
      } catch (error) {
        logger.error(`❌ Failed to collect data for ${indicator.series}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  private async collectIndicatorData(seriesId: string, name: string): Promise<void> {
    try {
      logger.info(`📊 Collecting data for ${name} (${seriesId})`);

      // Get current record count
      const currentRecords = await this.getIndicatorRecordCount(seriesId);
      
      // Calculate how much historical data to fetch
      const targetYears = this.config.backfillYears || 5;
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - targetYears);

      // Use existing FRED service to fetch data
      await fredDataService.fetchAndStoreIndicator(seriesId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      });

      const newRecords = await this.getIndicatorRecordCount(seriesId);
      const addedRecords = newRecords - currentRecords;

      if (addedRecords > 0) {
        logger.info(`✅ Added ${addedRecords} records for ${name} (${seriesId}). Total: ${newRecords}`);
      } else {
        logger.info(`📊 ${name} (${seriesId}) is up to date with ${newRecords} records`);
      }
    } catch (error) {
      logger.error(`❌ Error collecting data for ${seriesId}:`, error);
    }
  }

  private async getIndicatorRecordCount(seriesId: string): Promise<number> {
    try {
      const { db } = await import('../db');
      const result = await db.execute(`
        SELECT COUNT(*) as count
        FROM economic_indicators_current 
        WHERE metric_name LIKE '%${seriesId}%'
        OR metric_name LIKE '%${this.getIndicatorNameBySeriesId(seriesId)}%'
      `);
      
      return Number(result.rows[0]?.count || 0);
    } catch (error) {
      logger.error(`❌ Error getting record count for ${seriesId}:`, error);
      return 0;
    }
  }

  private async getLastUpdateDate(seriesId: string): Promise<Date | null> {
    try {
      const { db } = await import('../db');
      const result = await db.execute(`
        SELECT MAX(date) as last_date
        FROM economic_indicators_current 
        WHERE metric_name LIKE '%${seriesId}%'
        OR metric_name LIKE '%${this.getIndicatorNameBySeriesId(seriesId)}%'
      `);
      
      const lastDate = result.rows[0]?.last_date;
      return lastDate ? new Date(String(lastDate)) : null;
    } catch (error) {
      logger.error(`❌ Error getting last update date for ${seriesId}:`, error);
      return null;
    }
  }

  private getIndicatorNameBySeriesId(seriesId: string): string {
    const mapping: Record<string, string> = {
      'CCSA': 'Continuing Jobless Claims',
      'ICSA': 'Initial Jobless Claims',
      'PAYEMS': 'Nonfarm Payrolls',
      'CPIAUCSL': 'CPI All Items',
      'CPILFESL': 'Core CPI',
      'MORTGAGE30US': '30-Year Mortgage Rate',
      'DEXUSEU': 'US Dollar Index',
      'GASREGCOVW': 'Gasoline Prices',
      'RSAFS': 'Retail Sales',
      'HOUST': 'Housing Starts'
    };
    
    return mapping[seriesId] || seriesId;
  }

  async forceBackfill(seriesIds?: string[]): Promise<void> {
    const indicatorsToBackfill = seriesIds 
      ? this.MISSING_DATA_PRIORITY.filter(ind => seriesIds.includes(ind.series))
      : this.MISSING_DATA_PRIORITY.filter(ind => ind.priority === 1);

    logger.info(`🔄 Force backfilling ${indicatorsToBackfill.length} indicators`);

    await this.collectDataForIndicators(indicatorsToBackfill);

    logger.info('✅ Force backfill completed');
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      config: this.config,
      priorityIndicators: this.MISSING_DATA_PRIORITY.filter(ind => ind.priority <= 2),
      nextRun: this.schedulerInterval ? 'Scheduled' : 'Manual only'
    };
  }
}

export const optimizedFredScheduler = new OptimizedFredScheduler({
  runFrequency: 'daily',
  maxConcurrentCalls: 2,
  priorityIndicators: ['CCSA', 'ICSA', 'PAYEMS'],
  backfillYears: 5
});