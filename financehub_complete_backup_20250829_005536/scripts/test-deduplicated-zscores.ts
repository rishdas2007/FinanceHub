import { historicalMACDServiceDeduplicated } from '../server/services/historical-macd-service-deduplicated';

async function testDeduplicatedZScores() {
  console.log('🧪 Testing Deduplicated Z-Score Calculations');
  console.log('='.repeat(60));
  
  const testCases = [
    { symbol: 'SPY', rsi: 58.29, macd: 6.26, percent_b: 0.90 },
    { symbol: 'XLK', rsi: 53.59, macd: 3.37, percent_b: 0.73 },
    { symbol: 'XLE', rsi: 25.60, macd: -0.39, percent_b: 0.32 },
    { symbol: 'XLV', rsi: 54.06, macd: 0.01, percent_b: 0.79 }
  ];

  for (const testCase of testCases) {
    console.log(`\n📊 Testing ${testCase.symbol}:`);
    
    try {
      // Test RSI Z-score
      const rsiZScore = await historicalMACDServiceDeduplicated.calculateZScoreWithFallback(
        testCase.symbol, testCase.rsi, 'rsi'
      );
      console.log(`  RSI: ${testCase.rsi} → Z-score: ${rsiZScore.toFixed(4)}`);
      
      // Test MACD Z-score
      const macdZScore = await historicalMACDServiceDeduplicated.calculateZScoreWithFallback(
        testCase.symbol, testCase.macd, 'macd'
      );
      console.log(`  MACD: ${testCase.macd} → Z-score: ${macdZScore.toFixed(4)}`);
      
      // Test %B Z-score
      const percentBZScore = await historicalMACDServiceDeduplicated.calculateZScoreWithFallback(
        testCase.symbol, testCase.percent_b, 'percent_b'
      );
      console.log(`  %B: ${testCase.percent_b} → Z-score: ${percentBZScore.toFixed(4)}`);
      
      // Validate results
      const allZScores = [rsiZScore, macdZScore, percentBZScore];
      const extremeZScores = allZScores.filter(z => Math.abs(z) > 5);
      
      if (extremeZScores.length === 0) {
        console.log(`  ✅ All Z-scores within reasonable range (-5 to +5)`);
      } else {
        console.log(`  ⚠️ ${extremeZScores.length} extreme Z-scores detected`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error testing ${testCase.symbol}:`, error);
    }
  }

  console.log('\n🎯 Comparison Test: Before vs After Deduplication');
  console.log('-'.repeat(50));
  
  // Test raw data vs deduplicated for SPY RSI
  try {
    const spyRawRSI = await historicalMACDServiceDeduplicated.getHistoricalRSIValues('SPY', 30);
    console.log(`\nSPY Raw RSI Data (30 days):`);
    console.log(`  Records retrieved: ${spyRawRSI.length}`);
    
    if (spyRawRSI.length > 0) {
      const uniqueValues = new Set(spyRawRSI).size;
      const duplicateRatio = 1 - (uniqueValues / spyRawRSI.length);
      const mean = spyRawRSI.reduce((a, b) => a + b, 0) / spyRawRSI.length;
      const variance = spyRawRSI.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spyRawRSI.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`  Unique values: ${uniqueValues}/${spyRawRSI.length} (${(duplicateRatio * 100).toFixed(1)}% duplicates)`);
      console.log(`  Mean: ${mean.toFixed(4)}, StdDev: ${stdDev.toFixed(4)}`);
      console.log(`  Sample values: [${spyRawRSI.slice(0, 5).map(v => v.toFixed(2)).join(', ')}...]`);
      
      // Calculate Z-score with this data
      const currentSPYRSI = 58.29;
      const deduplicatedZScore = historicalMACDServiceDeduplicated.calculateZScore(currentSPYRSI, spyRawRSI);
      
      if (deduplicatedZScore !== null) {
        console.log(`  Deduplicated Z-score: ${deduplicatedZScore.toFixed(4)}`);
        
        if (Math.abs(deduplicatedZScore) < 5) {
          console.log(`  ✅ SUCCESS: Z-score now in reasonable range!`);
        } else {
          console.log(`  ⚠️ Still extreme, may need more data or different approach`);
        }
      } else {
        console.log(`  ⚠️ Data quality validation failed, using fallback`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error in comparison test:`, error);
  }
  
  console.log('\n🏁 Test completed!');
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDeduplicatedZScores()
    .then(() => {
      console.log('✅ Testing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

export { testDeduplicatedZScores };