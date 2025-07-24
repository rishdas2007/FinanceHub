interface CacheEntry {
  data: any;
  timestamp: number;
  dataTimestamp: string;
  expiry: number;
}

interface SmartCacheConfig {
  marketHours: { start: number; end: number }; // Hours in EST
  cacheDurations: {
    marketHours: number;    // 5 minutes
    afterHours: number;     // 15 minutes  
    weekends: number;       // 30 minutes
  };
}

export class SmartCache {
  private cache = new Map<string, CacheEntry>();
  private config: SmartCacheConfig;

  constructor() {
    this.config = {
      marketHours: { start: 9.5, end: 16 }, // 9:30 AM - 4:00 PM EST
      cacheDurations: {
        marketHours: 5 * 60 * 1000,     // 5 minutes
        afterHours: 15 * 60 * 1000,     // 15 minutes
        weekends: 30 * 60 * 1000        // 30 minutes
      }
    };
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = est.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = est.getHours() + est.getMinutes() / 60;

    // Weekend check
    if (day === 0 || day === 6) return false;
    
    // Market hours check (9:30 AM - 4:00 PM EST)
    return hour >= this.config.marketHours.start && hour <= this.config.marketHours.end;
  }

  private getTimeContext(): 'market' | 'afterHours' | 'weekend' {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = est.getDay();

    if (day === 0 || day === 6) return 'weekend';
    return this.isMarketHours() ? 'market' : 'afterHours';
  }

  private getCacheDuration(): number {
    const context = this.getTimeContext();
    return this.config.cacheDurations[
      context === 'market' ? 'marketHours' : 
      context === 'afterHours' ? 'afterHours' : 'weekends'
    ];
  }

  private generateCacheKey(baseKey: string, dataTimestamp?: string): string {
    if (dataTimestamp) {
      return `${baseKey}:${dataTimestamp}`;
    }
    return baseKey;
  }

  get(key: string, dataTimestamp?: string): CacheEntry | null {
    const cacheKey = this.generateCacheKey(key, dataTimestamp);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry;
  }

  set(key: string, data: any, dataTimestamp?: string): void {
    const cacheDuration = this.getCacheDuration();
    const now = Date.now();
    const cacheKey = this.generateCacheKey(key, dataTimestamp);
    
    const entry: CacheEntry = {
      data,
      timestamp: now,
      dataTimestamp: dataTimestamp || new Date().toISOString(),
      expiry: now + cacheDuration
    };
    
    this.cache.set(cacheKey, entry);
  }

  getCacheInfo(key: string, dataTimestamp?: string): {
    hit: boolean;
    age: number;
    context: string;
    dataTimestamp?: string;
    expiresIn: number;
  } {
    const cacheKey = this.generateCacheKey(key, dataTimestamp);
    const entry = this.cache.get(cacheKey);
    const now = Date.now();
    const context = this.getTimeContext();
    
    if (!entry || now > entry.expiry) {
      return {
        hit: false,
        age: 0,
        context,
        expiresIn: 0
      };
    }
    
    return {
      hit: true,
      age: now - entry.timestamp,
      context,
      dataTimestamp: entry.dataTimestamp,
      expiresIn: entry.expiry - now
    };
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): {
    totalEntries: number;
    currentContext: string;
    cacheDuration: number;
  } {
    return {
      totalEntries: this.cache.size,
      currentContext: this.getTimeContext(),
      cacheDuration: this.getCacheDuration()
    };
  }
}

export const smartCache = new SmartCache();