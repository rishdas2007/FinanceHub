/**
 * API Configuration for internal service calls
 * Centralizes URL configuration to avoid hardcoded localhost references
 */

const PORT = process.env.PORT || '5001';
const HOST = process.env.HOST || 'localhost';

export const API_CONFIG = {
  BASE_URL: `http://${HOST}:${PORT}`,
  ENDPOINTS: {
    MOMENTUM_ANALYSIS: '/api/momentum-analysis',
    ETF_METRICS: '/api/etf-metrics',
    TECHNICAL_INDICATORS: '/api/technical',
    MARKET_MOVERS: '/api/market-movers/stocks',
    STOCKS: '/api/stocks',
    ECONOMIC_CALENDAR: '/api/economic-calendar',
    ECONOMIC_OPENAI: '/api/recent-economic-openai'
  }
};

/**
 * Get full URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

/**
 * Common API endpoints
 */
export const API_URLS = {
  MOMENTUM_ANALYSIS: getApiUrl(API_CONFIG.ENDPOINTS.MOMENTUM_ANALYSIS),
  ETF_METRICS: getApiUrl(API_CONFIG.ENDPOINTS.ETF_METRICS),
  TECHNICAL_SPY: getApiUrl(`${API_CONFIG.ENDPOINTS.TECHNICAL_INDICATORS}/SPY`),
  MARKET_MOVERS: getApiUrl(API_CONFIG.ENDPOINTS.MARKET_MOVERS),
  VIX_STOCKS: getApiUrl(`${API_CONFIG.ENDPOINTS.STOCKS}/VIX`),
  ECONOMIC_CALENDAR: getApiUrl(API_CONFIG.ENDPOINTS.ECONOMIC_CALENDAR),
  ECONOMIC_OPENAI: getApiUrl(API_CONFIG.ENDPOINTS.ECONOMIC_OPENAI)
};