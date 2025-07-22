/**
 * Unified number formatting utilities - consolidating all number formatting logic
 * Replaces scattered implementations across components and services
 */

export function formatNumber(value: any, decimals: number = 1): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '0.0' : num.toFixed(decimals);
}

export function formatCurrency(value: number, decimals: number = 2): string {
  return `$${formatNumber(value, decimals)}`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

export function parseNumberWithSuffix(value: string): number {
  const cleanValue = value.replace(/[^\d.-]/g, '');
  let num = parseFloat(cleanValue);
  
  if (value.includes('K') || value.includes('k')) {
    num *= 1000;
  } else if (value.includes('M') || value.includes('m')) {
    num *= 1000000;
  } else if (value.includes('B') || value.includes('b')) {
    num *= 1000000000;
  }
  
  return isNaN(num) ? 0 : num;
}

export function formatVariance(actual: string | number, forecast: string | number): {
  value: number;
  isPositive: boolean;
  formatted: string;
} | null {
  const actualStr = actual.toString();
  const forecastStr = forecast.toString();
  
  let actualValue = parseNumberWithSuffix(actualStr);
  let forecastValue = parseNumberWithSuffix(forecastStr);
  
  if (isNaN(actualValue) || isNaN(forecastValue)) return null;
  
  const variance = actualValue - forecastValue;
  let formattedVariance: string;
  
  const hasK = actualStr.includes('K') || forecastStr.includes('K');
  const hasM = actualStr.includes('M') || forecastStr.includes('M');
  const hasPercent = actualStr.includes('%');
  
  if (hasK) {
    const formattedValue = Math.abs(variance / 1000).toFixed(0);
    formattedVariance = variance > 0 ? `+${formattedValue}K` : `-${formattedValue}K`;
  } else if (hasM) {
    formattedVariance = variance > 0 ? `+${(variance/1000000).toFixed(2)}M` : `${(variance/1000000).toFixed(2)}M`;
  } else if (hasPercent) {
    formattedVariance = variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`;
  } else {
    const actualDecimals = actualStr.includes('.') ? actualStr.split('.')[1]?.length || 0 : 0;
    formattedVariance = variance > 0 ? `+${variance.toFixed(actualDecimals)}` : `${variance.toFixed(actualDecimals)}`;
  }
  
  return {
    value: variance,
    isPositive: variance > 0,
    formatted: formattedVariance
  };
}