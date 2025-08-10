import { logger } from './logger.js';
import { performance } from 'perf_hooks';

interface ResourceLimits {
  maxConcurrentRequests: number;
  maxMemoryUsageMB: number;
  maxCpuThreshold: number;
}

class ResourceManager {
  private activeRequests = 0;
  private readonly limits: ResourceLimits = {
    maxConcurrentRequests: 50,
    maxMemoryUsageMB: 2048, // 2GB
    maxCpuThreshold: 85 // 85%
  };

  private requestQueue: Array<() => void> = [];
  private isHighLoadMode = false;

  public async executeWithResourceControl<T>(
    operation: () => Promise<T>,
    operationName: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const executeOperation = async () => {
        this.activeRequests++;
        const startTime = performance.now();
        
        try {
          const result = await operation();
          const duration = performance.now() - startTime;
          
          logger.debug(`✅ ${operationName} completed in ${duration.toFixed(0)}ms (active: ${this.activeRequests})`);
          
          resolve(result);
        } catch (error) {
          logger.error(`❌ ${operationName} failed:`, error);
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      // Check if we can execute immediately
      if (this.canExecuteNow() || priority === 'high') {
        await executeOperation();
      } else {
        // Queue the operation
        logger.debug(`⏳ Queueing ${operationName} (active: ${this.activeRequests}, queue: ${this.requestQueue.length})`);
        this.requestQueue.push(executeOperation);
      }
    });
  }

  private canExecuteNow(): boolean {
    // Check concurrent request limit
    if (this.activeRequests >= this.limits.maxConcurrentRequests) {
      return false;
    }

    // Check memory usage
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > this.limits.maxMemoryUsageMB) {
      logger.warn(`🚨 Memory limit approached: ${memoryUsageMB.toFixed(0)}MB`);
      return false;
    }

    return true;
  }

  private processQueue(): void {
    if (this.requestQueue.length === 0) return;
    
    while (this.requestQueue.length > 0 && this.canExecuteNow()) {
      const nextOperation = this.requestQueue.shift();
      if (nextOperation) {
        nextOperation();
      }
    }
  }

  public getResourceStatus() {
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      memoryUsageMB: memoryMB.toFixed(0),
      memoryLimitMB: this.limits.maxMemoryUsageMB,
      isHighLoadMode: this.isHighLoadMode,
      canAcceptRequests: this.canExecuteNow()
    };
  }

  public enableHighLoadMode(): void {
    this.isHighLoadMode = true;
    this.limits.maxConcurrentRequests = Math.floor(this.limits.maxConcurrentRequests * 0.7); // Reduce by 30%
    logger.warn('🚨 High load mode activated - reducing concurrent request limit');
  }

  public disableHighLoadMode(): void {
    this.isHighLoadMode = false;
    this.limits.maxConcurrentRequests = 50; // Reset to default
    logger.info('✅ High load mode disabled - restored normal limits');
  }

  // Background cleanup
  public performMaintenance(): void {
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    logger.info(`🔧 Resource maintenance - Memory: ${memoryMB.toFixed(0)}MB, Active: ${this.activeRequests}, Queue: ${this.requestQueue.length}`);
    
    // Force garbage collection if available and memory is high
    if (global.gc && memoryMB > this.limits.maxMemoryUsageMB * 0.8) {
      global.gc();
      const newMemoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
      logger.info(`🧹 GC executed: ${memoryMB.toFixed(0)}MB → ${newMemoryMB.toFixed(0)}MB`);
    }
  }

  // Start background maintenance
  public startMaintenanceScheduler(): void {
    setInterval(() => {
      this.performMaintenance();
    }, 5 * 60 * 1000); // Every 5 minutes

    logger.info('🔧 Resource maintenance scheduler started');
  }
}

export const resourceManager = new ResourceManager();