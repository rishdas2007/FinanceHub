import { logger } from '../utils/logger';

/**
 * WEEK 3: BATCH PROCESSING OPTIMIZATION
 * Intelligent request batching and processing optimization
 */

export interface BatchRequest {
  id: string;
  type: string;
  data: any;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  maxConcurrentBatches: number;
  priorityThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface BatchMetrics {
  totalRequests: number;
  batchedRequests: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  batchingEfficiency: number;
}

export class BatchProcessingService {
  private batches: Map<string, BatchRequest[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private processors: Map<string, (requests: BatchRequest[]) => Promise<any[]>> = new Map();
  private activeBatches = 0;
  private metrics: BatchMetrics = {
    totalRequests: 0,
    batchedRequests: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    batchingEfficiency: 0
  };

  private readonly config: BatchConfig = {
    maxBatchSize: 10,
    maxWaitTime: 100, // 100ms
    maxConcurrentBatches: 5,
    priorityThresholds: {
      critical: 10, // Process immediately with 10+ items
      high: 25,     // Wait 25ms max
      medium: 50,   // Wait 50ms max  
      low: 100      // Wait full 100ms
    }
  };

  /**
   * Register a batch processor for a specific request type
   */
  registerProcessor(
    type: string,
    processor: (requests: BatchRequest[]) => Promise<any[]>
  ): void {
    this.processors.set(type, processor);
    this.batches.set(type, []);
    logger.debug(`Batch processor registered for type: ${type}`);
  }

  /**
   * Add request to batch queue with intelligent scheduling
   */
  async addRequest<T>(
    type: string,
    data: any,
    priority: BatchRequest['priority'] = 'medium'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };

      this.metrics.totalRequests++;
      
      // Add to appropriate batch
      const batch = this.batches.get(type);
      if (!batch) {
        reject(new Error(`No processor registered for type: ${type}`));
        return;
      }

      batch.push(request);
      this.sortBatchByPriority(batch);

      logger.debug(`Request added to batch: ${type} (${batch.length} items, priority: ${priority})`);

      // Decide whether to process immediately or schedule
      this.scheduleProcessing(type);
    });
  }

  /**
   * Intelligent batch processing scheduling
   */
  private scheduleProcessing(type: string): void {
    const batch = this.batches.get(type);
    if (!batch || batch.length === 0) return;

    const highestPriority = batch[0].priority;
    const batchSize = batch.length;
    const shouldProcessImmediately = this.shouldProcessImmediately(highestPriority, batchSize);

    if (shouldProcessImmediately) {
      // Clear any existing timer
      const existingTimer = this.timers.get(type);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.timers.delete(type);
      }

      // Process immediately
      this.processBatch(type);
    } else if (!this.timers.has(type)) {
      // Schedule processing based on priority
      const waitTime = this.getWaitTime(highestPriority);
      
      const timer = setTimeout(() => {
        this.timers.delete(type);
        this.processBatch(type);
      }, waitTime);

      this.timers.set(type, timer);
      logger.debug(`Batch processing scheduled for ${type} in ${waitTime}ms`);
    }
  }

  /**
   * Determine if batch should be processed immediately
   */
  private shouldProcessImmediately(priority: BatchRequest['priority'], batchSize: number): boolean {
    // Process immediately if:
    // 1. Batch is full
    // 2. Critical priority with enough items
    // 3. High priority with substantial batch
    // 4. Max concurrent batches not reached

    if (batchSize >= this.config.maxBatchSize) return true;
    if (priority === 'critical' && batchSize >= 1) return true;
    if (priority === 'high' && batchSize >= 3) return true;
    if (this.activeBatches >= this.config.maxConcurrentBatches) return false;
    
    return false;
  }

  /**
   * Get wait time based on priority
   */
  private getWaitTime(priority: BatchRequest['priority']): number {
    return this.config.priorityThresholds[priority];
  }

  /**
   * Sort batch by priority (critical first, then by timestamp)
   */
  private sortBatchByPriority(batch: BatchRequest[]): void {
    batch.sort((a, b) => {
      // First sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp (older first)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Process batch with comprehensive error handling and metrics
   */
  private async processBatch(type: string): Promise<void> {
    const batch = this.batches.get(type);
    const processor = this.processors.get(type);

    if (!batch || !processor || batch.length === 0) return;

    // Prevent concurrent processing of same type
    if (this.activeBatches >= this.config.maxConcurrentBatches) {
      logger.debug(`Max concurrent batches reached, delaying ${type}`);
      setTimeout(() => this.processBatch(type), 50);
      return;
    }

    // Extract requests to process
    const requestsToProcess = batch.splice(0, this.config.maxBatchSize);
    const batchSize = requestsToProcess.length;
    
    this.activeBatches++;
    this.metrics.batchedRequests += batchSize;

    const startTime = Date.now();
    
    logger.info(`🔄 Processing batch: ${type} (${batchSize} items)`);

    try {
      const results = await processor(requestsToProcess);
      
      // Resolve individual requests
      for (let i = 0; i < requestsToProcess.length; i++) {
        const request = requestsToProcess[i];
        const result = results[i];
        
        if (result instanceof Error) {
          request.reject(result);
        } else {
          request.resolve(result);
        }
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(batchSize, processingTime);
      
      logger.info(`✅ Batch processed: ${type} (${batchSize} items, ${processingTime}ms)`);

    } catch (error) {
      logger.error(`❌ Batch processing failed: ${type}`, error);
      
      // Reject all requests in batch
      for (const request of requestsToProcess) {
        request.reject(error instanceof Error ? error : new Error('Batch processing failed'));
      }
    } finally {
      this.activeBatches--;
      
      // Schedule next batch if items remain
      if (batch.length > 0) {
        setTimeout(() => this.scheduleProcessing(type), 10);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(batchSize: number, processingTime: number): void {
    // Update average batch size
    const totalBatches = Math.ceil(this.metrics.batchedRequests / this.metrics.averageBatchSize) || 1;
    this.metrics.averageBatchSize = 
      (this.metrics.averageBatchSize * (totalBatches - 1) + batchSize) / totalBatches;

    // Update average processing time
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (totalBatches - 1) + processingTime) / totalBatches;

    // Calculate batching efficiency (requests batched vs total requests)
    this.metrics.batchingEfficiency = 
      (this.metrics.batchedRequests / this.metrics.totalRequests) * 100;
  }

  /**
   * Get current batch status
   */
  getBatchStatus(): {
    [type: string]: {
      pendingRequests: number;
      oldestRequest: number | null;
      averagePriority: string;
      scheduled: boolean;
    };
  } {
    const status: any = {};

    for (const [type, batch] of this.batches.entries()) {
      const pendingRequests = batch.length;
      const oldestRequest = batch.length > 0 ? Date.now() - batch[0].timestamp : null;
      
      // Calculate average priority weight
      const priorityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
      const totalWeight = batch.reduce((sum, req) => sum + priorityWeights[req.priority], 0);
      const avgWeight = pendingRequests > 0 ? totalWeight / pendingRequests : 0;
      
      let averagePriority = 'low';
      if (avgWeight >= 3.5) averagePriority = 'critical';
      else if (avgWeight >= 2.5) averagePriority = 'high';
      else if (avgWeight >= 1.5) averagePriority = 'medium';

      status[type] = {
        pendingRequests,
        oldestRequest,
        averagePriority,
        scheduled: this.timers.has(type)
      };
    }

    return status;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): BatchMetrics & {
    activeBatches: number;
    registeredTypes: number;
  } {
    return {
      ...this.metrics,
      activeBatches: this.activeBatches,
      registeredTypes: this.processors.size
    };
  }

  /**
   * Force process all pending batches
   */
  async flushAll(): Promise<void> {
    logger.info('🚀 Flushing all pending batches');

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Process all pending batches
    const processingPromises: Promise<void>[] = [];
    
    for (const type of this.batches.keys()) {
      const batch = this.batches.get(type);
      if (batch && batch.length > 0) {
        processingPromises.push(this.processBatch(type));
      }
    }

    await Promise.all(processingPromises);
    logger.info('✅ All batches flushed');
  }

  /**
   * Clear all pending requests (emergency stop)
   */
  clearAll(): void {
    logger.warn('⚠️ Clearing all pending batch requests');

    // Clear timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Reject all pending requests
    for (const batch of this.batches.values()) {
      for (const request of batch) {
        request.reject(new Error('Batch processing cancelled'));
      }
      batch.length = 0;
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): {
    recommendations: string[];
    performanceScore: number;
  } {
    const recommendations: string[] = [];
    let performanceScore = 100;

    // Check batching efficiency
    if (this.metrics.batchingEfficiency < 50) {
      recommendations.push('Consider increasing max wait time to improve batching efficiency');
      performanceScore -= 20;
    }

    // Check average batch size
    if (this.metrics.averageBatchSize < 3) {
      recommendations.push('Average batch size is low, consider adjusting batch triggers');
      performanceScore -= 15;
    }

    // Check processing time
    if (this.metrics.averageProcessingTime > 500) {
      recommendations.push('High processing times detected, consider optimizing batch processors');
      performanceScore -= 25;
    }

    // Check active batches
    if (this.activeBatches >= this.config.maxConcurrentBatches * 0.8) {
      recommendations.push('High concurrent batch usage, consider increasing max concurrent batches');
      performanceScore -= 10;
    }

    if (recommendations.length === 0) {
      recommendations.push('Batch processing is optimally configured');
    }

    return {
      recommendations,
      performanceScore: Math.max(0, performanceScore)
    };
  }
}

export const batchProcessingService = new BatchProcessingService();