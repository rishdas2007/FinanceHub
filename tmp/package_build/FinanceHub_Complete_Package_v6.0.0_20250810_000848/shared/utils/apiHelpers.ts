/**
 * Centralized API helper utilities
 * Consolidates rate limiting and request handling patterns
 */

import { API_RATE_LIMITS } from '../constants';

export interface RateLimitTracker {
  count: number;
  lastMinute: number;
  limit: number;
}

export function createRateLimitTracker(service: keyof typeof API_RATE_LIMITS): RateLimitTracker {
  return {
    count: 0,
    lastMinute: 0,
    limit: API_RATE_LIMITS[service]
  };
}

export async function checkRateLimit(tracker: RateLimitTracker): Promise<void> {
  const currentMinute = Math.floor(Date.now() / 60000);
  
  if (currentMinute !== tracker.lastMinute) {
    tracker.count = 0;
    tracker.lastMinute = currentMinute;
  }
  
  if (tracker.count >= tracker.limit) {
    console.log(`⏱️ Rate limit protection: ${tracker.count}/${tracker.limit} calls used this minute`);
    const waitTime = 60000 - (Date.now() % 60000) + 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    tracker.count = 0;
    tracker.lastMinute = Math.floor(Date.now() / 60000);
  }
  
  tracker.count++;
}

export function logApiCall(service: string, endpoint: string, success: boolean, duration?: number): void {
  const status = success ? '✅' : '❌';
  const timing = duration ? ` (${duration}ms)` : '';
  console.log(`${status} ${service} API: ${endpoint}${timing}`);
}