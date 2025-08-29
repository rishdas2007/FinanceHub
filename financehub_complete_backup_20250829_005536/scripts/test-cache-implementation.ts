/**
 * Test Cache Implementation
 * Verify that the intelligent caching system is working correctly
 */

import { logger } from '../server/utils/logger';

async function testCacheImplementation() {
  console.log('🔍 === TESTING CACHE IMPLEMENTATION ===');
  console.log('');

  try {
    // Test 1: ETF Metrics Endpoint
    console.log('📊 Test 1: ETF Metrics Endpoint...');
    const etfStart = Date.now();
    
    const etfResponse = await fetch('http://localhost:5000/api/etf-metrics');
    const etfData = await etfResponse.json();
    const etfTime = Date.now() - etfStart;
    
    console.log(`⏱️ Response time: ${etfTime}ms`);
    console.log(`✅ Success: ${etfData.success}`);
    console.log(`📊 Data count: ${etfData.data?.length || 0}`);
    console.log(`🎯 Source: ${etfData.metadata?.source || 'unknown'}`);
    
    if (etfData.metadata?.cache_stats) {
      console.log(`📈 Cache stats: ${JSON.stringify(etfData.metadata.cache_stats)}`);
    }
    
    if (etfData.data && etfData.data.length > 0) {
      const sample = etfData.data[0];
      console.log(`📊 Sample ETF: ${sample.symbol} - $${sample.price} (${sample.changePercent}%)`);
      console.log(`📈 Technical: RSI=${sample.components?.rsi14}, MACD Z=${sample.components?.macdZ}`);
    }
    console.log('');

    // Test 2: Cache Statistics
    console.log('📈 Test 2: Cache Statistics...');
    try {
      const cacheResponse = await fetch('http://localhost:5000/api/cache/stats');
      const cacheData = await cacheResponse.json();
      
      if (cacheData.success) {
        const stats = cacheData.cache_statistics;
        console.log(`📊 Total entries: ${stats.total_entries}`);
        console.log(`🎯 Total hits: ${stats.total_hits}`);
        console.log(`⏱️ Average age: ${Math.round(stats.avg_age_seconds)}s`);
        console.log(`💾 Memory usage: ${Math.round(stats.memory_usage_mb)}MB`);
        
        if (stats.hit_rate_by_key) {
          console.log('📋 Hit rates by key:');
          Object.entries(stats.hit_rate_by_key).forEach(([key, data]: [string, any]) => {
            console.log(`  - ${key}: ${data.hits} hits, ${Math.round(data.age_seconds)}s old`);
          });
        }
      } else {
        console.log('❌ Cache stats endpoint failed');
      }
    } catch (cacheError) {
      console.log(`❌ Cache stats error: ${cacheError.message}`);
    }
    console.log('');

    // Test 3: Performance Comparison (multiple requests)
    console.log('⚡ Test 3: Performance Comparison (3 rapid requests)...');
    const times = [];
    
    for (let i = 1; i <= 3; i++) {
      const start = Date.now();
      const response = await fetch('http://localhost:5000/api/etf-metrics');
      const time = Date.now() - start;
      times.push(time);
      
      const data = await response.json();
      console.log(`  Request ${i}: ${time}ms (source: ${data.metadata?.source})`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const improvement = times[0] > avgTime ? ((times[0] - avgTime) / times[0] * 100) : 0;
    
    console.log(`📊 Average response time: ${Math.round(avgTime)}ms`);
    console.log(`⚡ Cache improvement: ${Math.round(improvement)}% faster after first request`);
    console.log('');

    // Test 4: Cache Refresh
    console.log('🔄 Test 4: Testing Cache Refresh...');
    try {
      const refreshResponse = await fetch('http://localhost:5000/api/cache/refresh/etf-metrics', {
        method: 'POST'
      });
      const refreshData = await refreshResponse.json();
      
      if (refreshData.success) {
        console.log(`✅ Cache refresh successful: ${refreshData.message}`);
        console.log(`📊 Data count: ${refreshData.data_count}`);
      } else {
        console.log(`❌ Cache refresh failed: ${refreshData.error}`);
      }
    } catch (refreshError) {
      console.log(`❌ Cache refresh error: ${refreshError.message}`);
    }
    console.log('');

    // Summary
    console.log('📋 === CACHE IMPLEMENTATION TEST SUMMARY ===');
    console.log(`✅ ETF Metrics API: ${etfData.success ? 'Working' : 'Failed'}`);
    console.log(`⚡ Response Time: ${etfTime}ms`);
    console.log(`🎯 Cache Source: ${etfData.metadata?.source === 'intelligent_cache' ? 'Cache Active' : 'Direct Query'}`);
    console.log(`📊 Data Integrity: ${etfData.data && etfData.data.length === 12 ? 'All 12 ETFs' : 'Missing Data'}`);
    
    if (avgTime < 50) {
      console.log('🎉 EXCELLENT: Sub-50ms performance achieved!');
    } else if (avgTime < 100) {
      console.log('✅ GOOD: Sub-100ms performance achieved');
    } else {
      console.log('⚠️ SLOW: Performance needs optimization');
    }
    
    return {
      success: etfData.success,
      response_time: etfTime,
      data_count: etfData.data?.length || 0,
      cache_active: etfData.metadata?.source === 'intelligent_cache',
      avg_performance: avgTime
    };

  } catch (error) {
    console.error('❌ Cache implementation test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute if run directly
if (import.meta.main) {
  testCacheImplementation()
    .then(result => {
      console.log('');
      console.log('🎯 Test completed:', result.success ? 'SUCCESS' : 'FAILED');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { testCacheImplementation };