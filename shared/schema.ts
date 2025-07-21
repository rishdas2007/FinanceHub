import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, unique } from "drizzle-orm/pg-core";
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
  themeStrength: decimal("theme_strength", { precision: 3, scale: 2 }).notNull(),
  lastMentioned: timestamp("last_mentioned").notNull(),
  themeStart: timestamp("theme_start").notNull(),
  isActive: boolean("is_active").default(true),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

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
