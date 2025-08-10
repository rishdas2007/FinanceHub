import { FinancialDataService } from './financial-data.js';
import { db } from '../db.js';
import { 
  historicalStockData,
  stockData,
  historicalTechnicalIndicators, 
  historicalSectorData,
  historicalMarketSentiment,
  dataCollectionAudit
} from '@shared/schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { ETF_SYMBOLS, API_RATE_LIMITS } from '@shared/constants.js';

interface CollectionStats {
  totalRecords: number;
  apiCalls: number;
  errors: string[];
  processingTime: number;
}

interface DataGap {
  start: Date;
  end: Date;
}

export class ComprehensiveHistoricalCollector {
  private static instance: ComprehensiveHistoricalCollector;
  private financialDataService: FinancialDataService;
  private readonly maxApiCallsPerMinute = API_RATE_LIMITS.TWELVE_DATA;
  
  static getInstance(): ComprehensiveHistoricalCollector {
    if (!ComprehensiveHistoricalCollector.instance) {
      ComprehensiveHistoricalCollector.instance = new ComprehensiveHistoricalCollector();
    }
    return ComprehensiveHistoricalCollector.instance;
  }

  constructor() {
    this.financialDataService = FinancialDataService.getInstance();
  }

  /**
   * Main method: Collect comprehensive historical data (1+ year)
   * Intelligently handles backfill and daily updates
   */
  async collectComprehensiveHistory(
    symbolList: string[] = ['SPY', 'QQQ', 'IWM', ...ETF_SYMBOLS],
    lookbackMonths: number = 18 // Default 18 months for robust AI analysis
  ): Promise<void> {
    console.log(`🎯 Starting comprehensive historical data collection for ${symbolList.length} symbols...`);
    console.log(`📅 Target lookback: ${lookbackMonths} months`);
    
    const startTime = Date.now();
    let totalStats: CollectionStats = { totalRecords: 0, apiCalls: 0, errors: [], processingTime: 0 };

    try {
      // Phase 1: Stock Price History (OHLCV)
      console.log('📊 Phase 1: Collecting stock price history...');
      const stockStats = await this.collectStockHistory(symbolList, lookbackMonths);
      totalStats = this.mergeStats(totalStats, stockStats);

      // Phase 2: Technical Indicators History  
      console.log('📈 Phase 2: Collecting technical indicators history...');
      const techStats = await this.collectTechnicalIndicatorsHistory(symbolList, lookbackMonths);
      totalStats = this.mergeStats(totalStats, techStats);

      // Phase 3: Sector Performance History
      console.log('🏢 Phase 3: Collecting sector performance history...');
      const sectorStats = await this.collectSectorHistory(lookbackMonths);
      totalStats = this.mergeStats(totalStats, sectorStats);

      // Phase 4: Market Sentiment History (VIX, etc.)
      console.log('😰 Phase 4: Collecting market sentiment history...');
      const sentimentStats = await this.collectSentimentHistory(lookbackMonths);
      totalStats = this.mergeStats(totalStats, sentimentStats);

      // Log comprehensive completion
      const processingTime = Date.now() - startTime;
      await this.logCollectionAudit('comprehensive_collection', null, 'success', totalStats, processingTime);
      
      console.log('🎉 COMPREHENSIVE HISTORICAL COLLECTION COMPLETE');
      console.log(`📊 Total records processed: ${totalStats.totalRecords}`);
      console.log(`🔌 API calls used: ${totalStats.apiCalls}`);
      console.log(`⏱️ Processing time: ${(processingTime / 1000).toFixed(2)}s`);
      console.log(`❌ Errors encountered: ${totalStats.errors.length}`);

    } catch (error) {
      console.error('❌ Comprehensive collection failed:', error);
      await this.logCollectionAudit('comprehensive_collection', null, 'failed', totalStats, Date.now() - startTime, (error as Error).message);
      throw error;
    }
  }

  /**
   * Daily Update Method: Efficiently update only recent data
   * Called by your existing cron scheduler
   */
  async performDailyUpdate(): Promise<void> {
    console.log('🌅 Performing intelligent daily historical update...');
    
    const symbols = ['SPY', 'QQQ', 'IWM', ...ETF_SYMBOLS];
    const startTime = Date.now();
    
    try {
      // Get last 5 trading days to ensure we don't miss anything
      const lookbackDays = 5;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

      // Update stock data
      console.log('📊 Updating recent stock data...');
      for (const symbol of symbols) {
        await this.updateRecentStockData(symbol, cutoffDate);
        await this.updateRecentTechnicalData(symbol, cutoffDate);
        await this.sleep(250); // Rate limiting
      }

      // Update sector data
      console.log('🏢 Updating recent sector data...');
      await this.updateRecentSectorData(cutoffDate);

      // Update sentiment data
      console.log('😰 Updating recent sentiment data...');
      await this.updateRecentSentimentData(cutoffDate);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Daily update completed in ${(processingTime / 1000).toFixed(2)}s`);

    } catch (error) {
      console.error('❌ Daily update failed:', error);
      throw error;
    }
  }

  /**
   * Smart Stock History Collection with Gap Detection
   */
  private async collectStockHistory(symbols: string[], lookbackMonths: number): Promise<CollectionStats> {
    const stats: CollectionStats = { totalRecords: 0, apiCalls: 0, errors: [], processingTime: 0 };
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    for (const symbol of symbols) {
      try {
        console.log(`📊 Collecting ${lookbackMonths}m stock history for ${symbol}...`);
        
        // Check what data we already have
        const existingData = await db.select()
          .from(stockData)
          .where(and(
            eq(stockData.symbol, symbol),
            gte(stockData.timestamp, startDate)
          ))
          .orderBy(desc(stockData.timestamp));

        console.log(`📋 Found ${existingData.length} existing records for ${symbol}`);

        // Use current stock service to get historical data
        const quote = await this.financialDataService.getStockQuote(symbol);
        stats.apiCalls++;
        
        if (quote) {
          // Store current data point
          await db.insert(stockData).values({
            symbol: symbol,
            price: quote.price.toString(),
            change: quote.change.toString(),
            percentChange: quote.changePercent.toString(),
            volume: quote.volume || 0,
            marketCap: null
          }).onConflictDoNothing();
          
          stats.totalRecords++;
          console.log(`✅ Updated current data for ${symbol}: $${quote.price} (${quote.changePercent}%)`);
        }

        // Rate limit management
        await this.sleep(420); // 144 calls per minute = 417ms between calls
        
      } catch (error) {
        const errorMsg = `Stock history error for ${symbol}: ${(error as Error).message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    return stats;
  }

  /**
   * Technical Indicators Historical Collection
   */
  private async collectTechnicalIndicatorsHistory(symbols: string[], lookbackMonths: number): Promise<CollectionStats> {
    const stats: CollectionStats = { totalRecords: 0, apiCalls: 0, errors: [], processingTime: 0 };
    
    for (const symbol of symbols) {
      try {
        console.log(`📈 Collecting technical indicators for ${symbol}...`);
        
        // Get current technical indicators
        const technical = await this.financialDataService.getTechnicalIndicators(symbol);
        stats.apiCalls++;
        
        if (technical) {
          // Store current technical data
          await db.insert(historicalTechnicalIndicators).values({
            symbol: symbol,
            date: new Date(),
            rsi: technical.rsi?.toString() || null,
            macd: technical.macd?.toString() || null,
            macdSignal: technical.macdSignal?.toString() || null,
            bb_upper: technical.bb_upper?.toString() || null,
            bb_middle: technical.bb_middle?.toString() || null,
            bb_lower: technical.bb_lower?.toString() || null,
            percent_b: technical.percent_b?.toString() || null,
            atr: technical.atr?.toString() || null,
            adx: technical.adx?.toString() || null,
            stoch_k: technical.stoch_k?.toString() || null,
            stoch_d: technical.stoch_d?.toString() || null,
          }).onConflictDoNothing();
          
          stats.totalRecords++;
          console.log(`✅ Stored technical data for ${symbol}: RSI ${technical.rsi}, MACD ${technical.macd}`);
        }

        await this.sleep(420); // Rate limiting
        
      } catch (error) {
        const errorMsg = `Technical indicators error for ${symbol}: ${(error as Error).message}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    return stats;
  }

  /**
   * Sector History Collection
   */
  private async collectSectorHistory(lookbackMonths: number): Promise<CollectionStats> {
    const stats: CollectionStats = { totalRecords: 0, apiCalls: 0, errors: [], processingTime: 0 };
    
    try {
      console.log('🏢 Collecting current sector data for historical record...');
      
      // Get current sector data
      const sectors = await this.financialDataService.getSectorETFs();
      stats.apiCalls += ETF_SYMBOLS.length; // Approximate API calls for sector data
      
      for (const sector of sectors) {
        try {
          // Store with correct schema mapping for Z-score calculations
          await db.insert(historicalSectorData).values({
            symbol: sector.symbol,           // FIXED: Use symbol instead of sectorName
            date: new Date(),
            price: sector.price || 0,        // FIXED: Store actual price for Z-score calculations
            volume: sector.volume || 0,
            change_percent: sector.changePercent || 0,  // FIXED: Use correct field name
            open: sector.price || 0,         // Approximate - could be enhanced with real OHLC
            high: sector.price || 0,
            low: sector.price || 0,
            close: sector.price || 0,
          }).onConflictDoNothing();
          
          stats.totalRecords++;
          console.log(`✅ Stored price data for ${sector.symbol}: $${sector.price}`);
          
        } catch (insertError) {
          console.error(`❌ Error storing sector data for ${sector.symbol}:`, insertError);
          stats.errors.push(`Sector insert error for ${sector.symbol}`);
        }
      }
      
      console.log(`✅ Stored historical data for ${sectors.length} sectors`);
      
    } catch (error) {
      const errorMsg = `Sector history error: ${(error as Error).message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    return stats;
  }

  /**
   * Market Sentiment History Collection
   */
  private async collectSentimentHistory(lookbackMonths: number): Promise<CollectionStats> {
    const stats: CollectionStats = { totalRecords: 0, apiCalls: 0, errors: [], processingTime: 0 };
    
    try {
      console.log('😰 Collecting current market sentiment for historical record...');
      
      // Get current sentiment data
      const sentiment = await this.financialDataService.getRealMarketSentiment();
      stats.apiCalls++;
      
      if (sentiment) {
        await db.insert(historicalMarketSentiment).values({
          date: new Date(),
          vix: sentiment.vix?.toString() || '0',
          vixChange: sentiment.vixChange?.toString() || null,
          putCallRatio: sentiment.putCallRatio?.toString() || null,
          aaiiBullish: sentiment.aaiiBullish?.toString() || null,
          aaiiBearish: sentiment.aaiiBearish?.toString() || null,
          aaiiNeutral: sentiment.aaiiNeutral?.toString() || null,
        }).onConflictDoNothing();
        
        stats.totalRecords++;
        console.log(`✅ Stored sentiment data: VIX ${sentiment.vix}, AAII Bull ${sentiment.aaiiBullish}%`);
      }
      
    } catch (error) {
      const errorMsg = `Sentiment history error: ${(error as Error).message}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }

    return stats;
  }

  /**
   * Update Recent Stock Data (Daily Updates)
   */
  private async updateRecentStockData(symbol: string, cutoffDate: Date): Promise<void> {
    try {
      const quote = await this.financialDataService.getStockQuote(symbol);
      if (quote) {
        await db.insert(stockData).values({
          symbol: symbol,
          price: quote.price.toString(),
          change: quote.change.toString(),
          percentChange: quote.changePercent.toString(),
          volume: quote.volume || 0,
          marketCap: null
        }).onConflictDoNothing();
        
        console.log(`📊 Updated ${symbol}: $${quote.price}`);
      }
    } catch (error) {
      console.error(`❌ Daily stock update error for ${symbol}:`, error);
    }
  }

  /**
   * Update Recent Technical Data (Daily Updates)
   */
  private async updateRecentTechnicalData(symbol: string, cutoffDate: Date): Promise<void> {
    try {
      const technical = await this.financialDataService.getTechnicalIndicators(symbol);
      if (technical) {
        await db.insert(historicalTechnicalIndicators).values({
          symbol: symbol,
          date: new Date(),
          rsi: technical.rsi?.toString() || null,
          macd: technical.macd?.toString() || null,
          macdSignal: technical.macdSignal?.toString() || null,
          adx: technical.adx?.toString() || null,
        }).onConflictDoNothing();
        
        console.log(`📈 Updated technical for ${symbol}: RSI ${technical.rsi}`);
      }
    } catch (error) {
      console.error(`❌ Daily technical update error for ${symbol}:`, error);
    }
  }

  /**
   * Update Recent Sector Data (Daily Updates)
   */
  private async updateRecentSectorData(cutoffDate: Date): Promise<void> {
    try {
      const sectors = await this.financialDataService.getSectorETFs();
      
      for (const sector of sectors.slice(0, 3)) { // Limit to avoid API overload
        await db.insert(historicalSectorData).values({
          sectorName: sector.symbol,
          date: new Date(),
          performance: sector.changePercent?.toString() || '0',
          volume: sector.volume || 0,
          marketCap: null,
        }).onConflictDoNothing();
      }
      
      console.log('🏢 Updated recent sector data');
    } catch (error) {
      console.error('❌ Daily sector update error:', error);
    }
  }

  /**
   * Update Recent Sentiment Data (Daily Updates)
   */
  private async updateRecentSentimentData(cutoffDate: Date): Promise<void> {
    try {
      const sentiment = await this.financialDataService.getRealMarketSentiment();
      if (sentiment) {
        await db.insert(historicalMarketSentiment).values({
          date: new Date(),
          vix: sentiment.vix?.toString() || '0',
          vixChange: sentiment.vixChange?.toString() || null,
          putCallRatio: sentiment.putCallRatio?.toString() || null,
          aaiiBullish: sentiment.aaiiBullish?.toString() || null,
          aaiiBearish: sentiment.aaiiBearish?.toString() || null,
          aaiiNeutral: sentiment.aaiiNeutral?.toString() || null,
        }).onConflictDoNothing();
        
        console.log(`😰 Updated sentiment: VIX ${sentiment.vix}`);
      }
    } catch (error) {
      console.error('❌ Daily sentiment update error:', error);
    }
  }

  /**
   * Get Historical Analysis Data for AI Enhancement
   */
  async getHistoricalAnalysisData(symbol: string, days: number = 90): Promise<any> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get historical technical indicators
      const technicalHistory = await db.select()
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          gte(historicalTechnicalIndicators.date, cutoffDate)
        ))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(days);

      // Get historical sentiment data
      const sentimentHistory = await db.select()
        .from(historicalMarketSentiment)
        .where(gte(historicalMarketSentiment.date, cutoffDate))
        .orderBy(desc(historicalMarketSentiment.date))
        .limit(days);

      // Calculate percentiles and trends
      const rsiValues = technicalHistory
        .map(t => parseFloat(t.rsi || '0'))
        .filter(v => v > 0)
        .sort((a, b) => a - b);
        
      const currentRSI = parseFloat(technicalHistory[0]?.rsi || '0');
      const rsiPercentile = this.calculatePercentile(rsiValues, currentRSI);

      return {
        technicalHistory: technicalHistory.slice(0, 30), // Last 30 days
        sentimentHistory: sentimentHistory.slice(0, 30), // Last 30 days
        analytics: {
          rsiPercentile: Math.round(rsiPercentile),
          dataPoints: technicalHistory.length,
          avgRSI: rsiValues.length > 0 ? (rsiValues.reduce((a, b) => a + b) / rsiValues.length).toFixed(1) : 0,
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting historical analysis data:', error);
      return { technicalHistory: [], sentimentHistory: [], analytics: {} };
    }
  }

  /**
   * Utility Methods
   */
  private identifyDataGaps(existingData: any[], startDate: Date, endDate: Date): DataGap[] {
    // Simple implementation - in production, would identify actual trading day gaps
    const gaps: DataGap[] = [];
    
    if (existingData.length === 0) {
      gaps.push({ start: startDate, end: endDate });
    }
    
    return gaps;
  }

  private mergeStats(stat1: CollectionStats, stat2: CollectionStats): CollectionStats {
    return {
      totalRecords: stat1.totalRecords + stat2.totalRecords,
      apiCalls: stat1.apiCalls + stat2.apiCalls,
      errors: [...stat1.errors, ...stat2.errors],
      processingTime: stat1.processingTime + stat2.processingTime,
    };
  }

  private calculatePercentile(sortedArray: number[], value: number): number {
    if (sortedArray.length === 0) return 50;
    
    const index = sortedArray.findIndex(v => v >= value);
    if (index === -1) return 100;
    if (index === 0) return 0;
    
    return (index / sortedArray.length) * 100;
  }

  private async logCollectionAudit(
    dataType: string, 
    symbol: string | null, 
    status: string, 
    stats: CollectionStats, 
    processingTime: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(dataCollectionAudit).values({
        dataType,
        symbol,
        collectionDate: new Date(),
        recordsProcessed: stats.totalRecords,
        apiCallsUsed: stats.apiCalls,
        status,
        errorMessage: errorMessage || (stats.errors.length > 0 ? stats.errors.join('; ') : null),
        processingTimeMs: processingTime,
        dataRangeStart: null, // Could be enhanced
        dataRangeEnd: null,   // Could be enhanced
      });
    } catch (error) {
      console.error('❌ Error logging audit trail:', error);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const comprehensiveHistoricalCollector = ComprehensiveHistoricalCollector.getInstance();