#!/usr/bin/env tsx
/**
 * Direct Backfill Test Script
 * Tests actual data collection from Twelve Data API
 */

import { logger } from '../utils/logger';
import { FinancialDataService } from '../services/financial-data';

async function testDirectBackfill() {
  logger.info('🚀 Starting direct backfill test');
  
  const financialService = FinancialDataService.getInstance();
  const symbol = 'SPY';
  
  try {
    // Test historical data collection
    logger.info(`📊 Fetching historical data for ${symbol}`);
    const historicalData = await financialService.getHistoricalData(symbol, '1year');
    
    logger.info(`✅ Successfully fetched ${historicalData?.length || 0} historical records for ${symbol}`);
    
    if (historicalData && historicalData.length > 0) {
      logger.info(`📅 Date range: ${historicalData[0].date} to ${historicalData[historicalData.length - 1].date}`);
      logger.info(`💰 Latest close: $${historicalData[historicalData.length - 1].close}`);
    }
    
    return true;
  } catch (error) {
    logger.error('❌ Direct backfill test failed:', error);
    return false;
  }
}

// Execute if run directly
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.argv[1] === __filename) {
  testDirectBackfill()
    .then(success => {
      logger.info(success ? '✅ Test completed successfully' : '❌ Test failed');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

export { testDirectBackfill };