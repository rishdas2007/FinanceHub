import { getEtfMetricsLatest } from './etfMetricsService';
import { setCache } from './cache';

const CACHE_KEY = 'etf:metrics:latest';
const TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

/**
 * Cache warmer for ETF metrics - called by scheduler
 */
export async function warmEtfMetricsCache() {
  try {
    console.log('🔄 Warming ETF metrics cache...');
    const rows = await getEtfMetricsLatest();
    const payload = JSON.stringify({ 
      updatedAt: new Date().toISOString(), 
      items: rows 
    });
    
    await setCache(CACHE_KEY, payload, TTL_SECONDS);
    console.log(`✅ Warmed ETF metrics cache with ${rows.length} rows`);
    return rows.length;
  } catch (error) {
    console.error('❌ Failed to warm ETF metrics cache:', error);
    return 0;
  }
}

// Auto-warm cache every 5 minutes
setInterval(warmEtfMetricsCache, 5 * 60 * 1000);