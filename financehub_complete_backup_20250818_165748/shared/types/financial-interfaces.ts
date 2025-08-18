/**
 * Financial data type definitions to replace 'any' types in calculations
 * Critical for production type safety in financial calculations
 */

export interface TechnicalIndicatorData {
  symbol: string;
  rsi: number | null;
  sma_20: number | null;
  sma_50: number | null;
  ema_20: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  percent_b: number | null;
  atr: number | null;
  volume_ratio: number | null;
  price: number | null;
  timestamp: Date;
}

export interface ZScoreData {
  symbol: string;
  rsiZScore: number | null;
  macdZScore: number | null;
  bollingerZScore: number | null;
  atrZScore: number | null;
  priceMomentumZScore: number | null;
  maTrendZScore: number | null;
  compositeZScore: number | null;
  shortTermZScore: number | null;
  mediumTermZScore: number | null;
  longTermZScore: number | null;
  ultraLongZScore: number | null;
  signal: string | null;
  regimeAware: boolean;
  timestamp: Date;
}

export interface PriceData {
  symbol: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  pctChange: number | null;
  ts: Date;
  provider: string;
}

export interface DatabaseQueryResult<T> {
  success: boolean;
  data: T[];
  error?: string;
  timestamp: Date;
}

export interface FinancialCalculationInput {
  prices: number[];
  period: number;
  symbol: string;
}

export interface FinancialCalculationResult {
  value: number | null;
  confidence: number;
  dataPoints: number;
  timestamp: Date;
}

export interface WeightedTechnicalScore {
  score: number;
  signal: string;
  zScoreData: ZScoreData;
  confidence: number;
  components: {
    rsi: number | null;
    macd: number | null;
    bollinger: number | null;
    momentum: number | null;
  };
}

export interface ETFPriceValidation {
  symbol: string;
  price: number;
  isValid: boolean;
  validationErrors: string[];
  dataSource: string;
  timestamp: Date;
}

export interface MarketDataResponse<T> {
  success: boolean;
  data: T;
  cached: boolean;
  timestamp: Date;
  source: string;
  error?: string;
}