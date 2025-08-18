import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import logger from '../utils/logger';
import { historicalMACDService } from '../services/historical-macd-service';

const router = Router();

// ETF symbols we track
const ETF_SYMBOLS = [
  'SPY', 'XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY'
];

// Technical analysis calculations
function calculateRSI(prices: number[]): number | null {
  if (prices.length < 14) return null;
  
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  const avgGain = gains.slice(-14).reduce((a, b) => a + b) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b) / 14;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): { 
  macd: number | null; 
  signal: number | null;
  ema12: number | null;
  ema26: number | null;
} {
  if (prices.length < 26) return { macd: null, signal: null, ema12: null, ema26: null };
  
  // Simple EMA calculation
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (!ema12 || !ema26) return { macd: null, signal: null, ema12: null, ema26: null };
  
  const macd = ema12 - ema26;
  return { macd, signal: null, ema12, ema26 }; // Return EMA values for storage
}

function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

function calculateBollingerBands(prices: number[], period: number = 20): { upper: number; lower: number; percB: number | null } | null {
  if (prices.length < period) return null;
  
  const recentPrices = prices.slice(-period);
  const sma = recentPrices.reduce((a, b) => a + b) / period;
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  const upper = sma + (2 * stdDev);
  const lower = sma - (2 * stdDev);
  const currentPrice = prices[prices.length - 1];
  
  const percB = (currentPrice - lower) / (upper - lower);
  
  return { upper, lower, percB };
}

function calculateZScore(value: number | null, historicalValues: number[]): number | null {
  if (!value || historicalValues.length < 2) return null;
  
  const mean = historicalValues.reduce((a, b) => a + b) / historicalValues.length;
  const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (historicalValues.length - 1);
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function generateSignal(zScore: number | null): 'BUY' | 'SELL' | 'HOLD' {
  if (!zScore) return 'HOLD';
  if (zScore < -1.5) return 'BUY';
  if (zScore > 1.5) return 'SELL';
  return 'HOLD';
}

/**
 * Validate z-score reasonableness and cap extreme values
 */
function validateZScore(zscore: number | null, metric: string, symbol: string): number | null {
  if (zscore === null) return null;
  
  // Log extreme z-scores for investigation
  if (Math.abs(zscore) > 4) {
    console.log(`🚨 Extreme ${metric} z-score for ${symbol}: ${zscore.toFixed(2)} - possible calculation error`);
  }
  
  // Cap extreme values to reasonable range
  if (Math.abs(zscore) > 3) {
    const cappedValue = Math.sign(zscore) * 3;
    console.log(`📊 Capping ${metric} z-score for ${symbol}: ${zscore.toFixed(2)} → ${cappedValue}`);
    return cappedValue;
  }
  
  return zscore;
}

// Main ETF technical analysis endpoint
router.get('/technical-clean', async (req, res) => {
  try {
    logger.info('🔍 Fetching clean ETF technical data from Twelve Data API');
    
    const results = [];
    
    for (const symbol of ETF_SYMBOLS) {
      try {
        // Get current quote from Twelve Data API
        const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        
        if (!quoteResponse.ok) {
          logger.warn(`Failed to fetch quote for ${symbol}: ${quoteResponse.status}`);
          continue;
        }
        
        const quoteData = await quoteResponse.json();
        
        if (quoteData.status === 'error') {
          logger.warn(`API error for ${symbol}:`, quoteData.message);
          continue;
        }
        
        // Get time series data for technical indicators
        const timeSeriesUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=50&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const timeSeriesResponse = await fetch(timeSeriesUrl);
        
        let technicalData: {
          rsi: number | null;
          macd: number | null;
          macdSignal: number | null;
          ema12: number | null;
          ema26: number | null;
          bollingerPercB: number | null;
          sma20: number | null;
          sma50: number | null;
          maGap: number | null;
        } = {
          rsi: null,
          macd: null,
          macdSignal: null,
          ema12: null,
          ema26: null,
          bollingerPercB: null,
          sma20: null,
          sma50: null,
          maGap: null
        };
        
        if (timeSeriesResponse.ok) {
          const timeSeriesData = await timeSeriesResponse.json();
          
          if (timeSeriesData.values && Array.isArray(timeSeriesData.values)) {
            const prices = timeSeriesData.values.map((v: any) => parseFloat(v.close)).reverse();
            
            // Calculate technical indicators
            technicalData.rsi = calculateRSI(prices);
            
            const macdResult = calculateMACD(prices);
            technicalData.macd = macdResult.macd;
            technicalData.macdSignal = macdResult.signal;
            technicalData.ema12 = macdResult.ema12;
            technicalData.ema26 = macdResult.ema26;
            
            const bollingerResult = calculateBollingerBands(prices);
            if (bollingerResult) {
              technicalData.bollingerPercB = bollingerResult.percB;
            }
            
            // Calculate moving averages
            if (prices.length >= 20) {
              technicalData.sma20 = prices.slice(-20).reduce((a: number, b: number) => a + b) / 20;
            }
            if (prices.length >= 50) {
              technicalData.sma50 = prices.slice(-50).reduce((a: number, b: number) => a + b) / 50;
            }
            
            // Calculate MA gap
            if (technicalData.sma20 && technicalData.sma50) {
              technicalData.maGap = ((technicalData.sma20 - technicalData.sma50) / technicalData.sma50) * 100;
            }
          }
        }
        
        // Calculate Z-scores using consistent database historical data
        let rsiZScore = null;
        let macdZScore = null;
        let bbZScore = null;

        // Get historical data for consistent z-score calculation
        const historicalMACDs = await historicalMACDService.getHistoricalMACDValues(symbol, 90);
        const historicalRSIs = await historicalMACDService.getHistoricalRSIValues(symbol, 90);
        const historicalBBs = await historicalMACDService.getHistoricalBBValues(symbol, 90);

        // Calculate z-scores using database historical data
        if (technicalData.macd !== null) {
          if (historicalMACDs.length >= 30) {
            macdZScore = historicalMACDService.calculateZScore(technicalData.macd, historicalMACDs);
          } else {
            // Use realistic fallback only if insufficient database data
            const fallbackMACDs = historicalMACDService.getRealisticMACDFallback(symbol);
            macdZScore = historicalMACDService.calculateZScore(technicalData.macd, fallbackMACDs);
            console.log(`⚠️ ${symbol}: Using MACD fallback data (${historicalMACDs.length} db records insufficient)`);
          }
        }

        if (technicalData.rsi !== null) {
          if (historicalRSIs.length >= 30) {
            rsiZScore = historicalMACDService.calculateZScore(technicalData.rsi, historicalRSIs);
          } else {
            // Use realistic fallback only if insufficient database data
            const fallbackRSIs = historicalMACDService.getRealisticRSIFallback(symbol);
            rsiZScore = historicalMACDService.calculateZScore(technicalData.rsi, fallbackRSIs);
            console.log(`⚠️ ${symbol}: Using RSI fallback data (${historicalRSIs.length} db records insufficient)`);
          }
        }

        if (technicalData.bollingerPercB !== null) {
          if (historicalBBs.length >= 30) {
            bbZScore = historicalMACDService.calculateZScore(technicalData.bollingerPercB, historicalBBs);
          } else {
            // Use realistic fallback only if insufficient database data
            const fallbackBBs = historicalMACDService.getRealisticBBFallback(symbol);
            bbZScore = historicalMACDService.calculateZScore(technicalData.bollingerPercB, fallbackBBs);
            console.log(`⚠️ ${symbol}: Using Bollinger %B fallback data (${historicalBBs.length} db records insufficient)`);
          }
        }

        // Validate z-scores before using
        const validatedRSIZScore = validateZScore(rsiZScore, 'RSI', symbol);
        const validatedMACDZScore = validateZScore(macdZScore, 'MACD', symbol);
        const validatedBBZScore = validateZScore(bbZScore, 'Bollinger %B', symbol);
        
        // Calculate composite Z-score as simple average (more conservative approach)
        let compositeZScore = null;
        const scores: number[] = [];
        if (validatedRSIZScore !== null) scores.push(validatedRSIZScore);
        if (validatedMACDZScore !== null) scores.push(validatedMACDZScore);  
        if (validatedBBZScore !== null) scores.push(validatedBBZScore);
        
        if (scores.length > 0) {
          compositeZScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          // Additional capping for composite score
          compositeZScore = Math.max(-3, Math.min(3, compositeZScore));
        }
        
        const etfResult = {
          symbol: symbol,
          name: `${symbol} ETF`,
          price: parseFloat(quoteData.close),
          changePercent: parseFloat(quoteData.percent_change) || 0,
          ...technicalData,
          ema12: technicalData.ema12,
          ema26: technicalData.ema26,
          zScore: compositeZScore,
          rsiZScore: validatedRSIZScore,
          macdZScore: validatedMACDZScore,
          bbZScore: validatedBBZScore,
          signal: generateSignal(compositeZScore),
          lastUpdated: new Date().toISOString()
        };
        
        results.push(etfResult);
        
        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay for API rate limits
        
      } catch (error) {
        logger.error(`Error processing ${symbol}:`, error);
      }
    }
    
    logger.info(`✅ Successfully processed ${results.length} ETFs`);
    
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
      source: 'twelve_data_api'
    });
    
  } catch (error) {
    logger.error('❌ ETF technical clean endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;