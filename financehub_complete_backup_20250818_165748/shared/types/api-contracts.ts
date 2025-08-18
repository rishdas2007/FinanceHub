import { z } from 'zod';

// Unified API Response Envelope
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  warning: z.string().optional(),
  cached: z.boolean().optional(),
  version: z.string().optional(),
  source: z.enum(['db', 'provider', 'cache']).optional(),
  timestamp: z.string().optional()
});

export type ApiResponse<T = unknown> = {
  success: boolean;
  data: T;
  warning?: string;
  cached?: boolean;
  version?: string;
  source?: 'db' | 'provider' | 'cache';
  timestamp?: string;
};

// Market Status
export const MarketStatusSchema = z.object({
  isOpen: z.boolean(),
  isPremarket: z.boolean(),
  isAfterHours: z.boolean(),
  nextOpen: z.string(),
  nextClose: z.string(),
  session: z.string(),
  label: z.string().optional()
});

export type MarketStatus = z.infer<typeof MarketStatusSchema>;

// Top Movers
export const MoverSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number().optional()
});

export const TopMoversSchema = z.object({
  gainers: z.array(MoverSchema),
  losers: z.array(MoverSchema)
});

export type TopMovers = z.infer<typeof TopMoversSchema>;

// ETF Metrics
export const ETFMetricsSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  changePercent: z.number(),
  
  // Technical indicators
  rsi: z.number().nullable(),
  macd: z.number().nullable(),
  bollingerPosition: z.number().nullable(),
  atr: z.number().nullable(),
  
  // Z-Score data
  zScoreData: z.object({
    rsiZScore: z.number().nullable(),
    macdZScore: z.number().nullable(),
    bollingerZScore: z.number().nullable(),
    compositeZScore: z.number().nullable(),
    signal: z.string().nullable(),
    regimeAware: z.boolean().nullable()
  }).nullable(),
  
  // Weighted scoring
  weightedScore: z.number().nullable(),
  weightedSignal: z.string().nullable(),
  
  // Status flags
  fallback: z.boolean().optional(),
  dataQuality: z.enum(['high', 'medium', 'low']).optional()
});

export type ETFMetrics = z.infer<typeof ETFMetricsSchema>;

// Stock History
export const StockHistoryPointSchema = z.object({
  t: z.number(), // timestamp in ms
  date: z.string(), // YYYY-MM-DD format
  close: z.number(),
  open: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  volume: z.number().optional()
});

export const StockHistorySchema = z.object({
  symbol: z.string(),
  window: z.string(),
  points: z.array(StockHistoryPointSchema),
  fallback: z.boolean().optional()
});

export type StockHistory = z.infer<typeof StockHistorySchema>;

// Economic Indicators
export const EconomicIndicatorSchema = z.object({
  series_id: z.string(),
  display_name: z.string(),
  category: z.string(),
  value_std: z.number(),
  standard_unit: z.string(),
  level_z: z.number().nullable(),
  change_z: z.number().nullable(),
  level_class: z.string().nullable(),
  trend_class: z.string().nullable(),
  multi_signal: z.string().nullable(),
  period_end: z.string(),
  confidence: z.number().optional()
});

export type EconomicIndicator = z.infer<typeof EconomicIndicatorSchema>;

// Health Check
export const HealthCheckSchema = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  provider: z.boolean(),
  lastEtlAt: z.string().optional(),
  validFeatures: z.number().optional(), // % of symbols with valid features
  uptime: z.number().optional()
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// Request Validators
export const WindowSchema = z.enum(['7D', '30D', '90D', '1Y', '3Y', 'MAX']);
export const UniverseSchema = z.enum(['etf', 'sector', 'all']);

// Helper function to create typed API response
export function createApiResponse<T>(
  data: T, 
  options: Partial<Omit<ApiResponse<T>, 'success' | 'data'>> = {}
): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...options
  };
}

// Helper function to create error response
export function createApiError(
  message: string,
  options: Partial<Omit<ApiResponse<null>, 'success' | 'data'>> = {}
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    warning: message,
    timestamp: new Date().toISOString(),
    source: 'system' as const,
    ...options
  };
}