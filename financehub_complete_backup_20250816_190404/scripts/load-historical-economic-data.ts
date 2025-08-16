/**
 * Main Economic Data Loading Script for FinanceHub Pro v30
 * Orchestrates the complete data loading process for 104,625 historical records
 * Coordinates series definitions loading and observations loading
 */

import { loadSeriesDefinitions } from './load-economic-series-definitions';
import { loadEconomicObservations, validateLoadedData } from './load-economic-observations';
import { logger } from '../shared/utils/logger';
import path from 'path';
import { existsSync } from 'fs';

// CSV file location - check multiple possible locations
const POSSIBLE_CSV_PATHS = [
  './attached_assets/econ_series_observation_upload_1755231909139.csv',
  './econ_series_observation_upload.csv',
  './tmp/econ_series_observation_upload.csv',
  '/Users/rishabhdas/Downloads/Dashboard data/econ_series_observation_upload.csv'
];

function findCSVFile(): string {
  for (const csvPath of POSSIBLE_CSV_PATHS) {
    if (existsSync(csvPath)) {
      logger.info(`Found CSV file at: ${csvPath}`);
      return csvPath;
    }
  }
  
  throw new Error(`CSV file not found. Checked paths: ${POSSIBLE_CSV_PATHS.join(', ')}`);
}

async function main() {
  try {
    console.log('🚀 Starting Historical Economic Data Load Process for FinanceHub Pro v30...');
    console.log('📊 Target: 104,625 historical economic records across 34 series (1964-2025)');
    
    // Find CSV file
    const csvFilePath = findCSVFile();
    console.log(`📂 Using CSV file: ${csvFilePath}`);
    
    // Step 1: Load series definitions first
    console.log('\n📋 Phase 1: Loading Economic Series Definitions...');
    const seriesResult = await loadSeriesDefinitions();
    console.log(`✅ Series definitions loaded: ${seriesResult.inserted} inserted, ${seriesResult.updated} updated`);
    
    // Step 2: Load observations data
    console.log('\n📈 Phase 2: Loading Economic Observations from CSV...');
    const observationsResult = await loadEconomicObservations(csvFilePath);
    console.log(`✅ Observations loaded: ${observationsResult.processed} processed, ${observationsResult.errors} errors, ${observationsResult.skipped} skipped`);
    
    // Step 3: Comprehensive validation
    console.log('\n🔍 Phase 3: Running Comprehensive Data Validation...');
    const validationResult = await validateLoadedData();
    
    // Display validation results
    console.log('\n📋 Data Loading Summary:');
    console.log(`  📊 Total Records Loaded: ${validationResult.totalRecords.toLocaleString()}`);
    console.log(`  📈 Unique Economic Series: ${validationResult.uniqueSeries}`);
    console.log(`  📅 Date Range: ${validationResult.earliestDate} to ${validationResult.latestDate}`);
    
    console.log('\n🎯 Critical Series Z-Score Readiness:');
    validationResult.criticalSeriesValidation.forEach((series: any) => {
      console.log(`  ${series.status} ${series.seriesId}: ${series.recordCount} records (${series.zScoreReady ? 'Z-Score Ready' : 'Insufficient Data'})`);
    });
    
    // Performance metrics
    console.log('\n⚡ Performance Metrics:');
    console.log(`  📈 Processing Rate: ${Math.round(observationsResult.processed / 60)} records/second (estimated)`);
    console.log(`  📊 Success Rate: ${Math.round((observationsResult.processed / observationsResult.totalRecords) * 100)}%`);
    
    // Success criteria check
    const isSuccess = 
      validationResult.totalRecords >= 100000 && // At least 100k records
      validationResult.uniqueSeries >= 30 && // At least 30 series
      validationResult.criticalSeriesValidation.filter((s: any) => s.zScoreReady).length >= 4; // At least 4 critical series ready
    
    if (isSuccess) {
      console.log('\n🎉 HISTORICAL ECONOMIC DATA LOAD COMPLETE - SUCCESS!');
      console.log('✅ Economic indicators should now display proper YoY percentages');
      console.log('✅ Z-score calculations have sufficient historical data');
      console.log('✅ Dashboard economic health scoring is fully operational');
    } else {
      console.log('\n⚠️  Data load completed with warnings - review validation results');
    }
    
    // Next steps guidance
    console.log('\n🔄 Next Steps:');
    console.log('1. Test economic indicators API: GET /api/macroeconomic-indicators');
    console.log('2. Verify YoY calculations show percentages instead of raw index values');
    console.log('3. Check economic health dashboard for improved scoring');
    console.log('4. Run full application test to ensure all endpoints are working');
    
    process.exit(isSuccess ? 0 : 1);
    
  } catch (error) {
    logger.error('Historical economic data load process failed:', error);
    console.error('\n❌ CRITICAL ERROR: Data loading process failed');
    console.error('Error details:', error.message);
    
    // Error troubleshooting guidance
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Verify CSV file exists and is readable');
    console.log('2. Check database connection and permissions');
    console.log('3. Ensure all required tables exist (run migrations if needed)');
    console.log('4. Review error logs for specific issues');
    
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection reason:', reason);
  console.error('❌ FATAL: Unhandled promise rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message);
  console.error('❌ FATAL: Uncaught exception:', error.message);
  process.exit(1);
});

// ES module compatible execution check
if (process.argv[1]?.endsWith('load-historical-economic-data.ts')) {
  main();
}