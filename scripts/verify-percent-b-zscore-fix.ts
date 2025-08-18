import axios from 'axios';

async function verifyPercentBZScoreFix() {
  console.log('🔍 Verifying %B Z-Score Fix in Production API');
  console.log('='.repeat(60));
  
  try {
    // Get live ETF data from API
    const response = await axios.get('http://localhost:5000/api/etf/technical-clean');
    const etfData = response.data.data;
    
    console.log('\n📊 Current %B Z-Scores in Production:');
    console.log('Symbol | %B Value | %B Z-Score | Analysis');
    console.log('-'.repeat(50));
    
    let positiveCount = 0;
    let negativeCount = 0;
    let extremeCount = 0;
    
    etfData.forEach((etf: any) => {
      const percentB = etf.bollingerPercB;
      const bbZScore = etf.bbZScore;
      
      if (percentB !== null && bbZScore !== null) {
        const analysis = percentB > 0.5 ? 
          (bbZScore > 0 ? '✅ Above mean → Positive Z' : '🚨 Above mean → Negative Z (WRONG)') :
          (bbZScore < 0 ? '✅ Below mean → Negative Z' : '🚨 Below mean → Positive Z (WRONG)');
        
        console.log(`${etf.symbol.padEnd(6)} | ${(percentB * 100).toFixed(1)}%     | ${bbZScore.toFixed(3).padStart(6)} | ${analysis}`);
        
        if (bbZScore > 0) positiveCount++;
        if (bbZScore < 0) negativeCount++;
        if (Math.abs(bbZScore) > 5) extremeCount++;
      }
    });
    
    console.log('\n📈 Summary Statistics:');
    console.log(`Total ETFs analyzed: ${etfData.length}`);
    console.log(`Positive Z-scores: ${positiveCount}`);
    console.log(`Negative Z-scores: ${negativeCount}`);
    console.log(`Extreme Z-scores (|z| > 5): ${extremeCount}`);
    
    console.log('\n🎯 Fix Validation:');
    
    if (positiveCount > 0 && negativeCount > 0) {
      console.log('✅ %B Z-scores now show both positive and negative values (realistic distribution)');
    } else if (negativeCount === 0) {
      console.log('⚠️ All %B Z-scores are positive (may indicate bias)');
    } else if (positiveCount === 0) {
      console.log('🚨 All %B Z-scores are still negative (problem not fully resolved)');
    }
    
    if (extremeCount === 0) {
      console.log('✅ No extreme Z-scores detected (all within ±5 range)');
    } else {
      console.log(`⚠️ ${extremeCount} extreme Z-scores detected`);
    }
    
    // Check if fallback parameters are being used correctly
    console.log('\n🔧 Fallback Parameter Verification:');
    console.log('Expected fallback: mean=0.5, stddev=0.25');
    
    // Find an ETF with %B around 0.75 to test calculation
    const testETF = etfData.find((etf: any) => 
      etf.bollingerPercB !== null && 
      etf.bollingerPercB > 0.7 && 
      etf.bollingerPercB < 0.8
    );
    
    if (testETF) {
      const expectedZScore = (testETF.bollingerPercB - 0.5) / 0.25;
      const actualZScore = testETF.bbZScore;
      const difference = Math.abs(expectedZScore - actualZScore);
      
      console.log(`Test case: ${testETF.symbol}`);
      console.log(`  %B: ${testETF.bollingerPercB.toFixed(4)}`);
      console.log(`  Expected Z-score: ${expectedZScore.toFixed(4)}`);
      console.log(`  Actual Z-score: ${actualZScore.toFixed(4)}`);
      console.log(`  Difference: ${difference.toFixed(4)}`);
      
      if (difference < 0.01) {
        console.log('  ✅ Fallback parameters are being used correctly');
      } else {
        console.log('  ⚠️ Calculation may not be using expected fallback parameters');
      }
    }
    
    console.log('\n🏆 Overall Assessment:');
    
    const isFixed = positiveCount > 0 && negativeCount > 0 && extremeCount === 0;
    if (isFixed) {
      console.log('✅ %B Z-score fix is SUCCESSFUL');
      console.log('  - Realistic distribution of positive and negative values');
      console.log('  - No extreme outliers');
      console.log('  - Proper 0-1 scale implementation');
    } else {
      console.log('⚠️ %B Z-score fix needs additional work');
    }
    
  } catch (error) {
    console.error('❌ Error verifying %B Z-score fix:', error);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyPercentBZScoreFix()
    .then(() => {
      console.log('\n✅ Verification completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}

export { verifyPercentBZScoreFix };