#!/usr/bin/env tsx
// Populate Gold table (econ_series_features) with Z-score calculations
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function populateGoldFeatures() {
  console.log('🥇 Populating Gold features table with Z-score calculations...');
  
  try {
    // Get unique series that have sufficient data (at least 60 observations)
    const seriesWithData = await db.execute(sql`
      SELECT series_id, COUNT(*) as obs_count
      FROM econ_series_observation 
      WHERE value_std IS NOT NULL
      GROUP BY series_id
      HAVING COUNT(*) >= 60
      ORDER BY obs_count DESC
    `);

    console.log(`📊 Found ${seriesWithData.rows.length} series with sufficient data`);

    for (const series of seriesWithData.rows) {
      const seriesId = (series as any).series_id;
      const obsCount = (series as any).obs_count;
      
      console.log(`⚡ Processing ${seriesId} (${obsCount} observations)...`);
      
      // Calculate Z-scores for the last 2 years using 5-year rolling window
      await db.execute(sql`
        INSERT INTO econ_series_features (
          series_id, period_end, level_z, change_z, trend_z, 
          volatility_z, momentum_class, trend_class, level_class,
          created_at, updated_at
        )
        SELECT 
          series_id,
          period_end,
          -- Level Z-score (current value vs 5-year rolling mean)
          CASE 
            WHEN rolling_std > 0 THEN 
              (value_std - rolling_mean) / rolling_std
            ELSE 0 
          END as level_z,
          -- Change Z-score (month-over-month change vs historical volatility)
          CASE 
            WHEN change_std > 0 AND lag_value IS NOT NULL THEN 
              ((value_std - lag_value) - avg_change) / change_std
            ELSE 0 
          END as change_z,
          -- Trend Z-score (3-month trend vs historical)
          CASE 
            WHEN trend_std > 0 THEN 
              (trend_3m - avg_trend) / trend_std
            ELSE 0 
          END as trend_z,
          -- Volatility Z-score
          CASE 
            WHEN vol_std > 0 THEN 
              (recent_vol - avg_vol) / vol_std
            ELSE 0 
          END as volatility_z,
          -- Classification based on Z-scores
          CASE 
            WHEN (value_std - lag_value) / NULLIF(lag_value, 0) > 0.02 THEN 'STRONG_UP'
            WHEN (value_std - lag_value) / NULLIF(lag_value, 0) > 0.005 THEN 'UP'
            WHEN (value_std - lag_value) / NULLIF(lag_value, 0) < -0.02 THEN 'STRONG_DOWN'
            WHEN (value_std - lag_value) / NULLIF(lag_value, 0) < -0.005 THEN 'DOWN'
            ELSE 'STABLE'
          END as momentum_class,
          CASE 
            WHEN trend_3m > 0.01 THEN 'UPTREND'
            WHEN trend_3m < -0.01 THEN 'DOWNTREND'
            ELSE 'SIDEWAYS'
          END as trend_class,
          CASE 
            WHEN (value_std - rolling_mean) / NULLIF(rolling_std, 0) > 1.5 THEN 'HIGH'
            WHEN (value_std - rolling_mean) / NULLIF(rolling_std, 0) > 0.5 THEN 'ABOVE_NORMAL'
            WHEN (value_std - rolling_mean) / NULLIF(rolling_std, 0) < -1.5 THEN 'LOW'
            WHEN (value_std - rolling_mean) / NULLIF(rolling_std, 0) < -0.5 THEN 'BELOW_NORMAL'
            ELSE 'NORMAL'
          END as level_class,
          NOW() as created_at,
          NOW() as updated_at
        FROM (
          SELECT 
            series_id,
            period_end,
            value_std,
            LAG(value_std, 1) OVER (PARTITION BY series_id ORDER BY period_end) as lag_value,
            -- 5-year rolling statistics
            AVG(value_std) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as rolling_mean,
            STDDEV(value_std) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as rolling_std,
            -- 3-month trend
            (value_std - LAG(value_std, 3) OVER (PARTITION BY series_id ORDER BY period_end)) / 
            NULLIF(LAG(value_std, 3) OVER (PARTITION BY series_id ORDER BY period_end), 0) as trend_3m,
            -- Change statistics
            AVG(value_std - LAG(value_std, 1) OVER (PARTITION BY series_id ORDER BY period_end)) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as avg_change,
            STDDEV(value_std - LAG(value_std, 1) OVER (PARTITION BY series_id ORDER BY period_end)) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as change_std,
            -- Trend statistics
            AVG((value_std - LAG(value_std, 3) OVER (PARTITION BY series_id ORDER BY period_end)) / 
                NULLIF(LAG(value_std, 3) OVER (PARTITION BY series_id ORDER BY period_end), 0)) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as avg_trend,
            STDDEV((value_std - LAG(value_std, 3) OVER (PARTITION BY series_id ORDER BY period_end)) / 
                   NULLIF(LAG(value_std, 3) OVER (PARTITION BY series_id ORDER BY period_end), 0)) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as trend_std,
            -- Volatility statistics  
            STDDEV(value_std) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
            ) as recent_vol,
            AVG(STDDEV(value_std) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
            )) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as avg_vol,
            STDDEV(STDDEV(value_std) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
            )) OVER (
              PARTITION BY series_id 
              ORDER BY period_end 
              ROWS BETWEEN 59 PRECEDING AND CURRENT ROW
            ) as vol_std
          FROM econ_series_observation 
          WHERE series_id = ${seriesId}
            AND value_std IS NOT NULL
          ORDER BY period_end DESC
        ) calc
        WHERE period_end >= '2023-01-01'  -- Last 2 years
        ON CONFLICT (series_id, period_end) DO UPDATE SET
          level_z = EXCLUDED.level_z,
          change_z = EXCLUDED.change_z,
          trend_z = EXCLUDED.trend_z,
          volatility_z = EXCLUDED.volatility_z,
          momentum_class = EXCLUDED.momentum_class,
          trend_class = EXCLUDED.trend_class,
          level_class = EXCLUDED.level_class,
          updated_at = NOW()
      `);
    }

    // Final count
    const goldCount = await db.execute(sql`SELECT COUNT(*) as count FROM econ_series_features`);
    const goldRows = (goldCount.rows[0] as any).count;
    
    console.log(`🎉 Gold features populated successfully!`);
    console.log(`📊 Total Gold rows: ${goldRows}`);
    console.log(`📈 Series processed: ${seriesWithData.rows.length}`);
    
  } catch (error) {
    console.error('❌ Error populating Gold features:', error);
    throw error;
  }
}

if (import.meta.main) {
  populateGoldFeatures()
    .then(() => {
      console.log('✅ Gold features population completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to populate Gold features:', error);
      process.exit(1);
    });
}