import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
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
  putCallRatio: decimal("put_call_ratio", { precision: 5, scale: 2 }).notNull(),
  aaiiBullish: decimal("aaii_bullish", { precision: 5, scale: 2 }).notNull(),
  aaiiBearish: decimal("aaii_bearish", { precision: 5, scale: 2 }).notNull(),
  aaiiNeutral: decimal("aaii_neutral", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  dataSource: text("data_source").notNull().default("twelve_data"), // Track data source
});

export const technicalIndicators = pgTable("technical_indicators", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 10, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 10, scale: 4 }),
  bb_upper: decimal("bb_upper", { precision: 10, scale: 2 }),
  bb_lower: decimal("bb_lower", { precision: 10, scale: 2 }),
  sma_20: decimal("sma_20", { precision: 10, scale: 2 }),
  sma_50: decimal("sma_50", { precision: 10, scale: 2 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  marketConditions: text("market_conditions").notNull(),
  technicalOutlook: text("technical_outlook").notNull(),
  riskAssessment: text("risk_assessment").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
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

export const insertHistoricalStockDataSchema = createInsertSchema(historicalStockData).omit({
  id: true,
  createdAt: true,
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
