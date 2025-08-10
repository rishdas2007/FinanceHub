/**
 * Centralized variance calculation utilities
 * Consolidates duplicate variance calculation logic from economic calendar services
 */

// Re-export from unified utility
export { formatVariance, formatNumber, formatCurrency, formatPercentage, formatLargeNumber, parseNumberWithSuffix } from './numberFormatting-unified';

export function calculateImpact(actual: string | number, forecast: string | number): 'positive' | 'negative' | 'neutral' {
  try {
    const varianceResult = formatVariance(actual, forecast);
    if (!varianceResult) return 'neutral';
    const variance = varianceResult.value;
    
    if (variance > 0) return 'positive';
    if (variance < 0) return 'negative';
    return 'neutral';
  } catch {
    return 'neutral';
  }
}

export function formatVarianceDisplay(
  actual: string | number, 
  forecast: string | number,
  includeSign: boolean = true
): string {
  const variance = calculateVariance(actual, forecast);
  
  if (variance === 0) return '0';
  
  const sign = includeSign && variance > 0 ? '+' : '';
  
  // Format with appropriate K/M suffix if original values had them
  if (typeof actual === 'string') {
    if (actual.includes('K')) {
      return `${sign}${Math.round(variance)}K`;
    } else if (actual.includes('M')) {
      return `${sign}${variance.toFixed(1)}M`;
    } else if (actual.includes('%')) {
      return `${sign}${variance.toFixed(1)}%`;
    }
  }
  
  return `${sign}${variance.toFixed(1)}`;
}