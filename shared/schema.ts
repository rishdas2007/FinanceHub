import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, jsonb, unique, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export the 3-layer economic data model
export * from './economic-data-model';

// Historical tables for comprehensive market data analysis
export const historicalStockData = pgTable("historical_stock_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  open: decimal("open", { precision: 10, scale: 2 }).notNull(),
  high: decimal("high", { precision: 10, scale: 2 }).notNull(),
  low: decimal("low", { precision: 10, scale: 2 }).notNull(),
  close: decimal("close", { precision: 10, scale: 2 }).notNull(),
  volume: integer("volume").notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  symbolDateIdx: unique().on(table.symbol, table.date),
  symbolIdx: index("historical_stock_symbol_idx").on(table.symbol),
  dateIdx: index("historical_stock_date_idx").on(table.date),
}));

export const stockData = pgTable("stock_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  change: decimal("change", { precision: 10, scale: 2 }).notNull(),
  percentChange: decimal("percent_change", { precision: 5, scale: 2 }).notNull(),
  volume: integer("volume").notNull(),
  marketCap: decimal("market_cap", { precision: 15, scale: 0 }),
  timestamp: timestamp("timestamp").notNull(), // Removed .defaultNow() to allow custom timestamps
});

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
  macd_line: decimal("macd_line", { precision: 10, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 10, scale: 4 }),
  macdHistogram: decimal("macd_histogram", { precision: 10, scale: 4 }),
  bb_upper: decimal("bb_upper", { precision: 10, scale: 2 }),
  bb_middle: decimal("bb_middle", { precision: 10, scale: 2 }),
  bb_lower: decimal("bb_lower", { precision: 10, scale: 2 }),
  percent_b: decimal("percent_b", { precision: 5, scale: 4 }),
  adx: decimal("adx", { precision: 5, scale: 2 }),
  stoch_k: decimal("stoch_k", { precision: 5, scale: 2 }),
  stoch_d: decimal("stoch_d", { precision: 5, scale: 2 }),
  sma_20: decimal("sma_20", { precision: 10, scale: 2 }),
  sma_50: decimal("sma_50", { precision: 10, scale: 2 }),
  ema_12: decimal("ema_12", { precision: 10, scale: 2 }),
  ema_26: decimal("ema_26", { precision: 10, scale: 2 }),
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
  
  // Z-Score normalized values (252-day rolling window for enhanced accuracy)
  rsiZScore: decimal("rsi_zscore", { precision: 8, scale: 4 }),
  macdZScore: decimal("macd_zscore", { precision: 8, scale: 4 }),
  bollingerZScore: decimal("bollinger_zscore", { precision: 8, scale: 4 }),
  atrZScore: decimal("atr_zscore", { precision: 8, scale: 4 }),
  priceMomentumZScore: decimal("price_momentum_zscore", { precision: 8, scale: 4 }),
  maTrendZScore: decimal("ma_trend_zscore", { precision: 8, scale: 4 }),
  
  // Multi-Horizon Composite Z-Scores (leveraging 10-year dataset)
  compositeZScore: decimal("composite_zscore", { precision: 8, scale: 4 }),
  shortTermZScore: decimal("short_term_zscore", { precision: 8, scale: 4 }), // 63 days (3 months)
  mediumTermZScore: decimal("medium_term_zscore", { precision: 8, scale: 4 }), // 252 days (1 year)
  longTermZScore: decimal("long_term_zscore", { precision: 8, scale: 4 }), // 756 days (3 years)
  ultraLongZScore: decimal("ultra_long_zscore", { precision: 8, scale: 4 }), // 1260 days (5 years)
  
  signal: text("signal").notNull(), // BUY, SELL, HOLD
  signalStrength: decimal("signal_strength", { precision: 3, scale: 2 }),
  regimeAware: boolean("regime_aware").notNull().default(false), // Indicates multi-horizon analysis
  
  // Statistical metadata - Updated for 10-year dataset analysis
  lookbackPeriod: integer("lookback_period").notNull().default(252), // 1-year default for enhanced accuracy
  dataQuality: text("data_quality").notNull().default("good"), // good, partial, insufficient
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  symbolDateIdx: unique().on(table.symbol, table.date),
  symbolIdx: index("zscore_symbol_idx").on(table.symbol),
  dateIdx: index("zscore_date_idx").on(table.date),
}));

// Historical rolling statistics for Z-score calculations
// Note: rollingStatistics table removed during enhanced 10-year dataset optimization
// This table was unused and replaced by direct in-memory statistical calculations

// Note: Multi-timeframe analysis tables removed during technical debt cleanup:
// - technicalIndicatorsMultiTimeframe 
// - convergenceSignals, signalQualityScores, and bollingerSqueezeEvents 
// These were unused multi-timeframe analysis features

export const vixData = pgTable("vix_data", {
  id: serial("id").primaryKey(),
  vixValue: decimal("vix_value", { precision: 5, scale: 2 }).notNull(),
  vixChange: decimal("vix_change", { precision: 5, scale: 2 }).notNull(),
  vixChangePercent: decimal("vix_change_percent", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Historical tables for comprehensive market analysis
export const historicalTechnicalIndicators = pgTable("historical_technical_indicators", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 10, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 10, scale: 4 }),
  percentB: decimal("percent_b", { precision: 5, scale: 4 }),
  atr: decimal("atr", { precision: 10, scale: 4 }),
  priceChange: decimal("price_change", { precision: 8, scale: 4 }),
  maTrend: decimal("ma_trend", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  symbolDateIdx: unique().on(table.symbol, table.date),
  symbolIdx: index("historical_tech_symbol_idx").on(table.symbol),
  dateIdx: index("historical_tech_date_idx").on(table.date),
}));

export const historicalMarketSentiment = pgTable("historical_market_sentiment", {
  id: serial("id").primaryKey(),
  vix: decimal("vix", { precision: 5, scale: 2 }).notNull(),
  vixChange: decimal("vix_change", { precision: 5, scale: 2 }),
  putCallRatio: decimal("put_call_ratio", { precision: 5, scale: 2 }),
  aaiiBullish: decimal("aaii_bullish", { precision: 5, scale: 2 }),
  aaiiBearish: decimal("aaii_bearish", { precision: 5, scale: 2 }),
  aaiiNeutral: decimal("aaii_neutral", { precision: 5, scale: 2 }),
  date: timestamp("date").notNull(),
  dataSource: text("data_source").notNull().default("market_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dateIdx: index("historical_sentiment_date_idx").on(table.date),
}));

export const historicalSectorData = pgTable("historical_sector_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(), // ETF ticker symbol (SPY, XLK, etc.)
  date: timestamp("date").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Closing price
  volume: integer("volume").notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }).notNull(),
  open: decimal("open", { precision: 10, scale: 2 }).notNull(),
  high: decimal("high", { precision: 10, scale: 2 }).notNull(),
  low: decimal("low", { precision: 10, scale: 2 }).notNull(),
  close: decimal("close", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  symbolDateIdx: unique().on(table.symbol, table.date),
  symbolIdx: index("historical_sector_symbol_idx").on(table.symbol),
  dateIdx: index("historical_sector_date_idx").on(table.date),
}));

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

// Historical economic data table for economic analysis
export const historicalEconomicData = pgTable("historical_economic_data", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id").notNull(),
  indicator: text("indicator").notNull(),
  value: decimal("value", { precision: 15, scale: 4 }).notNull(),
  category: text("category").notNull(),
  frequency: text("frequency").notNull(),
  releaseDate: timestamp("release_date").notNull(),
  periodDate: timestamp("period_date").notNull(),
  unit: text("unit").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  seriesIdIdx: index("historical_economic_series_idx").on(table.seriesId),
  periodDateIdx: index("historical_economic_period_idx").on(table.periodDate),
}));
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

// Historical table type definitions
export type HistoricalStockData = typeof historicalStockData.$inferSelect;
export type InsertHistoricalStockData = typeof historicalStockData.$inferInsert;
export type StockData = typeof stockData.$inferSelect;
export type InsertStockData = typeof stockData.$inferInsert;
export type HistoricalTechnicalIndicators = typeof historicalTechnicalIndicators.$inferSelect;
export type InsertHistoricalTechnicalIndicators = typeof historicalTechnicalIndicators.$inferInsert;
export type HistoricalMarketSentiment = typeof historicalMarketSentiment.$inferSelect;
export type InsertHistoricalMarketSentiment = typeof historicalMarketSentiment.$inferInsert;
export type HistoricalSectorData = typeof historicalSectorData.$inferSelect;
export type InsertHistoricalSectorData = typeof historicalSectorData.$inferInsert;
export type HistoricalEconomicData = typeof historicalEconomicData.$inferSelect;
export type InsertHistoricalEconomicData = typeof historicalEconomicData.$inferInsert;

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

// Economic Calendar - Daily economic data releases with historical tracking
export const economicCalendar = pgTable("economic_calendar", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id").notNull(), // FRED series identifier
  metricName: text("metric_name").notNull(), // Human-readable name
  category: text("category").notNull(), // Growth, Inflation, Labor, Housing, Finance, Consumption, Government, Trade
  releaseDate: timestamp("release_date").notNull(), // When data was released
  periodDate: timestamp("period_date").notNull(), // The period the data represents
  actualValue: decimal("actual_value", { precision: 15, scale: 4 }).notNull(), // The reported value
  previousValue: decimal("previous_value", { precision: 15, scale: 4 }), // Prior period value
  variance: decimal("variance", { precision: 15, scale: 4 }), // actual - previous
  variancePercent: decimal("variance_percent", { precision: 8, scale: 4 }), // Percentage change
  unit: text("unit").notNull(), // %, thousands, billions, index, etc.
  frequency: text("frequency").notNull(), // daily, weekly, monthly, quarterly, annual
  seasonalAdjustment: text("seasonal_adjustment"), // SA, NSA, SAAR
  
  // Investment-focused derived metrics
  yoyGrowthRate: decimal("yoy_growth_rate", { precision: 8, scale: 4 }), // Year-over-year growth percentage
  qoqAnnualizedRate: decimal("qoq_annualized_rate", { precision: 8, scale: 4 }), // Quarter-over-quarter annualized
  momAnnualizedRate: decimal("mom_annualized_rate", { precision: 8, scale: 4 }), // Month-over-month annualized
  volatility12m: decimal("volatility_12m", { precision: 8, scale: 4 }), // 12-month rolling volatility
  trendStrength: decimal("trend_strength", { precision: 5, scale: 4 }), // Trend strength indicator (-1 to 1)
  cyclePosition: text("cycle_position"), // Peak, Expansion, Trough, Contraction
  percentileRank1y: decimal("percentile_rank_1y", { precision: 5, scale: 2 }), // 1-year percentile ranking (0-100)
  percentileRank5y: decimal("percentile_rank_5y", { precision: 5, scale: 2 }), // 5-year percentile ranking (0-100)
  regimeClassification: text("regime_classification"), // Current economic regime
  investmentSignal: text("investment_signal"), // BULLISH, BEARISH, NEUTRAL
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  seriesIdIdx: index("economic_calendar_series_id_idx").on(table.seriesId),
  releaseDateIdx: index("economic_calendar_release_date_idx").on(table.releaseDate),
  categoryIdx: index("economic_calendar_category_idx").on(table.category),
  periodDateIdx: index("economic_calendar_period_date_idx").on(table.periodDate),
  frequencyIdx: index("economic_calendar_frequency_idx").on(table.frequency),
  // Unique constraint to prevent duplicates
  uniqueSeriesPeriod: unique("unique_series_period_economic_calendar").on(table.seriesId, table.periodDate),
}));

export type EconomicCalendar = typeof economicCalendar.$inferSelect;
export type InsertEconomicCalendar = typeof economicCalendar.$inferInsert;

// Derived Investment Metrics - Advanced calculations for investment analysis
export const econDerivedMetrics = pgTable("econ_derived_metrics", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id").notNull(), // FRED series identifier
  periodEnd: timestamp("period_end").notNull(), // End of the period for this calculation
  baseTransformCode: text("base_transform_code").notNull(), // Base transformation applied
  
  // Growth Metrics - Most critical for investment decisions
  yoyGrowth: decimal("yoy_growth", { precision: 10, scale: 4 }), // Year-over-year growth percentage
  qoqAnnualized: decimal("qoq_annualized", { precision: 10, scale: 4 }), // Quarter-over-quarter annualized rate
  momAnnualized: decimal("mom_annualized", { precision: 10, scale: 4 }), // Month-over-month annualized rate
  yoy3yrAvg: decimal("yoy_3yr_avg", { precision: 10, scale: 4 }), // 3-year average YoY growth
  
  // Moving Averages - Trend identification
  ma3m: decimal("ma_3m", { precision: 15, scale: 4 }), // 3-month moving average
  ma6m: decimal("ma_6m", { precision: 15, scale: 4 }), // 6-month moving average
  ma12m: decimal("ma_12m", { precision: 15, scale: 4 }), // 12-month moving average
  
  // Volatility & Risk Measures
  volatility3m: decimal("volatility_3m", { precision: 8, scale: 4 }), // 3-month volatility
  volatility12m: decimal("volatility_12m", { precision: 8, scale: 4 }), // 12-month volatility
  trendSlope: decimal("trend_slope", { precision: 10, scale: 6 }), // Linear trend slope
  
  // Investment Context - Historical positioning
  percentileRank1y: decimal("percentile_rank_1y", { precision: 5, scale: 2 }), // 1-year percentile (0-100)
  percentileRank5y: decimal("percentile_rank_5y", { precision: 5, scale: 2 }), // 5-year percentile (0-100)
  percentileRank10y: decimal("percentile_rank_10y", { precision: 5, scale: 2 }), // 10-year percentile (0-100)
  
  // Economic Cycle Analysis
  cycleDaysFromPeak: integer("cycle_days_from_peak"), // Days since last peak
  cycleDaysFromTrough: integer("cycle_days_from_trough"), // Days since last trough
  cyclePosition: text("cycle_position"), // Peak, Expansion, Trough, Contraction
  regimeClassification: text("regime_classification"), // Economic regime classification
  
  // Investment Signals
  investmentSignal: text("investment_signal"), // BULLISH, BEARISH, NEUTRAL
  signalStrength: decimal("signal_strength", { precision: 5, scale: 4 }), // Signal confidence (-1 to 1)
  sectorImplication: text("sector_implication"), // Which sectors benefit/suffer
  assetClassImpact: text("asset_class_impact"), // Stocks/Bonds/Commodities impact
  
  // Real vs Nominal Analysis (for inflation-sensitive metrics)
  realValue: decimal("real_value", { precision: 15, scale: 4 }), // Inflation-adjusted value
  realYoyGrowth: decimal("real_yoy_growth", { precision: 10, scale: 4 }), // Real YoY growth
  inflationImpact: decimal("inflation_impact", { precision: 8, scale: 4 }), // Inflation component
  
  // Quality and Confidence Metrics
  calculationConfidence: decimal("calculation_confidence", { precision: 3, scale: 2 }), // 0-1 confidence score
  dataQualityScore: decimal("data_quality_score", { precision: 3, scale: 2 }), // 0-1 quality score
  misssingDataPoints: integer("missing_data_points"), // Count of interpolated/missing values
  
  // Metadata
  calculationDate: timestamp("calculation_date").notNull().defaultNow(),
  pipelineVersion: text("pipeline_version").notNull(), // For versioning calculations
  calculationEngine: text("calculation_engine").notNull().default("v1.0"), // Engine version
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Primary performance indexes
  seriesDateIdx: index("econ_derived_series_date_idx").on(table.seriesId, table.periodEnd.desc()),
  
  // Dashboard query optimization - most recent data first
  dashboardIdx: index("econ_derived_dashboard_idx").on(table.seriesId, table.periodEnd.desc())
    .where(sql`period_end >= CURRENT_DATE - INTERVAL '24 months'`),
  
  // Growth rate analysis
  growthRatesIdx: index("econ_derived_growth_rates_idx").on(table.yoyGrowth, table.qoqAnnualized)
    .where(sql`yoy_growth IS NOT NULL`),
  
  // Volatility analysis
  volatilityIdx: index("econ_derived_volatility_idx").on(table.seriesId, table.volatility12m, table.periodEnd.desc()),
  
  // Percentile ranking queries  
  percentilesIdx: index("econ_derived_percentiles_idx").on(table.percentileRank1y, table.percentileRank5y)
    .where(sql`percentile_rank_1y IS NOT NULL`),
  
  // Investment signal analysis
  signalsIdx: index("econ_derived_signals_idx").on(table.investmentSignal, table.signalStrength, table.periodEnd.desc()),
  
  // Cross-metric analysis
  regimeAnalysisIdx: index("econ_derived_regime_idx").on(table.regimeClassification, table.cyclePosition, table.periodEnd.desc()),
  
  // Unique constraint to prevent duplicate calculations
  uniqueSeriesPeriodTransform: unique("unique_series_period_transform_derived").on(table.seriesId, table.periodEnd, table.baseTransformCode),
}));

export type EconDerivedMetrics = typeof econDerivedMetrics.$inferSelect;
export type InsertEconDerivedMetrics = typeof econDerivedMetrics.$inferInsert;

// Legacy tables - kept for compatibility (but not used by new Economic Calendar)
export const economicIndicatorsHistory = pgTable("economic_indicators_history", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id"),
  metricName: text("metric_name"),
  value: decimal("value", { precision: 15, scale: 4 }),
  periodDate: timestamp("period_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const economicIndicatorsCurrent = pgTable("economic_indicators_current", {
  id: serial("id").primaryKey(),
  seriesId: text("series_id"),
  metric: text("metric"),
  valueNumeric: decimal("value_numeric", { precision: 15, scale: 4 }),
  periodDate: timestamp("period_date"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type EconomicIndicatorHistory = typeof economicIndicatorsHistory.$inferSelect;
export type InsertEconomicIndicatorHistory = typeof economicIndicatorsHistory.$inferInsert;
export type EconomicIndicatorCurrent = typeof economicIndicatorsCurrent.$inferSelect;
export type InsertEconomicIndicatorCurrent = typeof economicIndicatorsCurrent.$inferInsert;

export type FredUpdateLog = typeof fredUpdateLog.$inferSelect;
export type InsertFredUpdateLog = typeof fredUpdateLog.$inferInsert;
