import { logger } from '../../shared/utils/logger';

/**
 * ✅ PHASE 3 TASK 2: Advanced Scheduler Optimization
 * Intelligent scheduling system for market-aware data collection
 */

export interface SchedulerConfig {
  economicDataInterval: number;
  marketDataInterval: number;
  offHoursInterval: number;
  maxConcurrentJobs: number;
}

export class SchedulerOptimizer {
  private static instance: SchedulerOptimizer;
  private config: SchedulerConfig;
  private activeJobs = new Set<string>();
  
  private constructor() {
    this.config = {
      economicDataInterval: 24 * 60 * 60 * 1000, // 24 hours for economic data
      marketDataInterval: 5 * 60 * 1000, // 5 minutes during market hours
      offHoursInterval: 60 * 60 * 1000, // 1 hour during off hours
      maxConcurrentJobs: 3
    };
  }
  
  static getInstance(): SchedulerOptimizer {
    if (!SchedulerOptimizer.instance) {
      SchedulerOptimizer.instance = new SchedulerOptimizer();
    }
    return SchedulerOptimizer.instance;
  }
  
  /**
   * Optimize scheduler intervals based on market conditions
   */
  getOptimizedInterval(dataType: 'economic' | 'market', isMarketOpen: boolean): number {
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      logger.warn('Maximum concurrent jobs reached, delaying next execution');
      return this.config.offHoursInterval * 2; // Double interval when busy
    }
    
    switch (dataType) {
      case 'economic':
        return this.config.economicDataInterval;
      case 'market':
        return isMarketOpen ? this.config.marketDataInterval : this.config.offHoursInterval;
      default:
        return this.config.offHoursInterval;
    }
  }
  
  /**
   * Register active job
   */
  registerJob(jobId: string): void {
    this.activeJobs.add(jobId);
    logger.info(`Job registered: ${jobId} (${this.activeJobs.size}/${this.config.maxConcurrentJobs} active)`);
  }
  
  /**
   * Unregister completed job
   */
  unregisterJob(jobId: string): void {
    this.activeJobs.delete(jobId);
    logger.info(`Job completed: ${jobId} (${this.activeJobs.size}/${this.config.maxConcurrentJobs} active)`);
  }
  
  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      activeJobs: Array.from(this.activeJobs),
      totalActiveJobs: this.activeJobs.size,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      config: this.config
    };
  }
}

export const schedulerOptimizer = SchedulerOptimizer.getInstance();