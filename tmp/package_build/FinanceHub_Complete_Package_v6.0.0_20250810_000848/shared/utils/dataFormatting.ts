/**
 * Centralized data formatting utilities
 * Consolidates number formatting and data presentation patterns
 */

export function formatPrice(price: number | string, decimals: number = 2): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0.00';
  return num.toFixed(decimals);
}

export function formatPercentage(percentage: number | string, decimals: number = 2): string {
  const num = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
  if (isNaN(num)) return '0.00%';
  return `${num.toFixed(decimals)}%`;
}

export function formatLargeNumber(num: number | string): string {
  const value = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(value)) return '0';
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

export function formatVariance(actual: string | number, forecast: string | number): string {
  const actualNum = typeof actual === 'string' ? parseFloat(actual.replace(/[^-0-9.]/g, '')) : actual;
  const forecastNum = typeof forecast === 'string' ? parseFloat(forecast.replace(/[^-0-9.]/g, '')) : forecast;
  
  if (isNaN(actualNum) || isNaN(forecastNum)) return '0';
  
  const variance = actualNum - forecastNum;
  
  // Format with appropriate K/M suffix if original values had them
  if (typeof actual === 'string' && actual.includes('K')) {
    return `${variance >= 0 ? '+' : ''}${Math.round(variance)}K`;
  } else if (typeof actual === 'string' && actual.includes('M')) {
    return `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}M`;
  } else if (typeof actual === 'string' && actual.includes('%')) {
    return `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`;
  }
  
  return `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}`;
}

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export function parseNumericValue(value: string): number {
  return parseFloat(value.replace(/[^-0-9.]/g, '')) || 0;
}