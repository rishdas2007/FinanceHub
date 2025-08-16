import { pgTable, varchar, jsonb, timestamp, integer, decimal, boolean, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * FRED Current Readings Cache Table
 * Stores the latest reading for each economic indicator
 */
export const economicIndicatorsCurrent = pgTable(
  'economic_indicators_current',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    indicator_id: varchar('indicator_id', { length: 50 }).notNull(),
    value: decimal('value', { precision: 15, scale: 6 }).notNull(),
    date: varchar('date', { length: 20 }).notNull(),
    units: varchar('units', { length: 50 }).notNull(),
    last_updated: timestamp('last_updated').defaultNow().notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    source: varchar('source', { length: 20 }).default('FRED').notNull(),
    expiry_timestamp: timestamp('expiry_timestamp').notNull()
  },
  (table) => ({
    indicatorIdIdx: index('idx_current_indicator_id').on(table.indicator_id),
    lastUpdatedIdx: index('idx_current_last_updated').on(table.last_updated),
    expiryIdx: index('idx_current_expiry').on(table.expiry_timestamp)
  })
);

/**
 * FRED Historical Series Cache Table
 * Stores 12-month rolling historical data for each indicator
 */
export const economicIndicatorsHistorical = pgTable(
  'economic_indicators_historical',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    indicator_id: varchar('indicator_id', { length: 50 }).notNull(),
    data_points: jsonb('data_points').$type<Array<{date: string, value: number}>>().notNull(),
    series_length: integer('series_length').notNull(),
    last_updated: timestamp('last_updated').defaultNow().notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    expiry_timestamp: timestamp('expiry_timestamp').notNull()
  },
  (table) => ({
    indicatorIdIdx: index('idx_historical_indicator_id').on(table.indicator_id),
    lastUpdatedIdx: index('idx_historical_last_updated').on(table.last_updated),
    expiryIdx: index('idx_historical_expiry').on(table.expiry_timestamp)
  })
);

/**
 * FRED Year-over-Year Calculations Cache Table
 * Stores computed YoY changes and percentages
 */
export const economicIndicatorsYoY = pgTable(
  'economic_indicators_yoy',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    indicator_id: varchar('indicator_id', { length: 50 }).notNull(),
    current_value: decimal('current_value', { precision: 15, scale: 6 }).notNull(),
    year_ago_value: decimal('year_ago_value', { precision: 15, scale: 6 }).notNull(),
    yoy_change: decimal('yoy_change', { precision: 15, scale: 6 }).notNull(),
    yoy_percent: decimal('yoy_percent', { precision: 10, scale: 4 }).notNull(),
    calculation_date: timestamp('calculation_date').defaultNow().notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    expiry_timestamp: timestamp('expiry_timestamp').notNull()
  },
  (table) => ({
    indicatorIdIdx: index('idx_yoy_indicator_id').on(table.indicator_id),
    calculationDateIdx: index('idx_yoy_calculation_date').on(table.calculation_date),
    expiryIdx: index('idx_yoy_expiry').on(table.expiry_timestamp)
  })
);

/**
 * FRED Cache Audit Trail
 * Tracks cache operations for monitoring and debugging
 */
export const fredCacheAudit = pgTable(
  'fred_cache_audit',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    operation: varchar('operation', { length: 20 }).notNull(), // 'set', 'get', 'delete', 'batch_refresh'
    cache_type: varchar('cache_type', { length: 20 }).notNull(), // 'current', 'historical', 'yoy'
    indicator_id: varchar('indicator_id', { length: 50 }),
    success: boolean('success').notNull(),
    api_calls_made: integer('api_calls_made').default(0),
    response_time_ms: integer('response_time_ms'),
    error_message: varchar('error_message', { length: 500 }),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    timestamp: timestamp('timestamp').defaultNow().notNull()
  },
  (table) => ({
    operationIdx: index('idx_audit_operation').on(table.operation),
    timestampIdx: index('idx_audit_timestamp').on(table.timestamp),
    indicatorIdIdx: index('idx_audit_indicator_id').on(table.indicator_id),
    successIdx: index('idx_audit_success').on(table.success)
  })
);

/**
 * FRED API Rate Limiting Tracker
 * Monitors API usage to prevent rate limit violations
 */
export const fredApiUsage = pgTable(
  'fred_api_usage',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    api_key_hash: varchar('api_key_hash', { length: 64 }).notNull(), // SHA256 hash for privacy
    endpoint: varchar('endpoint', { length: 100 }).notNull(),
    calls_made: integer('calls_made').notNull(),
    window_start: timestamp('window_start').notNull(),
    window_end: timestamp('window_end').notNull(),
    rate_limit_hit: boolean('rate_limit_hit').default(false),
    created_at: timestamp('created_at').defaultNow().notNull()
  },
  (table) => ({
    apiKeyHashIdx: index('idx_usage_api_key_hash').on(table.api_key_hash),
    windowStartIdx: index('idx_usage_window_start').on(table.window_start),
    rateLimitIdx: index('idx_usage_rate_limit').on(table.rate_limit_hit)
  })
);

// Zod schemas for validation
export const insertEconomicIndicatorsCurrentSchema = createInsertSchema(economicIndicatorsCurrent);
export const insertEconomicIndicatorsHistoricalSchema = createInsertSchema(economicIndicatorsHistorical);
export const insertEconomicIndicatorsYoYSchema = createInsertSchema(economicIndicatorsYoY);
export const insertFredCacheAuditSchema = createInsertSchema(fredCacheAudit);
export const insertFredApiUsageSchema = createInsertSchema(fredApiUsage);

// TypeScript types
export type EconomicIndicatorsCurrent = typeof economicIndicatorsCurrent.$inferSelect;
export type EconomicIndicatorsHistorical = typeof economicIndicatorsHistorical.$inferSelect;
export type EconomicIndicatorsYoY = typeof economicIndicatorsYoY.$inferSelect;
export type FredCacheAudit = typeof fredCacheAudit.$inferSelect;
export type FredApiUsage = typeof fredApiUsage.$inferSelect;

export type InsertEconomicIndicatorsCurrent = z.infer<typeof insertEconomicIndicatorsCurrentSchema>;
export type InsertEconomicIndicatorsHistorical = z.infer<typeof insertEconomicIndicatorsHistoricalSchema>;
export type InsertEconomicIndicatorsYoY = z.infer<typeof insertEconomicIndicatorsYoYSchema>;
export type InsertFredCacheAudit = z.infer<typeof insertFredCacheAuditSchema>;
export type InsertFredApiUsage = z.infer<typeof insertFredApiUsageSchema>;