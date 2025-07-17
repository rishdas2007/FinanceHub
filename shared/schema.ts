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

export const marketSentiment = pgTable("market_sentiment", {
  id: serial("id").primaryKey(),
  vix: decimal("vix", { precision: 5, scale: 2 }).notNull(),
  putCallRatio: decimal("put_call_ratio", { precision: 5, scale: 2 }).notNull(),
  aaiiBullish: decimal("aaii_bullish", { precision: 5, scale: 2 }).notNull(),
  aaiiBearish: decimal("aaii_bearish", { precision: 5, scale: 2 }).notNull(),
  aaiiNeutral: decimal("aaii_neutral", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
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
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type StockData = typeof stockData.$inferSelect;
export type MarketSentiment = typeof marketSentiment.$inferSelect;
export type TechnicalIndicators = typeof technicalIndicators.$inferSelect;
export type AiAnalysis = typeof aiAnalysis.$inferSelect;
export type EconomicEvent = typeof economicEvents.$inferSelect;
export type InsertStockData = z.infer<typeof insertStockDataSchema>;
export type InsertMarketSentiment = z.infer<typeof insertMarketSentimentSchema>;
export type InsertTechnicalIndicators = z.infer<typeof insertTechnicalIndicatorsSchema>;
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;
export type InsertEconomicEvent = z.infer<typeof insertEconomicEventsSchema>;
