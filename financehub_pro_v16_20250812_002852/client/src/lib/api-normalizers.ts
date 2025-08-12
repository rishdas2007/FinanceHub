// API response normalizers to handle different response shapes
// Ensures consistent data structure for UI components

export interface ETFMetric {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  [key: string]: any;
}

/**
 * Normalize ETF metrics response to ensure consistent array format
 */
export function normalizeETFMetrics(response: any): ETFMetric[] {
  // Handle different response shapes
  const data = 
    Array.isArray(response) ? response :
    response?.metrics ?? response?.data ?? response?.results ?? [];

  // Ensure it's an array
  if (!Array.isArray(data)) {
    console.warn('ETF metrics response is not an array:', typeof data);
    return [];
  }

  // Validate and clean each metric
  return data.map((metric: any, index: number) => {
    if (!metric || typeof metric !== 'object') {
      console.warn(`Invalid ETF metric at index ${index}:`, metric);
      return null;
    }

    // Ensure required fields exist
    if (!metric.symbol) {
      console.warn(`ETF metric missing symbol at index ${index}:`, metric);
      return null;
    }

    return {
      symbol: String(metric.symbol),
      name: String(metric.name || metric.symbol),
      price: Number(metric.price) || 0,
      changePercent: Number(metric.changePercent) || 0,
      ...metric // Spread other properties
    };
  }).filter(Boolean) as ETFMetric[];
}

/**
 * Normalize market status response
 */
export function normalizeMarketStatus(response: any) {
  return response?.status ?? response ?? {
    isOpen: false,
    nextOpen: null,
    nextClose: null
  };
}

/**
 * Normalize top movers response
 */
export function normalizeTopMovers(response: any) {
  const movers = response?.etfMovers ?? response?.movers ?? response;
  
  return {
    gainers: normalizeETFMetrics(movers?.gainers ?? []),
    losers: normalizeETFMetrics(movers?.losers ?? []),
    ...movers
  };
}

/**
 * Normalize economic indicators response
 */
export function normalizeEconomicIndicators(response: any) {
  const indicators = response?.indicators ?? response?.data ?? response ?? [];
  
  if (!Array.isArray(indicators)) {
    console.warn('Economic indicators response is not an array:', typeof indicators);
    return [];
  }

  return indicators.map((indicator: any) => ({
    metric: String(indicator.metric || 'Unknown'),
    value: indicator.value,
    formatted: indicator.formatted || String(indicator.value || 'N/A'),
    change: indicator.change || 0,
    signal: indicator.signal || 'neutral',
    ...indicator
  }));
}

/**
 * Safe number extraction with fallback
 */
export function safeNumber(value: any, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? fallback : parsed;
  }
  
  return fallback;
}

/**
 * Safe string extraction with fallback
 */
export function safeString(value: any, fallback: string = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (value !== null && value !== undefined) {
    return String(value);
  }
  
  return fallback;
}

/**
 * Generic response normalizer that applies endpoint-specific logic
 */
export function normalizeApiResponse(response: any, endpoint: string): any {
  if (!response) {
    console.warn(`Empty response from ${endpoint}`);
    return null;
  }

  // Apply endpoint-specific normalization
  if (endpoint.includes('/api/etf-metrics')) {
    return normalizeETFMetrics(response);
  }
  
  if (endpoint.includes('/api/market-status')) {
    return normalizeMarketStatus(response);
  }
  
  if (endpoint.includes('/api/top-movers')) {
    return normalizeTopMovers(response);
  }
  
  if (endpoint.includes('/api/macroeconomic-indicators')) {
    return normalizeEconomicIndicators(response);
  }

  // Default: try to unwrap common patterns
  return response?.data ?? response?.results ?? response;
}