import { pool } from '../db';

/**
 * Returns precomputed ETF metrics using materialized table for fast SELECT.
 * Falls back to equity_features_daily if materialized table is empty.
 */
export async function getEtfMetricsLatest() {
  try {
    // Try materialized table first
    let result = await pool.query(`
      SELECT 
        symbol,
        name,
        last_price,
        pct_change_1d,
        perf_5d,
        perf_1m,
        volume,
        rsi,
        macd,
        bb_percent_b,
        sma_50,
        sma_200,
        ema_21,
        mini_trend_30d
      FROM etf_metrics_latest
      ORDER BY symbol ASC
    `);

    // If materialized table is empty, fallback to live query
    if (!result.rows || result.rows.length === 0) {
      result = await pool.query(`
        SELECT DISTINCT ON (symbol)
          symbol,
          symbol as name,
          COALESCE(close_price, 0) as last_price,
          COALESCE(pct_change_1d, 0) as pct_change_1d,
          COALESCE(perf_5d, 0) as perf_5d,
          COALESCE(perf_1m, 0) as perf_1m,
          COALESCE(volume, 0) as volume,
          COALESCE(rsi_14, 0) as rsi,
          COALESCE(macd_line, 0) as macd,
          COALESCE(bb_percent_b, 0) as bb_percent_b,
          COALESCE(sma_50, 0) as sma_50,
          COALESCE(sma_200, 0) as sma_200,
          COALESCE(ema_21, 0) as ema_21,
          '[]'::jsonb as mini_trend_30d
        FROM equity_features_daily
        WHERE date_calculated >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY symbol ASC, date_calculated DESC
        LIMIT 15
      `);
    }
    
    return result.rows || [];
  } catch (error) {
    console.error('Error fetching ETF metrics:', error);
    // Return empty array on error to prevent crashes
    return [];
  }
}