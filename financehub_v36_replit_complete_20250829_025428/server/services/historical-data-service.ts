import { db } from '../db';
import { equityDailyBars, historicalStockData } from '@shared/schema-v2';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { logger } from '../middleware/logging';
import { cacheService } from './cache-unified';
import { createApiResponse, createApiError, StockHistory } from '@shared/types/api-contracts';
import { financialDataService } from './financial-data';

export class HistoricalDataService {
  
  /**
   * Get stock history with DB-first, provider-fallback strategy
   */
  async getStockHistory(symbol: string, window: string): Promise<StockHistory> {
    logger.info(`📊 Getting stock history for ${symbol} (${window})`);
    
    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(window);
    
    // Try DB first (equity_daily_bars)
    const dbData = await this.getFromDatabase(symbol, startDate, endDate);
    
    if (dbData.length > 0) {
      logger.info(`✅ Found ${dbData.length} bars in database for ${symbol}`);
      return this.formatResponse(symbol, window, dbData, false);
    }
    
    // Fallback to legacy table
    const legacyData = await this.getFromLegacyTable(symbol, startDate, endDate);
    
    if (legacyData.length > 0) {
      logger.info(`📦 Found ${legacyData.length} bars in legacy table for ${symbol}`);
      return this.formatResponse(symbol, window, legacyData, false);
    }
    
    // Fallback to external provider
    logger.warn(`🔄 No DB data found for ${symbol}, falling back to provider`);
    const providerData = await this.getFromProvider(symbol, window);
    
    return this.formatResponse(symbol, window, providerData, true);
  }
  
  /**
   * Get thin sparkline data (close prices only)
   */
  async getSparkline(symbol: string, days: number): Promise<{ symbol: string; days: number; points: number[]; fallback: boolean }> {
    logger.info(`✨ Getting sparkline for ${symbol} (${days} days)`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Try DB first
    const dbData = await this.getFromDatabase(symbol, startDate, endDate);
    
    if (dbData.length > 0) {
      const closes = dbData.map(bar => parseFloat(bar.close.toString()));
      return { symbol, days, points: closes, fallback: false };
    }
    
    // Fallback to legacy
    const legacyData = await this.getFromLegacyTable(symbol, startDate, endDate);
    
    if (legacyData.length > 0) {
      const closes = legacyData.map(bar => parseFloat(bar.close.toString()));
      return { symbol, days, points: closes, fallback: false };
    }
    
    // Return empty with fallback flag
    return { symbol, days, points: [], fallback: true };
  }
  
  private async getFromDatabase(symbol: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      return await db
        .select()
        .from(equityDailyBars)
        .where(
          and(
            eq(equityDailyBars.symbol, symbol),
            gte(equityDailyBars.tsUtc, startDate),
            lte(equityDailyBars.tsUtc, endDate)
          )
        )
        .orderBy(equityDailyBars.tsUtc);
    } catch (error) {
      logger.error(`Failed to query equity_daily_bars for ${symbol}:`, error);
      return [];
    }
  }
  
  private async getFromLegacyTable(symbol: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      return await db
        .select()
        .from(historicalStockData)
        .where(
          and(
            eq(historicalStockData.symbol, symbol),
            gte(historicalStockData.date, startDate),
            lte(historicalStockData.date, endDate)
          )
        )
        .orderBy(historicalStockData.date);
    } catch (error) {
      logger.error(`Failed to query historical_stock_data for ${symbol}:`, error);
      return [];
    }
  }
  
  private async getFromProvider(symbol: string, window: string): Promise<any[]> {
    try {
      // Use existing financial data service as fallback
      const quote = await financialDataService.getStockQuote(symbol);
      
      if (quote) {
        // Return single point as fallback
        return [{
          symbol,
          open: quote.price,
          high: quote.price,
          low: quote.price,
          close: quote.price,
          volume: quote.volume || 0,
          date: new Date()
        }];
      }
      
      return [];
    } catch (error) {
      logger.error(`Provider fallback failed for ${symbol}:`, error);
      return [];
    }
  }
  
  private formatResponse(symbol: string, window: string, data: any[], fallback: boolean): StockHistory {
    const points = data.map(bar => ({
      t: new Date(bar.tsUtc || bar.date).getTime(),
      date: new Date(bar.tsUtc || bar.date).toISOString().split('T')[0],
      close: parseFloat(bar.close.toString()),
      open: parseFloat(bar.open.toString()),
      high: parseFloat(bar.high.toString()),
      low: parseFloat(bar.low.toString()),
      volume: bar.volume || 0
    }));
    
    return {
      symbol,
      window,
      points,
      fallback
    };
  }
  
  private calculateDateRange(window: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (window) {
      case '7D':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30D':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90D':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1Y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '3Y':
        startDate.setFullYear(startDate.getFullYear() - 3);
        break;
      case 'MAX':
        startDate.setFullYear(startDate.getFullYear() - 10);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }
    
    return { startDate, endDate };
  }
}

export const historicalDataService = new HistoricalDataService();