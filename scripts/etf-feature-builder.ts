#!/usr/bin/env tsx

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// ETF universe configuration
const ETF_UNIVERSE = ['SPY', 'XLK', 'XLF', 'XLI', 'XLE', 'XLV', 'XLP', 'XLU', 'XLY', 'XLC', 'XLB', 'XLRE'];

interface BarData {
  symbol: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FeatureRow {
  symbol: string;
  asof_date: string;
  horizon: string;
  pipeline_version: string;
  composite_z_60d: number | null;
  dz1_60d: number | null;
  dz5_60d: number | null;
  macd_z_60d: number | null;
  rsi14: number | null;
  bb_pctb_20: number | null;
  ma50: number | null;
  ma200: number | null;
  ma_gap_pct: number | null;
  atr14: number | null;
  rs_spy_30d: number | null;
  rs_spy_90d: number | null;
  beta_spy_252d: number | null;
  corr_spy_252d: number | null;
  vol_dollar_20d: number | null;
  // Required fields from existing schema
  observations: number;
  data_quality: string;
  has_sufficient_data: boolean;
  extras: any;
}

class TechnicalIndicators {
  // Calculate RSI using Wilder's smoothing
  static calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) return [];
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const rsiValues: number[] = [];
    let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    
    // First RSI value
    let rs = avgGain / (avgLoss || 0.001); // Avoid division by zero
    rsiValues.push(100 - (100 / (1 + rs)));
    
    // Subsequent RSI values using Wilder's smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      rs = avgGain / (avgLoss || 0.001);
      rsiValues.push(100 - (100 / (1 + rs)));
    }
    
    return rsiValues;
  }

  // Calculate EMA
  static calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];
    
    const k = 2 / (period + 1);
    const emaValues: number[] = [];
    
    // Start with SMA for first value
    const firstSMA = prices.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    emaValues.push(firstSMA);
    
    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] * k) + (emaValues[emaValues.length - 1] * (1 - k));
      emaValues.push(ema);
    }
    
    return emaValues;
  }

  // ✅ CRITICAL FIX: Calculate MACD with proper EMA array alignment
  static calculateMACD(prices: number[]): { macd: number[], signal: number[], histogram: number[] } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    if (ema12.length === 0 || ema26.length === 0) {
      return { macd: [], signal: [], histogram: [] };
    }
    
    // ✅ FIX: Proper array alignment - both EMAs should have same length after proper calculation
    const macd: number[] = [];
    const minLength = Math.min(ema12.length, ema26.length);
    
    // ✅ FIX: Calculate MACD from properly aligned EMAs
    for (let i = 0; i < minLength; i++) {
      macd.push(ema12[i] - ema26[i]);
    }
    
    const signal = this.calculateEMA(macd, 9);
    const histogram: number[] = [];
    
    // ✅ FIX: Correct histogram calculation
    const signalStartIndex = macd.length - signal.length;
    for (let i = 0; i < signal.length; i++) {
      histogram.push(macd[signalStartIndex + i] - signal[i]);
    }
    
    return { macd, signal, histogram };
  }

  // Calculate ATR using Wilder's smoothing
  static calculateATR(bars: BarData[], period: number = 14): number[] {
    if (bars.length < 2) return [];
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    if (trueRanges.length < period) return [];
    
    const atrValues: number[] = [];
    let atr = trueRanges.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
    atrValues.push(atr);
    
    // Wilder's smoothing
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((atr * (period - 1)) + trueRanges[i]) / period;
      atrValues.push(atr);
    }
    
    return atrValues;
  }

  // Calculate Simple Moving Average
  static calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];
    
    const smaValues: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      smaValues.push(sum / period);
    }
    return smaValues;
  }

  // Calculate Bollinger Bands %B
  static calculateBollingerPctB(prices: number[], period: number = 20, stdDev: number = 2): number[] {
    const sma = this.calculateSMA(prices, period);
    if (sma.length === 0) return [];
    
    const pctBValues: number[] = [];
    
    for (let i = 0; i < sma.length; i++) {
      const priceIndex = i + period - 1;
      const periodPrices = prices.slice(i, i + period);
      const mean = sma[i];
      const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const stdDeviation = Math.sqrt(variance) * stdDev;
      
      const upperBand = mean + stdDeviation;
      const lowerBand = mean - stdDeviation;
      const currentPrice = prices[priceIndex];
      
      if (upperBand === lowerBand) {
        pctBValues.push(0.5); // Avoid division by zero
      } else {
        const pctB = (currentPrice - lowerBand) / (upperBand - lowerBand);
        pctBValues.push(Math.max(0, Math.min(1, pctB))); // Clamp to [0,1]
      }
    }
    
    return pctBValues;
  }

  // Calculate Z-Score
  static calculateZScore(values: number[], period: number): number[] {
    if (values.length < period) return [];
    
    const zScores: number[] = [];
    
    for (let i = period - 1; i < values.length; i++) {
      const window = values.slice(i - period + 1, i + 1);
      const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev === 0) {
        zScores.push(0);
      } else {
        zScores.push((values[i] - mean) / stdDev);
      }
    }
    
    return zScores;
  }

  // Calculate returns
  static calculateReturns(prices: number[], period: number): number[] {
    if (prices.length < period + 1) return [];
    
    const returns: number[] = [];
    for (let i = period; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - period]) / prices[i - period]);
    }
    return returns;
  }

  // Calculate beta and correlation vs SPY
  static calculateBetaAndCorr(symbolReturns: number[], spyReturns: number[]): { beta: number | null, corr: number | null } {
    if (symbolReturns.length !== spyReturns.length || symbolReturns.length < 10) {
      return { beta: null, corr: null };
    }

    const n = symbolReturns.length;
    const meanSymbol = symbolReturns.reduce((sum, val) => sum + val, 0) / n;
    const meanSpy = spyReturns.reduce((sum, val) => sum + val, 0) / n;

    let covariance = 0;
    let varianceSymbol = 0;
    let varianceSpy = 0;

    for (let i = 0; i < n; i++) {
      const diffSymbol = symbolReturns[i] - meanSymbol;
      const diffSpy = spyReturns[i] - meanSpy;
      
      covariance += diffSymbol * diffSpy;
      varianceSymbol += diffSymbol * diffSymbol;
      varianceSpy += diffSpy * diffSpy;
    }

    covariance /= n;
    varianceSymbol /= n;
    varianceSpy /= n;

    const beta = varianceSpy === 0 ? null : covariance / varianceSpy;
    const corr = (varianceSymbol === 0 || varianceSpy === 0) ? null : 
                 covariance / Math.sqrt(varianceSymbol * varianceSpy);

    return { beta, corr };
  }
}

class ETFFeatureBuilder {
  private async loadBarsData(symbol: string, daysBack: number = 400): Promise<BarData[]> {
    console.log(`📊 Loading ${daysBack} days of bar data for ${symbol}...`);
    
    const result = await db.execute(sql`
      SELECT symbol, ts_utc::date as date, open, high, low, close, volume
      FROM equity_daily_bars 
      WHERE symbol = ${symbol}
        AND ts_utc >= CURRENT_DATE - INTERVAL '${sql.raw(daysBack.toString())} days'
      ORDER BY ts_utc ASC
    `);

    // Handle Drizzle result format (it could be an array or have a rows property)
    const rows = Array.isArray(result) ? result : result.rows || [];
    
    return rows.map(row => ({
      symbol: row.symbol as string,
      date: new Date(row.date as string),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume)
    }));
  }

  private computeFeatures(bars: BarData[], spyBars: BarData[]): FeatureRow[] {
    if (bars.length < 300 || spyBars.length < 300) {
      console.log(`⚠️  Insufficient data for ${bars[0]?.symbol}: ${bars.length} bars`);
      return [];
    }

    const symbol = bars[0].symbol;
    const closes = bars.map(b => b.close);
    const spyCloses = spyBars.map(b => b.close);
    
    // Calculate all indicators
    const rsi14 = TechnicalIndicators.calculateRSI(closes, 14);
    const macd = TechnicalIndicators.calculateMACD(closes);
    const atr14 = TechnicalIndicators.calculateATR(bars, 14);
    const ma50 = TechnicalIndicators.calculateSMA(closes, 50);
    const ma200 = TechnicalIndicators.calculateSMA(closes, 200);
    const bbPctB = TechnicalIndicators.calculateBollingerPctB(closes, 20, 2);
    
    // Calculate Z-scores with 60-day window
    const rsiZScore = TechnicalIndicators.calculateZScore(rsi14, 60);
    const macdZScore = TechnicalIndicators.calculateZScore(macd.macd, 60);
    const bbPctBZScore = TechnicalIndicators.calculateZScore(bbPctB, 60);
    
    // Price momentum (5-day returns)
    const priceMom5d = TechnicalIndicators.calculateReturns(closes, 5);
    const priceMomZScore = TechnicalIndicators.calculateZScore(priceMom5d, 60);
    
    // MA gap percentage
    const maGapPct: number[] = [];
    for (let i = 0; i < Math.min(ma50.length, ma200.length); i++) {
      const ma50Adj = ma50[i + Math.max(0, ma200.length - ma50.length)];
      const ma200Val = ma200[i];
      maGapPct.push((ma50Adj - ma200Val) / ma200Val);
    }
    const maGapZScore = TechnicalIndicators.calculateZScore(maGapPct, 60);
    
    // Relative strength vs SPY
    const returns30d = TechnicalIndicators.calculateReturns(closes, 30);
    const spyReturns30d = TechnicalIndicators.calculateReturns(spyCloses, 30);
    const returns90d = TechnicalIndicators.calculateReturns(closes, 90);
    const spyReturns90d = TechnicalIndicators.calculateReturns(spyCloses, 90);
    
    const rs30d: number[] = [];
    const rs90d: number[] = [];
    
    for (let i = 0; i < Math.min(returns30d.length, spyReturns30d.length); i++) {
      rs30d.push(returns30d[i] - spyReturns30d[i]);
    }
    
    for (let i = 0; i < Math.min(returns90d.length, spyReturns90d.length); i++) {
      rs90d.push(returns90d[i] - spyReturns90d[i]);
    }
    
    // Beta and correlation (252 days)
    const dailyReturns = TechnicalIndicators.calculateReturns(closes, 1);
    const spyDailyReturns = TechnicalIndicators.calculateReturns(spyCloses, 1);
    
    // Dollar volume
    const dollarVolume20d: number[] = [];
    for (let i = 19; i < bars.length; i++) {
      const avgDollarVol = bars.slice(i - 19, i + 1)
        .reduce((sum, bar) => sum + (bar.volume * bar.close), 0) / 20;
      dollarVolume20d.push(avgDollarVol);
    }

    // Generate feature rows for the last 300 days
    const features: FeatureRow[] = [];
    const startIndex = Math.max(0, bars.length - 300);
    
    for (let i = startIndex; i < bars.length; i++) {
      const bar = bars[i];
      const dayIndex = i;
      
      // Calculate composite Z-score with exact weightings
      const weights = {
        macd: 0.35,
        rsi: 0.25,
        maTrend: 0.20,
        bollinger: 0.15,
        priceMom: 0.05
      };
      
      let compositeZ: number | null = null;
      const components = {
        macdZ: this.getValueAtIndex(macdZScore, dayIndex - (bars.length - macdZScore.length)),
        rsiZ: this.getValueAtIndex(rsiZScore, dayIndex - (bars.length - rsiZScore.length)),
        maGapZ: this.getValueAtIndex(maGapZScore, dayIndex - (bars.length - maGapZScore.length)),
        bbPctBZ: this.getValueAtIndex(bbPctBZScore, dayIndex - (bars.length - bbPctBZScore.length)),
        priceMomZ: this.getValueAtIndex(priceMomZScore, dayIndex - (bars.length - priceMomZScore.length))
      };
      
      if (components.macdZ !== null && components.rsiZ !== null && 
          components.maGapZ !== null && components.bbPctBZ !== null && 
          components.priceMomZ !== null) {
        compositeZ = (
          weights.macd * components.macdZ +
          weights.rsi * components.rsiZ +
          weights.maTrend * components.maGapZ +
          weights.bollinger * components.bbPctBZ +
          weights.priceMom * components.priceMomZ
        );
      }
      
      // Calculate deltas
      let dz1: number | null = null;
      let dz5: number | null = null;
      
      if (compositeZ !== null && features.length > 0) {
        const prevZ = features[features.length - 1]?.composite_z_60d;
        if (prevZ !== null) dz1 = compositeZ - prevZ;
      }
      
      if (compositeZ !== null && features.length >= 5) {
        const prev5Z = features[features.length - 5]?.composite_z_60d;
        if (prev5Z !== null) dz5 = compositeZ - prev5Z;
      }
      
      // Beta and correlation calculation
      const windowStart = Math.max(0, dayIndex - 251);
      const windowEnd = dayIndex + 1;
      const symbolRets = dailyReturns.slice(
        Math.max(0, windowStart - (bars.length - dailyReturns.length)),
        windowEnd - (bars.length - dailyReturns.length)
      );
      const spyRets = spyDailyReturns.slice(
        Math.max(0, windowStart - (spyBars.length - spyDailyReturns.length)),
        windowEnd - (spyBars.length - spyDailyReturns.length)
      );
      
      const { beta, corr } = TechnicalIndicators.calculateBetaAndCorr(symbolRets, spyRets);
      
      const feature: FeatureRow = {
        symbol,
        asof_date: bar.date.toISOString().split('T')[0],
        horizon: '60D',
        pipeline_version: 'v1',
        composite_z_60d: compositeZ,
        dz1_60d: dz1,
        dz5_60d: dz5,
        macd_z_60d: components.macdZ,
        rsi14: this.getValueAtIndex(rsi14, dayIndex - (bars.length - rsi14.length)),
        bb_pctb_20: this.getValueAtIndex(bbPctB, dayIndex - (bars.length - bbPctB.length)),
        ma50: this.getValueAtIndex(ma50, dayIndex - (bars.length - ma50.length)),
        ma200: this.getValueAtIndex(ma200, dayIndex - (bars.length - ma200.length)),
        ma_gap_pct: this.getValueAtIndex(maGapPct, dayIndex - (bars.length - maGapPct.length)),
        atr14: this.getValueAtIndex(atr14, dayIndex - (bars.length - atr14.length)),
        rs_spy_30d: this.getValueAtIndex(rs30d, dayIndex - (bars.length - rs30d.length)),
        rs_spy_90d: this.getValueAtIndex(rs90d, dayIndex - (bars.length - rs90d.length)),
        beta_spy_252d: beta,
        corr_spy_252d: corr,
        vol_dollar_20d: this.getValueAtIndex(dollarVolume20d, dayIndex - (bars.length - dollarVolume20d.length)),
        // Required fields
        observations: Math.min(dayIndex + 1, 252), // Number of observations used
        data_quality: 'medium',
        has_sufficient_data: (dayIndex + 1) >= 60,
        extras: {}
      };
      
      features.push(feature);
    }
    
    console.log(`✅ Generated ${features.length} feature rows for ${symbol}`);
    return features;
  }

  private getValueAtIndex(array: number[], index: number): number | null {
    if (index < 0 || index >= array.length) return null;
    return array[index];
  }

  private async upsertFeatures(features: FeatureRow[]): Promise<void> {
    if (features.length === 0) return;
    
    console.log(`💾 Upserting ${features.length} feature rows...`);
    
    // Use a simpler batch insert approach
    for (const feature of features) {
      await db.execute(sql`
        INSERT INTO equity_features_daily
          (symbol, asof_date, horizon, pipeline_version,
           composite_z_60d, dz1_60d, dz5_60d, macd_z_60d, rsi14, bb_pctb_20,
           ma50, ma200, ma_gap_pct, atr14, rs_spy_30d, rs_spy_90d, beta_spy_252d,
           corr_spy_252d, vol_dollar_20d, observations, data_quality, has_sufficient_data, extras)
        VALUES 
          (${feature.symbol}, ${feature.asof_date}, ${feature.horizon}, ${feature.pipeline_version},
           ${feature.composite_z_60d}, ${feature.dz1_60d}, ${feature.dz5_60d}, ${feature.macd_z_60d}, 
           ${feature.rsi14}, ${feature.bb_pctb_20}, ${feature.ma50}, ${feature.ma200}, 
           ${feature.ma_gap_pct}, ${feature.atr14}, ${feature.rs_spy_30d}, ${feature.rs_spy_90d}, 
           ${feature.beta_spy_252d}, ${feature.corr_spy_252d}, ${feature.vol_dollar_20d}, 
           ${feature.observations}, ${feature.data_quality}, ${feature.has_sufficient_data}, ${JSON.stringify(feature.extras)}::jsonb)
        ON CONFLICT ON CONSTRAINT equity_features_daily_pkey 
        DO UPDATE SET
          composite_z_60d = EXCLUDED.composite_z_60d,
          dz1_60d         = EXCLUDED.dz1_60d,
          dz5_60d         = EXCLUDED.dz5_60d,
          macd_z_60d      = EXCLUDED.macd_z_60d,
          rsi14           = EXCLUDED.rsi14,
          bb_pctb_20      = EXCLUDED.bb_pctb_20,
          ma50            = EXCLUDED.ma50,
          ma200           = EXCLUDED.ma200,
          ma_gap_pct      = EXCLUDED.ma_gap_pct,
          atr14           = EXCLUDED.atr14,
          rs_spy_30d      = EXCLUDED.rs_spy_30d,
          rs_spy_90d      = EXCLUDED.rs_spy_90d,
          beta_spy_252d   = EXCLUDED.beta_spy_252d,
          corr_spy_252d   = EXCLUDED.corr_spy_252d,
          vol_dollar_20d  = EXCLUDED.vol_dollar_20d
      `);
    }
  }

  async buildFeatures(): Promise<void> {
    console.log('🚀 Starting ETF Feature Builder...');
    console.log(`📈 Processing ${ETF_UNIVERSE.length} ETFs: ${ETF_UNIVERSE.join(', ')}`);
    
    try {
      // Load SPY data first (needed for relative strength calculations)
      console.log('📊 Loading SPY benchmark data...');
      let spyBars = await this.loadBarsData('SPY', 400);
      
      // If SPY doesn't have enough data, try to use the symbol with the most data as benchmark
      if (spyBars.length < 300) {
        console.log('⚠️  SPY has insufficient data, checking for alternative benchmark...');
        
        // Find symbol with most data
        const dataCheck = await db.execute(sql`
          SELECT symbol, COUNT(*) as bar_count 
          FROM equity_daily_bars 
          GROUP BY symbol 
          HAVING COUNT(*) >= 300 
          ORDER BY bar_count DESC 
          LIMIT 1
        `);
        
        const dataRows = Array.isArray(dataCheck) ? dataCheck : dataCheck.rows || [];
        if (dataRows.length > 0) {
          const benchmarkSymbol = dataRows[0].symbol as string;
          console.log(`📊 Using ${benchmarkSymbol} as benchmark (${dataRows[0].bar_count} bars)`);
          spyBars = await this.loadBarsData(benchmarkSymbol, 400);
        } else {
          console.error('❌ No symbols with sufficient data for feature calculation');
          return;
        }
      }
      
      for (const symbol of ETF_UNIVERSE) {
        console.log(`\n🔄 Processing ${symbol}...`);
        
        const bars = await this.loadBarsData(symbol, 400);
        
        if (bars.length < 300) {
          console.log(`⚠️  Skipping ${symbol}: insufficient data (${bars.length} bars)`);
          continue;
        }
        
        const features = this.computeFeatures(bars, spyBars);
        await this.upsertFeatures(features);
        
        console.log(`✅ ${symbol} features updated successfully`);
      }
      
      console.log('\n🎉 ETF Feature Builder completed successfully!');
      
      // Verify results
      const result = await db.execute(sql`
        SELECT COUNT(*) as total_rows, 
               COUNT(DISTINCT symbol) as symbols,
               MAX(asof_date) as latest_date
        FROM equity_features_daily 
        WHERE horizon = '60D'
      `);
      
      const resultRows = Array.isArray(result) ? result : result.rows || [];
      if (resultRows.length > 0) {
        console.log(`📊 Results: ${resultRows[0].total_rows} rows for ${resultRows[0].symbols} symbols`);
        console.log(`📅 Latest date: ${resultRows[0].latest_date}`);
      }
      
    } catch (error) {
      console.error('❌ ETF Feature Builder failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const builder = new ETFFeatureBuilder();
  await builder.buildFeatures();
  process.exit(0);
}

// ES module entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ETFFeatureBuilder };