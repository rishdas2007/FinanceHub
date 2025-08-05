/**
 * Standardized Window Sizes Service
 * Defines asset-class appropriate lookback periods for statistical calculations
 */

export const OPTIMAL_WINDOWS = {
  // Daily data windows
  EQUITIES: 252,      // 1 year daily data for individual stocks
  ETF_TECHNICAL: 63,  // 3 months daily data for ETF technical analysis
  VOLATILITY: 22,     // 1 month for volatility calculations (VIX-style)
  SHORT_TERM: 20,     // 1 month for short-term momentum
  
  // Monthly data windows  
  ECONOMIC_MONTHLY: 36,   // 3 years monthly data for economic indicators
  ECONOMIC_QUARTERLY: 40, // 10 years quarterly data for GDP, etc.
  INFLATION_ANALYSIS: 60,  // 5 years monthly for inflation analysis
  
  // Specialized windows
  EARNINGS_CYCLE: 4,      // 4 quarters for earnings analysis
  BUSINESS_CYCLE: 48,     // 4 years monthly for business cycle analysis
  LONG_TERM_TRENDS: 120   // 10 years monthly for long-term trend analysis
} as const;

export type WindowType = keyof typeof OPTIMAL_WINDOWS;

/**
 * Get appropriate window size for specific analysis type
 */
export function getOptimalWindow(analysisType: WindowType): number {
  return OPTIMAL_WINDOWS[analysisType];
}

/**
 * Get minimum required data points for reliable statistics
 */
export function getMinimumDataPoints(analysisType: WindowType): number {
  const window = OPTIMAL_WINDOWS[analysisType];
  
  // Minimum is typically 1.5x the window size for stable statistics
  return Math.max(Math.ceil(window * 1.5), 30);
}

/**
 * Validate if dataset has sufficient data for analysis
 */
export function validateDataSufficiency(
  dataPoints: number, 
  analysisType: WindowType
): { sufficient: boolean; recommended: number; minimum: number } {
  const window = OPTIMAL_WINDOWS[analysisType];
  const minimum = getMinimumDataPoints(analysisType);
  
  return {
    sufficient: dataPoints >= minimum,
    recommended: window,
    minimum
  };
}

/**
 * Get asset-class specific configuration
 */
export interface AssetClassConfig {
  primaryWindow: number;
  minimumPoints: number;
  rollingWindow: number;
  description: string;
}

export function getAssetClassConfig(assetClass: 'equity' | 'etf' | 'economic' | 'volatility'): AssetClassConfig {
  switch (assetClass) {
    case 'equity':
      return {
        primaryWindow: OPTIMAL_WINDOWS.EQUITIES,
        minimumPoints: getMinimumDataPoints('EQUITIES'),
        rollingWindow: OPTIMAL_WINDOWS.SHORT_TERM,
        description: '1-year daily data with 20-day rolling calculations'
      };
      
    case 'etf':
      return {
        primaryWindow: OPTIMAL_WINDOWS.ETF_TECHNICAL,
        minimumPoints: getMinimumDataPoints('ETF_TECHNICAL'),
        rollingWindow: OPTIMAL_WINDOWS.SHORT_TERM,
        description: '3-month daily data optimized for ETF technical analysis'
      };
      
    case 'economic':
      return {
        primaryWindow: OPTIMAL_WINDOWS.ECONOMIC_MONTHLY,
        minimumPoints: getMinimumDataPoints('ECONOMIC_MONTHLY'),
        rollingWindow: 12, // 12-month rolling for economic data
        description: '3-year monthly data for economic indicator analysis'
      };
      
    case 'volatility':
      return {
        primaryWindow: OPTIMAL_WINDOWS.VOLATILITY,
        minimumPoints: getMinimumDataPoints('VOLATILITY'),
        rollingWindow: 10, // 10-day rolling for volatility
        description: '1-month daily data for volatility regime detection'
      };
      
    default:
      throw new Error(`Unknown asset class: ${assetClass}`);
  }
}