// Data integrity validation for ETF payloads
export interface EtfDataItem {
  symbol: string;
  last_price: number;
  asOf: string;
  provider: string;
}

export interface PayloadMetadata {
  asOf: string;
  provider: string;
  isStale: boolean;
  dqStatus: 'ok' | 'stale' | 'mismatch' | 'mixed';
}

export function validateEtfPayload(items: Array<EtfDataItem>): PayloadMetadata {
  if (!items?.length) {
    throw new Error('No items in payload');
  }

  // Check for valid timestamps
  const times = items.map(i => {
    const time = new Date(i.asOf).getTime();
    if (!isFinite(time)) throw new Error(`Invalid timestamp for ${i.symbol}: ${i.asOf}`);
    return time;
  });
  
  const tmin = Math.min(...times);
  const tmax = Math.max(...times);
  const timeDiff = tmax - tmin;
  
  // Flag mixed timestamps (>60s difference)
  if (timeDiff > 60_000) {
    console.warn(`⚠️ Mixed timestamps in payload: ${timeDiff}ms spread`);
    return {
      asOf: new Date(tmax).toISOString(),
      provider: items[0].provider,
      isStale: true,
      dqStatus: 'mixed'
    };
  }

  // Check for mixed providers
  const providers = new Set(items.map(i => i.provider));
  if (providers.size > 1) {
    console.warn(`⚠️ Mixed providers in payload: ${Array.from(providers).join(', ')}`);
    return {
      asOf: new Date(tmax).toISOString(),
      provider: items[0].provider,
      isStale: true,
      dqStatus: 'mixed'
    };
  }

  // Validate prices
  for (const item of items) {
    if (!isFinite(item.last_price) || item.last_price <= 0) {
      throw new Error(`Invalid price for ${item.symbol}: ${item.last_price}`);
    }
  }

  // Check if data is stale (more than 4 hours old during market hours)
  const now = Date.now();
  const dataAge = now - tmax;
  const isStale = dataAge > 4 * 60 * 60 * 1000; // 4 hours

  return {
    asOf: new Date(tmax).toISOString(),
    provider: items[0].provider,
    isStale,
    dqStatus: isStale ? 'stale' : 'ok'
  };
}

export function createContentETag(payload: any): string {
  const crypto = require('crypto');
  const payloadString = JSON.stringify(payload);
  return 'W/"' + crypto.createHash('sha1').update(payloadString).digest('hex') + '"';
}

export function validatePriceSanity(symbol: string, currentPrice: number, referencePrice?: number): boolean {
  if (!referencePrice) return true;
  
  const deviation = Math.abs(currentPrice - referencePrice) / referencePrice;
  const threshold = 0.02; // 2% threshold
  
  if (deviation > threshold) {
    console.warn(`🚨 Price sanity check failed for ${symbol}: ${currentPrice} vs ${referencePrice} (${(deviation * 100).toFixed(1)}% deviation)`);
    return false;
  }
  
  return true;
}