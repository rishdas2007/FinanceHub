/**
 * Optimized API Endpoints
 * Creates fast, cached endpoints to replace expensive real-time calculations
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { logger } from '../server/utils/logger';
import { z } from 'zod';

// Response schemas for type safety
const ETFMetricsOptimizedSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  changePercent: z.number(),
  volume: z.number(),
  volatility: z.number().nullable(),
  sma5: z.number().nullable(),
  sma20: z.number().nullable(),
  rsi: z.number().nullable(),
  macd: z.number().nullable(),
  performance: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number()
  }),
  zScore: z.number(),
  signal: z.enum(['BUY', 'SELL', 'HOLD', 'NEUTRAL']),
  lastUpdated: z.string()
});

const EconomicIndicatorsOptimizedSchema = z.object({
  indicators: z.array(z.object({
    seriesId: z.string(),
    name: z.string(),
    category: z.string(),
    currentValue: z.number(),
    displayValue: z.string(),
    zScore: z.number(),
    classification: z.enum(['HIGH', 'LOW', 'NORMAL', 'INSUFFICIENT_DATA']),
    trend: z.string(),
    lastUpdated: z.string()
  })),
  summary: z.object({
    totalIndicators: z.number(),
    highClassifications: z.number(),
    lowClassifications: z.number(),
    overallHealth: z.string()
  })
});

/**
 * Optimized ETF Metrics Endpoint
 * Uses materialized view instead of real-time calculations
 * Target: < 50ms response time (vs 998ms current)
 */
export async function getOptimizedETFMetrics() {
  try {
    const startTime = Date.now();
    
    // Query pre-calculated materialized view
    const result = await db.execute(sql`
      WITH latest_etf AS (
        SELECT DISTINCT ON (symbol) 
          symbol,
          close_price,
          daily_return,
          volume,
          volatility_20d,
          sma_5,
          sma_20,
          date
        FROM etf_metrics_cache 
        ORDER BY symbol, date DESC
      ),
      etf_with_names AS (
        SELECT 
          e.*,
          CASE 
            WHEN e.symbol = 'SPY' THEN 'S&P 500 INDEX'
            WHEN e.symbol = 'XLK' THEN 'SPDR Technology'
            WHEN e.symbol = 'XLV' THEN 'SPDR Healthcare'
            WHEN e.symbol = 'XLF' THEN 'SPDR Financial'
            WHEN e.symbol = 'XLY' THEN 'SPDR Consumer Discretionary'
            WHEN e.symbol = 'XLI' THEN 'SPDR Industrial'
            WHEN e.symbol = 'XLC' THEN 'SPDR Communication Services'
            WHEN e.symbol = 'XLP' THEN 'SPDR Consumer Staples'
            WHEN e.symbol = 'XLE' THEN 'SPDR Energy'
            WHEN e.symbol = 'XLU' THEN 'SPDR Utilities'
            WHEN e.symbol = 'XLB' THEN 'SPDR Materials'
            WHEN e.symbol = 'XLRE' THEN 'SPDR Real Estate'
            ELSE e.symbol
          END as name
        FROM latest_etf e
      )
      SELECT 
        symbol,
        name,
        close_price as price,
        COALESCE(daily_return, 0) as change_percent,
        COALESCE(volume, 0) as volume,
        ROUND(COALESCE(volatility_20d, 0)::numeric, 2) as volatility,
        ROUND(COALESCE(sma_5, 0)::numeric, 2) as sma5,
        ROUND(COALESCE(sma_20, 0)::numeric, 2) as sma20,
        -- Simple Z-Score calculation for performance
        CASE 
          WHEN volatility_20d > 0 THEN 
            ROUND(((close_price - sma_20) / volatility_20d)::numeric, 2)
          ELSE 0
        END as z_score,
        -- Signal based on simple moving average crossover
        CASE 
          WHEN sma_5 > sma_20 AND daily_return > 0 THEN 'BUY'
          WHEN sma_5 < sma_20 AND daily_return < -1 THEN 'SELL'
          WHEN daily_return BETWEEN -0.5 AND 0.5 THEN 'HOLD'
          ELSE 'NEUTRAL'
        END as signal,
        date as last_updated
      FROM etf_with_names
      ORDER BY symbol
    `);

    const metrics = Array.from(result).map(row => ({
      symbol: row.symbol as string,
      name: row.name as string,
      price: Number(row.price),
      changePercent: Number(row.change_percent),
      volume: Number(row.volume),
      volatility: row.volatility ? Number(row.volatility) : null,
      sma5: row.sma5 ? Number(row.sma5) : null,
      sma20: row.sma20 ? Number(row.sma20) : null,
      rsi: null, // Will be added in Phase 2
      macd: null, // Will be added in Phase 2
      performance: {
        daily: Number(row.change_percent),
        weekly: Number(row.change_percent) * 5, // Simplified for now
        monthly: Number(row.change_percent) * 22 // Simplified for now
      },
      zScore: Number(row.z_score),
      signal: row.signal as 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL',
      lastUpdated: new Date(row.last_updated as Date).toISOString()
    }));

    const responseTime = Date.now() - startTime;
    logger.info(`⚡ Optimized ETF metrics served in ${responseTime}ms (${metrics.length} ETFs)`);

    return {
      success: true,
      data: metrics,
      metadata: {
        count: metrics.length,
        responseTime: `${responseTime}ms`,
        cached: true,
        source: 'materialized_view'
      }
    };

  } catch (error) {
    logger.error('Failed to get optimized ETF metrics:', error);
    throw error;
  }
}

/**
 * Optimized Economic Indicators Endpoint
 * Uses pre-calculated Z-Scores and YoY transformations
 * Target: < 100ms response time
 */
export async function getOptimizedEconomicIndicators() {
  try {
    const startTime = Date.now();

    // Query pre-calculated economic indicators with Z-Scores
    const result = await db.execute(sql`
      WITH latest_indicators AS (
        SELECT DISTINCT ON (e.series_id)
          e.series_id,
          e.calculated_value,
          e.category,
          e.period_end,
          COALESCE(z.zscore_60m, 0) as zscore_60m,
          COALESCE(z.classification, 'INSUFFICIENT_DATA') as classification
        FROM economic_indicators_recent e
        LEFT JOIN zscore_cache z ON e.series_id = z.series_id AND e.period_end = z.period_end
        WHERE e.series_id IN ('CPIAUCSL', 'CPILFESL', 'PCEPI', 'UNRATE', 'DFF', 'DGS10', 'PAYEMS', 'ICSA')
        ORDER BY e.series_id, e.period_end DESC
      )
      SELECT 
        series_id,
        CASE 
          WHEN series_id = 'CPIAUCSL' THEN 'Consumer Price Index'
          WHEN series_id = 'CPILFESL' THEN 'Core CPI (Ex Food & Energy)'
          WHEN series_id = 'PCEPI' THEN 'PCE Price Index'
          WHEN series_id = 'UNRATE' THEN 'Unemployment Rate'
          WHEN series_id = 'DFF' THEN 'Federal Funds Rate'
          WHEN series_id = 'DGS10' THEN '10-Year Treasury'
          WHEN series_id = 'PAYEMS' THEN 'Nonfarm Payrolls'
          WHEN series_id = 'ICSA' THEN 'Initial Claims'
          ELSE series_id
        END as name,
        category,
        ROUND(calculated_value::numeric, 2) as current_value,
        -- Format display value based on series type
        CASE 
          WHEN series_id IN ('CPIAUCSL', 'CPILFESL', 'PCEPI') THEN 
            '+' || ROUND(calculated_value::numeric, 1) || '%'
          WHEN series_id IN ('UNRATE', 'DFF', 'DGS10') THEN 
            ROUND(calculated_value::numeric, 1) || '%'
          WHEN series_id = 'PAYEMS' THEN 
            ROUND((calculated_value / 1000)::numeric, 0) || 'K'
          WHEN series_id = 'ICSA' THEN 
            ROUND((calculated_value / 1000)::numeric, 0) || 'K'
          ELSE ROUND(calculated_value::numeric, 2)::text
        END as display_value,
        ROUND(zscore_60m::numeric, 2) as z_score,
        classification,
        -- Trend based on Z-Score
        CASE 
          WHEN zscore_60m > 1.0 THEN 'Rising'
          WHEN zscore_60m < -1.0 THEN 'Falling'
          WHEN zscore_60m BETWEEN -0.5 AND 0.5 THEN 'Stable'
          ELSE 'Moderate'
        END as trend,
        period_end as last_updated
      FROM latest_indicators
      ORDER BY 
        CASE category 
          WHEN 'Inflation' THEN 1 
          WHEN 'Labor' THEN 2 
          WHEN 'Financial' THEN 3 
          ELSE 4 
        END,
        series_id
    `);

    const indicators = Array.from(result).map(row => ({
      seriesId: row.series_id as string,
      name: row.name as string,
      category: row.category as string,
      currentValue: Number(row.current_value),
      displayValue: row.display_value as string,
      zScore: Number(row.z_score),
      classification: row.classification as 'HIGH' | 'LOW' | 'NORMAL' | 'INSUFFICIENT_DATA',
      trend: row.trend as string,
      lastUpdated: new Date(row.last_updated as Date).toISOString()
    }));

    // Calculate summary statistics
    const summary = {
      totalIndicators: indicators.length,
      highClassifications: indicators.filter(i => i.classification === 'HIGH').length,
      lowClassifications: indicators.filter(i => i.classification === 'LOW').length,
      overallHealth: indicators.filter(i => i.classification === 'NORMAL').length > indicators.length / 2 
        ? 'STABLE' 
        : 'ELEVATED_RISK'
    };

    const responseTime = Date.now() - startTime;
    logger.info(`⚡ Optimized economic indicators served in ${responseTime}ms (${indicators.length} indicators)`);

    return {
      success: true,
      indicators,
      summary,
      metadata: {
        responseTime: `${responseTime}ms`,
        cached: true,
        source: 'materialized_view'
      }
    };

  } catch (error) {
    logger.error('Failed to get optimized economic indicators:', error);
    throw error;
  }
}

/**
 * Fast Dashboard Summary Endpoint
 * Single query to load entire dashboard
 * Target: < 200ms response time for complete dashboard
 */
export async function getFastDashboardSummary() {
  try {
    const startTime = Date.now();

    // Query pre-calculated dashboard summary cache
    const result = await db.execute(sql`
      SELECT 
        cache_type,
        data,
        last_updated
      FROM dashboard_summary_cache
      ORDER BY cache_type
    `);

    const dashboardData = Array.from(result).reduce((acc, row) => {
      acc[row.cache_type as string] = {
        data: row.data,
        lastUpdated: new Date(row.last_updated as Date).toISOString()
      };
      return acc;
    }, {} as Record<string, any>);

    const responseTime = Date.now() - startTime;
    logger.info(`⚡ Fast dashboard summary served in ${responseTime}ms`);

    return {
      success: true,
      dashboard: dashboardData,
      metadata: {
        responseTime: `${responseTime}ms`,
        cached: true,
        source: 'dashboard_summary_cache'
      }
    };

  } catch (error) {
    logger.error('Failed to get fast dashboard summary:', error);
    throw error;
  }
}

/**
 * Health check for optimized endpoints
 */
export async function checkOptimizedEndpointsHealth() {
  try {
    const checks = await Promise.allSettled([
      getOptimizedETFMetrics(),
      getOptimizedEconomicIndicators(),
      getFastDashboardSummary()
    ]);

    const results = {
      etfMetrics: checks[0].status === 'fulfilled' ? 'HEALTHY' : 'ERROR',
      economicIndicators: checks[1].status === 'fulfilled' ? 'HEALTHY' : 'ERROR',
      dashboardSummary: checks[2].status === 'fulfilled' ? 'HEALTHY' : 'ERROR'
    };

    const overallHealth = Object.values(results).every(status => status === 'HEALTHY') 
      ? 'HEALTHY' 
      : 'DEGRADED';

    return {
      success: true,
      overallHealth,
      endpoints: results,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Health check failed for optimized endpoints:', error);
    return {
      success: false,
      overallHealth: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}