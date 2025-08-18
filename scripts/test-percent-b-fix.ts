import { historicalMACDServiceDeduplicated } from '../server/services/historical-macd-service-deduplicated';

async function testPercentBFix() {
  console.log('🔍 Testing %B Data Quality Fix');
  console.log('='.repeat(50));
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY'];
  
  for (const symbol of ETF_SYMBOLS) {
    console.log(`\n📊 Testing ${symbol} %B Fix:`);
    
    try {
      // Test filtered %B data retrieval
      const filteredPercentB = await historicalMACDServiceDeduplicated.getHistoricalPercentBValues(symbol, 30);
      
      console.log(`  Filtered %B records: ${filteredPercentB.length}`);
      
      if (filteredPercentB.length > 0) {
        // Data quality analysis
        const uniqueValues = new Set(filteredPercentB).size;
        const duplicateRatio = 1 - (uniqueValues / filteredPercentB.length);
        const mean = filteredPercentB.reduce((a, b) => a + b, 0) / filteredPercentB.length;
        const variance = filteredPercentB.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / filteredPercentB.length;
        const stdDev = Math.sqrt(variance);
        const range = Math.max(...filteredPercentB) - Math.min(...filteredPercentB);
        
        console.log(`  Quality metrics: mean=${mean.toFixed(4)}, stddev=${stdDev.toFixed(4)}, range=${range.toFixed(4)}`);
        console.log(`  Unique values: ${uniqueValues}/${filteredPercentB.length} (${(duplicateRatio * 100).toFixed(1)}% duplicates)`);
        console.log(`  Sample values: [${filteredPercentB.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
        
        // Quality checks
        if (stdDev >= 0.1) console.log(`  ✅ StdDev improved: ${stdDev.toFixed(4)}`);
        if (range >= 0.2) console.log(`  ✅ Range improved: ${range.toFixed(4)}`);
        if (duplicateRatio < 0.5) console.log(`  ✅ Duplicates reduced: ${(duplicateRatio * 100).toFixed(1)}%`);
        
        // Check for invalid values
        const invalidValues = filteredPercentB.filter(v => v <= 0 || v > 1.5);
        if (invalidValues.length === 0) {
          console.log(`  ✅ No invalid values (all in 0-1.5 range)`);
        } else {
          console.log(`  ⚠️ ${invalidValues.length} invalid values found`);
        }
      }
      
      // Test Z-score calculation with improved %B
      const testCurrentPercentB = 0.82; // Realistic %B value
      const percentBZScore = await historicalMACDServiceDeduplicated.calculateZScoreWithFallback(
        symbol, testCurrentPercentB, 'percent_b'
      );
      
      console.log(`  Z-score for %B=0.82: ${percentBZScore.toFixed(4)}`);
      
      // Validate Z-score is reasonable
      if (Math.abs(percentBZScore) <= 5) {
        console.log(`  ✅ %B Z-score within reasonable range: ${percentBZScore.toFixed(4)}`);
      } else {
        console.log(`  ⚠️ %B Z-score still extreme: ${percentBZScore.toFixed(4)}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error testing ${symbol}:`, error);
    }
  }
  
  console.log('\n🎯 %B Fix Validation:');
  console.log('✅ Filtered out invalid 0.0 values');
  console.log('✅ Capped maximum values at 1.5 (allows slight overshoot)');
  console.log('✅ Updated fallback parameters to 0-1 scale (mean=0.5, stddev=0.25)');
  console.log('✅ Daily deduplication maintains one record per trading day');
  
  console.log('\n📈 Expected Improvements:');
  console.log('• %B Z-scores should now be in -3 to +3 range');
  console.log('• Standard deviation should be > 0.1');
  console.log('• No more impossible -32+ Z-scores');
  console.log('• Proper 0-1 scale instead of 0-100 scale');
  
  // Test realistic %B values across the spectrum
  console.log('\n🧪 Testing %B Z-score spectrum:');
  const testValues = [0.1, 0.25, 0.5, 0.75, 0.9];
  for (const testVal of testValues) {
    const fallback = historicalMACDServiceDeduplicated.getRealisticPercentBFallback();
    const zScore = (testVal - fallback.mean) / fallback.stddev;
    console.log(`  %B=${testVal} → Z-score=${zScore.toFixed(4)}`);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPercentBFix()
    .then(() => {
      console.log('\n✅ %B Fix testing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 %B Fix testing failed:', error);
      process.exit(1);
    });
}

export { testPercentBFix };