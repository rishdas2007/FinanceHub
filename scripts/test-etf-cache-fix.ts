/**
 * Test ETF Cache Poisoning Fix
 * Verifies that fresh database data is being served instead of cached fallback data
 */

async function testETFCacheFix() {
  console.log('🔍 Testing ETF Cache Poisoning Fix...');
  console.log('');
  
  try {
    // Test the ETF Technical Metrics endpoint
    const response = await fetch('http://localhost:5000/api/etf/technical-metrics');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('📊 API Response Analysis:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Keys: ${Object.keys(data)}`);
    console.log(`   ETF Count: ${data.data?.length || 0}`);
    console.log('');
    
    if (data.success && data.data && data.data.length > 0) {
      console.log('📋 ETF Metrics Quality Check:');
      console.log('Symbol | RSI    | MACD   | Signal | Status');
      console.log('-------|--------|--------|--------|--------');
      
      let realDataCount = 0;
      let fakeDataCount = 0;
      
      data.data.forEach((etf: any) => {
        const rsi = etf.components?.rsi14 || etf.rsi;
        const macdZ = etf.components?.macdZ;
        const signal = etf.zScoreData?.signal || etf.signal;
        
        // Check for fake data patterns
        const hasFakeRSI = rsi === 50.0;
        const hasFakeMACD = macdZ === 0.0 || macdZ === null;
        const hasFakeSignal = signal === 'HOLD';
        
        const isFakeData = hasFakeRSI && hasFakeMACD && hasFakeSignal;
        
        if (isFakeData) {
          fakeDataCount++;
        } else {
          realDataCount++;
        }
        
        const rsiDisplay = rsi !== null ? rsi.toFixed(1) : 'N/A';
        const macdDisplay = macdZ !== null ? macdZ.toFixed(2) : 'N/A';
        const signalDisplay = signal || 'N/A';
        const status = isFakeData ? '🚨 FAKE' : '✅ REAL';
        
        console.log(`${etf.symbol.padEnd(6)} | ${rsiDisplay.padEnd(6)} | ${macdDisplay.padEnd(6)} | ${signalDisplay.padEnd(6)} | ${status}`);
      });
      
      console.log('');
      console.log('📊 Data Quality Summary:');
      console.log(`   Real Data: ${realDataCount}/${data.data.length} ETFs (${Math.round(realDataCount / data.data.length * 100)}%)`);
      console.log(`   Fake Data: ${fakeDataCount}/${data.data.length} ETFs (${Math.round(fakeDataCount / data.data.length * 100)}%)`);
      console.log('');
      
      // Assessment
      if (fakeDataCount === 0 && realDataCount > 0) {
        console.log('✅ SUCCESS: ETF Cache Poisoning Fix is working!');
        console.log('   - All ETFs now show real technical indicators');
        console.log('   - No fake RSI=50.0 or cached fallback patterns detected');
        console.log('   - Fresh database data is being served correctly');
      } else if (realDataCount > fakeDataCount) {
        console.log('⚠️ PARTIAL SUCCESS: Most ETFs show real data');
        console.log(`   - ${realDataCount} ETFs with real data, ${fakeDataCount} with cached fallbacks`);
        console.log('   - Cache poisoning fix is working but some cached data may remain');
      } else {
        console.log('❌ FAILURE: ETF Cache Poisoning Fix needs more work');
        console.log(`   - Still seeing ${fakeDataCount} ETFs with cached fallback data`);
        console.log('   - Cache clearing or validation may need adjustment');
      }
      
    } else {
      console.log('❌ No valid ETF data received from API');
      console.log('   Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('');
  console.log('🏁 ETF Cache Poisoning Fix test completed');
}

// Run test
testETFCacheFix();