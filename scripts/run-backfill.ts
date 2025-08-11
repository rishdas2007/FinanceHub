#!/usr/bin/env tsx
// Direct backfill script to process CSV files
// Usage: npx tsx scripts/run-backfill.ts

import { join } from 'path';
import { economicDataBackfillService } from '../server/services/economic-data-backfill';

async function runBackfill() {
  console.log('🚀 Starting economic data backfill...');
  
  try {
    // Define paths to CSV files
    const definitionsPath = join(process.cwd(), 'attached_assets', 'econ_series_def_upload_1754875461998.csv');
    const observationsPath = join(process.cwd(), 'attached_assets', 'econ_series_observation_upload_1754875461992.csv');
    
    console.log('📋 Definitions file:', definitionsPath);
    console.log('📊 Observations file:', observationsPath);
    
    // Process the CSV files
    const results = await economicDataBackfillService.processCsvFiles(
      definitionsPath,
      observationsPath
    );
    
    console.log('\n✅ Backfill Results:');
    console.log(`  • Series definitions: ${results.definitionsLoaded} loaded, ${results.definitionsSkipped} skipped`);
    console.log(`  • Observations: ${results.observationsLoaded} loaded, ${results.observationsSkipped} skipped`);
    
    // Validate the results
    console.log('\n🔍 Validating results...');
    const validation = await economicDataBackfillService.validateBackfill();
    
    console.log(`\n📊 Validation Summary:`);
    console.log(`  • Total series: ${validation.seriesCount}`);
    console.log(`  • Top series by observation count:`);
    
    validation.topSeriesStats.forEach((stat: any) => {
      console.log(`    - ${stat.series_id}: ${stat.obs_count} observations (${stat.earliest_date} to ${stat.latest_date})`);
    });
    
    console.log('\n🎉 Economic data backfill completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

runBackfill();