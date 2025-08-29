/**
 * Validate Technical Indicators
 * Ensure all technical indicators show realistic values
 */

async function validateTechnicalIndicators() {
  console.log('🔬 === TECHNICAL INDICATORS VALIDATION ===');
  console.log('📊 Checking for realistic MACD and MA Gap values...');
  console.log('');

  try {
    const response = await fetch('http://localhost:5000/api/etf-metrics');
    const data = await response.json();
    
    if (!data.success || !data.data) {
      console.log('❌ Failed to get ETF data');
      return false;
    }

    console.log('📊 Technical Indicators Analysis:');
    console.log('Symbol | RSI   | MACD   | MA Gap  | Status');
    console.log('-------|-------|--------|---------|----------');
    
    let allValid = true;
    
    data.data.forEach(etf => {
      const rsi = etf.components.rsi14;
      const macd = etf.components.macdZ;
      const maGap = etf.components.maGapPct;
      
      // Validation criteria
      const rsiValid = rsi >= 0 && rsi <= 100;
      const macdValid = Math.abs(macd) <= 3; // Should be within reasonable range
      const maGapValid = Math.abs(maGap) <= 10; // Should be within 10% typically
      
      const status = rsiValid && macdValid && maGapValid ? '✅ GOOD' : '❌ ISSUE';
      
      console.log(`${etf.symbol.padEnd(6)} | ${rsi.toFixed(1).padStart(5)} | ${macd.toFixed(3).padStart(6)} | ${maGap.toFixed(3).padStart(7)} | ${status}`);
      
      if (!rsiValid || !macdValid || !maGapValid) {
        allValid = false;
        if (!rsiValid) console.log(`   ⚠️ RSI out of range: ${rsi}`);
        if (!macdValid) console.log(`   ⚠️ MACD too extreme: ${macd}`);
        if (!maGapValid) console.log(`   ⚠️ MA Gap too large: ${maGap}%`);
      }
    });
    
    console.log('');
    console.log(`📋 Validation Result: ${allValid ? '✅ ALL VALID' : '❌ ISSUES FOUND'}`);
    console.log(`📊 Total ETFs: ${data.data.length}`);
    console.log(`⏱️ Response time: ${data.metadata?.responseTime || 'unknown'}`);
    console.log(`🎯 Data source: ${data.metadata?.source || 'unknown'}`);
    
    if (allValid) {
      console.log('🎉 All technical indicators are within realistic ranges!');
      console.log('💡 MACD values: ±3 range (typical: ±1)');
      console.log('💡 MA Gap values: ±10% range (typical: ±5%)');
      console.log('💡 RSI values: 0-100 range (oversold: <30, overbought: >70)');
    } else {
      console.log('🔧 Some indicators need adjustment. Check calculation logic.');
    }
    
    return allValid;
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

if (import.meta.main) {
  validateTechnicalIndicators()
    .then(valid => {
      process.exit(valid ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { validateTechnicalIndicators };