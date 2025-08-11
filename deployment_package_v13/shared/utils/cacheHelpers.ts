/**
 * Centralized cache helper utilities
 * Eliminates inconsistent cache key naming and duration patterns
 */

import { CACHE_DURATIONS } from '../constants';

export function getCacheKey(prefix: string, identifier?: string): string {
  return identifier ? `${prefix}-${identifier.toUpperCase()}` : prefix;
}

export function getCacheDuration(type: keyof typeof CACHE_DURATIONS, isMarketHours?: boolean): number {
  if (type === 'SECTOR_DATA_MARKET_HOURS' || type === 'SECTOR_DATA_AFTER_HOURS') {
    return isMarketHours ? CACHE_DURATIONS.SECTOR_DATA_MARKET_HOURS : CACHE_DURATIONS.SECTOR_DATA_AFTER_HOURS;
  }
  return CACHE_DURATIONS[type];
}

export interface CacheOptions {
  key: string;
  duration: number;
  bypassCache?: boolean;
}

export function createCacheOptions(
  prefix: string, 
  durationType: keyof typeof CACHE_DURATIONS,
  identifier?: string,
  isMarketHours?: boolean,
  bypassCache = false
): CacheOptions {
  return {
    key: getCacheKey(prefix, identifier),
    duration: getCacheDuration(durationType, isMarketHours),
    bypassCache
  };
}