#!/usr/bin/env node

/**
 * ETF Cache Bypass Test Script
 * Tests the /api/etf/technical-metrics endpoint to verify it returns real JSON data
 */

// Use built-in fetch (Node.js 18+)

async function testETFCacheBypass() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🔍 Testing ETF Cache Bypass...\n');
  
  try {
    // Test 1: Check if endpoint returns JSON
    console.log('📡 Testing: /api/etf/technical-metrics');
    const response = await fetch(`${baseUrl}/api/etf/technical-metrics`);
    const contentType = response.headers.get('content-type');
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${contentType}`);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ SUCCESS: Endpoint returns JSON');
        console.log(`✅ Data count: ${data.data?.length || 0} ETFs`);
        
        if (data.data && data.data.length > 0) {
          const sample = data.data[0];
          console.log('✅ Sample ETF data:');
          console.log(`   Symbol: ${sample.symbol}`);
          console.log(`   Price: $${sample.price}`);
          console.log(`   RSI: ${sample.rsi || 'N/A'}`);
          console.log(`   MACD: ${sample.macd || 'N/A'}`);
          console.log(`   Signal: ${sample.weightedSignal || 'N/A'}`);
          
          // Check if we're getting real data vs fake data
          const hasFakeData = sample.rsi === 50 && sample.macd === 0;
          if (hasFakeData) {
            console.log('🚨 WARNING: Still receiving synthetic data (RSI=50, MACD=0)');
          } else {
            console.log('✅ SUCCESS: Receiving real market data');
          }
        }
        
        if (data.metadata) {
          console.log(`✅ Source: ${data.metadata.source || 'unknown'}`);
          console.log(`✅ Cached: ${data.metadata.cached || false}`);
        }
        
      } else {
        console.log('❌ ERROR: Response has success=false');
        console.log(data);
      }
      
    } else {
      console.log('❌ ERROR: Endpoint returns HTML instead of JSON');
      const text = await response.text();
      console.log('Response preview:', text.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  // Test 2: Check cache status
  try {
    console.log('\n📊 Testing: Cache status');
    const cacheResponse = await fetch(`${baseUrl}/api/etf/cache/stats`);
    
    if (cacheResponse.ok) {
      const cacheData = await cacheResponse.json();
      console.log('✅ Cache stats:', cacheData);
    } else {
      console.log('⚠️  Cache stats endpoint not available');
    }
    
  } catch (error) {
    console.log('⚠️  Cache test skipped:', error.message);
  }
  
  console.log('\n🔧 Test completed');
}

testETFCacheBypass().catch(console.error);