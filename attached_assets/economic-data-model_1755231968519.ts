// 3-Layer Economic Data Model: Bronze → Silver → Gold
// This establishes the single source of truth for units, transforms, and signals

import { pgTable, text, date, doublePrecision, integer, primaryKey, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums for standardized classifications
export const standardUnitEnum = pgEnum('standard_unit', [
  'PCT_DECIMAL',   // 0.042 for 4.2%
  'USD',           // Dollar amounts
  'COUNT',         // Raw counts (people, claims)
  'INDEX_PT',      // Index points
  'HOURS',         // Working hours
  'RATIO_DECIMAL'  // Ratios as decimals
]);

export const scaleHintEnum = pgEnum('scale_hint', ['NONE', 'K', 'M', 'B']);
export const transformCodeEnum = pgEnum('transform_code', [
  'LEVEL',         // No transformation
  'YOY',           // Year-over-year
  'MOM',           // Month-over-month
  'QOQ_ANN',       // Quarter-over-quarter annualized
  'LOG_LEVEL',     // Log level
  'LOG_DIFF_MOM',  // Log difference month-over-month
  'LOG_DIFF_YOY'   // Log difference year-over-year
]);

export const levelClassEnum = pgEnum('level_class', ['ABOVE', 'NEUTRAL', 'BELOW']);
export const trendClassEnum = pgEnum('trend_class', ['ACCEL', 'FLAT', 'DECEL']);
export const freqEnum = pgEnum('freq', ['W', 'M', 'Q']);
export const seasonalAdjEnum = pgEnum('seasonal_adj', ['SA', 'NSA']);
export const typeTagEnum = pgEnum('type_tag', ['Leading', 'Lagging', 'Coincident']);

// LAYER 1: Bronze (Raw Ingestion - Immutable)
export const econSeriesRaw = pgTable('econ_series_raw', {
  seriesId: text('series_id').notNull(),
  periodEnd: date('period_end').notNull(),
  valueRaw: doublePrecision('value_raw').notNull(),
  unitRaw: text('unit_raw').notNull(),
  seasonalAdj: seasonalAdjEnum('seasonal_adj').notNull(),
  vintageTimestamp: timestamp('vintage_timestamp', { withTimezone: true }).defaultNow().notNull(),
  source: text('source').notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.seriesId, table.periodEnd, table.vintageTimestamp] })
}));

// LAYER 0: Series Definitions (Metadata)
export const econSeriesDef = pgTable('econ_series_def', {
  seriesId: text('series_id').primaryKey(),
  displayName: text('display_name').notNull(),
  category: text('category').notNull(),
  typeTag: typeTagEnum('type_tag').notNull(),
  nativeUnit: text('native_unit').notNull(),
  standardUnit: standardUnitEnum('standard_unit').notNull(),
  scaleHint: scaleHintEnum('scale_hint').default('NONE').notNull(),
  displayPrecision: integer('display_precision').default(2).notNull(),
  defaultTransform: transformCodeEnum('default_transform').default('LEVEL').notNull(),
  alignPolicy: text('align_policy').default('last').notNull(), // last/avg/sum
  preferredWindowMonths: integer('preferred_window_months').default(60).notNull(),
  seasonalAdj: seasonalAdjEnum('seasonal_adj').notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url')
});

// LAYER 2: Silver (Standardized & Aligned)
export const econSeriesObservation = pgTable('econ_series_observation', {
  seriesId: text('series_id').notNull().references(() => econSeriesDef.seriesId),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  freq: freqEnum('freq').notNull(),
  valueStd: doublePrecision('value_std').notNull(), // Canonical numeric value
  standardUnit: standardUnitEnum('standard_unit').notNull(),
  aggMethod: text('agg_method').notNull(), // last/avg/sum
  scaleHint: scaleHintEnum('scale_hint').notNull(),
  displayPrecision: integer('display_precision').notNull(),
  transformCode: transformCodeEnum('transform_code').notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.seriesId, table.periodEnd, table.transformCode] })
}));

// LAYER 3: Gold (Features & Signals)
export const econSeriesFeatures = pgTable('econ_series_features', {
  seriesId: text('series_id').notNull().references(() => econSeriesDef.seriesId),
  periodEnd: date('period_end').notNull(),
  transformCode: transformCodeEnum('transform_code').notNull(),
  refWindowMonths: integer('ref_window_months').notNull(),
  
  // Feature inputs
  valueT: doublePrecision('value_t').notNull(),
  deltaT: doublePrecision('delta_t').notNull(),
  meanLevel: doublePrecision('mean_level').notNull(),
  sdLevel: doublePrecision('sd_level').notNull(),
  meanDelta: doublePrecision('mean_delta').notNull(),
  sdDelta: doublePrecision('sd_delta').notNull(),
  
  // Z-scores (only two)
  levelZ: doublePrecision('level_z').notNull(),
  changeZ: doublePrecision('change_z').notNull(),
  
  // Classifications
  levelClass: levelClassEnum('level_class').notNull(),
  trendClass: trendClassEnum('trend_class').notNull(),
  multiSignal: text('multi_signal').notNull(),
  
  // Metadata
  pipelineVersion: text('pipeline_version').notNull(),
  provenance: jsonb('provenance').notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.seriesId, table.periodEnd, table.transformCode, table.pipelineVersion] })
}));

// Zod schemas
export const insertEconSeriesDef = createInsertSchema(econSeriesDef);
export const insertEconSeriesRaw = createInsertSchema(econSeriesRaw);
export const insertEconSeriesObservation = createInsertSchema(econSeriesObservation);
export const insertEconSeriesFeatures = createInsertSchema(econSeriesFeatures);

// Type definitions
export type EconSeriesDef = typeof econSeriesDef.$inferSelect;
export type EconSeriesRaw = typeof econSeriesRaw.$inferSelect;
export type EconSeriesObservation = typeof econSeriesObservation.$inferSelect;
export type EconSeriesFeatures = typeof econSeriesFeatures.$inferSelect;

export type InsertEconSeriesDef = z.infer<typeof insertEconSeriesDef>;
export type InsertEconSeriesRaw = z.infer<typeof insertEconSeriesRaw>;
export type InsertEconSeriesObservation = z.infer<typeof insertEconSeriesObservation>;
export type InsertEconSeriesFeatures = z.infer<typeof insertEconSeriesFeatures>;

// Multi-signal classification matrix (3x3 grid)
export const MULTI_SIGNAL_MATRIX = {
  'ABOVE_ACCEL': 'Strong, strengthening',
  'ABOVE_FLAT': 'Strong, steady', 
  'ABOVE_DECEL': 'Strong, weakening',
  'NEUTRAL_ACCEL': 'Improving',
  'NEUTRAL_FLAT': 'Neutral',
  'NEUTRAL_DECEL': 'Softening',
  'BELOW_ACCEL': 'Weak, rebounding',
  'BELOW_FLAT': 'Weak, steady',
  'BELOW_DECEL': 'Weak, deteriorating'
} as const;

// Classification thresholds
export const CLASSIFICATION_THRESHOLDS = {
  level: {
    above: 1.0,    // level_z >= +1
    below: -1.0    // level_z <= -1
  },
  trend: {
    accel: 0.5,    // change_z >= +0.5
    decel: -0.5    // change_z <= -0.5
  }
} as const;