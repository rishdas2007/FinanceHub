import { db } from '../db';
import { historicalTechnicalIndicators } from '../../shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export class HistoricalMACDServiceDeduplicated {
  
  /**
   * Get deduplicated historical MACD values (one per day)
   */
  async getHistoricalMACDValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      // Use DISTINCT ON to get one record per day
      const historicalData = await db.execute(sql`
        SELECT DISTINCT ON (DATE(date)) 
               macd::numeric as macd_value
        FROM historical_technical_indicators 
        WHERE symbol = ${symbol} 
          AND date >= ${cutoffDate}
          AND macd IS NOT NULL
        ORDER BY DATE(date) DESC, date DESC
        LIMIT ${lookbackDays}
      `);
      
      return historicalData.rows
        .map((row: any) => parseFloat(row.macd_value))
        .filter(value => !isNaN(value));
        
    } catch (error) {
      console.error(`❌ Error fetching deduplicated MACD data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get deduplicated historical RSI values (one per day)
   */
  async getHistoricalRSIValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      // Use DISTINCT ON to get one record per day
      const historicalData = await db.execute(sql`
        SELECT DISTINCT ON (DATE(date)) 
               rsi::numeric as rsi_value
        FROM historical_technical_indicators 
        WHERE symbol = ${symbol} 
          AND date >= ${cutoffDate}
          AND rsi IS NOT NULL
        ORDER BY DATE(date) DESC, date DESC
        LIMIT ${lookbackDays}
      `);
      
      return historicalData.rows
        .map((row: any) => parseFloat(row.rsi_value))
        .filter(value => !isNaN(value));
        
    } catch (error) {
      console.error(`❌ Error fetching deduplicated RSI data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get deduplicated historical Bollinger %B values (one per day)
   * Filters out invalid 0.0 values and ensures proper 0-1 range
   */
  async getHistoricalPercentBValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      // Use DISTINCT ON to get one record per day, filtering out invalid values
      const historicalData = await db.execute(sql`
        SELECT DISTINCT ON (DATE(date)) 
               percent_b::numeric as percent_b_value
        FROM historical_technical_indicators 
        WHERE symbol = ${symbol} 
          AND date >= ${cutoffDate}
          AND percent_b IS NOT NULL
          AND percent_b > 0.0001
          AND percent_b <= 1.5
        ORDER BY DATE(date) DESC, date DESC
        LIMIT ${lookbackDays}
      `);
      
      return historicalData.rows
        .map((row: any) => parseFloat(row.percent_b_value))
        .filter(value => !isNaN(value) && value > 0 && value <= 1.5);
        
    } catch (error) {
      console.error(`❌ Error fetching deduplicated %B data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate Z-score with enhanced data quality validation
   */
  calculateZScore(currentValue: number, historicalValues: number[]): number | null {
    if (!historicalValues || historicalValues.length < 10) {
      console.warn(`⚠️ Insufficient data for Z-score calculation: ${historicalValues?.length || 0} values`);
      return null;
    }

    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    // Enhanced data quality validation
    const range = Math.max(...historicalValues) - Math.min(...historicalValues);
    const uniqueValues = new Set(historicalValues).size;
    const duplicateRatio = 1 - (uniqueValues / historicalValues.length);

    // Check for corrupted data patterns
    const isCorrupted = stdDev < 0.1 || range < 1 || duplicateRatio > 0.8;

    if (isCorrupted) {
      console.warn(`🚨 Detected corrupted data: stdDev=${stdDev.toFixed(4)}, range=${range.toFixed(2)}, duplicates=${(duplicateRatio * 100).toFixed(1)}%`);
      return null; // Return null for corrupted data - caller should use fallback
    }

    if (stdDev === 0) {
      console.warn(`⚠️ Zero standard deviation detected`);
      return null;
    }

    return (currentValue - mean) / stdDev;
  }

  /**
   * Get realistic RSI fallback parameters based on market standards
   */
  getRealisticRSIFallback(): { mean: number; stddev: number } {
    return { mean: 50, stddev: 15 }; // Industry standard RSI distribution
  }

  /**
   * Get realistic MACD fallback parameters based on clean historical data
   */
  getRealisticMACDFallback(): { mean: number; stddev: number } {
    return { mean: 0, stddev: 1.03 }; // Derived from clean data analysis
  }

  /**
   * Get realistic Bollinger %B fallback parameters (0-1 scale)
   */
  getRealisticPercentBFallback(): { mean: number; stddev: number } {
    return { mean: 0.5, stddev: 0.25 }; // Proper 0-1 scale: mean=0.5, stddev=0.25
  }

  /**
   * Enhanced Z-score calculation with automatic fallback for corrupted data
   */
  async calculateZScoreWithFallback(
    symbol: string, 
    currentValue: number, 
    indicator: 'rsi' | 'macd' | 'percent_b',
    lookbackDays: number = 90
  ): Promise<number> {
    let historicalValues: number[] = [];

    try {
      // Get deduplicated historical data
      switch (indicator) {
        case 'rsi':
          historicalValues = await this.getHistoricalRSIValues(symbol, lookbackDays);
          break;
        case 'macd':
          historicalValues = await this.getHistoricalMACDValues(symbol, lookbackDays);
          break;
        case 'percent_b':
          historicalValues = await this.getHistoricalPercentBValues(symbol, lookbackDays);
          break;
      }

      // Try calculating with historical data
      if (historicalValues.length >= 30) {
        const zScore = this.calculateZScore(currentValue, historicalValues);
        if (zScore !== null && Math.abs(zScore) <= 10) { // Reasonable Z-score range
          console.log(`✅ Using deduplicated ${indicator.toUpperCase()} data: ${historicalValues.length} values, Z=${zScore.toFixed(4)}`);
          return zScore;
        }
      }

      // Fallback to realistic parameters
      let fallbackParams;
      switch (indicator) {
        case 'rsi':
          fallbackParams = this.getRealisticRSIFallback();
          break;
        case 'macd':
          fallbackParams = this.getRealisticMACDFallback();
          break;
        case 'percent_b':
          fallbackParams = this.getRealisticPercentBFallback();
          break;
      }

      const fallbackZScore = (currentValue - fallbackParams.mean) / fallbackParams.stddev;
      console.log(`⚠️ Using ${indicator.toUpperCase()} fallback: mean=${fallbackParams.mean}, stddev=${fallbackParams.stddev}, Z=${fallbackZScore.toFixed(4)}`);
      return fallbackZScore;

    } catch (error) {
      console.error(`❌ Error in Z-score calculation for ${symbol} ${indicator}:`, error);
      
      // Emergency fallback
      const emergency = indicator === 'rsi' ? this.getRealisticRSIFallback() : 
                      indicator === 'macd' ? this.getRealisticMACDFallback() : 
                      this.getRealisticPercentBFallback();
      return (currentValue - emergency.mean) / emergency.stddev;
    }
  }
}

// Export singleton instance
export const historicalMACDServiceDeduplicated = new HistoricalMACDServiceDeduplicated();