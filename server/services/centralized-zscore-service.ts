import { logger } from '../utils/logger.js';
import { DataQualityValidator } from './data-quality-validator';
import { VolatilityRegimeDetector } from './volatility-regime-detector';
import { getAssetClassConfig } from './standardized-window-sizes';

/**
 * Centralized Z-Score Service
 * Eliminates redundant calculations and ensures consistent statistical methods
 */

interface ZScoreResult {
  zScore: number | null;
  quality: number;
  timestamp: number;
  method: string;
  windowSize: number;
  dataPoints: number;
  confidenceLevel?: number;
  statisticalPower?: number;
}

interface CacheEntry {
  result: ZScoreResult;
  expiry: number;
}

export class CentralizedZScoreService {
  private static instance: CentralizedZScoreService;
  private cache = new Map<string, CacheEntry>();
  private dataQualityValidator = DataQualityValidator.getInstance();
  private volatilityDetector = VolatilityRegimeDetector.getInstance();
  
  // Enhanced cache TTLs optimized for 10-year dataset calculations
  private readonly CACHE_TTL = {
    'realtime': 60 * 1000,           // 1 minute for real-time data
    'intraday': 5 * 60 * 1000,       // 5 minutes for intraday data
    'daily': 2 * 60 * 60 * 1000,     // 2 hours for daily data (increased stability)
    'economic': 6 * 60 * 60 * 1000,  // 6 hours for economic data (more stable with 10-year data)
    'statistical': 24 * 60 * 60 * 1000 // 24 hours for statistical calculations
  };

  public static getInstance(): CentralizedZScoreService {
    if (!CentralizedZScoreService.instance) {
      CentralizedZScoreService.instance = new CentralizedZScoreService();
    }
    return CentralizedZScoreService.instance;
  }

  /**
   * Get Z-Score with intelligent caching and quality validation
   */
  async getZScore(
    symbol: string, 
    metric: string, 
    values: number[], 
    assetClass: 'equity' | 'etf' | 'economic' | 'volatility',
    dataFrequency: 'realtime' | 'intraday' | 'daily' | 'economic' = 'daily'
  ): Promise<ZScoreResult> {
    const cacheKey = `${symbol}:${metric}:${assetClass}`;
    const cached = this.cache.get(cacheKey);

    // Check cache validity
    if (cached && Date.now() < cached.expiry && cached.result.quality > 0.8) {
      logger.debug('Cache hit for Z-Score calculation', { cacheKey, quality: cached.result.quality });
      return cached.result;
    }

    // Calculate fresh Z-Score
    const result = await this.calculateFreshZScore(symbol, metric, values, assetClass);
    
    // Cache result if quality is acceptable
    if (result.quality > 0.5) {
      const ttl = this.CACHE_TTL[dataFrequency];
      this.cache.set(cacheKey, {
        result,
        expiry: Date.now() + ttl
      });
    }

    return result;
  }

  /**
   * Calculate fresh Z-Score with comprehensive quality validation
   */
  private async calculateFreshZScore(
    symbol: string,
    metric: string,
    values: number[],
    assetClass: 'equity' | 'etf' | 'economic' | 'volatility'
  ): Promise<ZScoreResult> {
    const startTime = Date.now();
    const config = getAssetClassConfig(assetClass);
    
    // Validate data quality with proper asset class mapping for 10-year dataset
    let validationClass: 'EQUITIES' | 'ETF_TECHNICAL' | 'ECONOMIC_MONTHLY' | 'ECONOMIC_QUARTERLY' | 'VOLATILITY';
    
    if (assetClass === 'economic') {
      validationClass = 'ECONOMIC_MONTHLY';
    } else if (values.length >= 2500) {
      // ETFs with 10-year data should use institutional EQUITIES standards
      validationClass = 'EQUITIES';
    } else {
      validationClass = 'ETF_TECHNICAL';
    }
    
    const qualityResult = this.dataQualityValidator.validateDataQuality(values, validationClass);

    if (!qualityResult.isValid) {
      logger.warn('Data quality validation failed', {
        symbol,
        metric,
        issues: qualityResult.issues,
        recommendations: qualityResult.recommendations
      });

      return {
        zScore: null,
        quality: qualityResult.quality,
        timestamp: Date.now(),
        method: 'validation_failed',
        windowSize: 0,
        dataPoints: values.length
      };
    }

    // Filter and validate values
    const validValues = values.filter(v => isFinite(v) && v !== null && v !== undefined);
    
    if (validValues.length < config.minimumPoints) {
      return {
        zScore: null,
        quality: 0,
        timestamp: Date.now(),
        method: 'insufficient_data',
        windowSize: 0,
        dataPoints: validValues.length
      };
    }

    // Use appropriate window size for calculation
    const windowSize = Math.min(config.primaryWindow, validValues.length);
    const windowValues = validValues.slice(-windowSize);
    
    // Calculate enhanced Z-Score with statistical significance testing
    const enhancedResult = this.calculateEnhancedZScore(windowValues, windowSize);
    const calculationTime = Date.now() - startTime;

    logger.debug('Enhanced Z-Score calculation completed', {
      symbol,
      metric,
      zScore: enhancedResult.zScore?.toFixed(4),
      quality: enhancedResult.quality.toFixed(3),
      confidenceLevel: enhancedResult.confidenceLevel?.toFixed(3),
      statisticalPower: enhancedResult.statisticalPower?.toFixed(3),
      windowSize,
      dataPoints: validValues.length,
      calculationTime: `${calculationTime}ms`
    });

    return {
      zScore: enhancedResult.zScore,
      quality: enhancedResult.quality,
      timestamp: Date.now(),
      method: enhancedResult.method,
      windowSize,
      dataPoints: validValues.length,
      confidenceLevel: enhancedResult.confidenceLevel,
      statisticalPower: enhancedResult.statisticalPower
    };
  }

  /**
   * Enhanced Z-Score calculation with statistical significance testing
   * Leverages 10 years of historical data for institutional-grade accuracy
   */
  private calculateEnhancedZScore(values: number[], windowSize: number): ZScoreResult {
    if (values.length < windowSize) {
      return { 
        zScore: null, 
        quality: 0, 
        method: 'insufficient_data',
        timestamp: Date.now(),
        windowSize: 0,
        dataPoints: values.length
      };
    }

    // Use much larger sample with 10 years of data
    const sampleSize = Math.min(windowSize, values.length);
    const sample = values.slice(-sampleSize);

    // Calculate with proper sample statistics
    const mean = sample.reduce((sum, val) => sum + val, 0) / sampleSize;
    const variance = sample.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (sampleSize - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0 || !isFinite(stdDev)) {
      return { 
        zScore: null, 
        quality: 0, 
        method: 'zero_variance',
        timestamp: Date.now(),
        windowSize: sampleSize,
        dataPoints: values.length
      };
    }

    const currentValue = values[values.length - 1];
    const zScore = (currentValue - mean) / stdDev;

    // Statistical significance with larger sample
    const statisticalPower = this.calculateStatisticalPower(sampleSize, stdDev);
    const confidenceLevel = this.getConfidenceLevel(Math.abs(zScore));

    return {
      zScore: isFinite(zScore) ? zScore : null,
      quality: statisticalPower,
      method: 'enhanced_sample',
      windowSize: sampleSize,
      dataPoints: values.length,
      confidenceLevel,
      statisticalPower,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate statistical power based on sample size - dramatically improved with 10 years of data
   */
  private calculateStatisticalPower(sampleSize: number, stdDev: number): number {
    // With larger samples, statistical power increases significantly
    if (sampleSize >= 2000) return 0.99;  // 99% power with 8+ years of data
    if (sampleSize >= 1000) return 0.95;  // 95% power with 4+ years of data  
    if (sampleSize >= 500) return 0.90;   // 90% power with 2+ years of data
    if (sampleSize >= 250) return 0.85;   // 85% power with 1+ year of data
    if (sampleSize >= 100) return 0.70;   // 70% power with 4+ months of data
    return Math.min(0.60, sampleSize / 100 * 0.6); // Scale for smaller samples
  }

  /**
   * Get confidence level based on z-score magnitude
   */
  private getConfidenceLevel(absZScore: number): number {
    if (absZScore >= 2.58) return 0.99;   // 99% confidence
    if (absZScore >= 1.96) return 0.95;   // 95% confidence
    if (absZScore >= 1.645) return 0.90;  // 90% confidence
    if (absZScore >= 1.28) return 0.80;   // 80% confidence
    if (absZScore >= 1.0) return 0.68;    // 68% confidence
    return 0.50; // 50% confidence for smaller z-scores
  }

  /**
   * Calculate Z-Score using proper sample statistics (legacy method)
   */
  private calculateSampleZScore(values: number[]): number | null {
    if (values.length < 2) return null;

    const n = values.length;
    const current = values[n - 1];
    
    // Calculate sample mean
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate sample variance (N-1 denominator) - critical for finite samples
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0 || !isFinite(stdDev)) return null;
    
    const zScore = (current - mean) / stdDev;
    
    // Return raw Z-Score without arbitrary capping to maintain statistical integrity
    return isFinite(zScore) ? zScore : null;
  }

  /**
   * Get volatility-adjusted Z-Score signal
   */
  async getVolatilityAdjustedSignal(
    symbol: string,
    metric: string,
    values: number[],
    vixLevel: number,
    assetClass: 'equity' | 'etf' | 'economic' | 'volatility' = 'etf'
  ): Promise<{
    zScore: number | null;
    adjustedZScore: number | null;
    signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    regime: { 
      level: 'low' | 'normal' | 'high' | 'extreme'; 
      description: string;
      multiplier: number;
    } | null;
    rationale: string;
  }> {
    const zScoreResult = await this.getZScore(symbol, metric, values, assetClass);
    
    if (zScoreResult.zScore === null) {
      return {
        zScore: null,
        adjustedZScore: null,
        signal: 'HOLD',
        regime: null,
        rationale: 'Invalid Z-Score calculation'
      };
    }

    // Generate basic signal based on z-score
    const signal = this.generateSignal(zScoreResult.zScore);
    
    return {
      zScore: zScoreResult.zScore,
      adjustedZScore: zScoreResult.zScore * this.getVolatilityMultiplier(vixLevel),
      signal: signal,
      regime: this.getVolatilityRegime(vixLevel),
      rationale: `Z-Score ${zScoreResult.zScore.toFixed(2)} with VIX ${vixLevel}`
    };
  }

  /**
   * Enhanced batch processing optimized for 10-year datasets
   * Process in larger batches of 20 (increased from 5) for better performance
   */
  async getBatchZScores(requests: Array<{
    symbol: string;
    metric: string;
    values: number[];
    assetClass: 'equity' | 'etf' | 'economic' | 'volatility';
  }>): Promise<Map<string, ZScoreResult>> {
    const results = new Map<string, ZScoreResult>();
    
    // Enhanced batch processing for large dataset calculations
    const batchSize = 20; // Increased from default 5 for 10-year datasets
    const batches = this.chunkArray(requests, batchSize);
    
    logger.info('Starting enhanced batch Z-Score processing', {
      totalRequests: requests.length,
      batchCount: batches.length,
      batchSize,
      optimization: '10-year-dataset-enhanced'
    });
    
    // Process batches in parallel with enhanced error handling
    const batchPromises = batches.map(async (batch, batchIndex) => {
      const batchResults = new Map<string, ZScoreResult>();
      
      try {
        const promises = batch.map(async (req) => {
          const result = await this.getZScore(req.symbol, req.metric, req.values, req.assetClass);
          const key = `${req.symbol}:${req.metric}`;
          batchResults.set(key, result);
          return result;
        });
        
        await Promise.all(promises);
        
        logger.debug('Batch completed', {
          batchIndex: batchIndex + 1,
          batchSize: batch.length,
          successCount: Array.from(batchResults.values()).filter(r => r.zScore !== null).length
        });
        
      } catch (error) {
        logger.error('Batch processing error', {
          batchIndex: batchIndex + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      return batchResults;
    });
    
    // Combine all batch results
    const batchResultsArray = await Promise.all(batchPromises);
    batchResultsArray.forEach(batchResult => {
      for (const [key, value] of batchResult.entries()) {
        results.set(key, value);
      }
    });
    
    const successfulCalculations = Array.from(results.values()).filter(r => r.zScore !== null).length;
    const averageQuality = results.size > 0 ? 
      (Array.from(results.values()).reduce((sum, r) => sum + r.quality, 0) / results.size) : 0;
    
    logger.info('Enhanced batch Z-Score processing completed', {
      totalRequests: requests.length,
      successfulCalculations,
      successRate: `${((successfulCalculations / requests.length) * 100).toFixed(1)}%`,
      averageQuality: averageQuality.toFixed(3),
      processingMethod: 'parallel-batch-enhanced'
    });
    
    return results;
  }

  /**
   * Helper method to chunk arrays into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clear cache entries (useful for testing or manual refresh)
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
      logger.info('Cache cleared for pattern', { pattern });
    } else {
      this.cache.clear();
      logger.info('Full cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    hitRate: number;
    averageQuality: number;
    oldestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: entries.length,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      averageQuality: entries.length > 0 ? 
        entries.reduce((sum, entry) => sum + entry.result.quality, 0) / entries.length : 0,
      oldestEntry: entries.length > 0 ? 
        Math.min(...entries.map(entry => now - entry.result.timestamp)) : 0
    };
  }

  /**
   * Generate trading signal based on Z-Score thresholds
   */
  private generateSignal(zScore: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (zScore <= -2.5) return 'STRONG_BUY';
    if (zScore <= -1.5) return 'BUY';
    if (zScore >= 2.5) return 'STRONG_SELL';
    if (zScore >= 1.5) return 'SELL';
    return 'HOLD';
  }

  /**
   * Get volatility multiplier based on VIX level
   */
  private getVolatilityMultiplier(vixLevel: number): number {
    if (vixLevel > 30) return 1.5; // High volatility amplifies signals
    if (vixLevel < 15) return 0.7; // Low volatility dampens signals
    return 1.0; // Normal volatility
  }

  /**
   * Get current volatility regime
   */
  private getVolatilityRegime(vixLevel: number): string {
    if (vixLevel < 15) return 'low';
    if (vixLevel < 25) return 'normal';
    if (vixLevel < 35) return 'high';
    return 'crisis';
  }
}