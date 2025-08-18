import { db } from '../db';
import { historicalTechnicalIndicators } from '../../shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

export class HistoricalMACDService {
  
  /**
   * Get historical MACD values for z-score calculation
   */
  async getHistoricalMACDValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      const historicalData = await db.select({
        macd: historicalTechnicalIndicators.macd
      })
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          gte(historicalTechnicalIndicators.date, cutoffDate)
        ))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(lookbackDays);
      
      const macdValues = historicalData
        .map(row => row.macd)
        .filter(val => val !== null)
        .map(val => Number(val));
      
      logger.info(`📈 Retrieved ${macdValues.length} historical MACD values for ${symbol}`);
      return macdValues;
      
    } catch (error) {
      logger.error(`❌ Error getting historical MACD for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get historical RSI values for z-score calculation
   */
  async getHistoricalRSIValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      const historicalData = await db.select({
        rsi: historicalTechnicalIndicators.rsi
      })
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          gte(historicalTechnicalIndicators.date, cutoffDate)
        ))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(lookbackDays);
      
      const rsiValues = historicalData
        .map(row => row.rsi)
        .filter(val => val !== null)
        .map(val => Number(val));
      
      return rsiValues;
      
    } catch (error) {
      logger.error(`❌ Error getting historical RSI for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get historical Bollinger %B values for z-score calculation
   */
  async getHistoricalBBValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      const historicalData = await db.select({
        percent_b: historicalTechnicalIndicators.percentB
      })
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          gte(historicalTechnicalIndicators.date, cutoffDate)
        ))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(lookbackDays);
      
      const bbValues = historicalData
        .map(row => row.percent_b)
        .filter(val => val !== null)
        .map(val => Number(val));
      
      return bbValues;
      
    } catch (error) {
      logger.error(`❌ Error getting historical Bollinger %B for ${symbol}:`, error);
      return [];
    }
  }
  
  /**
   * Calculate Z-score using database historical data
   */
  calculateZScore(currentValue: number, historicalValues: number[]): number | null {
    if (historicalValues.length < 10) {
      logger.warn('Insufficient historical data for z-score calculation');
      return null;
    }
    
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0; // Avoid division by zero
    
    const zScore = (currentValue - mean) / stdDev;
    
    // Validate reasonable z-score range
    if (Math.abs(zScore) > 5) {
      logger.warn(`Extreme z-score detected: ${zScore} for current=${currentValue}, mean=${mean.toFixed(2)}, stdDev=${stdDev.toFixed(2)}`);
    }
    
    return zScore;
  }
  
  /**
   * Get fallback realistic MACD values if database is insufficient
   */
  getRealisticMACDFallback(symbol: string): number[] {
    // Based on typical ETF MACD ranges - more conservative than current hardcoded values
    const baseFallback = [4.2, 4.8, 5.1, 5.7, 6.2, 6.8, 5.9, 4.5, 5.4, 6.0, 5.2, 4.9, 6.1, 5.8, 5.5];
    
    // Symbol-specific adjustments based on volatility
    const volatilityMultiplier = {
      'SPY': 1.0,    // Base case
      'XLK': 1.2,    // Tech - more volatile  
      'XLE': 1.5,    // Energy - most volatile
      'XLF': 0.8,    // Financials - less volatile
      'XLP': 0.6,    // Consumer staples - least volatile
    }[symbol as keyof typeof volatilityMultiplier] || 1.0;
    
    return baseFallback.map(val => val * volatilityMultiplier);
  }

  /**
   * Get fallback realistic RSI values
   */
  getRealisticRSIFallback(): number[] {
    return [45, 52, 48, 58, 42, 62, 38, 65, 35, 68, 32, 71, 46, 54, 49, 56, 44, 60, 40, 64];
  }

  /**
   * Get fallback realistic Bollinger %B values
   */
  getRealisticBBFallback(): number[] {
    return [0.65, 0.72, 0.58, 0.81, 0.45, 0.89, 0.35, 0.92, 0.28, 0.75, 0.68, 0.55, 0.78, 0.42, 0.85, 0.38, 0.88, 0.32, 0.95, 0.25];
  }
}

export const historicalMACDService = new HistoricalMACDService();