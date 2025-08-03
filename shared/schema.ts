import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const stockData = pgTable("stock_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  change: decimal("change", { precision: 10, scale: 2 }).notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }).notNull(),
  volume: integer("volume").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

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
  dataSource: text("data_source").notNull().default("twelve_data"), // Track data source
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

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  marketConditions: text("market_conditions").notNull(),
  technicalOutlook: text("technical_outlook").notNull(),
  riskAssessment: text("risk_assessment").notNull(),
  sectorRotation: text("sector_rotation").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Email subscription table for daily AI Market Commentary
export const emailSubscriptions = pgTable("email_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
});

export const economicEvents = pgTable("economic_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  importance: text("importance").notNull(),
  eventDate: timestamp("event_date").notNull(),
  actual: text("actual"),
  forecast: text("forecast"),
  previous: text("previous"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const historicalEconomicData = pgTable("historical_economic_data", {
  id: serial("id").primaryKey(),
  indicator: text("indicator").notNull(), // CPI, PPI, Retail Sales, etc.
  value: text("value").notNull(), // Actual reading
  previousValue: text("previous_value"), // Previous period value
  forecast: text("forecast"), // Forecasted value
  unit: text("unit"), // %, millions, etc.
  period: text("period").notNull(), // Jul 2025, Q2 2025, etc.
  releaseDate: text("release_date").notNull(), // YYYY-MM-DD
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const marketBreadth = pgTable("market_breadth", {
  id: serial("id").primaryKey(),
  advancingIssues: integer("advancing_issues").notNull(),
  decliningIssues: integer("declining_issues").notNull(),
  advancingVolume: decimal("advancing_volume", { precision: 15, scale: 0 }).notNull(),
  decliningVolume: decimal("declining_volume", { precision: 15, scale: 0 }).notNull(),
  newHighs: integer("new_highs").notNull(),
  newLows: integer("new_lows").notNull(),
  mcclellanOscillator: decimal("mcclellan_oscillator", { precision: 10, scale: 4 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

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

export const convergenceSignals = pgTable("convergence_signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  signal_type: text("signal_type").notNull(), // bollinger_squeeze, ma_convergence, rsi_divergence, volume_confirmation
  timeframes: jsonb("timeframes").notNull(), // Array of timeframes
  strength: integer("strength").notNull(), // 0-100
  confidence: integer("confidence").notNull(), // 0-100 based on historical success
  direction: text("direction").notNull(), // bullish, bearish, neutral
  detected_at: timestamp("detected_at").notNull(),
  expires_at: timestamp("expires_at").notNull(),
  metadata: jsonb("metadata").notNull().default('{}'),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  symbolIdx: index("convergence_symbol_idx").on(table.symbol),
  signalTypeIdx: index("signal_type_idx").on(table.signal_type),
  detectedAtIdx: index("detected_at_idx").on(table.detected_at),
  isActiveIdx: index("is_active_idx").on(table.is_active),
}));

export const signalQualityScores = pgTable("signal_quality_scores", {
  id: serial("id").primaryKey(),
  signal_type: text("signal_type").notNull(),
  symbol: text("symbol").notNull(),
  timeframe_combination: text("timeframe_combination").notNull(),
  total_occurrences: integer("total_occurrences").notNull().default(0),
  successful_occurrences: integer("successful_occurrences").notNull().default(0),
  success_rate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default('0'),
  avg_return_24h: decimal("avg_return_24h", { precision: 10, scale: 4 }).notNull().default('0'),
  avg_return_7d: decimal("avg_return_7d", { precision: 10, scale: 4 }).notNull().default('0'),
  last_updated: timestamp("last_updated").notNull().defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  signalSymbolIdx: index("signal_symbol_idx").on(table.signal_type, table.symbol),
  successRateIdx: index("success_rate_idx").on(table.success_rate),
  uniqueSignalConstraint: unique("unique_signal_combination").on(table.signal_type, table.symbol, table.timeframe_combination),
}));

export const bollingerSqueezeEvents = pgTable("bollinger_squeeze_events", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  squeeze_start: timestamp("squeeze_start").notNull(),
  squeeze_end: timestamp("squeeze_end"),
  squeeze_duration_hours: integer("squeeze_duration_hours"),
  breakout_direction: text("breakout_direction"), // up, down, null
  breakout_strength: decimal("breakout_strength", { precision: 5, scale: 2 }),
  price_at_squeeze: decimal("price_at_squeeze", { precision: 10, scale: 2 }).notNull(),
  price_at_breakout: decimal("price_at_breakout", { precision: 10, scale: 2 }),
  volume_at_squeeze: decimal("volume_at_squeeze", { precision: 15, scale: 0 }).notNull(),
  volume_at_breakout: decimal("volume_at_breakout", { precision: 15, scale: 0 }),
  return_24h: decimal("return_24h", { precision: 10, scale: 4 }),
  return_7d: decimal("return_7d", { precision: 10, scale: 4 }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  symbolTimeframeIdx: index("squeeze_symbol_timeframe_idx").on(table.symbol, table.timeframe),
  squeezeStartIdx: index("squeeze_start_idx").on(table.squeeze_start),
  isActiveIdx: index("squeeze_is_active_idx").on(table.is_active),
}));

export const vixData = pgTable("vix_data", {
  id: serial("id").primaryKey(),
  vixValue: decimal("vix_value", { precision: 5, scale: 2 }).notNull(),
  vixChange: decimal("vix_change", { precision: 5, scale: 2 }).notNull(),
  vixChangePercent: decimal("vix_change_percent", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const sectorData = pgTable("sector_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }).notNull(),
  fiveDayChange: decimal("five_day_change", { precision: 5, scale: 2 }),
  oneMonthChange: decimal("one_month_change", { precision: 5, scale: 2 }),
  volume: integer("volume").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Enhanced AI Analysis Schema for Thematic Commentary
export const thematicAnalysis = pgTable("thematic_analysis", {
  id: serial("id").primaryKey(),
  bottomLine: text("bottom_line").notNull(),
  dominantTheme: text("dominant_theme").notNull(),
  setup: text("setup").notNull(),
  evidence: text("evidence").notNull(),
  implications: text("implications").notNull(),
  catalysts: text("catalysts").notNull(),
  contrarianView: text("contrarian_view").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  marketContext: jsonb("market_context"), // Store raw market data used
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Historical Context System for Percentile Rankings
export const metricPercentiles = pgTable("metric_percentiles", {
  id: serial("id").primaryKey(),
  metricName: text("metric_name").notNull(),
  lookbackPeriod: text("lookback_period").notNull(), // '1Y', '3Y', '5Y', 'ALL'
  percentile5: decimal("percentile_5", { precision: 10, scale: 4 }),
  percentile25: decimal("percentile_25", { precision: 10, scale: 4 }),
  percentile50: decimal("percentile_50", { precision: 10, scale: 4 }),
  percentile75: decimal("percentile_75", { precision: 10, scale: 4 }),
  percentile95: decimal("percentile_95", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  dataPoints: integer("data_points").notNull(), // Number of observations
}, (table) => ({
  uniqueMetricPeriod: unique().on(table.metricName, table.lookbackPeriod),
}));

export const historicalContext = pgTable("historical_context", {
  id: serial("id").primaryKey(),
  metricName: text("metric_name").notNull(),
  metricValue: decimal("metric_value", { precision: 10, scale: 4 }).notNull(),
  contextDate: timestamp("context_date").notNull(),
  subsequentReturn1w: decimal("subsequent_return_1w", { precision: 8, scale: 4 }),
  subsequentReturn1m: decimal("subsequent_return_1m", { precision: 8, scale: 4 }),
  subsequentReturn3m: decimal("subsequent_return_3m", { precision: 8, scale: 4 }),
  eventContext: text("event_context"), // What was happening at the time
  marketRegime: text("market_regime"), // bull, bear, sideways
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Market Regime Classification
export const marketRegimes = pgTable("market_regimes", {
  id: serial("id").primaryKey(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  regimeType: text("regime_type").notNull(), // 'bull_market', 'bear_market', 'volatility_regime', 'low_vol_regime'
  characteristics: jsonb("characteristics").notNull(), // Key metrics during this period
  triggerEvent: text("trigger_event"), // What caused the regime change
  avgReturn: decimal("avg_return", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Pattern Recognition Storage
export const marketPatterns = pgTable("market_patterns", {
  id: serial("id").primaryKey(),
  patternName: text("pattern_name").notNull(),
  description: text("description").notNull(),
  detectionDate: timestamp("detection_date").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  patternData: jsonb("pattern_data").notNull(), // Technical/fundamental data that formed pattern
  historicalPrecedents: jsonb("historical_precedents"), // Similar patterns from the past
  outcomeActual: text("outcome_actual"), // What actually happened
  outcomePredicted: text("outcome_predicted"), // What was expected
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});



// Narrative Memory for Coherent Storytelling
export const narrativeMemory = pgTable("narrative_memory", {
  id: serial("id").primaryKey(),
  themeGroup: text("theme_group").notNull(), // risk_on_off, inflation_cycle, etc.
  narrativeThread: text("narrative_thread").notNull(), // The ongoing story
  keyEvents: jsonb("key_events"), // Timeline of supporting events
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull().default('0.5'),
});

// Enhanced Historical Tables for Twelve Data Metrics
export const historicalTechnicalIndicators = pgTable("historical_technical_indicators", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 8, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 8, scale: 4 }),
  macdHistogram: decimal("macd_histogram", { precision: 8, scale: 4 }),
  vwap: decimal("vwap", { precision: 10, scale: 2 }),
  bollingerUpper: decimal("bollinger_upper", { precision: 10, scale: 2 }),
  bollingerMiddle: decimal("bollinger_middle", { precision: 10, scale: 2 }),
  bollingerLower: decimal("bollinger_lower", { precision: 10, scale: 2 }),
  atr: decimal("atr", { precision: 8, scale: 4 }),
  adx: decimal("adx", { precision: 5, scale: 2 }),
  stochK: decimal("stoch_k", { precision: 5, scale: 2 }),
  stochD: decimal("stoch_d", { precision: 5, scale: 2 }),
  williamsR: decimal("williams_r", { precision: 5, scale: 2 }),
  dataSource: text("data_source").notNull().default("twelve_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueSymbolDate: unique().on(table.symbol, table.date),
  symbolIndex: index("idx_historical_tech_symbol").on(table.symbol),
  dateIndex: index("idx_historical_tech_date").on(table.date),
}));

export const historicalSectorData = pgTable("historical_sector_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  open: decimal("open", { precision: 10, scale: 2 }).notNull(),
  high: decimal("high", { precision: 10, scale: 2 }).notNull(),
  low: decimal("low", { precision: 10, scale: 2 }).notNull(),
  close: decimal("close", { precision: 10, scale: 2 }).notNull(),
  volume: integer("volume").notNull(),
  changePercent: decimal("change_percent", { precision: 5, scale: 2 }),
  dataSource: text("data_source").notNull().default("twelve_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueSymbolDate: unique().on(table.symbol, table.date),
  symbolIndex: index("idx_historical_sector_symbol").on(table.symbol),
  dateIndex: index("idx_historical_sector_date").on(table.date),
}));

export const historicalMarketSentiment = pgTable("historical_market_sentiment", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  vix: decimal("vix", { precision: 5, scale: 2 }),
  vixChange: decimal("vix_change", { precision: 5, scale: 2 }),
  putCallRatio: decimal("put_call_ratio", { precision: 5, scale: 4 }),
  fearGreedIndex: integer("fear_greed_index"),
  aaiiBullish: decimal("aaii_bullish", { precision: 5, scale: 2 }),
  aaiiBearish: decimal("aaii_bearish", { precision: 5, scale: 2 }),
  dataSource: text("data_source").notNull().default("twelve_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueDate: unique().on(table.date),
  dateIndex: index("idx_historical_sentiment_date").on(table.date),
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

// Export type definitions for the new historical tables
export type HistoricalTechnicalIndicator = typeof historicalTechnicalIndicators.$inferSelect;
export type InsertHistoricalTechnicalIndicator = typeof historicalTechnicalIndicators.$inferInsert;
export type HistoricalSectorData = typeof historicalSectorData.$inferSelect;
export type InsertHistoricalSectorData = typeof historicalSectorData.$inferInsert;
export type HistoricalMarketSentiment = typeof historicalMarketSentiment.$inferSelect;
export type InsertHistoricalMarketSentiment = typeof historicalMarketSentiment.$inferInsert;
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertStockDataSchema = createInsertSchema(stockData).omit({
  id: true,
  timestamp: true,
});

export const insertMarketSentimentSchema = createInsertSchema(marketSentiment).omit({
  id: true,
  timestamp: true,
});

export const insertTechnicalIndicatorsSchema = createInsertSchema(technicalIndicators).omit({
  id: true,
  timestamp: true,
});

export const insertAiAnalysisSchema = createInsertSchema(aiAnalysis).omit({
  id: true,
  timestamp: true,
});

export const insertEconomicEventsSchema = createInsertSchema(economicEvents).omit({
  id: true,
  timestamp: true,
});

export const insertMarketBreadthSchema = createInsertSchema(marketBreadth).omit({
  id: true,
  timestamp: true,
});

export const insertVixDataSchema = createInsertSchema(vixData).omit({
  id: true,
  timestamp: true,
});

export const insertSectorDataSchema = createInsertSchema(sectorData).omit({
  id: true,
  timestamp: true,
});

export const insertHistoricalStockDataSchema = createInsertSchema(historicalStockData).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSubscriptionSchema = createInsertSchema(emailSubscriptions).omit({
  id: true,
  subscribedAt: true,
  unsubscribedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type StockData = typeof stockData.$inferSelect;
export type HistoricalStockData = typeof historicalStockData.$inferSelect;
export type MarketSentiment = typeof marketSentiment.$inferSelect;
export type TechnicalIndicators = typeof technicalIndicators.$inferSelect;
export type AiAnalysis = typeof aiAnalysis.$inferSelect;
export type EconomicEvent = typeof economicEvents.$inferSelect;
export type MarketBreadth = typeof marketBreadth.$inferSelect;
export type VixData = typeof vixData.$inferSelect;
export type InsertStockData = z.infer<typeof insertStockDataSchema>;
export type InsertHistoricalStockData = z.infer<typeof insertHistoricalStockDataSchema>;
export type InsertMarketSentiment = z.infer<typeof insertMarketSentimentSchema>;
export type InsertTechnicalIndicators = z.infer<typeof insertTechnicalIndicatorsSchema>;
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;
export type InsertEconomicEvent = z.infer<typeof insertEconomicEventsSchema>;
export type InsertMarketBreadth = z.infer<typeof insertMarketBreadthSchema>;
export type InsertVixData = z.infer<typeof insertVixDataSchema>;
export type SectorData = typeof sectorData.$inferSelect;
export type EmailSubscription = typeof emailSubscriptions.$inferSelect;
export type InsertEmailSubscription = z.infer<typeof insertEmailSubscriptionSchema>;
export type InsertSectorData = z.infer<typeof insertSectorDataSchema>;

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
