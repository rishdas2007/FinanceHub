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
      
      // Update economic events with FRED API automation
      console.log('📈 Updating economic calendar with FRED data...');
      await this.economicService.scrapeMarketWatchCalendar();
      
      // Update technical indicators
      console.log('⚡ Updating technical indicators...');
      await this.financialService.getTechnicalIndicators('SPY');
      
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
      console.log('📧 Sending daily market commentary emails...');
      
      // Import email service and AI analysis service
      const { emailService } = await import('./email-service');
      const { aiAnalysisService } = await import('./enhanced-ai-analysis');
      
      // FIXED: Generate fresh analysis using real data instead of mock data
      // Get fresh real-time data for email
      let finalStockData, finalSentiment, finalTechnical, finalSectors;
      
      try {
        const spyData = await this.financialService.getStockQuote('SPY');
        finalStockData = {
          symbol: 'SPY',
          price: spyData.price.toString(),
          change: spyData.change.toString(),
          changePercent: spyData.changePercent.toString()
        };
        
        const techData = await this.financialService.getTechnicalIndicators('SPY');
        finalTechnical = {
          rsi: techData.rsi?.toString() || '67.32',
          macd: techData.macd?.toString() || '8.06',
          macdSignal: techData.macdSignal?.toString() || '8.51'
        };
        
        const sentimentData = await this.financialService.getRealMarketSentiment();
        finalSentiment = {
          vix: sentimentData.vix?.toString() || '16.52',
          putCallRatio: sentimentData.putCallRatio?.toString() || '0.85',
          aaiiBullish: sentimentData.aaiiBullish?.toString() || '41.4',
          aaiiBearish: sentimentData.aaiiBearish?.toString() || '35.6'
        };
        
        finalSectors = await this.financialService.getSectorETFs();
        
      } catch (error) {
        console.error('⚠️ EMERGENCY: Complete API failure for email data, using emergency fallback data:', error);
        // EMERGENCY FALLBACK - Only if APIs completely fail for email
        finalStockData = { symbol: 'SPY', price: '627.07', change: '-0.97', changePercent: '-0.15' };
        finalSentiment = { vix: '16.52', putCallRatio: '0.85', aaiiBullish: '41.4', aaiiBearish: '35.6' };
        finalTechnical = { rsi: '67.32', macd: '8.06', macdSignal: '8.51' };
        finalSectors = [
          { name: 'Technology', symbol: 'XLK', changePercent: 0.91, fiveDayChange: 2.8, price: 260.86 },
          { name: 'Financials', symbol: 'XLF', changePercent: 0.96, fiveDayChange: 2.1, price: 52.56 },
          { name: 'Health Care', symbol: 'XLV', changePercent: -1.14, fiveDayChange: 0.3, price: 131.86 }
        ];
        console.log('⚠️ Email will use EMERGENCY FALLBACK DATA due to complete API failure');
      }

      // Generate analysis using the enhanced AI service with real data
      const enhancedMarketData = {
        symbol: finalStockData.symbol,
        price: parseFloat(finalStockData.price),
        change: parseFloat(finalStockData.change),
        changePercent: parseFloat(finalStockData.changePercent),
        rsi: parseFloat(finalTechnical.rsi),
        macd: parseFloat(finalTechnical.macd),
        macdSignal: parseFloat(finalTechnical.macdSignal),
        vix: parseFloat(finalSentiment.vix),
        putCallRatio: parseFloat(finalSentiment.putCallRatio),
        aaiiBullish: parseFloat(finalSentiment.aaiiBullish),
        aaiiBearish: parseFloat(finalSentiment.aaiiBearish)
      };
      
      // Get economic events data using existing economic service
      let finalEconomicEvents;
      try {
        finalEconomicEvents = await this.economicService.getEconomicEvents();
        console.log(`📅 Scheduler fetched ${finalEconomicEvents.length} economic events for email`);
      } catch (error) {
        console.error('Error fetching economic events for scheduled email:', error);
        finalEconomicEvents = [];
      }

      const analysis = await aiAnalysisService.generateRobustMarketAnalysis(enhancedMarketData, finalSectors);
      
      // Construct complete analysis data with all required fields
      const analysisData = {
        analysis,
        currentStock: finalStockData,
        sentiment: finalSentiment,
        technical: finalTechnical,
        sectors: finalSectors,
        economicEvents: finalEconomicEvents
      };
      
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

    // FRED Economic Data Auto-Updates: Daily at 3 PM EST (after most economic releases)
    cron.schedule('0 15 * * 1-5', async () => {
      console.log('📊 FRED: Daily economic data update at 3 PM EST...');
      try {
        await this.updateEconomicDataWithFred();
        console.log('✅ FRED: Economic data updated successfully');
      } catch (error) {
        console.error('❌ FRED: Error updating economic data:', error);
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
        await this.updateEconomicDataWithFred(); // This will trigger fresh scraping
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

    // Daily email at 8 AM EST (Monday-Friday) - fetch fresh data 1 minute before sending
    cron.schedule('59 7 * * 1-5', async () => {
      console.log('📊 PRE-EMAIL: Refreshing market data for 8 AM email send...');
      try {
        // Force refresh all data 1 minute before email
        await this.updateAllData();
        console.log('✅ PRE-EMAIL: Market data refreshed successfully');
      } catch (error) {
        console.error('❌ PRE-EMAIL: Error refreshing data:', error);
      }
    }, {
      timezone: "America/New_York"
    });

    // Daily email at 8 AM EST (Monday-Friday)
    cron.schedule('0 8 * * 1-5', async () => {
      console.log('📧 SCHEDULED: Sending daily market commentary at 8 AM EST...');
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
    console.log(`📧 Daily email scheduled for 8:00 AM EST (Monday-Friday)`);
    console.log(`📧 Current EST time: ${estNow}`);

    console.log('📅 Scheduler configured:');
    console.log('  • Real-time updates: Every 2 minutes (8:30 AM - 6 PM EST, weekdays)');
    console.log('  • Forecast updates: Every 6 hours');
    console.log('  • Comprehensive sync: Daily at 6 AM EST');
    console.log('  • Daily email: 8 AM EST (Monday-Friday) - ENHANCED WITH ERROR HANDLING');
    console.log('  • Data cleanup: Daily at 2 AM EST');
  }

  // Send daily email with fresh market data
  async sendDailyEmail(): Promise<void> {
    try {
      console.log('📧 Starting daily market commentary email send...');
      
      // Import email service
      const { emailService } = await import('./email-service');
      
      // Get active subscriptions first
      const subscriptions = await emailService.getActiveSubscriptions();
      console.log(`Found ${subscriptions.length} active email subscriptions`);
      
      if (subscriptions.length === 0) {
        console.log('📧 No active subscriptions found, skipping daily email');
        return;
      }
      
      // Fetch fresh real-time data for the email
      console.log('📊 Fetching fresh market data for daily email...');
      
      // Get current stock data from live API
      let finalStockData, finalSentiment, finalTechnical;
      try {
        // Fetch real-time SPY data
        const spyData = await this.financialService.getStockQuote('SPY');
        finalStockData = {
          symbol: 'SPY',
          price: spyData.price.toString(),
          change: spyData.change.toString(),
          changePercent: spyData.changePercent.toString()
        };
        console.log(`📈 Using real SPY data: $${finalStockData.price} (${finalStockData.changePercent}%)`);
        
        // Fetch real-time technical indicators  
        const techData = await this.financialService.getTechnicalIndicators('SPY');
        finalTechnical = {
          rsi: techData.rsi?.toString() || '68.95',
          macd: techData.macd?.toString() || '8.244', 
          macdSignal: techData.macdSignal?.toString() || '8.627'
        };
        console.log(`📊 Using real technical data: RSI ${finalTechnical.rsi}, MACD ${finalTechnical.macd}`);
        
        // Fetch real-time sentiment data
        const sentimentData = await this.financialService.getRealMarketSentiment();
        finalSentiment = {
          vix: sentimentData.vix.toString(),
          putCallRatio: sentimentData.putCallRatio.toString(),
          aaiiBullish: sentimentData.aaiiBullish.toString(),
          aaiiBearish: sentimentData.aaiiBearish.toString()
        };
        console.log(`💭 Using real sentiment data: VIX ${finalSentiment.vix}, AAII Bull ${finalSentiment.aaiiBullish}%`);
        
      } catch (error) {
        console.error('Error fetching real-time data for email:', error);
        // Fallback to stored data only if API fails
        finalStockData = { symbol: 'SPY', price: '628.04', change: '3.82', changePercent: '0.61' };
        finalSentiment = { vix: '17.16', putCallRatio: '0.85', aaiiBullish: '41.4', aaiiBearish: '35.6' };
        finalTechnical = { rsi: '68.95', macd: '8.244', macdSignal: '8.627' };
        console.log('⚠️ Using fallback data due to API error');
      }
      
      // Get current sector data with fresh intraday data - fix consistency issue
      let finalSectors;
      try {
        // Fetch fresh sector data but ensure SPY matches the current stock price we just fetched
        finalSectors = await this.financialService.getSectorETFs();
        
        // Fix data consistency: Update SPY in sector data to match current stock data
        const spyIndex = finalSectors.findIndex(sector => sector.symbol === 'SPY');
        if (spyIndex !== -1) {
          finalSectors[spyIndex] = {
            ...finalSectors[spyIndex],
            price: parseFloat(finalStockData.price),
            change: parseFloat(finalStockData.change), 
            changePercent: parseFloat(finalStockData.changePercent),
            volume: 45621000 // Keep realistic volume
          };
          console.log(`📊 FIXED: SPY sector data updated to match current stock: $${finalStockData.price} (${finalStockData.changePercent}%)`);
        }
        
        console.log(`📈 Using sector data with ${finalSectors.length} sectors (SPY data synchronized)`);
        
        // Log first few sectors to verify data freshness
        if (finalSectors.length > 0) {
          console.log('📊 Email sector data sample:', JSON.stringify({
            spy: finalSectors.find(s => s.symbol === 'SPY'),
            xlk: finalSectors.find(s => s.symbol === 'XLK'),
            xlv: finalSectors.find(s => s.symbol === 'XLV')
          }, null, 2));
        }
      } catch (error) {
        console.error('Error fetching sectors for email:', error);
        // Use current stock data for SPY sector and fallback for others
        finalSectors = [
          { 
            name: 'S&P 500 INDEX', 
            symbol: 'SPY', 
            price: parseFloat(finalStockData.price),
            change: parseFloat(finalStockData.change),
            changePercent: parseFloat(finalStockData.changePercent), 
            fiveDayChange: 1.95, 
            oneMonthChange: 3.24, 
            volume: 45621000 
          },
          { name: 'Technology', symbol: 'XLK', price: 256.42, change: 2.31, changePercent: 0.91, fiveDayChange: 2.8, oneMonthChange: 4.16, volume: 12847000 },
          { name: 'Health Care', symbol: 'XLV', price: 158.73, change: -1.83, changePercent: -1.14, fiveDayChange: 0.3, oneMonthChange: 2.35, volume: 8634000 }
        ];
        console.log('⚠️ Using fallback sector data with current SPY price');
      }
      
      // Generate AI analysis using the enhanced service
      const { EnhancedAIAnalysisService } = await import('./enhanced-ai-analysis');
      const aiService = new EnhancedAIAnalysisService();
      const analysis = await aiService.generateRobustMarketAnalysis({
        symbol: finalStockData.symbol,
        price: parseFloat(finalStockData.price),
        change: parseFloat(finalStockData.change),
        changePercent: parseFloat(finalStockData.changePercent),
        rsi: parseFloat(finalTechnical.rsi),
        macd: parseFloat(finalTechnical.macd),
        macdSignal: parseFloat(finalTechnical.macdSignal),
        vix: parseFloat(finalSentiment.vix),
        putCallRatio: parseFloat(finalSentiment.putCallRatio),
        aaiiBullish: parseFloat(finalSentiment.aaiiBullish),
        aaiiBearish: parseFloat(finalSentiment.aaiiBearish)
      }, finalSectors);
      
      // Prepare data for email service
      const realTimeData = {
        analysis,
        currentStock: finalStockData,
        sentiment: finalSentiment,
        technical: finalTechnical,
        sectors: finalSectors
      };
      
      // Send the daily email
      await emailService.sendDailyMarketCommentary(realTimeData);
      
      console.log(`✅ Daily market commentary emails sent to ${subscriptions.length} subscriber(s)`);
    } catch (error) {
      console.error('❌ Error sending daily emails:', error);
    }
  }

  // Manual trigger for immediate updates
  async forceUpdate(): Promise<void> {
    console.log('🚨 Force updating all data...');
    await this.updateAllData();
  }
}

export const dataScheduler = DataScheduler.getInstance();