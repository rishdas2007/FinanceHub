#!/usr/bin/env tsx

/**
 * Backfill script for new architecture:
 * 1. Migrate historical_stock_data to equity_daily_bars
 * 2. Compute technical features for feature store
 * 3. Validate data quality
 */

import { db } from '../server/db';
import { equityFeaturesETL } from '../server/services/equity-features-etl';
import { logger } from '../server/middleware/logging';

const ETF_SYMBOLS = ['SPY', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE', 'XRT'];

async function main() {
  try {
    logger.info('🚀 Starting Phase 1 backfill: Equity features');
    
    // Step 1: Backfill daily bars from historical_stock_data
    logger.info('📊 Step 1: Backfilling daily bars');
    await equityFeaturesETL.backfillDailyBars(ETF_SYMBOLS);
    
    // Step 2: Compute technical features for last 400 trading days
    logger.info('🔧 Step 2: Computing technical features');
    await equityFeaturesETL.computeFeatures(ETF_SYMBOLS, 400);
    
    // Step 3: Test the new API
    logger.info('🧪 Step 3: Testing feature store API');
    const features = await equityFeaturesETL.getLatestFeatures(['SPY', 'XLK', 'XLF']);
    
    logger.info('✅ Sample features:');
    features.forEach(feature => {
      logger.info(`  ${feature.symbol}: ${feature.dataQuality} quality, fallback: ${feature.fallback}`);
    });
    
    logger.info('🎉 Phase 1 backfill completed successfully!');
    
  } catch (error) {
    logger.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

main();