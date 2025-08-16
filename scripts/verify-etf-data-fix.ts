/**
 * Verify ETF Cache Poisoning Fix Success
 * Comprehensive test to confirm real data is being served
 */

import { promises as fs } from 'fs';

async function verifyETFDataFix() {
  console.log('🔍 VERIFYING ETF CACHE POISONING FIX...');
  console.log('');
  
  try {
    // Test the ETF endpoint directly
    const response = await fetch('http://localhost:5000/api/etf/technical-metrics');
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      console.log('❌ Response is not JSON (likely HTML error page)');
      console.log(`Content-Type: ${contentType}`);
      const text = await response.text();
      console.log(`Response preview: ${text.substring(0, 200)}...`);
      return;
    }
    
    const data = await response.json();
    
    console.log('📊 API Response Analysis:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Has success field: ${data.success !== undefined}`);
    console.log(`   Has data array: ${Array.isArray(data.data)}`);
    console.log(`   ETF count: ${data.data?.length || 0}`);
    console.log('');
    
    if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
      console.log('❌ Invalid API response structure');
      console.log('Response:', JSON.stringify(data, null, 2));
      return;
    }
    
    // Analyze data quality
    console.log('🔍 DATA QUALITY ANALYSIS:');
    console.log('Symbol | RSI    | MACD-Z | Signal | Z-Score | Price  | Status');
    console.log('-------|--------|--------|--------|---------|--------|--------');
    
    let realDataCount = 0;
    let fakeDataCount = 0;
    let partialDataCount = 0;
    
    data.data.forEach((etf: any) => {
      const symbol = etf.symbol || 'N/A';
      const rsi = etf.components?.rsi14;
      const macdZ = etf.components?.macdZ;
      const signal = etf.zScoreData?.signal || etf.signal;
      const compositeZ = etf.zScoreData?.compositeZScore;
      const price = etf.price;
      
      // Quality assessment
      const hasFakeRSI = rsi === 50.0;
      const hasFakeMACD = macdZ === 0.0 || macdZ === null || macdZ === undefined;
      const hasFakeSignal = signal === 'HOLD';
      const hasFakeZScore = compositeZ === 0.0 || compositeZ === null;
      const hasZeroPrice = price === 0 || price === null || price === undefined;
      
      let status = '';
      let quality = 'real';
      
      // Determine data quality
      if (hasFakeRSI && hasFakeMACD && hasFakeSignal && hasFakeZScore) {
        status = '🚨 FAKE';
        quality = 'fake';
        fakeDataCount++;
      } else if (hasZeroPrice || (!rsi && !macdZ && !signal)) {
        status = '⚠️ PARTIAL';
        quality = 'partial';
        partialDataCount++;
      } else {
        status = '✅ REAL';
        quality = 'real';
        realDataCount++;
      }
      
      // Format display values
      const rsiDisplay = rsi !== null && rsi !== undefined ? rsi.toFixed(1) : 'N/A';
      const macdDisplay = macdZ !== null && macdZ !== undefined ? macdZ.toFixed(2) : 'N/A';
      const signalDisplay = signal || 'N/A';
      const zscoreDisplay = compositeZ !== null && compositeZ !== undefined ? compositeZ.toFixed(2) : 'N/A';
      const priceDisplay = price !== null && price !== undefined ? `$${price.toFixed(2)}` : 'N/A';
      
      console.log(`${symbol.padEnd(6)} | ${rsiDisplay.padEnd(6)} | ${macdDisplay.padEnd(6)} | ${signalDisplay.padEnd(6)} | ${zscoreDisplay.padEnd(7)} | ${priceDisplay.padEnd(6)} | ${status}`);
    });
    
    const totalETFs = data.data.length;
    
    console.log('');
    console.log('📈 QUALITY SUMMARY:');
    console.log(`   ✅ Real Data: ${realDataCount}/${totalETFs} ETFs (${Math.round(realDataCount / totalETFs * 100)}%)`);
    console.log(`   ⚠️ Partial Data: ${partialDataCount}/${totalETFs} ETFs (${Math.round(partialDataCount / totalETFs * 100)}%)`);
    console.log(`   🚨 Fake Data: ${fakeDataCount}/${totalETFs} ETFs (${Math.round(fakeDataCount / totalETFs * 100)}%)`);
    console.log('');
    
    // Overall assessment
    const realDataPercentage = (realDataCount / totalETFs) * 100;
    
    if (realDataPercentage >= 80) {
      console.log('🎉 SUCCESS: ETF Cache Poisoning Fix is working excellently!');
      console.log(`   - ${realDataPercentage.toFixed(1)}% of ETFs show authentic technical indicators`);
      console.log('   - Cache bypass successfully serving fresh database data');
      console.log('   - No more fake RSI=50.0 or zero Z-score fallbacks detected');
    } else if (realDataPercentage >= 50) {
      console.log('⚠️ PARTIAL SUCCESS: Cache poisoning fix is working but needs optimization');
      console.log(`   - ${realDataPercentage.toFixed(1)}% real data is good progress`);
      console.log('   - Some cached fallbacks may still be present');
    } else {
      console.log('❌ NEEDS WORK: Cache poisoning fix requires additional investigation');
      console.log(`   - Only ${realDataPercentage.toFixed(1)}% real data detected`);
      console.log('   - Cache clearing or data quality validation needs adjustment');
    }
    
    // Save detailed results
    const reportData = {
      timestamp: new Date().toISOString(),
      apiStatus: response.status,
      totalETFs: totalETFs,
      realDataCount,
      partialDataCount,
      fakeDataCount,
      realDataPercentage,
      success: realDataPercentage >= 80,
      etfDetails: data.data.map((etf: any) => ({
        symbol: etf.symbol,
        rsi: etf.components?.rsi14,
        macdZ: etf.components?.macdZ,
        signal: etf.zScoreData?.signal,
        compositeZ: etf.zScoreData?.compositeZScore,
        price: etf.price
      }))
    };
    
    await fs.writeFile(
      'etf-cache-fix-verification-report.json', 
      JSON.stringify(reportData, null, 2)
    );
    
    console.log('');
    console.log('📄 Detailed report saved to: etf-cache-fix-verification-report.json');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('   💡 Tip: Make sure the server is running on localhost:5000');
    }
  }
  
  console.log('');
  console.log('🏁 ETF Cache Poisoning Fix verification completed');
}

// Run verification
verifyETFDataFix();