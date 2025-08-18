import { cacheService } from '../server/services/cache-unified';
import { logger } from '@shared/utils/logger';

async function clearETFCache() {
  console.log('🧹 Starting ETF cache clearing process...');
  
  try {
    // Clear all ETF-related caches
    const etfCacheKeys = [
      'etf-metrics-fast',
      'etf-metrics-standard', 
      'etf-metrics-cache',
      'etf-technical-indicators',
      'etf-zscore-data',
      'consolidated-etf-metrics'
    ];
    
    etfCacheKeys.forEach(key => {
      cacheService.delete(key);
      console.log(`🧹 Cleared cache key: ${key}`);
    });
    
    // Verify cache is empty
    const remainingData = etfCacheKeys.map(key => cacheService.get(key)).filter(Boolean);
    
    if (remainingData.length === 0) {
      console.log('✅ ETF cache successfully cleared');
      console.log('📊 Next API request will fetch fresh data from database');
    } else {
      console.log('⚠️ Some cache entries may still exist');
    }
    
  } catch (error) {
    console.error('❌ Failed to clear ETF cache:', error);
  }
}

clearETFCache();