/**
 * Comprehensive Cache Test
 * Validates the complete real data caching strategy implementation
 */

async function runComprehensiveCacheTest() {
  console.log('🎯 === COMPREHENSIVE REAL DATA CACHING TEST ===');
  console.log('📋 Testing: Intelligent cache + Real data preservation + Performance');
  console.log('');

  const results = {
    performance: [],
    data_integrity: null,
    cache_efficiency: null,
    overall_score: 0
  };

  try {
    // Test 1: Performance Benchmarking (5 rapid requests)
    console.log('⚡ Test 1: Performance Benchmarking...');
    for (let i = 1; i <= 5; i++) {
      const start = Date.now();
      const response = await fetch('http://localhost:5000/api/etf-metrics');
      const time = Date.now() - start;
      const data = await response.json();
      
      results.performance.push({
        request: i,
        time_ms: time,
        source: data.metadata?.source,
        data_count: data.data?.length || 0,
        success: data.success
      });
      
      console.log(`  Request ${i}: ${time}ms (${data.metadata?.source}) - ${data.data?.length || 0} ETFs`);
      
      if (i < 5) await new Promise(resolve => setTimeout(resolve, 200));
    }

    const avgTime = results.performance.reduce((sum, r) => sum + r.time_ms, 0) / results.performance.length;
    const cacheHits = results.performance.filter(r => r.source === 'intelligent_cache').length;
    const firstRequestTime = results.performance[0].time_ms;
    const avgCachedTime = results.performance.slice(1).reduce((sum, r) => sum + r.time_ms, 0) / 4;

    console.log(`📊 Average response time: ${Math.round(avgTime)}ms`);
    console.log(`⚡ Cache improvement: ${Math.round((firstRequestTime - avgCachedTime) / firstRequestTime * 100)}%`);
    console.log(`🎯 Cache hit rate: ${cacheHits}/5 requests`);
    console.log('');

    // Test 2: Data Integrity Validation
    console.log('🔍 Test 2: Data Integrity Validation...');
    const dataIntegrityResponse = await fetch('http://localhost:5000/api/data-integrity/status');
    const integrityData = await dataIntegrityResponse.json();
    
    if (integrityData.success) {
      results.data_integrity = integrityData.data_health;
      console.log(`📊 Overall Data Health Score: ${integrityData.data_health.overall_score}/100 (Grade: ${integrityData.data_health.grade})`);
      console.log(`✅ Real data sources: ${integrityData.data_health.real_data_sources}/${integrityData.data_health.total_sources}`);
      console.log(`🎯 Average confidence: ${integrityData.data_health.avg_confidence}%`);
      console.log(`📈 Status: ${integrityData.data_health.status}`);
    } else {
      console.log('❌ Data integrity check failed');
    }
    console.log('');

    // Test 3: Cache Efficiency Analysis
    console.log('📈 Test 3: Cache Efficiency Analysis...');
    const cacheMetricsResponse = await fetch('http://localhost:5000/api/data-integrity/cache-metrics');
    const cacheData = await cacheMetricsResponse.json();
    
    if (cacheData.success) {
      results.cache_efficiency = cacheData.cache_metrics.summary;
      console.log(`💾 Total cache entries: ${cacheData.cache_metrics.summary.total_entries}`);
      console.log(`🎯 Total cache hits: ${cacheData.cache_metrics.summary.total_hits}`);
      console.log(`⏱️ Average cache age: ${cacheData.cache_metrics.summary.avg_age_seconds}s`);
      console.log(`📊 Memory usage: ${cacheData.cache_metrics.summary.memory_usage_mb}MB`);
      
      cacheData.cache_metrics.performance_by_key.forEach(key => {
        console.log(`  - ${key.cache_key}: ${key.hits} hits, ${key.performance_rating} performance`);
      });
    } else {
      console.log('❌ Cache metrics check failed');
    }
    console.log('');

    // Test 4: Real Data Sample Validation
    console.log('🔬 Test 4: Real Data Sample Validation...');
    const etfResponse = await fetch('http://localhost:5000/api/etf-metrics');
    const etfData = await etfResponse.json();
    
    if (etfData.success && etfData.data.length > 0) {
      const samples = etfData.data.slice(0, 3);
      console.log('📊 Data Sample Analysis:');
      
      samples.forEach(etf => {
        const hasRealisticPrice = etf.price > 10 && etf.price < 1000;
        const hasRealVolume = etf.volume > 1000;
        const hasValidTimestamp = new Date(etf.lastUpdated).getTime() > 0;
        
        console.log(`  ${etf.symbol}: $${etf.price} (${etf.changePercent.toFixed(2)}%) Vol: ${etf.volume.toLocaleString()}`);
        console.log(`    ✅ Realistic: ${hasRealisticPrice ? 'Yes' : 'No'}, Volume: ${hasRealVolume ? 'Yes' : 'No'}, Timestamp: ${hasValidTimestamp ? 'Valid' : 'Invalid'}`);
        console.log(`    📈 RSI: ${etf.components.rsi14}, Volatility: ${etf.volatility || 'N/A'}`);
      });
    }
    console.log('');

    // Calculate Overall Score
    const performanceScore = avgTime < 50 ? 100 : avgTime < 100 ? 80 : avgTime < 200 ? 60 : 30;
    const dataIntegrityScore = results.data_integrity ? results.data_integrity.overall_score : 0;
    const cacheEfficiencyScore = cacheHits >= 4 ? 100 : cacheHits >= 2 ? 70 : 30;
    
    results.overall_score = Math.round((performanceScore * 0.4 + dataIntegrityScore * 0.4 + cacheEfficiencyScore * 0.2));

    // Final Summary
    console.log('📋 === COMPREHENSIVE TEST SUMMARY ===');
    console.log(`🎯 Overall Implementation Score: ${results.overall_score}/100`);
    console.log('');
    console.log('📊 Performance Results:');
    console.log(`  ⚡ Average response time: ${Math.round(avgTime)}ms`);
    console.log(`  🎯 Performance grade: ${performanceScore >= 80 ? 'EXCELLENT' : performanceScore >= 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT'}`);
    console.log('');
    console.log('🔍 Data Integrity Results:');
    console.log(`  ✅ Data health score: ${dataIntegrityScore}/100`);
    console.log(`  📈 Real data preserved: ${results.data_integrity?.status === 'HEALTHY' ? 'YES' : 'PARTIAL'}`);
    console.log('');
    console.log('📈 Cache Efficiency Results:');
    console.log(`  🎯 Cache hit rate: ${cacheHits}/5 (${Math.round(cacheHits/5*100)}%)`);
    console.log(`  💾 Cache performance: ${cacheEfficiencyScore >= 80 ? 'EXCELLENT' : 'GOOD'}`);
    console.log('');

    // Strategic Recommendations
    console.log('💡 STRATEGIC RECOMMENDATIONS:');
    if (results.overall_score >= 90) {
      console.log('🎉 OUTSTANDING: Implementation exceeds expectations!');
      console.log('✅ Real data caching strategy is production-ready');
      console.log('🚀 Consider deploying to production environment');
    } else if (results.overall_score >= 80) {
      console.log('✅ EXCELLENT: Implementation meets high standards');
      console.log('🔧 Minor optimizations could push to outstanding level');
      console.log('✅ Ready for production with monitoring');
    } else if (results.overall_score >= 70) {
      console.log('👍 GOOD: Solid implementation with room for improvement');
      console.log('🔧 Focus on cache hit rate optimization');
      console.log('📊 Monitor data integrity closely');
    } else {
      console.log('⚠️ NEEDS WORK: Implementation requires optimization');
      console.log('🔧 Review cache configuration and data sources');
      console.log('📊 Investigate performance bottlenecks');
    }

    return {
      success: true,
      overall_score: results.overall_score,
      performance_ms: Math.round(avgTime),
      data_integrity_score: dataIntegrityScore,
      cache_hit_rate: Math.round(cacheHits/5*100),
      recommendation: results.overall_score >= 80 ? 'PRODUCTION_READY' : 'NEEDS_OPTIMIZATION'
    };

  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
    return {
      success: false,
      error: error.message,
      recommendation: 'INVESTIGATE_ERROR'
    };
  }
}

// Execute test
if (import.meta.main) {
  runComprehensiveCacheTest()
    .then(result => {
      console.log('');
      console.log(`🎯 Test Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`📊 Final Score: ${result.overall_score || 0}/100`);
      console.log(`💡 Recommendation: ${result.recommendation}`);
      process.exit(result.success && result.overall_score >= 70 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution error:', error);
      process.exit(1);
    });
}

export { runComprehensiveCacheTest };