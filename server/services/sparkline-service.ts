import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../../shared/utils/logger';

export interface SparklineData {
  data: number[];
  trend: 'up' | 'down' | 'flat';
  change: number; // percentage change
  period: string;
}

export class SparklineService {
  /**
   * Get 30-day sparkline data for an ETF with harmonized scaling
   */
  async getSparklineData(symbol: string): Promise<{ success: boolean; data?: number[]; trend?: 'up' | 'down' | 'flat'; change?: number; normalizedData?: number[]; error?: string }> {
    try {
      // First try to get real historical data
      const realData = await this.getRealHistoricalData(symbol);
      if (realData) {
        return {
          success: true,
          data: realData.rawData,
          normalizedData: realData.normalizedData,
          trend: realData.trend,
          change: realData.change,
          isFallback: false, // FIX 6: Add fallback transparency
          dataSource: 'database' // ADD THIS
        };
      }

      // Fallback to sample data if no real data available
      logger.warn(`No real data available for ${symbol}, using sample data`);
      const sampleData = this.generateSampleSparklineData(symbol);
      return {
        success: true,
        ...sampleData,
        isFallback: true, // FIX 6: Add fallback transparency
        dataSource: 'sample', // ADD THIS
        reason: 'No historical data available'
      };
    } catch (error) {
      logger.error(`Failed to get sparkline data for ${symbol}:`, String(error));
      
      // Fallback to sample data
      const sampleData = this.generateSampleSparklineData(symbol);
      return {
        success: true,
        ...sampleData,
        isFallback: true, // FIX 6: Add fallback transparency
        dataSource: 'sample', // ADD THIS
        reason: 'Database error occurred'
      };
    }
  }

  /**
   * Get real historical price data from database
   */
  private async getRealHistoricalData(symbol: string): Promise<{
    rawData: number[];
    normalizedData: number[];
    trend: 'up' | 'down' | 'flat';
    change: number;
  } | null> {
    try {
      // Query historical sector data for the ETF (same table as z-score calculations)
      const result = await db.execute(sql`
        SELECT price, date
        FROM historical_sector_data 
        WHERE symbol = ${symbol} 
        ORDER BY date ASC
        LIMIT 60
      `);

      if (!result.rows || result.rows.length < 10) {
        return null; // Not enough data points
      }

      const prices = result.rows.map((row: any) => parseFloat(row.price || 0)).filter(p => p > 0);
      
      if (prices.length < 10) {
        return null;
      }

      // Calculate trend and change
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;

      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (changePercent > 1) trend = 'up';
      else if (changePercent < -1) trend = 'down';

      // Enhanced scaling to preserve price variation - use actual prices with smart scaling
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const range = maxPrice - minPrice;
      
      // Use actual prices but apply dynamic range amplification for better visualization
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const normalizedData = prices.map(price => {
        if (range === 0) return price; // Keep actual price if no variation
        // Apply percentage deviation amplification for better visual variation
        const deviation = ((price - mean) / mean) * 100;
        return mean + (deviation * 3); // Amplify variations by 3x
      });

      return {
        rawData: prices,
        normalizedData,
        trend,
        change: changePercent
      };
    } catch (error) {
      logger.error(`Failed to get real historical data for ${symbol}:`, String(error));
      return null;
    }
  }

  /**
   * Generate sample sparkline data based on symbol characteristics
   */
  private generateSampleSparklineData(symbol: string): SparklineData {
    const baseValue = this.getBaseValueForSymbol(symbol);
    const volatility = this.getVolatilityForSymbol(symbol);
    
    // Generate 30 data points
    const data: number[] = [];
    let currentValue = baseValue;
    
    for (let i = 0; i < 30; i++) {
      // Add some realistic price movement
      const randomChange = (Math.random() - 0.5) * volatility;
      currentValue += randomChange;
      data.push(Math.max(currentValue, baseValue * 0.8)); // Prevent unrealistic drops
    }

    const firstPrice = data[0];
    const lastPrice = data[data.length - 1];
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (changePercent > 1) trend = 'up';
    else if (changePercent < -1) trend = 'down';

    return {
      data,
      trend,
      change: changePercent,
      period: '30d'
    };
  }

  private getBaseValueForSymbol(symbol: string): number {
    const symbolPrices: Record<string, number> = {
      'SPY': 450,
      'QQQ': 380,
      'IWM': 200,
      'XLF': 38,
      'XLK': 180,
      'XLV': 130,
      'XLE': 85,
      'XLI': 110,
      'XLY': 160,
      'XLP': 75,
      'XLU': 70,
      'XLRE': 45
    };
    return symbolPrices[symbol] || 100;
  }

  private getVolatilityForSymbol(symbol: string): number {
    const symbolVolatility: Record<string, number> = {
      'SPY': 2,
      'QQQ': 4,
      'IWM': 3,
      'XLF': 1.5,
      'XLK': 5,
      'XLV': 2,
      'XLE': 4,
      'XLI': 2.5,
      'XLY': 3,
      'XLP': 1,
      'XLU': 1,
      'XLRE': 2
    };
    return symbolVolatility[symbol] || 2;
  }
}

export const sparklineService = new SparklineService();