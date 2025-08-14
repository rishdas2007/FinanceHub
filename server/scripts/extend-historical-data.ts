#!/usr/bin/env tsx
/**
 * Extended Historical Data Collection Script
 * Specifically designed to collect additional historical data
 * to push ETFs from 30 records to 63+ records for high reliability
 */

import { logger } from '../utils/logger';
import { db } from '../db.js';
import { historicalStockData } from '@shared/schema';
import { FinancialDataService } from '../services/financial-data';
import { desc, eq, and, lt } from 'drizzle-orm';

interface ExtendedBackfillResult {
  symbol: string;
  previousRecords: number;
  newRecords: number;
  totalRecords: number;
  reliabilityStatus: string;
  earliestDate: string;
  latestDate: string;
}

class ExtendedHistoricalDataCollector {
  private financialDataService: FinancialDataService;
  private readonly ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
  private readonly TARGET_RECORDS = 63; // For ETF high reliability
  private readonly BATCH_SIZE = 20;
  private readonly API_DELAY_MS = 1500; // Respect rate limits

  constructor() {
    this.financialDataService = FinancialDataService.getInstance();
  }

  /**
   * Collect additional historical data to reach target reliability
   */
  async extendHistoricalData(): Promise<ExtendedBackfillResult[]> {
    logger.info('🎯 Starting extended historical data collection');
    logger.info(`📊 Target: ${this.TARGET_RECORDS} records per symbol for high reliability`);
    
    const results: ExtendedBackfillResult[] = [];
    
    for (const symbol of this.ETF_SYMBOLS) {
      try {
        logger.info(`🔄 Processing ${symbol}...`);
        
        // Check current data status
        const currentData = await db
          .select()
          .from(historicalStockData)
          .where(eq(historicalStockData.symbol, symbol))
          .orderBy(desc(historicalStockData.date));
          
        const currentCount = currentData.length;
        logger.info(`📊 ${symbol}: Current records = ${currentCount}`);
        
        if (currentCount >= this.TARGET_RECORDS) {
          logger.info(`✅ ${symbol}: Already has sufficient data (${currentCount} records)`);
          results.push({
            symbol,
            previousRecords: currentCount,
            newRecords: 0,
            totalRecords: currentCount,
            reliabilityStatus: 'HIGH RELIABILITY',
            earliestDate: currentData[currentData.length - 1]?.date || '',
            latestDate: currentData[0]?.date || ''
          });
          continue;
        }
        
        // Calculate how many more records we need
        const recordsNeeded = this.TARGET_RECORDS - currentCount;
        logger.info(`📈 ${symbol}: Need ${recordsNeeded} more records for high reliability`);
        
        // Get the earliest date in current data to extend backwards
        const earliestCurrentDate = currentData[currentData.length - 1]?.date;
        logger.info(`📅 ${symbol}: Extending backwards from ${earliestCurrentDate}`);
        
        // Collect additional historical data going further back
        const newRecords = await this.collectExtendedHistoricalData(symbol, recordsNeeded, earliestCurrentDate);
        
        // Get updated count
        const updatedData = await db
          .select()
          .from(historicalStockData)
          .where(eq(historicalStockData.symbol, symbol));
          
        const finalCount = updatedData.length;
        const reliabilityStatus = finalCount >= this.TARGET_RECORDS ? 'HIGH RELIABILITY ✅' : 
                                 finalCount >= 45 ? 'APPROACHING HIGH' : 'MEDIUM';
        
        results.push({
          symbol,
          previousRecords: currentCount,
          newRecords,
          totalRecords: finalCount,
          reliabilityStatus,
          earliestDate: updatedData.sort((a, b) => a.date.localeCompare(b.date))[0]?.date || '',
          latestDate: updatedData.sort((a, b) => b.date.localeCompare(a.date))[0]?.date || ''
        });
        
        logger.info(`🎉 ${symbol}: ${currentCount} → ${finalCount} records (${reliabilityStatus})`);
        
        // Rate limiting delay
        await this.sleep(this.API_DELAY_MS);
        
      } catch (error) {
        logger.error(`❌ Failed to extend data for ${symbol}:`, error);
        results.push({
          symbol,
          previousRecords: 0,
          newRecords: 0,
          totalRecords: 0,
          reliabilityStatus: 'ERROR',
          earliestDate: '',
          latestDate: ''
        });
      }
    }
    
    // Summary
    const highReliability = results.filter(r => r.totalRecords >= this.TARGET_RECORDS).length;
    const totalNewRecords = results.reduce((sum, r) => sum + r.newRecords, 0);
    
    logger.info('🎯 Extended Historical Data Collection Complete');
    logger.info(`📊 Symbols with high reliability: ${highReliability}/${this.ETF_SYMBOLS.length}`);
    logger.info(`📈 Total new records collected: ${totalNewRecords}`);
    
    return results;
  }
  
  /**
   * Collect additional historical data for a specific symbol
   */
  private async collectExtendedHistoricalData(symbol: string, recordsNeeded: number, fromDate: string): Promise<number> {
    logger.info(`📡 Collecting ${recordsNeeded} additional records for ${symbol}`);
    
    try {
      // Calculate how far back we need to go (approximately)
      const daysToGoBack = Math.ceil(recordsNeeded * 1.4); // Buffer for weekends/holidays
      const startDate = new Date(fromDate);
      startDate.setDate(startDate.getDate() - daysToGoBack);
      
      logger.info(`📅 ${symbol}: Fetching data from ${startDate.toISOString().split('T')[0]} to ${fromDate}`);
      
      // Fetch historical data using the financial service
      const historicalData = await this.financialDataService.getHistoricalData(symbol, '1year');
      
      if (!historicalData || historicalData.length === 0) {
        logger.warn(`⚠️ ${symbol}: No additional historical data received`);
        return 0;
      }
      
      // Filter to get only data before our current earliest date
      const newData = historicalData.filter(record => record.date < fromDate);
      
      if (newData.length === 0) {
        logger.warn(`⚠️ ${symbol}: No new historical data before ${fromDate}`);
        return 0;
      }
      
      // Sort by date and take the most recent records we need
      const sortedNewData = newData
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, recordsNeeded);
      
      logger.info(`📊 ${symbol}: Processing ${sortedNewData.length} new records`);
      
      // Insert new records into database
      let insertedCount = 0;
      for (const record of sortedNewData) {
        try {
          // Check if record already exists to avoid duplicates
          const existing = await db
            .select()
            .from(historicalStockData)
            .where(and(
              eq(historicalStockData.symbol, symbol),
              eq(historicalStockData.date, record.date)
            ));
            
          if (existing.length === 0) {
            await db.insert(historicalStockData).values({
              symbol,
              date: record.date,
              open: record.open,
              high: record.high,
              low: record.low,
              close: record.close,
              volume: record.volume
            });
            insertedCount++;
          }
        } catch (insertError) {
          logger.warn(`⚠️ ${symbol}: Failed to insert record for ${record.date}:`, insertError);
        }
      }
      
      logger.info(`✅ ${symbol}: Successfully inserted ${insertedCount} new records`);
      return insertedCount;
      
    } catch (error) {
      logger.error(`❌ ${symbol}: Failed to collect extended historical data:`, error);
      return 0;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const collector = new ExtendedHistoricalDataCollector();
  collector.extendHistoricalData()
    .then(results => {
      console.log('\n🎯 Extended Historical Data Collection Results:');
      results.forEach(result => {
        console.log(`${result.symbol}: ${result.previousRecords} → ${result.totalRecords} records (${result.reliabilityStatus})`);
      });
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Extended data collection failed:', error);
      process.exit(1);
    });
}

export { ExtendedHistoricalDataCollector };