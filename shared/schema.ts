import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Note: users, stockData, and historicalStockData tables removed during technical debt cleanup
// These were orphaned tables with zero data and no active usage

export const marketSentiment = pgTable("market_sentiment", {
  id: serial("id").primaryKey(),
  vix: decimal("vix", { precision: 5, scale: 2 }).notNull(),
  vixChange: decimal("vix_change", { precision: 5, scale: 2 }),
  putCallRatio: decimal("put_call_ratio", { precision: 5, scale: 2 }).notNull(),
  putCallChange: decimal("put_call_change", { precision: 5, scale: 2 }),
  aaiiBullish: decimal("aaii_bullish", { precision: 5, scale: 2 }).notNull(),
  aaiiBullishChange: decimal("aaii_bullish_change", { precision: 5, scale: 2 }),
  aaiiBearish: decimal("aaii_bearish", { precision: 5, scale: 2 }).notNull(),
  aaiiBearishChange: decimal("aaii_bearish_change", { precision: 5, scale: 2 }),
  aaiiNeutral: decimal("aaii_neutral", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  dataSource: text("data_source").notNull().default("aaii_survey"), // Track data source
});

export const technicalIndicators = pgTable("technical_indicators", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 10, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 10, scale: 4 }),
  bb_upper: decimal("bb_upper", { precision: 10, scale: 2 }),
  bb_middle: decimal("bb_middle", { precision: 10, scale: 2 }),
  bb_lower: decimal("bb_lower", { precision: 10, scale: 2 }),
  percent_b: decimal("percent_b", { precision: 5, scale: 4 }),
  adx: decimal("adx", { precision: 5, scale: 2 }),
  stoch_k: decimal("stoch_k", { precision: 5, scale: 2 }),
  stoch_d: decimal("stoch_d", { precision: 5, scale: 2 }),
  sma_20: decimal("sma_20", { precision: 10, scale: 2 }),
  sma_50: decimal("sma_50", { precision: 10, scale: 2 }),
  vwap: decimal("vwap", { precision: 10, scale: 2 }),
  atr: decimal("atr", { precision: 10, scale: 4 }),
  willr: decimal("willr", { precision: 5, scale: 2 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Note: aiAnalysis table removed during technical debt cleanup
// Superseded by enhanced AI services

// Email subscription table for daily AI Market Commentary
export const emailSubscriptions = pgTable("email_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
});

// Note: economicEvents, historicalEconomicData, and marketBreadth tables removed
// These were orphaned tables replaced by enhanced economic indicator systems

// Z-Score Technical Indicators for statistical normalization
export const zscoreTechnicalIndicators = pgTable("zscore_technical_indicators", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  
  // Original technical indicator values
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 10, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 10, scale: 4 }),
  percentB: decimal("percent_b", { precision: 5, scale: 4 }),
  atr: decimal("atr", { precision: 10, scale: 4 }),
  priceChange: decimal("price_change", { precision: 8, scale: 4 }),
  maTrend: decimal("ma_trend", { precision: 10, scale: 4 }),
  
  // Z-Score normalized values (20-day rolling window)
  rsiZScore: decimal("rsi_zscore", { precision: 8, scale: 4 }),
  macdZScore: decimal("macd_zscore", { precision: 8, scale: 4 }),
  bollingerZScore: decimal("bollinger_zscore", { precision: 8, scale: 4 }),
  atrZScore: decimal("atr_zscore", { precision: 8, scale: 4 }),
  priceMomentumZScore: decimal("price_momentum_zscore", { precision: 8, scale: 4 }),
  maTrendZScore: decimal("ma_trend_zscore", { precision: 8, scale: 4 }),
  
  // Composite Z-Score and signals
  compositeZScore: decimal("composite_zscore", { precision: 8, scale: 4 }),
  signal: text("signal").notNull(), // BUY, SELL, HOLD
  signalStrength: decimal("signal_strength", { precision: 3, scale: 2 }),
  
  // Statistical metadata
  lookbackPeriod: integer("lookback_period").notNull().default(20),
  dataQuality: text("data_quality").notNull().default("good"), // good, partial, insufficient
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  symbolDateIdx: unique().on(table.symbol, table.date),
  symbolIdx: index("zscore_symbol_idx").on(table.symbol),
  dateIdx: index("zscore_date_idx").on(table.date),
}));

// Historical rolling statistics for Z-score calculations
export const rollingStatistics = pgTable("rolling_statistics", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  indicator: text("indicator").notNull(), // rsi, macd, bollinger, atr, price_momentum, ma_trend
  
  // 20-day rolling window statistics
  mean: decimal("mean", { precision: 12, scale: 6 }),
  standardDeviation: decimal("standard_deviation", { precision: 12, scale: 6 }),
  count: integer("count").notNull(),
  minimum: decimal("minimum", { precision: 12, scale: 6 }),
  maximum: decimal("maximum", { precision: 12, scale: 6 }),
  
  // Z-score calculation metadata
  windowSize: integer("window_size").notNull().default(20),
  calculationDate: timestamp("calculation_date").notNull().defaultNow(),
}, (table) => ({
  symbolDateIndicatorIdx: unique().on(table.symbol, table.date, table.indicator),
  symbolIndicatorIdx: index("rolling_stats_symbol_indicator_idx").on(table.symbol, table.indicator),
}));

// Multi-Timeframe Technical Convergence Analysis Tables
export const technicalIndicatorsMultiTimeframe = pgTable("technical_indicators_multi_timeframe", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(), // 1m, 5m, 1h, 1d, 1w, 1M
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd_line: decimal("macd_line", { precision: 10, scale: 4 }),
  macd_signal: decimal("macd_signal", { precision: 10, scale: 4 }),
  macd_histogram: decimal("macd_histogram", { precision: 10, scale: 4 }),
  bollinger_upper: decimal("bollinger_upper", { precision: 10, scale: 2 }),
  bollinger_middle: decimal("bollinger_middle", { precision: 10, scale: 2 }),
  bollinger_lower: decimal("bollinger_lower", { precision: 10, scale: 2 }),
  bollinger_width: decimal("bollinger_width", { precision: 10, scale: 4 }),
  bollinger_position: decimal("bollinger_position", { precision: 5, scale: 4 }),
  volume_sma_20: decimal("volume_sma_20", { precision: 15, scale: 0 }),
  volume_ratio: decimal("volume_ratio", { precision: 5, scale: 2 }),
  atr: decimal("atr", { precision: 10, scale: 4 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  symbolTimeframeIdx: index("symbol_timeframe_idx").on(table.symbol, table.timeframe),
  timestampIdx: index("multi_timeframe_timestamp_idx").on(table.timestamp),
}));

// Note: convergenceSignals, signalQualityScores, and bollingerSqueezeEvents tables removed 
// during technical debt cleanup - these were unused multi-timeframe analysis features

export const vixData = pgTable("vix_data", {
  id: serial("id").primaryKey(),
  vixValue: decimal("vix_value", { precision: 5, scale: 2 }).notNull(),
  vixChange: decimal("vix_change", { precision: 5, scale: 2 }).notNull(),
  vixChangePercent: decimal("vix_change_percent", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Note: All orphaned tables removed during technical debt cleanup:
// - sectorData, thematicAnalysis, metricPercentiles, historicalContext
// - marketRegimes, marketPatterns, narrativeMemory  
// - historicalTechnicalIndicators, historicalSectorData, historicalMarketSentiment
// These were unused/superseded features with zero data

// Data Collection Audit Trail
export const dataCollectionAudit = pgTable("data_collection_audit", {
  id: serial("id").primaryKey(),
  dataType: text("data_type").notNull(), // 'stock_data', 'technical_indicators', 'sector_data'
  symbol: text("symbol"), // NULL for market-wide data
  collectionDate: timestamp("collection_date").notNull(),
  recordsProcessed: integer("records_processed").notNull(),
  apiCallsUsed: integer("api_calls_used").notNull(),
  status: text("status").notNull(), // 'success', 'partial', 'failed'
  errorMessage: text("error_message"),
  dataRangeStart: timestamp("data_range_start"),
  dataRangeEnd: timestamp("data_range_end"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dataTypeIndex: index("idx_audit_data_type").on(table.dataType),
  collectionDateIndex: index("idx_audit_collection_date").on(table.collectionDate),
}));

// Note: Historical table type definitions removed - tables were orphaned and cleaned up
// Data lineage tracking table for complete audit trail
export const dataLineageLog = pgTable("data_lineage_log", {
  id: text("id").primaryKey(),
  seriesId: text("series_id").notNull(),
  operation: text("operation").notNull(), // 'ingestion', 'validation', 'transformation', 'calculation', 'output'
  stage: text("stage").notNull(), // 'ingress', 'processing', 'egress'
  timestamp: timestamp("timestamp").notNull(),
  sourceValue: decimal("source_value", { precision: 20, scale: 6 }),
  transformedValue: decimal("transformed_value", { precision: 20, scale: 6 }),
  metadata: jsonb("metadata").notNull(),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  seriesIdIndex: index("idx_lineage_series_id").on(table.seriesId),
  operationIndex: index("idx_lineage_operation").on(table.operation),
  timestampIndex: index("idx_lineage_timestamp").on(table.timestamp),
}));

export type DataCollectionAudit = typeof dataCollectionAudit.$inferSelect;
export type InsertDataCollectionAudit = typeof dataCollectionAudit.$inferInsert;
export type DataLineageLog = typeof dataLineageLog.$inferSelect;
export type InsertDataLineageLog = typeof dataLineageLog.$inferInsert;

// Schema definitions for active tables only

export const insertMarketSentimentSchema = createInsertSchema(marketSentiment).omit({
  id: true,
  timestamp: true,
});

export const insertTechnicalIndicatorsSchema = createInsertSchema(technicalIndicators).omit({
  id: true,
  timestamp: true,
});

export const insertVixDataSchema = createInsertSchema(vixData).omit({
  id: true,
  timestamp: true,
});

export const insertEmailSubscriptionSchema = createInsertSchema(emailSubscriptions).omit({
  id: true,
  subscribedAt: true,
  unsubscribedAt: true,
});

// Type definitions for active tables only
export type MarketSentiment = typeof marketSentiment.$inferSelect;
export type TechnicalIndicators = typeof technicalIndicators.$inferSelect;
export type VixData = typeof vixData.$inferSelect;
export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
export type InsertMarketSentiment = z.infer<typeof insertMarketSentimentSchema>;
export type InsertTechnicalIndicators = z.infer<typeof insertTechnicalIndicatorsSchema>;
export type InsertVixData = z.infer<typeof insertVixDataSchema>;
export type InsertEmailSubscription = z.infer<typeof insertEmailSubscriptionSchema>;

// Enhanced historical economic data table for proper time series accumulation
export const economicTimeSeries = pgTable("economic_time_series", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id").notNull(), // FRED series ID (CPIAUCSL, PAYEMS, etc.)
  indicator: text("indicator").notNull(), // Human readable name
  value: decimal("value", { precision: 15, scale: 4 }).notNull(),
  valueFormatted: text("value_formatted").notNull(), // "2.9%", "221K", etc.
  category: text("category").notNull(), // employment, inflation, etc.
  importance: text("importance").notNull(), // high, medium, low
  frequency: text("frequency").notNull(), // weekly, monthly, quarterly
  units: text("units").notNull(), // Percent, Thousands, etc.
  releaseDate: timestamp("release_date").notNull(), // When data was released
  periodDate: timestamp("period_date").notNull(), // What period data represents
  previousValue: decimal("previous_value", { precision: 15, scale: 4 }),
  monthlyChange: decimal("monthly_change", { precision: 8, scale: 4 }),
  annualChange: decimal("annual_change", { precision: 8, scale: 4 }),
  dataSource: text("data_source").notNull().default('fred'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Enhanced economic indicators history table for incremental FRED API updates
export const economicIndicatorsHistory = pgTable("economic_indicators_history", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id"), // FRED series ID for matching
  metricName: text("metric_name").notNull(), // Human readable name (actual database column)
  category: text("category").notNull(), // Growth, Inflation, Labor, etc.
  type: text("type").notNull(), // Leading, Coincident, Lagging
  frequency: text("frequency").notNull(), // weekly, monthly, quarterly
  value: decimal("value", { precision: 15, scale: 4 }).notNull(), // Main value (actual database column)
  periodDate: timestamp("period_date").notNull(), // Date for queries (actual database column)
  releaseDate: timestamp("release_date").notNull(), // Release date (actual database column)
  unit: text("unit").notNull(), // "Percent", "Thousands of Persons", etc.
  
  // Additional calculated fields
  forecast: decimal("forecast", { precision: 15, scale: 4 }),
  priorValue: decimal("prior_value", { precision: 15, scale: 4 }),
  monthlyChange: decimal("monthly_change", { precision: 8, scale: 4 }),
  annualChange: decimal("annual_change", { precision: 8, scale: 4 }),
  zScore12m: decimal("z_score_12m", { precision: 8, scale: 4 }),
  threeMonthAnnualized: decimal("three_month_annualized", { precision: 8, scale: 4 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => ({
  // Indexes for performance
  seriesIdIdx: index("series_id_idx").on(table.seriesId),
  metricNameIdx: index("metric_name_idx").on(table.metricName),
  categoryIdx: index("category_idx").on(table.category),
  periodDateIdx: index("period_date_idx").on(table.periodDate),
  // Unique constraint to prevent duplicates
  uniqueSeriesPeriod: unique("unique_series_period").on(table.seriesId, table.periodDate),
}));

// Current economic indicators table for latest values
export const economicIndicatorsCurrent = pgTable("economic_indicators_current", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id").notNull(),
  metric: text("metric").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(),
  frequency: text("frequency").notNull(),
  valueNumeric: decimal("value_numeric", { precision: 15, scale: 4 }).notNull(),
  periodDateDesc: text("period_date_desc").notNull(),
  releaseDateDesc: text("release_date_desc").notNull(),
  periodDate: timestamp("period_date").notNull(),
  releaseDate: timestamp("release_date").notNull(),
  unit: text("unit").notNull(),
  isLatest: boolean("is_latest").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  seriesIdIdx: index("current_series_id_idx").on(table.seriesId),
  isLatestIdx: index("current_is_latest_idx").on(table.isLatest),
  uniqueSeriesLatest: unique("unique_series_latest").on(table.seriesId, table.isLatest),
}));

// FRED update log for tracking incremental updates
export const fredUpdateLog = pgTable("fred_update_log", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  seriesId: text("series_id").notNull(),
  operation: text("operation").notNull(), // "insert", "update", "skip"
  periodDateDesc: text("period_date_desc").notNull(),
  valueNumeric: decimal("value_numeric", { precision: 15, scale: 4 }),
  outcome: text("outcome").notNull(), // "success", "duplicate", "error"
  errorMessage: text("error_message"),
  apiCallsUsed: integer("api_calls_used").notNull().default(0),
  executionTime: integer("execution_time"), // milliseconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  sessionIdIdx: index("fred_session_id_idx").on(table.sessionId),
  seriesIdIdx: index("fred_log_series_id_idx").on(table.seriesId),
  createdAtIdx: index("fred_log_created_at_idx").on(table.createdAt),
}));

// Historical context snapshots for AI analysis
export const historicalContextSnapshots = pgTable("historical_context_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  // Key economic indicators snapshot
  cpi: decimal("cpi", { precision: 8, scale: 4 }),
  cpiChange: decimal("cpi_change", { precision: 8, scale: 4 }),
  coreCpi: decimal("core_cpi", { precision: 8, scale: 4 }),
  unemployment: decimal("unemployment", { precision: 5, scale: 2 }),
  payrolls: integer("payrolls"), // in thousands
  retailSales: decimal("retail_sales", { precision: 8, scale: 4 }),
  housingStarts: decimal("housing_starts", { precision: 8, scale: 4 }),
  fedFunds: decimal("fed_funds", { precision: 5, scale: 2 }),
  
  // Composite scores for AI context
  inflationTrend: text("inflation_trend"), // "rising", "falling", "stable"
  employmentTrend: text("employment_trend"),
  housingTrend: text("housing_trend"),
  overallSentiment: text("overall_sentiment"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Data quality tracking for historical accumulation
export const dataQualityLog = pgTable("data_quality_log", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(), // "store", "backfill", "update"
  seriesId: text("series_id").notNull(),
  recordsProcessed: integer("records_processed").notNull(),
  recordsStored: integer("records_stored").notNull(),
  recordsSkipped: integer("records_skipped").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  executionTime: integer("execution_time"), // milliseconds
  status: text("status").notNull(), // "success", "partial", "failed"
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EconomicTimeSeries = typeof economicTimeSeries.$inferSelect;
export type InsertEconomicTimeSeries = typeof economicTimeSeries.$inferInsert;
export type HistoricalContextSnapshot = typeof historicalContextSnapshots.$inferSelect;
export type InsertHistoricalContextSnapshot = typeof historicalContextSnapshots.$inferInsert;
export type DataQualityLog = typeof dataQualityLog.$inferSelect;
export type InsertDataQualityLog = typeof dataQualityLog.$inferInsert;

// Comprehensive Economic Indicators Database Schema
export const economicIndicators = pgTable("economic_indicators", {
  id: serial("id").primaryKey(),
  indicator_name: text("indicator_name").notNull(),
  indicator_type: text("indicator_type").notNull(), // GDP, CPI, PPI, Employment, etc.
  category: text("category").notNull(), // Growth, Inflation, Labor, Housing, etc.
  agency: text("agency").notNull(), // BLS, BEA, Census, Fed Reserve, etc.
  frequency: text("frequency").notNull(), // Monthly, Quarterly, Annual
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
}, (table) => ({
  nameIdx: index("idx_indicator_name").on(table.indicator_name),
  typeIdx: index("idx_indicator_type").on(table.indicator_type),
  categoryIdx: index("idx_indicator_category").on(table.category)
}));

export const economicDataReadings = pgTable("economic_data_readings", {
  id: serial("id").primaryKey(),
  indicator_id: integer("indicator_id").references(() => economicIndicators.id).notNull(),
  release_date: timestamp("release_date").notNull(),
  period: text("period").notNull(), // "July 2025", "Q2 2025", etc.
  actual_value: text("actual_value"),
  forecast_value: text("forecast_value"),
  previous_value: text("previous_value"),
  unit: text("unit"), // %, millions, index, etc.
  beat_forecast: boolean("beat_forecast"), // true if actual > forecast
  variance: text("variance"), // actual - forecast
  source: text("source"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
}, (table) => ({
  indicatorIdx: index("idx_economic_data_indicator").on(table.indicator_id),
  dateIdx: index("idx_economic_data_date").on(table.release_date),
  periodIdx: index("idx_economic_data_period").on(table.period)
}));

export const economicSearchCache = pgTable("economic_search_cache", {
  id: serial("id").primaryKey(),
  search_query: text("search_query").notNull(),
  search_results: jsonb("search_results").notNull(),
  indicators_found: integer("indicators_found").notNull(),
  cached_at: timestamp("cached_at").defaultNow(),
  expires_at: timestamp("expires_at").notNull()
}, (table) => ({
  queryIdx: index("idx_search_query").on(table.search_query),
  expiresIdx: index("idx_search_expires").on(table.expires_at)
}));

// Types for the new economic tables
export type EconomicIndicator = typeof economicIndicators.$inferSelect;
export type InsertEconomicIndicator = typeof economicIndicators.$inferInsert;
export type EconomicDataReading = typeof economicDataReadings.$inferSelect;
export type InsertEconomicDataReading = typeof economicDataReadings.$inferInsert;
export type EconomicSearchCacheEntry = typeof economicSearchCache.$inferSelect;
export type InsertEconomicSearchCache = typeof economicSearchCache.$inferInsert;
// Economic Statistical Alerts - Only show metrics >1 std dev from mean
export const economicStatisticalAlerts = pgTable("economic_statistical_alerts", {
  id: serial("id").primaryKey(),
  metricName: text("metric_name").notNull(),
  category: text("category").notNull(),
  currentValue: decimal("current_value", { precision: 15, scale: 4 }).notNull(),
  mean: decimal("mean", { precision: 15, scale: 4 }).notNull(),
  std: decimal("std", { precision: 15, scale: 4 }).notNull(),
  zScore: decimal("z_score", { precision: 8, scale: 4 }).notNull(),
  trend: text("trend").notNull(), // increasing, decreasing, stable
  alertType: text("alert_type").notNull(), // "above_1std", "below_1std", "above_2std", "below_2std"
  periodStartDate: text("period_start_date").notNull(),
  periodEndDate: text("period_end_date").notNull(),
  analysisDate: timestamp("analysis_date").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  categoryIndex: index("idx_alerts_category").on(table.category),
  metricIndex: index("idx_alerts_metric").on(table.metricName),
  alertTypeIndex: index("idx_alerts_type").on(table.alertType),
  analysisDateIndex: index("idx_alerts_analysis_date").on(table.analysisDate),
}));

export type EconomicStatisticalAlert = typeof economicStatisticalAlerts.$inferSelect;
export type InsertEconomicStatisticalAlert = typeof economicStatisticalAlerts.$inferInsert;

export type EconomicIndicatorHistory = typeof economicIndicatorsHistory.$inferSelect;
export type InsertEconomicIndicatorHistory = typeof economicIndicatorsHistory.$inferInsert;
export type EconomicIndicatorCurrent = typeof economicIndicatorsCurrent.$inferSelect;
export type InsertEconomicIndicatorCurrent = typeof economicIndicatorsCurrent.$inferInsert;
export type FredUpdateLog = typeof fredUpdateLog.$inferSelect;
export type InsertFredUpdateLog = typeof fredUpdateLog.$inferInsert;
