#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { db } from '../db';
import { historicalStockData, historicalTechnicalIndicators } from '@shared/schema';
import { logger } from '../utils/logger';

interface HistoricalRecord {
  id: number;
  symbol: string;
  date: string;
  price: number;
  volume: number;
  change_percent: number;
  created_at: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TechnicalRecord {
  id: number;
  symbol: string;
  date: string;
  rsi: number;
  macd_line: number;
  macd_signal: number;
  macd_histogram: number;
  bollinger_upper: number;
  bollinger_middle: number;
  bollinger_lower: number;
  volume_sma: number;
  atr: number;
  adx: number;
  bb_percent_b: number;
  created_at: string;
}

/**
 * Load 10-Year Enhanced Dataset
 * Imports comprehensive historical data to resolve data sufficiency warnings
 */
async function load10YearDataset() {
  logger.info('🚀 Loading 10-year enhanced dataset to resolve data sufficiency warnings...');
  
  const baseDir = path.join(process.cwd(), 'attached_assets');
  
  // File paths for the 10-year datasets
  const historicalDataFile = path.join(baseDir, 'historical_sector_data_10_years_1754448070408.csv');
  const technicalDataFile = path.join(baseDir, 'historical_technical_indicators_10_years_1754448070408.csv');
  
  let totalRecordsLoaded = 0;
  let errors: string[] = [];

  try {
    // Load historical sector data (price/volume)
    if (fs.existsSync(historicalDataFile)) {
      logger.info('📊 Loading historical sector data...');
      
      const csvContent = fs.readFileSync(historicalDataFile, 'utf-8');
      const records: HistoricalRecord[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      logger.info(`📈 Processing ${records.length} historical records...`);

      // Clear existing data to avoid conflicts
      await db.delete(historicalStockData);
      logger.info('🗑️ Cleared existing historical stock data');

      // Insert in batches for better performance
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        const insertData = batch.map(record => ({
          symbol: record.symbol,
          date: new Date(record.date.replace(/"/g, '')),
          open: record.open.toString(),
          high: record.high.toString(),
          low: record.low.toString(),
          close: record.close.toString(),
          volume: record.volume,
          price: record.price,
          changePercent: record.change_percent
        }));

        await db.insert(historicalStockData).values(insertData);
        totalRecordsLoaded += batch.length;
        
        if (i % (batchSize * 5) === 0) {
          logger.info(`📊 Processed ${i + batch.length}/${records.length} historical records...`);
        }
      }

      logger.info(`✅ Loaded ${records.length} historical sector records`);
    }

    // Load technical indicators data
    if (fs.existsSync(technicalDataFile)) {
      logger.info('📊 Loading technical indicators data...');
      
      const csvContent = fs.readFileSync(technicalDataFile, 'utf-8');
      const records: TechnicalRecord[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      logger.info(`📈 Processing ${records.length} technical indicator records...`);

      // Clear existing technical data
      await db.delete(historicalTechnicalIndicators);
      logger.info('🗑️ Cleared existing technical indicator data');

      // Insert technical indicators in batches
      const batchSize = 1000;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        const insertData = batch.map(record => ({
          symbol: record.symbol,
          date: new Date(record.date.replace(/"/g, '')),
          rsi: record.rsi,
          macdLine: record.macd_line,
          macdSignal: record.macd_signal,
          macdHistogram: record.macd_histogram,
          bollingerUpper: record.bollinger_upper,
          bollingerMiddle: record.bollinger_middle,
          bollingerLower: record.bollinger_lower,
          volumeSma: record.volume_sma,
          atr: record.atr,
          adx: record.adx,
          bbPercentB: record.bb_percent_b
        }));

        await db.insert(historicalTechnicalIndicators).values(insertData);
        totalRecordsLoaded += batch.length;
        
        if (i % (batchSize * 5) === 0) {
          logger.info(`📊 Processed ${i + batch.length}/${records.length} technical records...`);
        }
      }

      logger.info(`✅ Loaded ${records.length} technical indicator records`);
    }

    // Verify data loading
    const verificationQuery = await db
      .select({
        symbol: historicalStockData.symbol,
        count: sql<number>`count(*)`,
        oldest: sql<Date>`min(date)`,
        newest: sql<Date>`max(date)`
      })
      .from(historicalStockData)
      .groupBy(historicalStockData.symbol)
      .orderBy(sql`count(*) DESC`);

    logger.info('📊 Data loading verification:');
    verificationQuery.forEach(row => {
      const years = ((row.newest.getTime() - row.oldest.getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
      logger.info(`  • ${row.symbol}: ${row.count} records spanning ${years} years (${row.oldest.toDateString()} to ${row.newest.toDateString()})`);
    });

    logger.info(`🎉 Successfully loaded ${totalRecordsLoaded} total records from 10-year dataset`);
    logger.info('✅ Data sufficiency warnings should now be resolved with comprehensive historical coverage');
    
    return {
      success: true,
      recordsLoaded: totalRecordsLoaded,
      errors,
      verification: verificationQuery
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Failed to load 10-year dataset:', errorMessage);
    errors.push(errorMessage);
    
    return {
      success: false,
      recordsLoaded: totalRecordsLoaded,
      errors,
      verification: null
    };
  }
}

// Import sql from drizzle-orm for the count queries
import { sql } from 'drizzle-orm';

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  load10YearDataset()
    .then(result => {
      if (result.success) {
        logger.info('🎯 10-year dataset loading completed successfully');
        process.exit(0);
      } else {
        logger.error('💥 10-year dataset loading failed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('💥 Fatal error during dataset loading:', error);
      process.exit(1);
    });
}

export { load10YearDataset };