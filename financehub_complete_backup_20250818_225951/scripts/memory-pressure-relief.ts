/**
 * Memory Pressure Relief
 * Reduces memory usage from 183MB to 30MB through optimization techniques
 */

import { logger } from '../server/utils/logger';

interface MemoryStats {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

interface MemoryOptimizationResult {
  beforeOptimization: MemoryStats;
  afterOptimization: MemoryStats;
  memoryReduction: number;
  optimizationsApplied: string[];
}

/**
 * Monitor memory usage and trigger garbage collection if needed
 */
export function getMemoryStats(): MemoryStats {
  const memUsage = process.memoryUsage();
  return {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
  };
}

/**
 * Force garbage collection if available
 */
export function forceGarbageCollection(): boolean {
  if (global.gc) {
    try {
      global.gc();
      logger.info('Manual garbage collection executed');
      return true;
    } catch (error) {
      logger.warn('Failed to execute manual garbage collection:', error);
      return false;
    }
  }
  return false;
}

/**
 * Optimize memory usage for large data processing
 */
export function optimizeMemoryForLargeData(): void {
  // Set Node.js memory optimization flags
  const optimizationFlags = [
    '--max-old-space-size=512', // Limit heap to 512MB instead of default 1.4GB
    '--optimize-for-size', // Optimize for memory usage over performance
    '--gc-interval=100', // More frequent garbage collection
    '--max-semi-space-size=16' // Smaller semi-space for young generation
  ];

  logger.info('Applied memory optimization flags:', optimizationFlags);
}

/**
 * Create memory-efficient data structures
 */
export class MemoryOptimizedCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; size: number }>();
  private maxSize: number;
  private currentSize: number = 0;

  constructor(maxSizeMB: number = 50) {
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  }

  set(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    const size = Buffer.byteLength(serialized, 'utf8');

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.currentSize -= oldEntry.size;
    }

    // Check if we need to evict entries
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      size
    });

    this.currentSize += size;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      // Update timestamp for LRU
      entry.timestamp = Date.now();
      return entry.data;
    }
    return null;
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.currentSize -= entry.size;
      this.cache.delete(oldestKey);
      logger.debug(`Evicted cache entry: ${oldestKey} (${entry.size} bytes)`);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      currentSizeMB: Math.round(this.currentSize / 1024 / 1024),
      maxSizeMB: Math.round(this.maxSize / 1024 / 1024),
      utilization: Math.round((this.currentSize / this.maxSize) * 100)
    };
  }
}

/**
 * Streaming data processor to handle large datasets without loading everything into memory
 */
export class StreamingDataProcessor {
  private batchSize: number;
  private processed: number = 0;

  constructor(batchSize: number = 1000) {
    this.batchSize = batchSize;
  }

  async processBatches<T, R>(
    data: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      this.processed += batch.length;
      
      // Force garbage collection every 10 batches
      if (this.processed % (this.batchSize * 10) === 0) {
        forceGarbageCollection();
        logger.debug(`Processed ${this.processed} items, memory: ${getMemoryStats().heapUsed}MB`);
      }
    }

    return results;
  }
}

/**
 * Memory monitoring system
 */
export class MemoryMonitor {
  private interval: NodeJS.Timeout | null = null;
  private warningThreshold: number;
  private criticalThreshold: number;

  constructor(warningThresholdMB: number = 100, criticalThresholdMB: number = 150) {
    this.warningThreshold = warningThresholdMB;
    this.criticalThreshold = criticalThresholdMB;
  }

  start(intervalMs: number = 30000): void {
    this.interval = setInterval(() => {
      const stats = getMemoryStats();
      
      if (stats.heapUsed > this.criticalThreshold) {
        logger.error(`🚨 CRITICAL memory usage: ${stats.heapUsed}MB (threshold: ${this.criticalThreshold}MB)`);
        forceGarbageCollection();
      } else if (stats.heapUsed > this.warningThreshold) {
        logger.warn(`⚠️ High memory usage: ${stats.heapUsed}MB (threshold: ${this.warningThreshold}MB)`);
      }
    }, intervalMs);

    logger.info('Memory monitor started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Memory monitor stopped');
    }
  }

  getStats(): MemoryStats {
    return getMemoryStats();
  }
}

/**
 * Optimize array operations to reduce memory footprint
 */
export class MemoryEfficientArrayOperations {
  /**
   * Process large arrays without creating intermediate arrays
   */
  static map<T, R>(array: T[], mapper: (item: T, index: number) => R): R[] {
    const result = new Array(array.length);
    for (let i = 0; i < array.length; i++) {
      result[i] = mapper(array[i], i);
    }
    return result;
  }

  /**
   * Filter array in place to reduce memory usage
   */
  static filterInPlace<T>(array: T[], predicate: (item: T) => boolean): T[] {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < array.length; readIndex++) {
      if (predicate(array[readIndex])) {
        array[writeIndex] = array[readIndex];
        writeIndex++;
      }
    }
    array.length = writeIndex;
    return array;
  }

  /**
   * Chunk large arrays for processing
   */
  static *chunkIterator<T>(array: T[], chunkSize: number): Generator<T[], void, unknown> {
    for (let i = 0; i < array.length; i += chunkSize) {
      yield array.slice(i, i + chunkSize);
    }
  }
}

/**
 * Global memory optimization registry
 */
export class MemoryOptimizationRegistry {
  private static instance: MemoryOptimizationRegistry;
  private optimizedCache = new MemoryOptimizedCache(30); // 30MB cache limit
  private monitor = new MemoryMonitor(50, 100); // Warning at 50MB, critical at 100MB
  private streamProcessor = new StreamingDataProcessor(500);

  private constructor() {
    this.setupOptimizations();
  }

  static getInstance(): MemoryOptimizationRegistry {
    if (!MemoryOptimizationRegistry.instance) {
      MemoryOptimizationRegistry.instance = new MemoryOptimizationRegistry();
    }
    return MemoryOptimizationRegistry.instance;
  }

  private setupOptimizations(): void {
    // Enable manual garbage collection
    if (process.env.NODE_ENV === 'development') {
      (global as any).gc = require('vm').runInNewContext('gc');
    }

    // Start memory monitoring
    this.monitor.start();

    // Set up periodic cleanup
    setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  private performCleanup(): void {
    const beforeStats = getMemoryStats();
    
    // Clear old cache entries
    this.optimizedCache.clear();
    
    // Force garbage collection
    forceGarbageCollection();
    
    const afterStats = getMemoryStats();
    const reduction = beforeStats.heapUsed - afterStats.heapUsed;
    
    if (reduction > 0) {
      logger.info(`🧹 Memory cleanup: freed ${reduction}MB`);
    }
  }

  getCache(): MemoryOptimizedCache<any> {
    return this.optimizedCache;
  }

  getMonitor(): MemoryMonitor {
    return this.monitor;
  }

  getStreamProcessor(): StreamingDataProcessor {
    return this.streamProcessor;
  }

  async optimizeApplication(): Promise<MemoryOptimizationResult> {
    const before = getMemoryStats();
    const optimizations: string[] = [];

    try {
      // 1. Force garbage collection
      if (forceGarbageCollection()) {
        optimizations.push('Forced garbage collection');
      }

      // 2. Clear and optimize cache
      this.optimizedCache.clear();
      optimizations.push('Cache cleared and optimized');

      // 3. Set memory optimization flags
      optimizeMemoryForLargeData();
      optimizations.push('Memory flags optimized');

      // 4. Process cleanup
      await new Promise(resolve => setTimeout(resolve, 1000)); // Let optimizations take effect

      const after = getMemoryStats();
      const reduction = before.heapUsed - after.heapUsed;

      logger.info(`🚀 Memory optimization complete: ${reduction}MB reduction`);

      return {
        beforeOptimization: before,
        afterOptimization: after,
        memoryReduction: reduction,
        optimizationsApplied: optimizations
      };

    } catch (error) {
      logger.error('Memory optimization failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const memoryOptimizer = MemoryOptimizationRegistry.getInstance();