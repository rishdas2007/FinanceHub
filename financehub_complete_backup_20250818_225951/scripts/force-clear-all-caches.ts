/**
 * Force Clear All Cache Layers - Aggressive Cache Busting
 * Clears every possible cache layer to eliminate fake data persistence
 */

import { cacheService } from '../server/services/cache-unified';

async function forceClearAllCaches() {
  console.log('🧹 FORCE CLEARING ALL CACHE LAYERS...');
  console.log('');
  
  try {
    // 1. ETF-specific cache keys
    const etfCacheKeys = [
      'etf-metrics-fast',
      'etf-metrics-standard', 
      'etf-metrics-cache',
      'etf-technical-indicators',
      'etf-zscore-data',
      'consolidated-etf-metrics',
      'etf-technical',
      'etf-metrics',
      'etf-price-data',
      'etf-technical-data'
    ];
    
    // 2. Technical indicator cache keys
    const technicalCacheKeys = [
      'technical-indicators',
      'zscore-technical',
      'standard-technical-indicators',
      'technical-data-cache',
      'indicator-cache'
    ];
    
    // 3. General system caches
    const systemCacheKeys = [
      'market-data',
      'stock-data',
      'price-cache',
      'api-cache',
      'response-cache'
    ];
    
    // 4. Combine all cache keys
    const allCacheKeys = [...etfCacheKeys, ...technicalCacheKeys, ...systemCacheKeys];
    
    console.log(`🎯 Targeting ${allCacheKeys.length} cache keys for clearing...`);
    console.log('');
    
    let clearedCount = 0;
    let errorCount = 0;
    
    // Clear each cache key
    for (const key of allCacheKeys) {
      try {
        const existed = cacheService.get(key) !== null;
        cacheService.delete(key);
        
        if (existed) {
          console.log(`✅ Cleared cache key: ${key}`);
          clearedCount++;
        } else {
          console.log(`⚪ Cache key not found: ${key}`);
        }
      } catch (error) {
        console.log(`❌ Error clearing ${key}:`, error);
        errorCount++;
      }
    }
    
    // 5. Clear any remaining cache entries by pattern matching
    console.log('');
    console.log('🔍 Clearing remaining cache entries...');
    
    try {
      // Get all cache keys and clear any that might contain ETF/technical data
      const cacheKeys = Object.keys(cacheService.cache?.data || {});
      
      for (const key of cacheKeys) {
        if (key.toLowerCase().includes('etf') || 
            key.toLowerCase().includes('technical') ||
            key.toLowerCase().includes('indicator') ||
            key.toLowerCase().includes('zscore') ||
            key.toLowerCase().includes('price') ||
            key.toLowerCase().includes('stock')) {
          
          cacheService.delete(key);
          console.log(`🧹 Pattern-matched clear: ${key}`);
          clearedCount++;
        }
      }
    } catch (error) {
      console.log('⚠️ Pattern matching clear failed:', error);
    }
    
    // 6. Force garbage collection if available
    try {
      if (global.gc) {
        global.gc();
        console.log('🗑️ Forced garbage collection');
      }
    } catch (error) {
      // Garbage collection not available
    }
    
    console.log('');
    console.log('📊 Cache Clearing Summary:');
    console.log(`   ✅ Successfully cleared: ${clearedCount} cache entries`);
    console.log(`   ❌ Errors encountered: ${errorCount} entries`);
    console.log('');
    
    // 7. Verify cache is empty
    const remainingETFData = etfCacheKeys
      .map(key => ({ key, data: cacheService.get(key) }))
      .filter(item => item.data !== null);
    
    if (remainingETFData.length === 0) {
      console.log('✅ SUCCESS: All ETF caches completely cleared');
      console.log('📊 Next API request will fetch 100% fresh data from database');
    } else {
      console.log('⚠️ WARNING: Some cache entries may still exist:');
      remainingETFData.forEach(item => {
        console.log(`   - ${item.key}: ${JSON.stringify(item.data).substring(0, 100)}...`);
      });
    }
    
    console.log('');
    console.log('🚀 RECOMMENDATION: Test ETF metrics endpoint immediately');
    console.log('   curl http://localhost:5000/api/etf/technical-metrics');
    
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
  }
}

forceClearAllCaches();