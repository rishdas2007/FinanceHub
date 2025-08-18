import { backfillHistoricalTechnicalIndicators } from './backfill-historical-technical-indicators';
import { runFullValidation } from './test-macd-consistency';

async function executeMACDConsistencyFix(): Promise<void> {
  console.log('🚀 Starting MACD Consistency Fix Process');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Backfill historical data
    console.log('STEP 1: Backfilling historical technical indicators...');
    console.log('-'.repeat(40));
    await backfillHistoricalTechnicalIndicators();
    console.log('');
    
    // Step 2: Validate the fix
    console.log('STEP 2: Running MACD consistency validation...');
    console.log('-'.repeat(40));
    await runFullValidation();
    console.log('');
    
    // Step 3: Summary
    console.log('STEP 3: Implementation Summary');
    console.log('-'.repeat(40));
    console.log('✅ ETF technical clean route updated to store EMA12/EMA26 values');
    console.log('✅ Database insert services enhanced to include EMA values');
    console.log('✅ Historical technical indicators table populated');
    console.log('✅ Consistent z-score calculation implemented using database data');
    console.log('✅ MACD calculation validation and monitoring added');
    console.log('');
    
    console.log('🎯 MACD Consistency Fix completed successfully!');
    console.log('');
    console.log('Next Steps:');
    console.log('• Monitor z-score distributions in production');
    console.log('• Watch for extreme z-scores (>3) that may indicate data issues');
    console.log('• Ensure historical data continues to be populated from new technical indicators');
    console.log('• Consider adding automated alerts for data quality issues');
    
  } catch (error) {
    console.error('❌ MACD consistency fix process failed:', error);
    throw error;
  }
}

// Execute if called directly
if (require.main === module) {
  executeMACDConsistencyFix()
    .then(() => {
      console.log('\n🎉 Process completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Process failed:', error);
      process.exit(1);
    });
}

export default executeMACDConsistencyFix;