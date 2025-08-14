// Object pooling for memory optimization
// Reduces garbage collection pressure by reusing objects

interface PooledObject {
  reset(): void;
}

export class ObjectPool<T extends PooledObject> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;
  private created: number = 0;
  private borrowed: number = 0;
  private returned: number = 0;

  constructor(factory: () => T, maxSize: number = 100, resetFn?: (obj: T) => void) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.resetFn = resetFn;
  }

  // Get object from pool or create new one
  get(): T {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.factory();
      this.created++;
    }

    this.borrowed++;
    return obj;
  }

  // Return object to pool
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      // Reset object state
      if (this.resetFn) {
        this.resetFn(obj);
      } else {
        obj.reset();
      }

      this.pool.push(obj);
      this.returned++;
    }
    // If pool is full, let object be garbage collected
  }

  // Get pool statistics
  getStats() {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      created: this.created,
      borrowed: this.borrowed,
      returned: this.returned,
      active: this.borrowed - this.returned,
      hitRate: this.borrowed > 0 ? ((this.borrowed - this.created) / this.borrowed * 100).toFixed(2) + '%' : '0%'
    };
  }

  // Clear the pool
  clear(): void {
    this.pool = [];
  }
}

// Specific pools for common objects

// Query result pool for database queries
export class QueryResult implements PooledObject {
  public data: any[] = [];
  public meta: any = {};
  public timestamp: number = 0;
  public source: string = '';

  reset(): void {
    this.data = [];
    this.meta = {};
    this.timestamp = 0;
    this.source = '';
  }
}

export const queryResultPool = new ObjectPool<QueryResult>(
  () => new QueryResult(),
  50 // Keep 50 query result objects
);

// ETF metrics calculation pool
export class ETFMetricsCalculation implements PooledObject {
  public symbol: string = '';
  public price: number = 0;
  public percentChange: number = 0;
  public zScore: number = 0;
  public technicalIndicators: any = {};
  public calculations: any = {};

  reset(): void {
    this.symbol = '';
    this.price = 0;
    this.percentChange = 0;
    this.zScore = 0;
    this.technicalIndicators = {};
    this.calculations = {};
  }
}

export const etfMetricsPool = new ObjectPool<ETFMetricsCalculation>(
  () => new ETFMetricsCalculation(),
  25 // Keep 25 ETF calculation objects
);

// Economic data processing pool
export class EconomicDataProcessor implements PooledObject {
  public seriesId: string = '';
  public observations: any[] = [];
  public features: any = {};
  public zScores: any = {};
  public transformations: any = {};

  reset(): void {
    this.seriesId = '';
    this.observations = [];
    this.features = {};
    this.zScores = {};
    this.transformations = {};
  }
}

export const economicDataPool = new ObjectPool<EconomicDataProcessor>(
  () => new EconomicDataProcessor(),
  30 // Keep 30 economic data processors
);

// HTTP response pool for API responses
export class APIResponse implements PooledObject {
  public success: boolean = true;
  public data: any = null;
  public error: string | null = null;
  public timestamp: string = '';
  public source: string = '';
  public cached: boolean = false;

  reset(): void {
    this.success = true;
    this.data = null;
    this.error = null;
    this.timestamp = '';
    this.source = '';
    this.cached = false;
  }
}

export const apiResponsePool = new ObjectPool<APIResponse>(
  () => new APIResponse(),
  40 // Keep 40 API response objects
);

// Performance metrics pool
export class PerformanceMetrics implements PooledObject {
  public startTime: number = 0;
  public endTime: number = 0;
  public duration: number = 0;
  public memoryUsage: any = {};
  public queryCount: number = 0;
  public cacheHits: number = 0;
  public cacheMisses: number = 0;

  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.duration = 0;
    this.memoryUsage = {};
    this.queryCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

export const performanceMetricsPool = new ObjectPool<PerformanceMetrics>(
  () => new PerformanceMetrics(),
  20 // Keep 20 performance metric objects
);

// Pool manager for monitoring all pools
export class PoolManager {
  private pools: Map<string, ObjectPool<any>> = new Map();

  registerPool<T extends PooledObject>(name: string, pool: ObjectPool<T>): void {
    this.pools.set(name, pool);
  }

  getPoolStats(): { [key: string]: any } {
    const stats: { [key: string]: any } = {};
    
    this.pools.forEach((pool, name) => {
      stats[name] = pool.getStats();
    });

    return stats;
  }

  getTotalStats() {
    const allStats = this.getPoolStats();
    
    let totalCreated = 0;
    let totalBorrowed = 0;
    let totalReturned = 0;
    let totalPoolSize = 0;

    Object.values(allStats).forEach((stats: any) => {
      totalCreated += stats.created;
      totalBorrowed += stats.borrowed;
      totalReturned += stats.returned;
      totalPoolSize += stats.poolSize;
    });

    return {
      totalPools: this.pools.size,
      totalCreated,
      totalBorrowed,
      totalReturned,
      totalPoolSize,
      totalActive: totalBorrowed - totalReturned,
      overallHitRate: totalBorrowed > 0 ? ((totalBorrowed - totalCreated) / totalBorrowed * 100).toFixed(2) + '%' : '0%'
    };
  }

  clearAllPools(): void {
    this.pools.forEach(pool => pool.clear());
  }
}

// Global pool manager instance
export const poolManager = new PoolManager();

// Register all pools
poolManager.registerPool('queryResult', queryResultPool);
poolManager.registerPool('etfMetrics', etfMetricsPool);
poolManager.registerPool('economicData', economicDataPool);
poolManager.registerPool('apiResponse', apiResponsePool);
poolManager.registerPool('performanceMetrics', performanceMetricsPool);

// Helper functions for easy pool usage
export const getQueryResult = () => queryResultPool.get();
export const releaseQueryResult = (obj: QueryResult) => queryResultPool.release(obj);

export const getETFMetrics = () => etfMetricsPool.get();
export const releaseETFMetrics = (obj: ETFMetricsCalculation) => etfMetricsPool.release(obj);

export const getEconomicData = () => economicDataPool.get();
export const releaseEconomicData = (obj: EconomicDataProcessor) => economicDataPool.release(obj);

export const getAPIResponse = () => apiResponsePool.get();
export const releaseAPIResponse = (obj: APIResponse) => apiResponsePool.release(obj);

export const getPerformanceMetrics = () => performanceMetricsPool.get();
export const releasePerformanceMetrics = (obj: PerformanceMetrics) => performanceMetricsPool.release(obj);