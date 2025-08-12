import { pool } from '../db';

// Use a simpler approach to avoid API rate limit crashes
async function getSectorETFsSimple() {
  // Direct integration with the enhanced-market-data service used by /api/sectors
  const { EnhancedMarketDataService } = await import('./enhanced-market-data');
  const marketService = new EnhancedMarketDataService();
  return await marketService.getSectorETFs();
}

/**
 * Returns real-time ETF metrics using the same data source as /api/sectors endpoint.
 * This ensures authentic current prices and performance data.
 */
export async function getEtfMetricsLatest() {
  try {
    // Use the same stable service that provides real data to /api/sectors
    const sectorData = await getSectorETFsSimple();
    
    if (!sectorData || sectorData.length === 0) {
      console.warn('No sector ETF data available, using fallback');
      return [];
    }

    // Transform sector data to ETF metrics format with technical indicators from database
    const etfMetrics = await Promise.all(
      sectorData.map(async (etf) => {
        // Get technical indicators from equity_features_daily
        const technicalResult = await pool.query(`
          SELECT 
            rsi14,
            macd,
            bb_pctb_20 as bb_percent_b,
            sma50,
            sma200,
            sma20 as ema_21,
            composite_z_60d
          FROM equity_features_daily 
          WHERE symbol = $1 
          ORDER BY asof_date DESC 
          LIMIT 1
        `, [etf.symbol]);

        const technical = technicalResult.rows[0] || {};
        
        return {
          symbol: etf.symbol,
          name: etf.name,
          last_price: Number(etf.price) || 0,
          pct_change_1d: Number(etf.changePercent) || Number(etf.change) || 0, // Use changePercent or change from live data
          perf_5d: Number(etf.fiveDayChange) || 0,
          perf_1m: Number(etf.oneMonthChange) || 0,
          volume: Number(etf.volume) || 0,
          rsi: Number(technical.rsi14) || 0,
          macd: Number(technical.macd) || 0,
          bb_percent_b: Number(technical.bb_pctb_20) || 0, // Fix column name
          sma_50: Number(technical.sma50) || 0,
          sma_200: Number(technical.sma200) || 0,
          ema_21: Number(technical.sma20) || 0, // sma20 is available, ema_21 might not be
          mini_trend_30d: [] // Will be populated by sparkline service
        };
      })
    );
    
    return etfMetrics;
    
  } catch (error) {
    console.error('Error fetching real-time ETF metrics:', error);
    // Return empty array on error to prevent crashes
    return [];
  }
}