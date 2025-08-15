/**
 * Unified Number Formatting Utility
 * Consolidated all number/currency/percentage formatting functions
 */

export function formatNumber(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toFixed(decimals);
}

export function formatPercentage(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00%';
  return `${num.toFixed(decimals)}%`;
}

export function formatCurrency(value: number | string, currency: string = 'USD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export function formatLargeNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^-0-9.]/g, '')) : value;
  if (isNaN(num)) return '0';
  
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  
  return num.toFixed(0);
}

export function parseNumberWithSuffix(value: string): number {
  const cleanValue = value.replace(/[^-0-9.KMBTkmbt]/g, '');
  const suffix = value.slice(-1).toUpperCase();
  const baseNum = parseFloat(cleanValue);
  
  if (isNaN(baseNum)) return 0;
  
  switch (suffix) {
    case 'K': return baseNum * 1e3;
    case 'M': return baseNum * 1e6;
    case 'B': return baseNum * 1e9;
    case 'T': return baseNum * 1e12;
    default: return baseNum;
  }
}

export function formatVariance(actual: string | number, forecast: string | number): { value: number; formatted: string } | null {
  const actualNum = typeof actual === 'string' ? parseFloat(actual.replace(/[^-0-9.]/g, '')) : actual;
  const forecastNum = typeof forecast === 'string' ? parseFloat(forecast.replace(/[^-0-9.]/g, '')) : forecast;
  
  if (isNaN(actualNum) || isNaN(forecastNum)) return null;
  
  const variance = actualNum - forecastNum;
  
  // Determine if we should use K/M formatting based on the magnitude
  if (Math.abs(variance) >= 1000) {
    return {
      value: variance,
      formatted: formatLargeNumber(variance)
    };
  }
  
  return {
    value: variance,
    formatted: variance.toFixed(2)
  };
}