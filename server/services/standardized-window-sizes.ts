/**
 * Standardized Window Sizes Service
 * Defines asset-class appropriate lookback periods for statistical calculations
 */

export const OPTIMAL_WINDOWS = {
  // Daily data windows - Updated for 10 years of historical data (2520 trading days)
  EQUITIES: 2520,         // Full 10 years for maximum statistical accuracy
  ETF_TECHNICAL: 252,     // 1 year rolling window (upgraded from 63 days)
  VOLATILITY: 63,         // 3 months for vol calculations (upgraded from 22 days)
  SHORT_TERM: 63,         // 3 months for short-term signals (upgraded from 20 days)
  
  // Monthly data windows - Updated for 10 years of economic data (120 months)
  ECONOMIC_MONTHLY: 60,   // 5 years monthly (upgraded from 36 months)
  ECONOMIC_QUARTERLY: 40, // 10 years quarterly data for GDP, etc.
  INFLATION_ANALYSIS: 120, // 10 years for inflation analysis (upgraded from 60 months)
  
  // Specialized windows - Enhanced with longer historical context
  EARNINGS_CYCLE: 4,      // 4 quarters for earnings analysis
  BUSINESS_CYCLE: 120,    // 10 years for business cycle analysis (upgraded from 48 months)
  LONG_TERM_TRENDS: 240   // 20 years for long-term trend analysis (upgraded from 120 months)
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
 * Updated for 10 years of historical data - requires higher minimums for reliability
 */
export function getMinimumDataPoints(analysisType: WindowType): number {
  const window = OPTIMAL_WINDOWS[analysisType];
  
  // With 10 years available, require at least 50% of window for reliability
  return Math.max(Math.ceil(window * 0.5), window / 2);
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
        description: '10-year daily data with 63-day rolling calculations for maximum statistical power'
      };
      
    case 'etf':
      return {
        primaryWindow: OPTIMAL_WINDOWS.ETF_TECHNICAL,
        minimumPoints: getMinimumDataPoints('ETF_TECHNICAL'),
        rollingWindow: OPTIMAL_WINDOWS.SHORT_TERM,
        description: '1-year daily data optimized for ETF technical analysis with 10-year historical context'
      };
      
    case 'economic':
      return {
        primaryWindow: OPTIMAL_WINDOWS.ECONOMIC_MONTHLY,
        minimumPoints: getMinimumDataPoints('ECONOMIC_MONTHLY'),
        rollingWindow: 12, // 12-month rolling for economic data
        description: '5-year monthly data for economic indicator analysis with 10-year historical foundation'
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