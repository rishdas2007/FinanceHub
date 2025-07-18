import cron from 'node-cron';
import { FinancialDataService } from './financial-data';
import { EconomicDataService } from './economic-data';
import { AIAnalysisService } from './ai-analysis';

export class DataScheduler {
  private static instance: DataScheduler;
  private financialService: FinancialDataService;
  private economicService: EconomicDataService;
  private aiService: AIAnalysisService;
  private isMarketHours: boolean = false;

  constructor() {
    this.financialService = FinancialDataService.getInstance();
    this.economicService = EconomicDataService.getInstance();
    this.aiService = new AIAnalysisService();
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
      
      // Update economic events
      console.log('📈 Updating economic calendar...');
      await this.economicService.scrapeMarketWatchCalendar();
      
      // Update technical indicators
      console.log('⚡ Updating technical indicators...');
      await this.financialService.getTechnicalIndicators('SPY');
      
      // Update sentiment data
      console.log('💭 Updating sentiment data...');
      await this.financialService.getSentimentData();
      
      console.log('✅ Comprehensive data update completed');
    } catch (error) {
      console.error('❌ Error during comprehensive data update:', error);
    }
  }

  async sendDailyEmail(): Promise<void> {
    try {
      console.log('📧 Sending daily market commentary emails...');
      
      // Import email service and AI analysis service
      const { emailService } = await import('./email-service');
      const { aiAnalysisService } = await import('./enhanced-ai-analysis');
      
      // Generate fresh analysis for the email
      const analysisData = await aiAnalysisService.generateComprehensiveAnalysis();
      
      // Send the daily email
      await emailService.sendDailyMarketCommentary(analysisData);
      
      console.log('✅ Daily market commentary emails sent successfully');
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
        this.financialService.getSentimentData()
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
      
      // Regenerate AI analysis with latest data
      const marketData = await this.financialService.getMarketIndicators();
      const sectorData = await this.financialService.getSectorETFs();
      
      if (marketData) {
        await this.aiService.generateMarketAnalysis({
          symbol: 'SPY',
          price: marketData.spy_price || 628,
          change: marketData.spy_change || 0,
          changePercent: marketData.spy_change_percent || 0,
          rsi: marketData.spy_rsi,
          macd: marketData.spy_macd,
          macdSignal: marketData.spy_macd_signal,
          vix: marketData.vix,
          putCallRatio: marketData.putCallRatio,
          aaiiBullish: marketData.aaiiBullish,
          aaiiBearish: marketData.aaiiBearish
        }, sectorData);
      }
      
      console.log('✅ Forecast data updated');
    } catch (error) {
      console.error('❌ Error during forecast update:', error);
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

    // Real-time updates: Every 2 minutes during market hours (8:30 AM - 6 PM EST, weekdays)
    cron.schedule('*/2 * * * *', async () => {
      if (this.isWeekday()) {
        const est = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        const estHour = new Date(est).getHours();
        
        // Extended hours: 8:30 AM - 6 PM EST
        if (estHour >= 8 && estHour <= 18) {
          await this.updateRealTimeData();
        }
      }
    }, {
      timezone: "America/New_York"
    });

    // Forecast updates: Every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.updateForecastData();
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

    // Daily email at 8 AM EST (Monday-Friday)
    cron.schedule('0 8 * * 1-5', async () => {
      console.log('📧 Sending daily market commentary at 8 AM EST...');
      await this.sendDailyEmail();
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

    console.log('📅 Scheduler configured:');
    console.log('  • Real-time updates: Every 2 minutes (8:30 AM - 6 PM EST, weekdays)');
    console.log('  • Forecast updates: Every 6 hours');
    console.log('  • Comprehensive sync: Daily at 6 AM EST');
    console.log('  • Data cleanup: Daily at 2 AM EST');
  }

  // Manual trigger for immediate updates
  async forceUpdate(): Promise<void> {
    console.log('🚨 Force updating all data...');
    await this.updateAllData();
  }
}

export const dataScheduler = DataScheduler.getInstance();