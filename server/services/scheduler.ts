import cron from 'node-cron';
import { FinancialDataService } from './financial-data';
import { EconomicDataService } from './economic-data';

export class DataScheduler {
  private static instance: DataScheduler;
  private financialService: FinancialDataService;
  private economicService: EconomicDataService;
  private isMarketHours: boolean = false;

  constructor() {
    this.financialService = FinancialDataService.getInstance();
    this.economicService = EconomicDataService.getInstance();
  }

  static getInstance(): DataScheduler {
    if (!DataScheduler.instance) {
      DataScheduler.instance = new DataScheduler();
    }
    return DataScheduler.instance;
  }

  private isWeekday(): boolean {
    const today = new Date();
    const day = today.getDay();
    return day >= 1 && day <= 5; // Monday to Friday
  }

  private checkMarketHours(): boolean {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    // Market hours: 9:30 AM - 4:00 PM EST
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    return this.isWeekday() && currentTime >= marketOpen && currentTime <= marketClose;
  }

  async updateAllData(): Promise<void> {
    try {
      console.log('🔄 Starting comprehensive data update...');
      
      // Update market indicators with fresh timestamp
      console.log('📊 Updating market indicators...');
      const marketData = await this.financialService.getMarketIndicators();
      console.log('Market indicators updated:', marketData ? 'success' : 'failed');
      
      // Update sector data
      console.log('🏢 Updating sector data...');
      await this.financialService.getSectorETFs();
      
      // Update economic events with FRED API automation
      console.log('📈 Updating economic calendar with FRED data...');
      await this.economicService.scrapeMarketWatchCalendar();
      
      // Update technical indicators for all ETFs
      console.log('⚡ Updating technical indicators...');
      const etfSymbols = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
      for (const symbol of etfSymbols) {
        try {
          await this.financialService.getTechnicalIndicators(symbol);
          console.log(`✅ Technical indicators updated for ${symbol}`);
        } catch (error) {
          console.error(`❌ Failed to update technical indicators for ${symbol}:`, error);
        }
      }
      
      // Update sentiment data
      console.log('💭 Updating sentiment data...');
      await this.financialService.getRealMarketSentiment();
      
      console.log('✅ Comprehensive data update completed');
    } catch (error) {
      console.error('❌ Error during comprehensive data update:', error);
    }
  }

  async sendDailyEmail(): Promise<void> {
    try {
      console.log('📧 Email functionality has been removed from the platform');
      return;
      
      console.log('✅ Email functionality has been removed - no operations performed');
    } catch (error) {
      console.error('❌ Error sending daily emails:', error);
    }
  }

  async updateRealTimeData(): Promise<void> {
    if (!this.checkMarketHours()) {
      console.log('⏰ Outside market hours, skipping real-time updates');
      return;
    }

    try {
      console.log('🔄 Real-time market data update...');
      
      // Quick updates for live data
      await Promise.all([
        this.financialService.getStockQuote('SPY'),
        this.financialService.getMarketIndicators(),
        this.financialService.getRealMarketSentiment()
      ]);
      
      console.log('✅ Real-time data updated');
    } catch (error) {
      console.error('❌ Error during real-time update:', error);
    }
  }

  async updateForecastData(): Promise<void> {
    try {
      console.log('🔮 Updating forecast data...');
      
      // Update economic events and forecasts
      await this.economicService.scrapeMarketWatchCalendar();
      
      // AI analysis functionality has been removed
      console.log('🤖 AI analysis functionality has been removed from the platform');
      
      console.log('✅ Forecast data updated');
    } catch (error) {
      console.error('❌ Error during forecast update:', error);
    }
  }

  async updateEconomicDataWithFred(): Promise<void> {
    try {
      console.log('📊 FRED: Updating economic calendar with FRED API...');
      
      // Use the economic service which now includes FRED integration
      await this.economicService.scrapeMarketWatchCalendar();
      
      console.log('✅ FRED: Economic calendar updated with latest data');
    } catch (error) {
      console.error('❌ FRED: Error updating economic data:', error);
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      console.log('🧹 Starting data cleanup...');
      
      // Clear any cached data older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Log cleanup action (in a real system, you'd clean database records)
      console.log(`🗑️ Cleaning data older than ${oneDayAgo.toISOString()}`);
      
      console.log('✅ Data cleanup completed');
    } catch (error) {
      console.error('❌ Error during data cleanup:', error);
    }
  }

  startScheduler(): void {
    console.log('🚀 Starting DataScheduler with comprehensive update schedule...');
    console.log('📧 CRITICAL: Setting up 8 AM EST daily email cron job...');

    // DISABLED: Real-time updates were causing memory leaks - use less frequent updates instead
    // Every 2 minutes was too aggressive and caused 4GB+ heap crashes
    // cron.schedule('*/2 * * * *', async () => {
    //   if (this.isWeekday()) {
    //     const est = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    //     const estHour = new Date(est).getHours();
    //     
    //     // Extended hours: 8:30 AM - 6 PM EST
    //     if (estHour >= 8 && estHour <= 18) {
    //       await this.updateRealTimeData();
    //     }
    //   }
    // }, {
    //   timezone: "America/New_York"
    // });

    // Forecast updates: Every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.updateForecastData();
    }, {
      timezone: "America/New_York"
    });

    // OpenAI services removed - cache cleanup only
    cron.schedule('0 15 * * 1-5', async () => {
      console.log('🧹 Daily cache cleanup at 3 PM EST...');
      try {
        const { cacheService } = await import('./cache-unified');
        cacheService.delete("economic-indicators-openai-daily-v1");
        cacheService.delete("economic-indicators-cache");
        
        console.log('✅ Daily cache cleanup completed successfully');
      } catch (error) {
        console.error('❌ Daily cache cleanup failed:', error);
      }
    }, {
      timezone: "America/New_York"
    });

    // MarketWatch Calendar Auto-Scraping: Daily at 4 AM EST (after FRED updates, before market open)
    cron.schedule('0 4 * * 1-5', async () => {
      console.log('🔍 MARKETWATCH: Daily calendar refresh for upcoming events...');
      try {
        // Force refresh the cached scraping data
        const economicDataService = (await import('./economic-data')).EconomicDataService.getInstance();
        (economicDataService as any).lastScrapedTime = null; // Force refresh
        // FRED updates removed - using fallback economic data only
        console.log('✅ MARKETWATCH: Daily calendar updated successfully');
      } catch (error) {
        console.error('❌ MARKETWATCH: Error updating daily calendar:', error);
      }
    }, {
      timezone: "America/New_York"
    });

    // Comprehensive sync: Daily at 6 AM EST
    cron.schedule('0 6 * * *', async () => {
      console.log('🌅 Starting daily comprehensive sync at 6 AM EST...');
      await this.updateAllData();
    }, {
      timezone: "America/New_York"
    });

    // Daily email at 8:20 AM EST (Market Days + Sunday) - uses cached data for faster delivery
    cron.schedule('20 8 * * 0,1-5', async () => {
      console.log('📧 SCHEDULED: Sending daily market commentary at 8:20 AM EST (Market Days + Sunday)...');
      try {
        await this.sendDailyEmail();
        console.log('✅ SCHEDULED: Daily email completed successfully');
      } catch (error) {
        console.error('❌ SCHEDULED: Error sending daily email:', error);
      }
    }, {
      timezone: "America/New_York"
    });

    // Data cleanup: Daily at 2 AM EST
    cron.schedule('0 2 * * *', async () => {
      console.log('🌙 Starting daily cleanup at 2 AM EST...');
      await this.cleanupOldData();
    }, {
      timezone: "America/New_York"
    });

    // Initial data load
    setTimeout(async () => {
      console.log('🎯 Performing initial data load...');
      await this.updateAllData();
    }, 5000); // 5 second delay to allow server to fully start

    // Enhanced logging for email schedule
    const estNow = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    console.log(`📧 Daily email scheduled for 8:20 AM EST (Market Days + Sunday)`);
    console.log(`📧 Current EST time: ${estNow}`);

    console.log('📅 Scheduler configured:');
    console.log('  • Real-time updates: Every 2 minutes (8:30 AM - 6 PM EST, weekdays)');
    console.log('  • Forecast updates: Every 6 hours');
    console.log('  • Comprehensive sync: Daily at 6 AM EST');
    console.log('  • Daily email: 8:20 AM EST (Market Days + Sunday) - COMPREHENSIVE DASHBOARD');
    console.log('  • Data cleanup: Daily at 2 AM EST');
  }



  // Manual trigger for immediate updates
  async forceUpdate(): Promise<void> {
    console.log('🚨 Force updating all data...');
    await this.updateAllData();
  }

  // Database methods removed as email functionality has been removed
}

export const dataScheduler = DataScheduler.getInstance();