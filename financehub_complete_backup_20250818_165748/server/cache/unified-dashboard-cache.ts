// Unified cache for dashboard movers data
// Simple in-memory cache with TTL and last-good fallback

const cache = new Map<string, { data: any; expires: number }>();
const lastGood = new Map<string, any>();

export async function getCache(key: string): Promise<any | null> {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

export async function setCache(key: string, data: any, ttlMs: number): Promise<void> {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs
  });
}

export async function getLastGood(key: string): Promise<any | null> {
  return lastGood.get(key) || null;
}

export async function setLastGood(key: string, data: any): Promise<void> {
  lastGood.set(key, data);
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expires) {
      cache.delete(key);
    }
  }
}, 60000); // Clean every minute