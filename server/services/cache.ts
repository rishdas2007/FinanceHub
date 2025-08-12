import Redis from 'ioredis';

let redis: Redis | null = null;
const memory = new Map<string, { expiresAt: number, value: string }>();

function getRedis(): Redis | null {
  if (process.env.REDIS_URL) {
    if (!redis) redis = new Redis(process.env.REDIS_URL);
    return redis;
  }
  return null;
}

export async function getCache(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) return await r.get(key);
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { memory.delete(key); return null; }
  return hit.value;
}

export async function setCache(key: string, value: string, ttlSeconds: number) {
  const r = getRedis();
  if (r) await r.setex(key, ttlSeconds, value);
  else memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}