#!/usr/bin/env tsx

/**
 * CSV Upload Runner
 * Executes the CSV data transformation and upload process
 */

import { processCSVUpload } from './csv-data-transformer';
import { resolve } from 'path';

async function main() {
  console.log('🚀 Starting Economic Data CSV Upload Process...');
  console.log('📄 Processing attached economic indicators CSV file...');
  
  const csvPath = resolve(__dirname, '../attached_assets/economic_indicators_populated_with_real_data_1754761527436.csv');
  
  try {
    await processCSVUpload(csvPath);
    console.log('✅ Economic data CSV upload completed successfully!');
    console.log('📊 Your database now contains enhanced historical economic data.');
    
  } catch (error) {
    console.error('❌ CSV upload process failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}