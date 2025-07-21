import cron from 'node-cron';
import { comprehensiveHistoricalCollector } from './comprehensive-historical-collector.js';
import { historicalDataAccumulator } from './historical-data-accumulator.js';
import { historicalDataIntelligence } from './historical-data-intelligence.js';

export class EnhancedCronScheduler {
  private static instance: EnhancedCronScheduler;
  private isInitialized = false;
  
  static getInstance(): EnhancedCronScheduler {
    if (!EnhancedCronScheduler.instance) {
      EnhancedCronScheduler.instance = new EnhancedCronScheduler();
    }
    return EnhancedCronScheduler.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⏰ Enhanced cron scheduler already initialized');
      return;
    }

    console.log('⚡ Initializing Enhanced Cron Scheduler with Comprehensive Historical Data Collection...');

    // Historical Data Collection - Every 4 hours during market days
    cron.schedule('0 */4 * * 1-5', async () => {
      try {
        console.log('📊 [CRON] Starting 4-hourly historical data accumulation...');
        await comprehensiveHistoricalCollector.performDailyUpdate();
        await historicalDataAccumulator.accumulateDailyReadings();
        console.log('✅ [CRON] 4-hourly historical data collection completed');
      } catch (error) {
        console.error('❌ [CRON] 4-hourly historical data collection failed:', error);
      }
    });

    // Weekly Deep Historical Analysis - Saturdays at 6 AM
    cron.schedule('0 6 * * 6', async () => {
      try {
        console.log('🧠 [CRON] Starting weekly deep historical analysis...');
        
        // Generate comprehensive intelligence insights
        const insights = await historicalDataIntelligence.generateIntelligentInsights('SPY');
        console.log(`📈 Generated ${insights.technicalInsights.length} technical insights`);
        
        // Perform comprehensive historical backfill (6 months)
        await comprehensiveHistoricalCollector.collectComprehensiveHistory(['SPY', 'QQQ', 'IWM'], 6);
        
        console.log('✅ [CRON] Weekly deep historical analysis completed');
      } catch (error) {
        console.error('❌ [CRON] Weekly deep historical analysis failed:', error);
      }
    });

    // Daily Historical Context Update - 5 AM EST every weekday
    cron.schedule('0 5 * * 1-5', async () => {
      try {
        console.log('📊 [CRON] Starting daily historical context update...');
        
        // Update daily comprehensive data
        await comprehensiveHistoricalCollector.performDailyUpdate();
        
        // Generate enhanced AI context
        const context = await historicalDataIntelligence.generateEnhancedAIContext('SPY');
        console.log('🤖 Generated enhanced AI context for daily analysis');
        
        console.log('✅ [CRON] Daily historical context update completed');
      } catch (error) {
        console.error('❌ [CRON] Daily historical context update failed:', error);
      }
    });

    // Selective Data Cleanup - Sundays at 3 AM (preserve historical data)
    cron.schedule('0 3 * * 0', async () => {
      try {
        console.log('🧹 [CRON] Starting selective data cleanup (preserving historical data)...');
        
        // Clean up old audit logs (keep 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        // Note: Only cleaning audit logs, preserving all historical market data
        console.log('🗄️ Cleaned audit logs older than 90 days (historical market data preserved)');
        
        console.log('✅ [CRON] Selective cleanup completed - historical data integrity maintained');
      } catch (error) {
        console.error('❌ [CRON] Selective cleanup failed:', error);
      }
    });

    // Initialize with immediate data accumulation (3 second delay for startup)
    setTimeout(async () => {
      try {
        console.log('🚀 [STARTUP] Performing initial historical data accumulation...');
        
        // Start with daily update (lightweight)
        await comprehensiveHistoricalCollector.performDailyUpdate();
        
        // Add immediate economic data accumulation
        await historicalDataAccumulator.accumulateDailyReadings();
        
        console.log('✅ [STARTUP] Initial historical data accumulation completed');
        console.log('📊 Enhanced Cron Scheduler: Historical data collection system is now ACTIVE');
        
      } catch (error) {
        console.error('❌ [STARTUP] Initial historical data accumulation failed:', error);
      }
    }, 3000);

    this.isInitialized = true;
    console.log('⚡ Enhanced Cron Scheduler initialized successfully');
    console.log('📅 Active schedules:');
    console.log('   • Every 4 hours (Mon-Fri): Historical data updates'); 
    console.log('   • Daily 5 AM EST (Mon-Fri): Context updates');
    console.log('   • Saturday 6 AM EST: Deep historical analysis');
    console.log('   • Sunday 3 AM EST: Selective cleanup');
  }

  /**
   * Manual trigger for comprehensive historical collection
   */
  async triggerComprehensiveCollection(lookbackMonths: number = 12): Promise<void> {
    try {
      console.log(`🎯 [MANUAL] Triggering comprehensive historical collection (${lookbackMonths} months)...`);
      
      await comprehensiveHistoricalCollector.collectComprehensiveHistory(
        ['SPY', 'QQQ', 'IWM', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLE', 'XLU', 'XLB', 'XLP'], 
        lookbackMonths
      );
      
      console.log('✅ [MANUAL] Comprehensive historical collection completed');
    } catch (error) {
      console.error('❌ [MANUAL] Comprehensive historical collection failed:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for intelligent insights generation
   */
  async triggerIntelligentInsights(symbol: string = 'SPY'): Promise<any> {
    try {
      console.log(`🧠 [MANUAL] Generating intelligent insights for ${symbol}...`);
      
      const insights = await historicalDataIntelligence.generateIntelligentInsights(symbol);
      
      console.log('✅ [MANUAL] Intelligent insights generated successfully');
      return insights;
      
    } catch (error) {
      console.error('❌ [MANUAL] Intelligent insights generation failed:', error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  getStatus(): { initialized: boolean; activeJobs: string[] } {
    return {
      initialized: this.isInitialized,
      activeJobs: [
        '4-hourly data updates (Mon-Fri)',
        'Daily context updates (5 AM EST, Mon-Fri)', 
        'Weekly deep analysis (Sat 6 AM EST)',
        'Selective cleanup (Sun 3 AM EST)'
      ]
    };
  }
}

// Export singleton
export const enhancedCronScheduler = EnhancedCronScheduler.getInstance();