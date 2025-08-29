import { sql } from 'drizzle-orm';

/**
 * Service to calculate accurate 30-day trends from actual database prices
 * Fixes inconsistent price data issues across different API sources
 */
export class ETFTrendCalculatorService {
  
  /**
   * Calculate accurate 30-day trend using database historical prices
   * @param symbol ETF symbol
   * @returns percentage change over 30 days
   */
  async calculate30DayTrend(symbol: string): Promise<number | null> {
    try {
      const { db } = await import('../db');
      
      // Get price from 30 days ago and most recent price
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get the most recent price
      const recentPriceResult = await db.execute(sql`
        SELECT price, date 
        FROM historical_sector_data 
        WHERE symbol = ${symbol} 
        ORDER BY date DESC 
        LIMIT 1
      `);
      
      if (!recentPriceResult.rows.length) {
        console.warn(`No recent price data found for ${symbol}`);
        return null;
      }
      
      const recentPrice = parseFloat(recentPriceResult.rows[0].price);
      
      // Get price from approximately 30 days ago
      const oldPriceResult = await db.execute(sql`
        SELECT price, date 
        FROM historical_sector_data 
        WHERE symbol = ${symbol} 
          AND date <= ${thirtyDaysAgo.toISOString().split('T')[0]}
        ORDER BY date DESC 
        LIMIT 1
      `);
      
      if (!oldPriceResult.rows.length) {
        console.warn(`No historical price data found for ${symbol} from 30 days ago`);
        return null;
      }
      
      const oldPrice = parseFloat(oldPriceResult.rows[0].price);
      
      // Calculate percentage change
      const trendPercent = ((recentPrice - oldPrice) / oldPrice) * 100;
      
      console.log(`30-day trend calculated for ${symbol}: ${trendPercent.toFixed(2)}% (${oldPrice} → ${recentPrice})`);
      
      return Math.round(trendPercent * 100) / 100; // Round to 2 decimals
      
    } catch (error) {
      console.error(`Failed to calculate 30-day trend for ${symbol}:`, error);
      return null;
    }
  }
  
  /**
   * Calculate trends for all ETFs in batch
   * @param symbols Array of ETF symbols
   * @returns Map of symbol to trend percentage
   */
  async calculateBatchTrends(symbols: string[]): Promise<Map<string, number | null>> {
    const trends = new Map<string, number | null>();
    
    // Process in parallel for better performance
    const promises = symbols.map(async (symbol) => {
      const trend = await this.calculate30DayTrend(symbol);
      trends.set(symbol, trend);
    });
    
    await Promise.all(promises);
    return trends;
  }
  
  /**
   * Get detailed trend analysis with price points
   */
  async getTrendAnalysis(symbol: string): Promise<{
    current: number;
    thirtyDaysAgo: number;
    change: number;
    changePercent: number;
    dates: { current: string; old: string };
  } | null> {
    try {
      const { db } = await import('../db');
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get recent price with exact date
      const recentResult = await db.execute(sql`
        SELECT price, date 
        FROM historical_sector_data 
        WHERE symbol = ${symbol} 
        ORDER BY date DESC 
        LIMIT 1
      `);
      
      // Get old price with exact date
      const oldResult = await db.execute(sql`
        SELECT price, date 
        FROM historical_sector_data 
        WHERE symbol = ${symbol} 
          AND date <= ${thirtyDaysAgo.toISOString().split('T')[0]}
        ORDER BY date DESC 
        LIMIT 1
      `);
      
      if (!recentResult.rows.length || !oldResult.rows.length) {
        return null;
      }
      
      const current = parseFloat(recentResult.rows[0].price);
      const old = parseFloat(oldResult.rows[0].price);
      const change = current - old;
      const changePercent = (change / old) * 100;
      
      return {
        current,
        thirtyDaysAgo: old,
        change,
        changePercent: Math.round(changePercent * 100) / 100,
        dates: {
          current: recentResult.rows[0].date,
          old: oldResult.rows[0].date
        }
      };
      
    } catch (error) {
      console.error(`Failed to get trend analysis for ${symbol}:`, error);
      return null;
    }
  }
}

export const etfTrendCalculator = new ETFTrendCalculatorService();