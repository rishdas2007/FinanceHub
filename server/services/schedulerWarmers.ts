import { getEtfMetricsLatest } from './etfMetricsService';
import { setCache } from './cache';

const CACHE_KEY = 'etf:metrics:latest';
const TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

/**
 * Cache warmer for ETF metrics - called by scheduler after DB refresh
 */
export async function warmEtfMetricsCache() {
  try {
    console.log('🔄 Warming ETF metrics cache...');
    const start = performance.now();
    const rows = await getEtfMetricsLatest();
    
    // Create optimized payload matching controller format
    const optimizedData = rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      last_price: Number(row.last_price),
      pct_change_1d: Number(row.pct_change_1d),
      perf_5d: Number(row.perf_5d) || 0,
      perf_1m: Number(row.perf_1m) || 0,
      volume: Number(row.volume) || 0,
      rsi: Number(row.rsi) || 0,
      macd: Number(row.macd) || 0,
      bb_percent_b: Number(row.bb_percent_b) || 0,
      sma_50: Number(row.sma_50) || 0,
      sma_200: Number(row.sma_200) || 0,
      ema_21: Number(row.ema_21) || 0,
      mini_trend_30d: Array.isArray(row.mini_trend_30d) ? row.mini_trend_30d : []
    }));
    
    const payload = JSON.stringify({ 
      version: 1,
      updatedAt: new Date().toISOString(), 
      items: optimizedData 
    });
    
    await setCache(CACHE_KEY, payload, TTL_SECONDS);
    const duration = performance.now() - start;
    console.log(`✅ Warmed ETF metrics cache: ${rows.length} rows in ${duration.toFixed(1)}ms`);
    return rows.length;
  } catch (error) {
    console.error('❌ Failed to warm ETF metrics cache:', error);
    return 0;
  }
}

// Circuit breaker pattern - keep serving last good cache
let lastGoodPayload: string | null = null;

export async function getEtfMetricsCacheWithCircuitBreaker() {
  try {
    const count = await warmEtfMetricsCache();
    if (count > 0) {
      const payload = await getCache(CACHE_KEY);
      if (payload) {
        lastGoodPayload = payload;
      }
    }
    return count;
  } catch (error) {
    console.warn('⚡ Circuit breaker: Using last good ETF cache due to error:', error);
    if (lastGoodPayload) {
      await setCache(CACHE_KEY, lastGoodPayload, TTL_SECONDS);
      return 1; // Indicate we have fallback data
    }
    throw error;
  }
}

// Auto-warm cache every 5 minutes with circuit breaker
setInterval(() => {
  getEtfMetricsCacheWithCircuitBreaker().catch(err => {
    console.error('🔥 Cache warming failed completely:', err);
  });
}, 5 * 60 * 1000);