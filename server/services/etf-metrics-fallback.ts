// ETF Metrics Fallback Service - RCA Implementation
// Provides robust fallback when equity_features_daily is empty

import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { stockData, technicalIndicators } from '../../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

interface ETFMetricsResult {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  signal: string;
  rsi: number | null;
  bollingerPosition: number | null;
  bollingerStatus: string;
  maSignal: string;
  maTrend: string;
  maGap: number | null;
  volatility: number | null;
  change30Day: number | null;
  weightedSignal: string;
  atr: number | null;
  zScore: number | null;
  sharpeRatio: number | null;
  fiveDayReturn: number | null;
}

const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];

const ETF_NAMES = {
  'SPY': 'S&P 500 INDEX',
  'XLK': 'Technology',
  'XLV': 'Health Care', 
  'XLF': 'Financial',
  'XLY': 'Consumer Discretionary',
  'XLI': 'Industrial',
  'XLC': 'Communication Services',
  'XLP': 'Consumer Staples',
  'XLE': 'Energy',
  'XLU': 'Utilities',
  'XLB': 'Materials',
  'XLRE': 'Real Estate'
};

export class ETFMetricsFallbackService {
  
  // Check if equity_features_daily has data
  async hasPrecomputedFeatures(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM equity_features_daily 
        WHERE asof_date >= CURRENT_DATE - INTERVAL '7 days'
      `);
      return parseInt(result.rows[0]?.count || '0') > 0;
    } catch (error) {
      console.warn('Unable to check equity_features_daily:', error);
      return false;
    }
  }

  // Fallback: Get ETF metrics from stock_data and technical_indicators tables
  async getETFMetricsFallback(): Promise<ETFMetricsResult[]> {
    console.log('📊 Using fallback ETF metrics (stock_data + technical_indicators)');
    
    const results: ETFMetricsResult[] = [];
    
    for (const symbol of ETF_SYMBOLS) {
      try {
        // Get latest price and change
        const latestPrice = await db
          .select()
          .from(stockData)
          .where(eq(stockData.symbol, symbol))
          .orderBy(desc(stockData.timestamp))
          .limit(1);

        // Get latest technical indicators
        const latestTech = await db
          .select()
          .from(technicalIndicators)
          .where(eq(technicalIndicators.symbol, symbol))
          .orderBy(desc(technicalIndicators.timestamp))
          .limit(1);

        if (latestPrice.length === 0) {
          console.warn(`No price data for ${symbol}, skipping`);
          continue;
        }

        const price = latestPrice[0];
        const tech = latestTech[0] || {};

        // Calculate basic signals with available data
        const rsi = tech.rsi || null;
        const bollingerPosition = this.calculateBollingerPosition(
          price.price, 
          tech.bb_upper, 
          tech.bb_lower
        );

        const signal = this.generateBasicSignal(rsi, bollingerPosition);
        const maSignal = this.getMASignal(tech.sma_20, tech.sma_50, price.price);
        
        results.push({
          symbol,
          name: ETF_NAMES[symbol as keyof typeof ETF_NAMES] || symbol,
          price: price.price,
          changePercent: price.change_percent || 0,
          signal,
          rsi,
          bollingerPosition,
          bollingerStatus: this.getBollingerStatus(bollingerPosition),
          maSignal: maSignal.signal,
          maTrend: maSignal.trend,
          maGap: this.calculateMAGap(tech.sma_20, tech.sma_50),
          volatility: tech.volatility || null,
          change30Day: await this.calculate30DayChange(symbol),
          weightedSignal: signal, // Use same signal for now
          atr: tech.atr || null,
          zScore: null, // Not available in fallback
          sharpeRatio: null, // Not available in fallback
          fiveDayReturn: null // Not available in fallback
        });

      } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
        // Continue with other symbols
      }
    }

    console.log(`📊 Fallback ETF metrics: ${results.length}/${ETF_SYMBOLS.length} symbols processed`);
    return results;
  }

  private calculateBollingerPosition(price: number, upper?: number, lower?: number): number | null {
    if (!upper || !lower || upper === lower) return null;
    return (price - lower) / (upper - lower);
  }

  private getBollingerStatus(position: number | null): string {
    if (position === null) return 'No Data';
    if (position >= 1.0) return 'Above Upper';
    if (position <= 0.0) return 'Below Lower'; 
    if (position >= 0.8) return 'Near Upper';
    if (position <= 0.2) return 'Near Lower';
    return 'Middle';
  }

  private generateBasicSignal(rsi: number | null, bollingerPosition: number | null): string {
    const signals: string[] = [];
    
    if (rsi !== null) {
      if (rsi <= 30) signals.push('BULLISH'); // Oversold
      else if (rsi >= 70) signals.push('BEARISH'); // Overbought
    }
    
    if (bollingerPosition !== null) {
      if (bollingerPosition <= 0.2) signals.push('BULLISH'); // Near lower band
      else if (bollingerPosition >= 0.8) signals.push('BEARISH'); // Near upper band
    }
    
    // Simple consensus
    const bullishCount = signals.filter(s => s === 'BULLISH').length;
    const bearishCount = signals.filter(s => s === 'BEARISH').length;
    
    if (bullishCount > bearishCount) return 'BULLISH';
    if (bearishCount > bullishCount) return 'BEARISH';
    return 'HOLD';
  }

  private getMASignal(sma20?: number, sma50?: number, price?: number): { signal: string; trend: string } {
    if (!sma20 || !sma50 || !price) {
      return { signal: 'No Data', trend: 'neutral' };
    }
    
    const ma20AboveMA50 = sma20 > sma50;
    const priceAboveMA20 = price > sma20;
    
    if (ma20AboveMA50 && priceAboveMA20) {
      return { signal: 'Bull Cross', trend: 'bullish' };
    } else if (!ma20AboveMA50 && !priceAboveMA20) {
      return { signal: 'Bear Cross', trend: 'bearish' };
    } else {
      return { signal: 'Mixed', trend: 'neutral' };
    }
  }

  private calculateMAGap(sma20?: number, sma50?: number): number | null {
    if (!sma20 || !sma50 || sma50 === 0) return null;
    return ((sma20 - sma50) / sma50) * 100;
  }

  private async calculate30DayChange(symbol: string): Promise<number | null> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const oldPrice = await db
        .select()
        .from(stockData)
        .where(and(
          eq(stockData.symbol, symbol),
          gte(stockData.timestamp, thirtyDaysAgo)
        ))
        .orderBy(stockData.timestamp)
        .limit(1);
        
      const currentPrice = await db
        .select()
        .from(stockData)
        .where(eq(stockData.symbol, symbol))
        .orderBy(desc(stockData.timestamp))
        .limit(1);
      
      if (oldPrice.length === 0 || currentPrice.length === 0) return null;
      
      const oldValue = oldPrice[0].price;
      const currentValue = currentPrice[0].price;
      
      return ((currentValue - oldValue) / oldValue) * 100;
    } catch (error) {
      console.warn(`Failed to calculate 30-day change for ${symbol}:`, error);
      return null;
    }
  }

  // Enhanced method that tries precomputed first, falls back to legacy tables
  async getETFMetrics(): Promise<{ 
    success: boolean; 
    data: ETFMetricsResult[]; 
    source: string;
    fallbackReason?: string;
  }> {
    // First, try to use precomputed features
    const hasPrecomputed = await this.hasPrecomputedFeatures();
    
    if (hasPrecomputed) {
      try {
        // Try to get from equity_features_daily (existing logic)
        console.log('📊 Using precomputed ETF features from equity_features_daily');
        
        const result = await db.execute(sql.raw(`
          SELECT 
            efd.symbol,
            efd.rsi14 as rsi,
            efd.z_close,
            efd.sma20,
            efd.sma50,
            efd.macd,
            efd.macd_signal,
            efd.percent_b as bollinger_position,
            efd.boll_up,
            efd.boll_low,
            efd.atr,
            sd.price,
            sd.change_percent
          FROM equity_features_daily efd
          LEFT JOIN stock_data sd ON efd.symbol = sd.symbol
          WHERE efd.symbol = ANY(ARRAY['${ETF_SYMBOLS.join("','")}'])
            AND efd.asof_date >= CURRENT_DATE - INTERVAL '3 days'
          ORDER BY efd.symbol, efd.asof_date DESC
        `));

        if (result.rows.length > 0) {
          // Process precomputed data
          const processedData = this.processPrecomputedData(result.rows);
          return {
            success: true,
            data: processedData,
            source: 'precomputed_features'
          };
        }
      } catch (error) {
        console.warn('Failed to get precomputed features:', error);
      }
    }

    // Fallback to legacy tables
    const fallbackData = await this.getETFMetricsFallback();
    return {
      success: true,
      data: fallbackData,
      source: 'fallback_legacy_tables',
      fallbackReason: hasPrecomputed ? 'precomputed_query_failed' : 'no_precomputed_data'
    };
  }

  private processPrecomputedData(rows: any[]): ETFMetricsResult[] {
    // Group by symbol and take latest
    const symbolMap = new Map();
    
    rows.forEach(row => {
      if (!symbolMap.has(row.symbol)) {
        symbolMap.set(row.symbol, row);
      }
    });

    return Array.from(symbolMap.values()).map(row => ({
      symbol: row.symbol,
      name: ETF_NAMES[row.symbol as keyof typeof ETF_NAMES] || row.symbol,
      price: row.price || 0,
      changePercent: row.change_percent || 0,
      signal: this.generateBasicSignal(row.rsi, row.bollinger_position),
      rsi: row.rsi,
      bollingerPosition: row.bollinger_position,
      bollingerStatus: this.getBollingerStatus(row.bollinger_position),
      maSignal: this.getMASignal(row.sma20, row.sma50, row.price).signal,
      maTrend: this.getMASignal(row.sma20, row.sma50, row.price).trend,
      maGap: this.calculateMAGap(row.sma20, row.sma50),
      volatility: null, // Add if available
      change30Day: null, // Calculate separately if needed
      weightedSignal: this.generateBasicSignal(row.rsi, row.bollinger_position),
      atr: row.atr,
      zScore: row.z_close,
      sharpeRatio: null,
      fiveDayReturn: null
    }));
  }
}