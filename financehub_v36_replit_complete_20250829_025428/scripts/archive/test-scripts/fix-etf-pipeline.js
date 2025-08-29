#!/usr/bin/env node

// Emergency ETF Pipeline Fix Script
// This script backfills missing data and runs the ETL for all ETF symbols

import { db } from './server/db.js';
import { EquityFeaturesETL } from './server/services/equity-features-etl.js';

async function fixETFPipeline() {
  console.log('🔧 Starting ETF Pipeline Emergency Fix...');
  
  const etl = new EquityFeaturesETL();
  
  try {
    // Step 1: Backfill daily bars from historical data
    console.log('📊 Step 1: Backfilling daily bars...');
    await etl.backfillDailyBars();
    
    // Step 2: Compute features for all ETFs
    console.log('🧮 Step 2: Computing features for all ETFs...');
    await etl.computeFeatures();
    
    console.log('✅ ETF Pipeline fix completed successfully!');
    
    // Step 3: Verify results
    console.log('🔍 Step 3: Verifying results...');
    const results = await db.execute(`
      SELECT 
        symbol, 
        COUNT(*) as feature_records,
        MAX(asof_date) as latest_date
      FROM equity_features_daily 
      WHERE symbol IN ('SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE')
      GROUP BY symbol 
      ORDER BY feature_records DESC
    `);
    
    console.table(results);
    
  } catch (error) {
    console.error('❌ ETF Pipeline fix failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixETFPipeline();