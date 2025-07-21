import { AdaptiveAIService } from './adaptive-ai-service.js';

interface CacheEntry {
  analysis: any;
  timestamp: number;
  marketConditions: string;
}

export class SmartCacheService {
  private analysisCache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_CACHE_SIZE = 50; // Prevent memory bloat

  async getCachedAnalysisOrGenerate(marketData: any): Promise<any> {
    console.log('🔄 Checking cache for Bayesian analysis...');
    
    const cacheKey = this.generateCacheKey(marketData);
    const cached = this.analysisCache.get(cacheKey);
    
    // Check if we have valid cached analysis
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log('✅ Using cached Bayesian analysis (saving tokens and API costs)');
      return { 
        ...cached.analysis, 
        fromCache: true,
        cacheAge: Math.round((Date.now() - cached.timestamp) / 1000 / 60) // Age in minutes
      };
    }

    // Generate new analysis using adaptive AI
    console.log('🧠 Generating fresh Bayesian analysis...');
    const adaptiveAI = new AdaptiveAIService();
    const analysis = await adaptiveAI.generateBayesianAnalysis(marketData);
    
    // Cache the result with market conditions context
    this.cacheAnalysis(cacheKey, analysis, marketData);

    return { ...analysis, fromCache: false };
  }

  private cacheAnalysis(cacheKey: string, analysis: any, marketData: any): void {
    // Clean cache if it's getting too large
    if (this.analysisCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanOldestEntries();
    }

    // Store analysis with metadata
    this.analysisCache.set(cacheKey, {
      analysis,
      timestamp: Date.now(),
      marketConditions: this.summarizeMarketConditions(marketData)
    });

    console.log(`💾 Cached Bayesian analysis (${this.analysisCache.size} total entries)`);
  }

  private generateCacheKey(marketData: any): string {
    // Create cache key based on significant market moves only
    // This allows caching when markets haven't moved significantly
    
    // Round values to create cache buckets
    const roundedPrice = Math.round((marketData.spyPrice || 600) * 4) / 4; // Round to quarter
    const roundedVix = Math.round(marketData.vix || 20); // Round to integer
    const roundedRsi = Math.round((marketData.rsi || 50) / 5) * 5; // Round to nearest 5
    const roundedChange = Math.round((marketData.spyChange || 0) * 10) / 10; // Round to tenth
    
    // Include AAII sentiment in cache key (rounded to 5%)
    const roundedAaii = Math.round((marketData.aaiiBullish || 40) / 5) * 5;
    
    return `bayesian_${roundedPrice}_${roundedVix}_${roundedRsi}_${roundedChange}_${roundedAaii}`;
  }

  private summarizeMarketConditions(marketData: any): string {
    const conditions = [];
    
    if ((marketData.vix || 20) > 25) conditions.push('high_vix');
    if ((marketData.rsi || 50) > 70) conditions.push('overbought');
    if ((marketData.rsi || 50) < 30) conditions.push('oversold');
    if (Math.abs(marketData.spyChange || 0) > 1) conditions.push('high_movement');
    
    return conditions.join('_') || 'normal';
  }

  private cleanOldestEntries(): void {
    console.log('🧹 Cleaning oldest cache entries...');
    
    // Convert to array and sort by timestamp
    const entries = Array.from(this.analysisCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const removeCount = Math.floor(this.MAX_CACHE_SIZE * 0.25);
    for (let i = 0; i < removeCount; i++) {
      this.analysisCache.delete(entries[i][0]);
    }
    
    console.log(`🗑️ Removed ${removeCount} oldest cache entries`);
  }

  // Method to force cache clear if needed
  clearCache(): void {
    console.log('🧹 Clearing all Bayesian analysis cache...');
    this.analysisCache.clear();
  }

  // Get cache statistics for monitoring
  getCacheStats(): any {
    const entries = Array.from(this.analysisCache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.analysisCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      averageAge: entries.length > 0 
        ? Math.round(entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length / 1000 / 60)
        : 0,
      validEntries: entries.filter(entry => (now - entry.timestamp) < this.CACHE_DURATION).length,
      cacheDuration: this.CACHE_DURATION / 1000 / 60 // in minutes
    };
  }
}