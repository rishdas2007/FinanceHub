import { logger } from '../middleware/logging';
import { storage } from '../storage';
// Removed smart-cache dependency - using direct cache implementation
import { marketHoursDetector } from './market-hours-detector';

interface UnifiedDashboardData {
  // Core market data
  spyData: {
    ticker: 'SPY';
    price: number;
    change: number;
    changePercent: number;
    rsi: number;
    zScore: number;
    annualReturn: number;
    sharpeRatio: number;
    momentum: string;
    signal: string;
  };
  
  // Sector data with consistent calculations
  sectorData: Array<{
    sector: string;
    ticker: string;
    price: number;
    oneDayChange: number;
    fiveDayChange: number;
    oneMonthChange: number;
    rsi: number;
    zScore: number; // CRITICAL: Same calculation across all components
    annualReturn: number;
    sharpeRatio: number;
    momentum: string;
    signal: string;
  }>;
  
  // Technical indicators
  technicalData: {
    vix: number;
    adx: number;
    putCallRatio: number;
    aaiiBullish: number;
    aaiiBearish: number;
  };
  
  // Economic readings
  economicData: Array<{
    metric: string;
    current: string;
    forecast: string;
    variance: string;
    prior: string;
    type: string;
    lastUpdated: string;
    releaseDate: string;
    change: string;
    zScore: number;
  }>;
  
  // Metadata
  lastUpdated: Date;
  dataAge: number; // milliseconds
  freshness: 'fresh' | 'recent' | 'stale';
}

export class UnifiedDashboardCache {
  private static instance: UnifiedDashboardCache;
  private readonly CACHE_KEY = 'unified-dashboard-data';
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private isUpdating = false;
  private cachedData: UnifiedDashboardData | null = null;
  private cacheTimestamp = 0;
  private localCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static getInstance(): UnifiedDashboardCache {
    if (!UnifiedDashboardCache.instance) {
      UnifiedDashboardCache.instance = new UnifiedDashboardCache();
    }
    return UnifiedDashboardCache.instance;
  }

  /**
   * Get unified dashboard data - single source of truth for all components
   */
  async getUnifiedData(): Promise<UnifiedDashboardData> {
    // Check cache first
    if (this.cachedData && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      const dataAge = Date.now() - this.cacheTimestamp;
      logger.info(`📊 Serving cached unified dashboard data (age: ${dataAge}ms)`);
      return this.cachedData;
    }

    // If cache is stale or missing, fetch fresh data
    return await this.fetchAndCacheUnifiedData();
  }

  /**
   * Force refresh all data and update cache
   */
  async refreshUnifiedData(): Promise<UnifiedDashboardData> {
    if (this.isUpdating) {
      logger.info('📊 Already updating unified data, returning cached version');
      if (this.cachedData) return this.cachedData;
    }

    return await this.fetchAndCacheUnifiedData();
  }

  /**
   * Get SPY baseline data for consistent comparison
   */
  async getSPYBaseline(): Promise<UnifiedDashboardData['spyData']> {
    const unifiedData = await this.getUnifiedData();
    return unifiedData.spyData;
  }

  /**
   * Get sector data with consistent Z-Score calculations
   */
  async getSectorData(): Promise<UnifiedDashboardData['sectorData']> {
    const unifiedData = await this.getUnifiedData();
    return unifiedData.sectorData;
  }

  /**
   * Get technical indicators
   */
  async getTechnicalData(): Promise<UnifiedDashboardData['technicalData']> {
    const unifiedData = await this.getUnifiedData();
    return unifiedData.technicalData;
  }

  private async fetchAndCacheUnifiedData(): Promise<UnifiedDashboardData> {
    this.isUpdating = true;
    logger.info('📊 Fetching fresh unified dashboard data');

    try {
      // Fetch momentum analysis data (contains SPY + sectors with consistent calculations)
      const momentumData = await this.fetchMomentumData();
      
      // Fetch technical indicators
      const technicalData = await this.fetchTechnicalData();
      
      // Fetch economic readings
      const economicData = await this.fetchEconomicData();

      // Build unified data structure
      const unifiedData: UnifiedDashboardData = {
        spyData: this.extractSPYData(momentumData),
        sectorData: this.extractSectorData(momentumData),
        technicalData,
        economicData,
        lastUpdated: new Date(),
        dataAge: 0,
        freshness: 'fresh'
      };

      // Cache the unified data (using simplified local cache)
      this.cachedData = unifiedData;
      this.cacheTimestamp = Date.now();
      
      logger.info(`📊 Unified dashboard data cached successfully (${unifiedData.sectorData.length} sectors)`);
      return unifiedData;

    } catch (error) {
      logger.error('❌ Error fetching unified dashboard data:', error);
      
      // Return stale cache if available
      if (this.cachedData && Date.now() - this.cacheTimestamp < this.CACHE_TTL * 2) {
        logger.info('📊 Returning stale cached data due to fetch error');
        return this.cachedData;
      }
      
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  private async fetchMomentumData(): Promise<any> {
    try {
      const response = await fetch('http://localhost:5000/api/momentum-analysis');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      logger.error('❌ Error fetching momentum data:', error);
      throw error;
    }
  }

  private async fetchTechnicalData(): Promise<UnifiedDashboardData['technicalData']> {
    try {
      // Fetch VIX from stocks API
      const vixResponse = await fetch('http://localhost:5000/api/stocks/VIX');
      let vix = 16.2; // fallback
      if (vixResponse.ok) {
        const vixData = await vixResponse.json();
        vix = parseFloat(vixData.price) || 16.2;
      }

      // Fetch ADX from technical indicators
      const techResponse = await fetch('http://localhost:5000/api/technical/SPY');
      let adx = 31.27; // fallback
      if (techResponse.ok) {
        const techData = await techResponse.json();
        adx = parseFloat(techData.adx) || 31.27;
      }

      // Get AAII sentiment from latest stored data
      const sentimentData = await storage.getLatestMarketSentiment();
      
      return {
        vix,
        adx,
        putCallRatio: Number(sentimentData?.putCallRatio) || 0.85,
        aaiiBullish: Number(sentimentData?.aaiiBullish) || 41.4,
        aaiiBearish: Number(sentimentData?.aaiiBearish) || 35.6
      };
    } catch (error) {
      logger.error('❌ Error fetching technical data:', error);
      // Return fallback values
      return {
        vix: 16.2,
        adx: 31.27,
        putCallRatio: 0.85,
        aaiiBullish: 41.4,
        aaiiBearish: 35.6
      };
    }
  }

  private async fetchEconomicData(): Promise<UnifiedDashboardData['economicData']> {
    try {
      const response = await fetch('http://localhost:5000/api/recent-economic-openai');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      logger.error('❌ Error fetching economic data:', error);
      return [];
    }
  }

  private extractSPYData(momentumData: any): UnifiedDashboardData['spyData'] {
    const spyEntry = momentumData.momentumStrategies?.find((s: any) => s.ticker === 'SPY');
    if (!spyEntry) {
      throw new Error('SPY data not found in momentum analysis');
    }

    return {
      ticker: 'SPY',
      price: parseFloat(spyEntry.price) || 628.04,
      change: parseFloat(spyEntry.oneDayChange) || 0.2,
      changePercent: parseFloat(spyEntry.oneDayChange) || 0.2,
      rsi: parseFloat(spyEntry.rsi) || 68.5,
      zScore: parseFloat(spyEntry.zScore) || 0.10, // CRITICAL: Source of truth for Z-Score
      annualReturn: parseFloat(spyEntry.annualReturn) || 14.8,
      sharpeRatio: parseFloat(spyEntry.sharpeRatio) || 0.72,
      momentum: spyEntry.momentum || 'Bullish',
      signal: spyEntry.signal || 'Moderate bullish'
    };
  }

  private extractSectorData(momentumData: any): UnifiedDashboardData['sectorData'] {
    if (!momentumData.momentumStrategies) {
      return [];
    }

    return momentumData.momentumStrategies
      .filter((s: any) => s.ticker !== 'SPY') // Exclude SPY from sector list
      .map((sector: any) => ({
        sector: sector.sector || 'Unknown',
        ticker: sector.ticker || '',
        price: parseFloat(sector.price) || 0,
        oneDayChange: parseFloat(sector.oneDayChange) || 0,
        fiveDayChange: parseFloat(sector.fiveDayChange) || 0,
        oneMonthChange: parseFloat(sector.oneMonthChange) || 0,
        rsi: parseFloat(sector.rsi) || 50,
        zScore: parseFloat(sector.zScore) || 0, // CRITICAL: Same calculation as chart
        annualReturn: parseFloat(sector.annualReturn) || 0,
        sharpeRatio: parseFloat(sector.sharpeRatio) || 0,
        momentum: sector.momentum || 'Neutral',
        signal: sector.signal || 'Mixed signals'
      }));
  }

  private isCacheValid(cached: UnifiedDashboardData): boolean {
    const age = Date.now() - cached.lastUpdated.getTime();
    cached.dataAge = age;
    
    if (age < 10 * 60 * 1000) { // < 10 minutes
      cached.freshness = 'fresh';
      return true;
    } else if (age < 30 * 60 * 1000) { // < 30 minutes
      cached.freshness = 'recent';
      return true;
    } else {
      cached.freshness = 'stale';
      return false; // Force refresh for stale data
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): any {
    if (!this.cachedData) {
      return { status: 'empty', lastUpdated: null, dataAge: null, freshness: null };
    }

    const age = Date.now() - this.cachedData.lastUpdated.getTime();
    return {
      status: 'active',
      lastUpdated: this.cachedData.lastUpdated,
      dataAge: age,
      freshness: this.cachedData.freshness,
      spyDataAvailable: !!this.cachedData.spyData,
      sectorCount: this.cachedData.sectorData.length,
      economicCount: this.cachedData.economicData.length
    };
  }

  /**
   * Set economic data cache with custom TTL for daily 8am refresh strategy
   */
  async setEconomicDataCache(data: any[], ttlMs: number): Promise<void> {
    if (this.cachedData) {
      // Update only economic data in existing cache
      this.cachedData.economicData = data;
      this.cachedData.lastUpdated = new Date();
      this.cacheTimestamp = Date.now();
    } else {
      // Create new cache entry with economic data
      this.cachedData = {
        spyData: {
          ticker: 'SPY',
          price: 620,
          change: 0.3,
          changePercent: 0.05,
          rsi: 70,
          zScore: 0.1,
          annualReturn: 14.8,
          sharpeRatio: 0.72,
          momentum: 'Bullish',
          signal: 'Moderate bullish'
        },
        sectorData: [],
        economicData: data,
        technicalData: {
          vix: 16.2,
          adx: 31.27,
          putCallRatio: 0.85,
          aaiiBullish: 41.4,
          aaiiBearish: 35.6
        },
        lastUpdated: new Date(),
        dataAge: 0,
        freshness: 'fresh' as const
      };
      this.cacheTimestamp = Date.now();
    }
    
    logger.info(`📊 Economic data cache set with ${data.length} readings for ${Math.round(ttlMs / (60 * 60 * 1000))} hours`);
  }

  // Methods to support background-data-fetcher compatibility
  get(key: string): { data: any; timestamp: number } | null {
    const entry = this.localCache.get(key);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return { data: entry.data, timestamp: entry.timestamp };
    }
    return null;
  }

  set(key: string, data: any, ttl: number): void {
    this.localCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: typeof ttl === 'number' ? ttl : 300000 // Default 5min if not provided
    });
  }

  remove(key: string): void {
    this.localCache.delete(key);
  }

  clear(): void {
    this.localCache.clear();
    this.cachedData = null;
    this.cacheTimestamp = 0;
  }

  getStats(): any {
    return {
      size: this.localCache.size,
      cacheAge: Date.now() - this.cacheTimestamp,
      isMainCacheValid: this.cachedData && Date.now() - this.cacheTimestamp < this.CACHE_TTL
    };
  }
}

export const unifiedDashboardCache = UnifiedDashboardCache.getInstance();