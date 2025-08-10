#!/usr/bin/env tsx

/**
 * ETF Data Integration Script - 10 Year Historical Datasets
 * 
 * Integrates comprehensive 10-year historical datasets to replace API-limited data:
 * - historical_sector_data_10_years.csv (31,320 records, 2015-2025)
 * - historical_technical_indicators_10_years.csv (6,000 records, 2023-2025)
 * - zscore_technical_indicators_10_years.csv (5,760 records, 2023-2025)
 * 
 * This addresses the critical data sufficiency issue where API limitations 
 * restricted historical data to 42-day windows vs the required 252+ days for 
 * reliable z-score calculations.
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { 
  historicalSectorData, 
  historicalTechnicalIndicators, 
  zscoreTechnicalIndicators 
} from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const db = drizzle(neon(process.env.DATABASE_URL));

interface IntegrationStats {
  sectorData: { processed: number; inserted: number; skipped: number };
  technicalIndicators: { processed: number; inserted: number; skipped: number };
  zscoreIndicators: { processed: number; inserted: number; skipped: number };
  totalRecords: number;
  executionTime: number;
}

class DatasetIntegrator {
  private stats: IntegrationStats = {
    sectorData: { processed: 0, inserted: 0, skipped: 0 },
    technicalIndicators: { processed: 0, inserted: 0, skipped: 0 },
    zscoreIndicators: { processed: 0, inserted: 0, skipped: 0 },
    totalRecords: 0,
    executionTime: 0
  };

  /**
   * Parse CSV data with proper type conversion
   */
  private parseCsvFile(filePath: string): any[] {
    console.log(`📄 Reading CSV file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true
    });
    
    console.log(`✅ Parsed ${records.length} records from ${path.basename(filePath)}`);
    return records;
  }

  /**
   * Clean and normalize date strings from CSV
   */
  private parseDate(dateStr: string): Date {
    // Remove extra quotes and parse ISO date
    const cleanDate = dateStr.replace(/"/g, '');
    return new Date(cleanDate);
  }

  /**
   * Convert string to decimal with null handling
   */
  private parseDecimal(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value.toString());
    return isNaN(num) ? null : num.toString();
  }

  /**
   * Convert string to integer with null handling
   */
  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value.toString());
    return isNaN(num) ? null : num;
  }

  /**
   * Clear existing historical data before import
   */
  private async clearExistingData(): Promise<void> {
    console.log('🗑️ Clearing existing historical data...');
    
    try {
      await db.delete(zscoreTechnicalIndicators);
      console.log('✅ Cleared zscore_technical_indicators table');
      
      await db.delete(historicalTechnicalIndicators);
      console.log('✅ Cleared historical_technical_indicators table');
      
      await db.delete(historicalSectorData);
      console.log('✅ Cleared historical_sector_data table');
      
      console.log('🎯 All existing historical data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing existing data:', error);
      throw error;
    }
  }

  /**
   * Integrate 10-year historical sector data (OHLCV + ETF data)
   */
  private async integrateHistoricalSectorData(): Promise<void> {
    console.log('\n📊 Integrating Historical Sector Data (10 years)...');
    
    const csvPath = path.join(__dirname, '..', '..', 'attached_assets', 'historical_sector_data_10_years_1754448070408.csv');
    const records = this.parseCsvFile(csvPath);
    
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const insertData = batch.map(record => ({
        symbol: record.symbol,
        date: this.parseDate(record.date),
        price: this.parseDecimal(record.price) || '0',
        volume: this.parseInteger(record.volume) || 0,
        changePercent: this.parseDecimal(record.change_percent) || '0',
        open: this.parseDecimal(record.open) || '0',
        high: this.parseDecimal(record.high) || '0',
        low: this.parseDecimal(record.low) || '0',
        close: this.parseDecimal(record.close) || '0',
      })).filter(data => data.symbol && data.date);
      
      try {
        await db.insert(historicalSectorData).values(insertData);
        insertedCount += insertData.length;
        
        console.log(`📈 Inserted batch ${Math.floor(i/batchSize) + 1}: ${insertData.length} records (Total: ${insertedCount})`);
      } catch (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
        this.stats.sectorData.skipped += batch.length;
      }
    }
    
    this.stats.sectorData.processed = records.length;
    this.stats.sectorData.inserted = insertedCount;
    
    console.log(`✅ Historical Sector Data Integration Complete: ${insertedCount}/${records.length} records`);
  }

  /**
   * Integrate historical technical indicators
   */
  private async integrateHistoricalTechnicalIndicators(): Promise<void> {
    console.log('\n📈 Integrating Historical Technical Indicators...');
    
    const csvPath = path.join(__dirname, '..', '..', 'attached_assets', 'historical_technical_indicators_10_years_1754448070408.csv');
    const records = this.parseCsvFile(csvPath);
    
    const batchSize = 500;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const insertData = batch.map(record => ({
        symbol: record.symbol,
        date: this.parseDate(record.date),
        rsi: this.parseDecimal(record.rsi),
        macd: this.parseDecimal(record.macd),
        macdSignal: this.parseDecimal(record.macd_signal),
        percentB: this.parseDecimal(record.percent_b),
        atr: this.parseDecimal(record.atr),
        priceChange: this.parseDecimal(record.price_change),
        maTrend: this.parseDecimal(record.ma_trend),
      })).filter(data => data.symbol && data.date);
      
      try {
        await db.insert(historicalTechnicalIndicators).values(insertData);
        insertedCount += insertData.length;
        
        console.log(`📊 Inserted batch ${Math.floor(i/batchSize) + 1}: ${insertData.length} records (Total: ${insertedCount})`);
      } catch (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
        this.stats.technicalIndicators.skipped += batch.length;
      }
    }
    
    this.stats.technicalIndicators.processed = records.length;
    this.stats.technicalIndicators.inserted = insertedCount;
    
    console.log(`✅ Historical Technical Indicators Integration Complete: ${insertedCount}/${records.length} records`);
  }

  /**
   * Integrate z-score technical indicators with trading signals
   */
  private async integrateZScoreTechnicalIndicators(): Promise<void> {
    console.log('\n🎯 Integrating Z-Score Technical Indicators...');
    
    const csvPath = path.join(__dirname, '..', '..', 'attached_assets', 'zscore_technical_indicators_10_years_1754448070409.csv');
    const records = this.parseCsvFile(csvPath);
    
    const batchSize = 500;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const insertData = batch.map(record => ({
        symbol: record.symbol,
        date: this.parseDate(record.date),
        rsi: this.parseDecimal(record.rsi),
        macd: this.parseDecimal(record.macd),
        macdSignal: this.parseDecimal(record.macd_signal),
        percentB: this.parseDecimal(record.percent_b),
        atr: this.parseDecimal(record.atr),
        priceChange: this.parseDecimal(record.price_change),
        maTrend: this.parseDecimal(record.ma_trend),
        rsiZScore: this.parseDecimal(record.rsi_zscore),
        macdZScore: this.parseDecimal(record.macd_zscore),
        bollingerZScore: this.parseDecimal(record.bollinger_zscore),
        atrZScore: this.parseDecimal(record.atr_zscore),
        priceMomentumZScore: this.parseDecimal(record.price_momentum_zscore),
        maTrendZScore: this.parseDecimal(record.ma_trend_zscore),
        compositeZScore: this.parseDecimal(record.composite_zscore),
        signal: record.signal || 'HOLD',
        signalStrength: this.parseDecimal(record.signal_strength),
        lookbackPeriod: this.parseInteger(record.lookback_period) || 20,
        dataQuality: record.data_quality || 'good',
      })).filter(data => data.symbol && data.date && data.signal);
      
      try {
        await db.insert(zscoreTechnicalIndicators).values(insertData);
        insertedCount += insertData.length;
        
        console.log(`🎯 Inserted batch ${Math.floor(i/batchSize) + 1}: ${insertData.length} records (Total: ${insertedCount})`);
      } catch (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
        this.stats.zscoreIndicators.skipped += batch.length;
      }
    }
    
    this.stats.zscoreIndicators.processed = records.length;
    this.stats.zscoreIndicators.inserted = insertedCount;
    
    console.log(`✅ Z-Score Technical Indicators Integration Complete: ${insertedCount}/${records.length} records`);
  }

  /**
   * Verify data integrity after integration
   */
  private async verifyDataIntegrity(): Promise<void> {
    console.log('\n🔍 Verifying Data Integrity...');
    
    try {
      // Check sector data coverage
      const sectorCount = await db.select({ count: sql`count(*)` }).from(historicalSectorData);
      const sectorSymbols = await db.select({ 
        symbol: historicalSectorData.symbol,
        count: sql`count(*)` 
      }).from(historicalSectorData).groupBy(historicalSectorData.symbol);
      
      console.log(`📊 Sector Data: ${sectorCount[0].count} total records`);
      console.log(`📈 Symbols in sector data: ${sectorSymbols.length}`);
      
      // Check technical indicators coverage
      const techCount = await db.select({ count: sql`count(*)` }).from(historicalTechnicalIndicators);
      const techSymbols = await db.select({ 
        symbol: historicalTechnicalIndicators.symbol,
        count: sql`count(*)` 
      }).from(historicalTechnicalIndicators).groupBy(historicalTechnicalIndicators.symbol);
      
      console.log(`📈 Technical Indicators: ${techCount[0].count} total records`);
      console.log(`🎯 Symbols in technical data: ${techSymbols.length}`);
      
      // Check z-score indicators coverage
      const zscoreCount = await db.select({ count: sql`count(*)` }).from(zscoreTechnicalIndicators);
      const zscoreSymbols = await db.select({ 
        symbol: zscoreTechnicalIndicators.symbol,
        count: sql`count(*)` 
      }).from(zscoreTechnicalIndicators).groupBy(zscoreTechnicalIndicators.symbol);
      
      console.log(`🎯 Z-Score Indicators: ${zscoreCount[0].count} total records`);
      console.log(`📊 Symbols in z-score data: ${zscoreSymbols.length}`);
      
      // Check date ranges
      const dateRanges = await db.select({
        table: sql`'sector_data' as table_name`,
        minDate: sql`min(date)`,
        maxDate: sql`max(date)`
      }).from(historicalSectorData);
      
      console.log(`📅 Date Range - Sector Data: ${dateRanges[0].minDate} to ${dateRanges[0].maxDate}`);
      
      console.log('✅ Data integrity verification complete');
      
    } catch (error) {
      console.error('❌ Error during data integrity verification:', error);
    }
  }

  /**
   * Generate integration summary report
   */
  private generateReport(): void {
    console.log('\n📋 INTEGRATION SUMMARY REPORT');
    console.log('═'.repeat(50));
    
    console.log(`\n📊 HISTORICAL SECTOR DATA (10 Years)`);
    console.log(`   Processed: ${this.stats.sectorData.processed.toLocaleString()}`);
    console.log(`   Inserted:  ${this.stats.sectorData.inserted.toLocaleString()}`);
    console.log(`   Skipped:   ${this.stats.sectorData.skipped.toLocaleString()}`);
    console.log(`   Success:   ${((this.stats.sectorData.inserted / this.stats.sectorData.processed) * 100).toFixed(1)}%`);
    
    console.log(`\n📈 HISTORICAL TECHNICAL INDICATORS`);
    console.log(`   Processed: ${this.stats.technicalIndicators.processed.toLocaleString()}`);
    console.log(`   Inserted:  ${this.stats.technicalIndicators.inserted.toLocaleString()}`);
    console.log(`   Skipped:   ${this.stats.technicalIndicators.skipped.toLocaleString()}`);
    console.log(`   Success:   ${((this.stats.technicalIndicators.inserted / this.stats.technicalIndicators.processed) * 100).toFixed(1)}%`);
    
    console.log(`\n🎯 Z-SCORE TECHNICAL INDICATORS`);
    console.log(`   Processed: ${this.stats.zscoreIndicators.processed.toLocaleString()}`);
    console.log(`   Inserted:  ${this.stats.zscoreIndicators.inserted.toLocaleString()}`);
    console.log(`   Skipped:   ${this.stats.zscoreIndicators.skipped.toLocaleString()}`);
    console.log(`   Success:   ${((this.stats.zscoreIndicators.inserted / this.stats.zscoreIndicators.processed) * 100).toFixed(1)}%`);
    
    const totalProcessed = this.stats.sectorData.processed + this.stats.technicalIndicators.processed + this.stats.zscoreIndicators.processed;
    const totalInserted = this.stats.sectorData.inserted + this.stats.technicalIndicators.inserted + this.stats.zscoreIndicators.inserted;
    
    console.log(`\n🎉 OVERALL INTEGRATION RESULTS`);
    console.log(`   Total Records Processed: ${totalProcessed.toLocaleString()}`);
    console.log(`   Total Records Inserted:  ${totalInserted.toLocaleString()}`);
    console.log(`   Overall Success Rate:    ${((totalInserted / totalProcessed) * 100).toFixed(1)}%`);
    console.log(`   Execution Time:          ${this.stats.executionTime.toFixed(2)} seconds`);
    
    console.log('\n✅ 10-Year Historical Dataset Integration Complete!');
    console.log('🚀 ETF analysis now has comprehensive historical context for reliable z-score calculations');
  }

  /**
   * Main integration workflow
   */
  async integrate(): Promise<void> {
    const startTime = Date.now();
    
    console.log('🚀 Starting 10-Year Historical Dataset Integration');
    console.log('═'.repeat(60));
    console.log('📋 Integration Plan:');
    console.log('   1. Clear existing limited historical data');
    console.log('   2. Integrate 10-year sector data (31,320 records)');
    console.log('   3. Integrate technical indicators (6,000 records)');
    console.log('   4. Integrate z-score indicators (5,760 records)');
    console.log('   5. Verify data integrity');
    console.log('   6. Generate integration report');
    console.log('═'.repeat(60));
    
    try {
      // Step 1: Clear existing data
      await this.clearExistingData();
      
      // Step 2: Integrate sector data
      await this.integrateHistoricalSectorData();
      
      // Step 3: Integrate technical indicators
      await this.integrateHistoricalTechnicalIndicators();
      
      // Step 4: Integrate z-score indicators
      await this.integrateZScoreTechnicalIndicators();
      
      // Step 5: Verify data integrity
      await this.verifyDataIntegrity();
      
      // Calculate execution time
      this.stats.executionTime = (Date.now() - startTime) / 1000;
      
      // Step 6: Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('💥 Integration failed:', error);
      throw error;
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const integrator = new DatasetIntegrator();
    await integrator.integrate();
    process.exit(0);
  } catch (error) {
    console.error('💥 Integration script failed:', error);
    process.exit(1);
  }
}

// Run the integration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DatasetIntegrator };