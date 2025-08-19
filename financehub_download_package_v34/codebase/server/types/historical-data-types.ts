/**
 * Type definitions for unified historical data service
 */

export interface ZScoreResult {
  zScore: number | null;
  fallbackUsed: boolean;
  fallbackReason?: string;
  extremeValue: boolean;
  corruptionDetected: boolean;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  timestamp?: Date;
}

export interface MACDData {
  value: number;
  date: Date;
  ema12?: number;
  ema26?: number;
  signal?: number;
}

export interface RSIData {
  value: number;
  date: Date;
  period: number;
}

export interface BollingerData {
  percentB: number;
  date: Date;
  upper?: number;
  lower?: number;
  sma?: number;
}

export interface HistoricalDataOptions {
  deduplicated?: boolean;
  period?: number;
  fallback?: boolean;
  minDataPoints?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ValidationResult {
  corruptionDetected: boolean;
  reason?: string;
  confidence: number;
  anomalies: string[];
}

export interface StatisticalFallbacks {
  rsi: { mean: number; stddev: number };
  macd: { mean: number; stddev: number };
  percentB: { mean: number; stddev: number };
}

export interface TechnicalIndicatorConfig {
  symbol: string;
  indicators: ('rsi' | 'macd' | 'bollinger')[];
  period: number;
  options: HistoricalDataOptions;
}

export interface CalculationMetrics {
  processingTime: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  fallbacksUsed: number;
  corruptionDetected: boolean;
  totalDataPoints: number;
}

export type IndicatorType = 'rsi' | 'macd' | 'percent_b' | 'bollinger_upper' | 'bollinger_lower';
export type TimeFrame = 'daily' | 'weekly' | 'monthly';
export type ConfidenceLevel = 'high' | 'medium' | 'low';