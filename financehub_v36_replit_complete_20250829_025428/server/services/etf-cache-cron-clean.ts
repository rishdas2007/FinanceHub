import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { etfCacheService } from './etf-cache-service-clean';

export class ETFCacheCronService {
  private isRunning = false;
  private lastRefresh: Date | null = null;
  private refreshCount = 0;
  private errorCount = 0;

  /**
   * Initialize ETF cache background refresh
   * Runs every 5 minutes during market hours
   */
  initialize() {
    console.log('🚀 Initializing ETF cache background refresh service');
    
    // Every 5 minutes: 0,5,10,15,20,25,30,35,40,45,50,55
    cron.schedule('*/5 * * * *', async () => {
      await this.performBackgroundRefresh();
    });
    
    // Initial cache warm-up
    setTimeout(() => {
      this.performBackgroundRefresh();
    }, 5000); // 5 second delay after startup
    
    console.log('✅ ETF cache cron service initialized - refreshing every 5 minutes');
  }

  /**
   * Perform background cache refresh
   */
  private async performBackgroundRefresh() {
    if (this.isRunning) {
      console.log('⏭️ ETF cache refresh already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting ETF cache background refresh');
      
      // Refresh materialized view
      await this.refreshMaterializedView();
      
      // Clear memory cache to force fresh fetch on next request
      etfCacheService.clearMemoryCache();
      
      this.lastRefresh = new Date();
      this.refreshCount++;
      
      const duration = Date.now() - startTime;
      console.log(`✅ ETF cache refresh completed in ${duration}ms (total refreshes: ${this.refreshCount})`);
      
    } catch (error) {
      this.errorCount++;
      console.error('❌ ETF cache refresh failed:', error);
      console.log(`📊 ETF cache refresh stats: ${this.refreshCount} successes, ${this.errorCount} errors`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Refresh the materialized view in database
   */
  private async refreshMaterializedView(): Promise<void> {
    try {
      const result = await db.execute(sql`SELECT * FROM public.refresh_etf_5min_cache()`);
      const refreshResult = result.rows[0] as any;
      
      if (refreshResult) {
        console.log(`📊 Materialized view refreshed: ${refreshResult.rows_refreshed} rows in ${refreshResult.refresh_duration}`);
        
        if (refreshResult.status !== 'SUCCESS') {
          throw new Error(`Refresh failed: ${refreshResult.status}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to refresh materialized view:', error);
      throw error;
    }
  }

  /**
   * Get refresh statistics
   */
  getStats() {
    return {
      service_status: this.isRunning ? 'running' : 'idle',
      last_refresh: this.lastRefresh?.toISOString() || null,
      total_refreshes: this.refreshCount,
      total_errors: this.errorCount,
      next_refresh_in_minutes: this.getNextRefreshInMinutes(),
      refresh_schedule: 'Every 5 minutes',
      initialized: true
    };
  }

  /**
   * Calculate minutes until next refresh
   */
  private getNextRefreshInMinutes(): number {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextRefreshMinute = Math.ceil(minutes / 5) * 5;
    
    if (nextRefreshMinute === 60) {
      return 60 - minutes;
    }
    
    return nextRefreshMinute - minutes;
  }

  /**
   * Manual refresh trigger (for testing)
   */
  async triggerManualRefresh(): Promise<void> {
    console.log('🔧 Manual ETF cache refresh triggered');
    await this.performBackgroundRefresh();
  }
}

export const etfCacheCronService = new ETFCacheCronService();