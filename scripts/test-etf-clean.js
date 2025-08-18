#!/usr/bin/env node

/**
 * Test ETF Technical Metrics Clean Endpoint
 */

async function testETFCleanEndpoint() {
  console.log('🔍 Testing ETF Technical Clean endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:5000/api/etf/technical-clean');
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`✅ Success: ${data.success}`);
      console.log(`📊 ETF count: ${data.data?.length || 0}`);
      console.log(`📡 Source: ${data.source}`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📈 Sample ETF:');
        const sample = data.data[0];
        console.log(`   Symbol: ${sample.symbol}`);
        console.log(`   Price: $${sample.price}`);
        console.log(`   Change: ${sample.changePercent}%`);
        console.log(`   RSI: ${sample.rsi || 'N/A'}`);
        console.log(`   MACD: ${sample.macd || 'N/A'}`);
        console.log(`   Z-Score: ${sample.zScore || 'N/A'}`);
        console.log(`   Signal: ${sample.signal}`);
      }
      
    } else {
      const text = await response.text();
      console.log('❌ Error response:', text);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testETFCleanEndpoint().catch(console.error);