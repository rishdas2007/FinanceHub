import { db } from '../db';
import { historicalStockData, historicalMarketSentiment } from '@shared/schema';
import { eq, gt, desc, asc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Historical Data Importer Service
 * Imports VIX, AAII sentiment, and SPY historical data from CSV files
 */
export class HistoricalDataImporter {
  private static instance: HistoricalDataImporter;
  
  static getInstance(): HistoricalDataImporter {
    if (!HistoricalDataImporter.instance) {
      HistoricalDataImporter.instance = new HistoricalDataImporter();
    }
    return HistoricalDataImporter.instance;
  }

  /**
   * Import VIX historical data from CSV
   */
  async importVIXData(csvPath: string): Promise<number> {
    console.log('📊 Starting VIX historical data import...');
    
    try {
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      let importedCount = 0;
      
      for (const line of dataLines) {
        if (!line.trim()) continue;
        
        const [dateStr, open, high, low, close] = line.split(',');
        if (!dateStr || !close) continue;
        
        try {
          const date = new Date(dateStr);
          const vixValue = parseFloat(close);
          
          if (isNaN(vixValue) || vixValue <= 0) continue;
          
          // Store in historical_market_sentiment table
          await db.insert(historicalMarketSentiment).values({
            date: date,
            vix: vixValue,
            putCallRatio: 0, // Will be updated later if available
            aaiiBullish: 0,  // Will be updated with AAII data
            aaiiBearish: 0
          }).onConflictDoUpdate({
            target: historicalMarketSentiment.date,
            set: {
              vix: vixValue
            }
          });
          
          importedCount++;
        } catch (error) {
          console.warn(`⚠️  Skipping invalid VIX row: ${line.substring(0, 50)}...`);
        }
      }
      
      console.log(`✅ VIX import completed: ${importedCount} records`);
      return importedCount;
    } catch (error) {
      console.error('❌ VIX import failed:', error);
      throw error;
    }
  }

  /**
   * Import AAII sentiment historical data from CSV
   */
  async importAAIIData(csvPath: string): Promise<number> {
    console.log('📊 Starting AAII sentiment historical data import...');
    
    try {
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      let importedCount = 0;
      
      for (const line of dataLines) {
        if (!line.trim()) continue;
        
        const columns = line.split(',');
        if (columns.length < 4) continue;
        
        const [dateStr, bullishStr, neutralStr, bearishStr] = columns;
        if (!dateStr || !bullishStr) continue;
        
        try {
          const date = new Date(dateStr);
          const bullish = parseFloat(bullishStr.replace('%', ''));
          const neutral = parseFloat(neutralStr.replace('%', ''));
          const bearish = parseFloat(bearishStr.replace('%', ''));
          
          if (isNaN(bullish) || isNaN(neutral) || isNaN(bearish)) continue;
          
          // Update existing VIX records or create new ones
          const dateStr = date.toISOString().split('T')[0];
          const existingRecord = await db.select().from(historicalMarketSentiment)
            .where(eq(historicalMarketSentiment.date, date)).limit(1);
          
          if (existingRecord.length > 0) {
            // Update existing record
            await db.update(historicalMarketSentiment)
              .set({
                aaiiBullish: bullish,
                aaiiBearish: bearish
              })
              .where(eq(historicalMarketSentiment.date, date));
          } else {
            // Create new record
            await db.insert(historicalMarketSentiment).values({
              date: date,
              vix: 0, // Will be updated with VIX data
              putCallRatio: 0,
              aaiiBullish: bullish,
              aaiiBearish: bearish
            }).onConflictDoNothing();
          }
          
          importedCount++;
        } catch (error) {
          console.warn(`⚠️  Skipping invalid AAII row: ${line.substring(0, 50)}...`);
        }
      }
      
      console.log(`✅ AAII import completed: ${importedCount} records`);
      return importedCount;
    } catch (error) {
      console.error('❌ AAII import failed:', error);
      throw error;
    }
  }

  /**
   * Import SPY historical data from CSV
   */
  async importSPYData(csvPath: string): Promise<number> {
    console.log('📊 Starting SPY historical data import...');
    
    try {
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // Skip header
      const dataLines = lines.slice(1);
      let importedCount = 0;
      
      for (const line of dataLines) {
        if (!line.trim()) continue;
        
        const columns = line.split(',');
        if (columns.length < 6) continue;
        
        const [dateStr, closeStr, volumeStr, openStr, highStr, lowStr] = columns;
        if (!dateStr || !closeStr) continue;
        
        try {
          const date = new Date(dateStr);
          const close = parseFloat(closeStr);
          const open = parseFloat(openStr);
          const high = parseFloat(highStr);
          const low = parseFloat(lowStr);
          const volume = parseInt(volumeStr);
          
          if (isNaN(close) || close <= 0) continue;
          
          await db.insert(historicalStockData).values({
            date: date,
            symbol: 'SPY',
            close: close,
            open: open,
            high: high,
            low: low,
            volume: volume || 0
          }).onConflictDoNothing();
          
          importedCount++;
        } catch (error) {
          console.warn(`⚠️  Skipping invalid SPY row: ${line.substring(0, 50)}...`);
        }
      }
      
      console.log(`✅ SPY import completed: ${importedCount} records`);
      return importedCount;
    } catch (error) {
      console.error('❌ SPY import failed:', error);
      throw error;
    }
  }

  /**
   * Import all historical data files
   */
  async importAllData(): Promise<{vix: number, aaii: number, spy: number}> {
    console.log('🚀 Starting comprehensive historical data import...');
    
    const vixPath = path.join(process.cwd(), 'attached_assets', 'VIX_History_1753144785433.csv');
    const aaiiPath = path.join(process.cwd(), 'attached_assets', 'sentiment readings_1753144785439.csv');
    const spyPath = path.join(process.cwd(), 'attached_assets', 'SPY_HistoricalData_1753144980967.csv');
    
    const results = {
      vix: 0,
      aaii: 0,
      spy: 0
    };
    
    try {
      // Import VIX data first
      if (fs.existsSync(vixPath)) {
        results.vix = await this.importVIXData(vixPath);
      }
      
      // Import AAII data
      if (fs.existsSync(aaiiPath)) {
        results.aaii = await this.importAAIIData(aaiiPath);
      }
      
      // Import SPY data
      if (fs.existsSync(spyPath)) {
        results.spy = await this.importSPYData(spyPath);
      }
      
      console.log('🎉 Historical data import completed successfully!');
      console.log(`📊 Imported: VIX: ${results.vix}, AAII: ${results.aaii}, SPY: ${results.spy}`);
      
      return results;
    } catch (error) {
      console.error('❌ Historical data import failed:', error);
      throw error;
    }
  }

  /**
   * Get data availability summary
   */
  async getDataAvailability(): Promise<{
    vixDays: number;
    aaiiRecords: number;
    spyDays: number;
    dateRange: { start: string; end: string };
  }> {
    try {
      // Count VIX records
      const vixCount = await db.select().from(historicalMarketSentiment)
        .where(gt(historicalMarketSentiment.vix, 0));
      
      // Count AAII records  
      const aaiiCount = await db.select().from(historicalMarketSentiment)
        .where(gt(historicalMarketSentiment.aaiiBullish, 0));
      
      // Count SPY records
      const spyCount = await db.select().from(historicalStockData)
        .where(eq(historicalStockData.symbol, 'SPY'));
      
      // Get date range
      const oldestVix = await db.select().from(historicalMarketSentiment)
        .where(gt(historicalMarketSentiment.vix, 0))
        .orderBy(asc(historicalMarketSentiment.date)).limit(1);
      
      const newestVix = await db.select().from(historicalMarketSentiment)
        .where(gt(historicalMarketSentiment.vix, 0))
        .orderBy(desc(historicalMarketSentiment.date)).limit(1);
      
      return {
        vixDays: vixCount.length,
        aaiiRecords: aaiiCount.length,
        spyDays: spyCount.length,
        dateRange: {
          start: oldestVix[0]?.date?.toISOString() || 'No data',
          end: newestVix[0]?.date?.toISOString() || 'No data'
        }
      };
    } catch (error) {
      console.error('❌ Failed to get data availability:', error);
      return {
        vixDays: 0,
        aaiiRecords: 0,
        spyDays: 0,
        dateRange: { start: 'Error', end: 'Error' }
      };
    }
  }
}

export const historicalDataImporter = HistoricalDataImporter.getInstance();