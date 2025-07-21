interface AICacheEntry {
  analysis: any;
  timestamp: number;
  marketSnapshot: string;
}

export class OptimizedAICache {
  private cache = new Map<string, AICacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for AI commentary

  private generateMarketSnapshot(marketData: any): string {
    // Create a snapshot key based on market conditions
    const rsi = Math.round((marketData.rsi || 50) / 10) * 10; // Round to nearest 10
    const vix = Math.round((marketData.vix || 20) / 5) * 5; // Round to nearest 5
    const priceChange = Math.round((marketData.spy_change || 0) * 2) / 2; // Round to nearest 0.5%
    const sentiment = Math.round((marketData.aaii_bullish || 40) / 10) * 10; // Round to nearest 10
    
    return `RSI:${rsi}_VIX:${vix}_CHG:${priceChange}_SENT:${sentiment}`;
  }

  async getCachedOrGenerate(marketData: any, generator: () => Promise<any>): Promise<any> {
    const snapshot = this.generateMarketSnapshot(marketData);
    const now = Date.now();
    
    // Check if we have a recent cache entry for similar market conditions
    const cached = this.cache.get(snapshot);
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      console.log('🎯 AI Commentary cache hit - returning cached analysis');
      return {
        ...cached.analysis,
        timestamp: new Date().toISOString(),
        fromCache: true
      };
    }

    // No suitable cache, generate fresh analysis
    console.log('🧠 Generating fresh AI commentary...');
    const newAnalysis = await generator();
    
    // Cache the result
    this.cache.set(snapshot, {
      analysis: newAnalysis,
      timestamp: now,
      marketSnapshot: snapshot
    });

    // Clean old entries
    this.cleanOldEntries();

    return {
      ...newAnalysis,
      fromCache: false
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
  }

  getCacheStats(): any {
    const now = Date.now();
    const validEntries = Array.from(this.cache.values())
      .filter(entry => (now - entry.timestamp) < this.CACHE_DURATION).length;

    return {
      validEntries,
      totalEntries: this.cache.size,
      hitRate: validEntries > 0 ? `${Math.round((validEntries / this.cache.size) * 100)}%` : '0%',
      cacheDurationMinutes: this.CACHE_DURATION / 1000 / 60
    };
  }
}

export const optimizedAICache = new OptimizedAICache();