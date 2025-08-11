import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, jsonb, unique, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============================================================================
// NEW ARCHITECTURE: Equities (Bronze → Silver → Gold)
// =============================================================================

// Authoritative daily bars (UTC) - replaces historical_stock_data
export const equityDailyBars = pgTable("equity_daily_bars", {
  symbol: text("symbol").notNull(),
  tsUtc: timestamp("ts_utc", { withTimezone: true }).notNull(), // bar time @ 00:00:00Z
  open: decimal("open", { precision: 10, scale: 2 }).notNull(),
  high: decimal("high", { precision: 10, scale: 2 }).notNull(),
  low: decimal("low", { precision: 10, scale: 2 }).notNull(),
  close: decimal("close", { precision: 10, scale: 2 }).notNull(),
  volume: integer("volume"),
}, (table) => ({
  pk: primaryKey({ columns: [table.symbol, table.tsUtc] }),
  symbolDescIdx: index("idx_edb_symbol_desc").on(table.symbol, table.tsUtc.desc())
}));

// Intraday quotes (ephemeral, optional persistence)
export const quoteSnapshots = pgTable("quote_snapshots", {
  symbol: text("symbol").notNull(),
  tsUtc: timestamp("ts_utc", { withTimezone: true }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  change: decimal("change", { precision: 10, scale: 2 }),
  percentChange: decimal("percent_change", { precision: 5, scale: 2 }),
  volume: integer("volume"),
  marketCap: integer("market_cap"),
}, (table) => ({
  pk: primaryKey({ columns: [table.symbol, table.tsUtc] })
}));

// Precomputed technicals & composites - THE FEATURE STORE
export const equityFeaturesDaily = pgTable("equity_features_daily", {
  symbol: text("symbol").notNull(),
  asofDate: date("asof_date").notNull(),
  horizon: text("horizon").notNull(), // '20D'|'60D'|'252D'|'RSI14' etc
  
  // Technical indicators
  rsi14: decimal("rsi14", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 10, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 10, scale: 4 }),
  bollUp: decimal("boll_up", { precision: 10, scale: 2 }),
  bollMid: decimal("boll_mid", { precision: 10, scale: 2 }),
  bollLow: decimal("boll_low", { precision: 10, scale: 2 }),
  zClose: decimal("z_close", { precision: 8, scale: 4 }), // z-score vs lookback mean/sd
  sma20: decimal("sma20", { precision: 10, scale: 2 }),
  sma50: decimal("sma50", { precision: 10, scale: 2 }),
  sma200: decimal("sma200", { precision: 10, scale: 2 }),
  atr: decimal("atr", { precision: 10, scale: 4 }),
  percentB: decimal("percent_b", { precision: 5, scale: 4 }),
  
  // Statistical metadata
  observations: integer("observations").notNull(),
  meanValue: decimal("mean_value", { precision: 15, scale: 8 }),
  stdDev: decimal("std_dev", { precision: 15, scale: 8 }),
  
  // Quality flags
  dataQuality: text("data_quality").notNull().default('medium'), // high|medium|low
  hasSufficientData: boolean("has_sufficient_data").notNull().default(false),
  
  extras: jsonb("extras").notNull().default('{}'),
  pipelineVersion: text("pipeline_version").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.symbol, table.asofDate, table.horizon, table.pipelineVersion] }),
  symbolDateIdx: index("idx_efd_symbol_date").on(table.symbol, table.asofDate.desc())
}));

// =============================================================================
// NEW ARCHITECTURE: Macro (Bronze → Silver → Gold)
// =============================================================================

export const econSeriesDef = pgTable("econ_series_def", {
  seriesId: text("series_id").primaryKey(), // e.g., 'core_cpi_yoy'
  displayName: text("display_name").notNull(),
  category: text("category").notNull(),
  typeTag: text("type_tag").notNull(), // Leading|Coincident|Lagging
  nativeUnit: text("native_unit").notNull(),
  standardUnit: text("standard_unit").notNull(), // enum in app
  scaleHint: text("scale_hint").notNull().default('NONE'), // NONE|K|M|B
  displayPrecision: integer("display_precision").notNull().default(2),
  defaultTransform: text("default_transform").notNull(), // LEVEL|YOY|MOM|...
  alignPolicy: text("align_policy").notNull().default('last'), // for W→M
  preferredWindowMonths: integer("preferred_window_months").notNull().default(60),
  seasonalAdj: text("seasonal_adj").notNull(), // SA|NSA
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
}, (table) => ({
  categoryIdx: index("idx_esd_category").on(table.category)
}));

// Silver layer: standardized observations
export const econSeriesObservation = pgTable("econ_series_observation", {
  seriesId: text("series_id").notNull().references(() => econSeriesDef.seriesId),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  freq: text("freq").notNull(), // W|M|Q
  valueStd: decimal("value_std", { precision: 15, scale: 8 }).notNull(), // canonical numeric
  standardUnit: text("standard_unit").notNull(),
  aggMethod: text("agg_method").notNull(),
  scaleHint: text("scale_hint").notNull(),
  displayPrecision: integer("display_precision").notNull(),
  transformCode: text("transform_code").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.seriesId, table.periodEnd, table.transformCode] }),
  seriesEndIdx: index("idx_eso_series_end").on(table.seriesId, table.periodEnd.desc())
}));

// Gold layer: z-scores and signals
export const econSeriesFeatures = pgTable("econ_series_features", {
  seriesId: text("series_id").notNull().references(() => econSeriesDef.seriesId),
  periodEnd: date("period_end").notNull(),
  transformCode: text("transform_code").notNull(),
  refWindowMonths: integer("ref_window_months").notNull(),
  
  valueT: decimal("value_t", { precision: 15, scale: 8 }).notNull(),
  deltaT: decimal("delta_t", { precision: 15, scale: 8 }).notNull(),
  meanLevel: decimal("mean_level", { precision: 15, scale: 8 }).notNull(),
  sdLevel: decimal("sd_level", { precision: 15, scale: 8 }).notNull(),
  meanDelta: decimal("mean_delta", { precision: 15, scale: 8 }).notNull(),
  sdDelta: decimal("sd_delta", { precision: 15, scale: 8 }).notNull(),
  
  levelZ: decimal("level_z", { precision: 8, scale: 4 }).notNull(),
  changeZ: decimal("change_z", { precision: 8, scale: 4 }).notNull(),
  levelClass: text("level_class").notNull(),
  trendClass: text("trend_class").notNull(),
  multiSignal: text("multi_signal").notNull(),
  
  pipelineVersion: text("pipeline_version").notNull(),
  provenance: jsonb("provenance").notNull(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.seriesId, table.periodEnd, table.transformCode, table.pipelineVersion] }),
  seriesEndIdx: index("idx_esf_series_end").on(table.seriesId, table.periodEnd.desc())
}));

// =============================================================================
// LEGACY TABLES (Keep for migration compatibility)
// =============================================================================

// Keep existing tables for gradual migration
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

export const technicalIndicators = pgTable("technical_indicators", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 10, scale: 4 }),
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

// =============================================================================
// SCHEMA EXPORTS & TYPES
// =============================================================================

// New schema exports
export const insertEquityDailyBarSchema = createInsertSchema(equityDailyBars);
export type InsertEquityDailyBar = z.infer<typeof insertEquityDailyBarSchema>;
export type SelectEquityDailyBar = typeof equityDailyBars.$inferSelect;

export const insertEquityFeaturesDailySchema = createInsertSchema(equityFeaturesDaily);
export type InsertEquityFeaturesDaily = z.infer<typeof insertEquityFeaturesDailySchema>;
export type SelectEquityFeaturesDaily = typeof equityFeaturesDaily.$inferSelect;

export const insertEconSeriesDefSchema = createInsertSchema(econSeriesDef);
export type InsertEconSeriesDef = z.infer<typeof insertEconSeriesDefSchema>;
export type SelectEconSeriesDef = typeof econSeriesDef.$inferSelect;

export const insertEconSeriesObservationSchema = createInsertSchema(econSeriesObservation);
export type InsertEconSeriesObservation = z.infer<typeof insertEconSeriesObservationSchema>;
export type SelectEconSeriesObservation = typeof econSeriesObservation.$inferSelect;

export const insertEconSeriesFeaturesSchema = createInsertSchema(econSeriesFeatures);
export type InsertEconSeriesFeatures = z.infer<typeof insertEconSeriesFeaturesSchema>;
export type SelectEconSeriesFeatures = typeof econSeriesFeatures.$inferSelect;