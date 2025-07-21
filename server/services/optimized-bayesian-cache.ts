interface CacheEntry {
  analysis: any;
  timestamp: number;
  marketConditions: {
    rsi: number;
    vix: number;
    priceLevel: number;
  };
}

export class OptimizedBayesianCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold

  private generateCacheKey(marketData: any): string {
    // Round values to reduce cache misses on minor fluctuations
    const rsi = Math.round(marketData.rsi / 5) * 5; // Round to nearest 5
    const vix = Math.round(marketData.vix / 2) * 2; // Round to nearest 2
    const priceLevel = Math.round((marketData.price || marketData.spy_close) / 10) * 10; // Round to nearest 10
    
    return `${rsi}-${vix}-${priceLevel}`;
  }

  private calculateSimilarity(conditions1: any, conditions2: any): number {
    const rsiSim = 1 - Math.abs(conditions1.rsi - conditions2.rsi) / 100;
    const vixSim = 1 - Math.abs(conditions1.vix - conditions2.vix) / 50;
    const priceSim = 1 - Math.abs(conditions1.priceLevel - conditions2.priceLevel) / 100;
    
    return (rsiSim + vixSim + priceSim) / 3;
  }

  async getCachedOrGenerate(marketData: any, generator: () => Promise<any>): Promise<any> {
    const cacheKey = this.generateCacheKey(marketData);
    const now = Date.now();
    
    // Check exact cache match first
    const exactMatch = this.cache.get(cacheKey);
    if (exactMatch && (now - exactMatch.timestamp) < this.CACHE_DURATION) {
      console.log('🎯 Exact cache hit for Bayesian analysis');
      return {
        ...exactMatch.analysis,
        fromCache: true,
        cacheType: 'exact'
      };
    }

    // Check for similar conditions
    const currentConditions = {
      rsi: marketData.rsi,
      vix: marketData.vix,
      priceLevel: marketData.price || marketData.spy_close
    };

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) < this.CACHE_DURATION) {
        const similarity = this.calculateSimilarity(currentConditions, entry.marketConditions);
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          console.log(`🎯 Similar cache hit (${Math.round(similarity * 100)}% similarity)`);
          
          // Adjust analysis slightly for current conditions
          const adjustedAnalysis = this.adjustAnalysisForCurrentConditions(entry.analysis, marketData);
          return {
            ...adjustedAnalysis,
            fromCache: true,
            cacheType: 'similar',
            similarity: Math.round(similarity * 100)
          };
        }
      }
    }

    // No suitable cache entry found, generate new analysis
    console.log('🧠 Generating fresh Bayesian analysis...');
    const newAnalysis = await generator();
    
    // Cache the new analysis
    this.cache.set(cacheKey, {
      analysis: newAnalysis,
      timestamp: now,
      marketConditions: currentConditions
    });

    // Clean old entries
    this.cleanOldEntries();

    return {
      ...newAnalysis,
      fromCache: false,
      cacheType: 'fresh'
    };
  }

  private adjustAnalysisForCurrentConditions(cachedAnalysis: any, currentMarketData: any): any {
    // Make minor adjustments to cached analysis for current conditions
    const currentPrice = currentMarketData.price || currentMarketData.spy_close;
    const currentRsi = currentMarketData.rsi;
    const currentVix = currentMarketData.vix;

    return {
      ...cachedAnalysis,
      setup: cachedAnalysis.setup?.replace(/\$[\d,]+\.?\d*/g, `$${currentPrice.toFixed(2)}`)
        .replace(/RSI at [\d\.]+/g, `RSI at ${currentRsi.toFixed(1)}`)
        .replace(/VIX at [\d\.]+/g, `VIX at ${currentVix.toFixed(1)}`),
      evidence: cachedAnalysis.evidence?.replace(/RSI at [\d\.]+/g, `RSI at ${currentRsi.toFixed(1)}`)
        .replace(/VIX at [\d\.]+/g, `VIX at ${currentVix.toFixed(1)}`),
      timestamp: new Date().toISOString(),
      adjustedForCurrentConditions: true
    };
  }

  private cleanOldEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) > this.CACHE_DURATION) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned ${keysToDelete.length} old cache entries`);
    }
  }

  getCacheStats(): any {
    const now = Date.now();
    const validEntries = Array.from(this.cache.values())
      .filter(entry => (now - entry.timestamp) < this.CACHE_DURATION).length;

    return {
      validEntries,
      totalEntries: this.cache.size,
      hitRate: validEntries > 0 ? `${Math.round((validEntries / this.cache.size) * 100)}%` : '0%',
      cacheDuration: this.CACHE_DURATION / 1000 / 60 // in minutes
    };
  }
}

export const optimizedBayesianCache = new OptimizedBayesianCache();