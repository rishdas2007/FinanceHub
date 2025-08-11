/**
 * Batch Processing Service
 * Implements efficient batch processing with queue management and error handling
 */

import { logger } from '../utils/logger';
import { rateLimitingService } from './rate-limiting-service';

interface BatchRequest {
  id: string;
  type: string;
  data: any;
  priority: 'low' | 'normal' | 'high';
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

interface BatchProcessingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
  fromCache: boolean;
}

interface BatchMetrics {
  totalProcessed: number;
  successRate: number;
  avgProcessingTime: number;
  queueSize: number;
  activeJobs: number;
}

export class BatchProcessingService {
  private queue: Map<string, BatchRequest[]> = new Map();
  private processing: Set<string> = new Set();
  private metrics: BatchMetrics;
  private batchSize: number = 10;
  private processingInterval: number = 5000; // 5 seconds
  private isRunning: boolean = false;

  constructor() {
    this.metrics = {
      totalProcessed: 0,
      successRate: 100,
      avgProcessingTime: 0,
      queueSize: 0,
      activeJobs: 0
    };
    
    this.startBatchProcessor();
  }

  /**
   * Add request to batch queue
   */
  async queueRequest<T>(
    type: string,
    data: any,
    priority: 'low' | 'normal' | 'high' = 'normal',
    maxRetries: number = 3
  ): Promise<string> {
    const request: BatchRequest = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      priority,
      timestamp: new Date(),
      retries: 0,
      maxRetries
    };

    if (!this.queue.has(type)) {
      this.queue.set(type, []);
    }

    const typeQueue = this.queue.get(type)!;
    
    // Insert based on priority
    if (priority === 'high') {
      typeQueue.unshift(request);
    } else {
      typeQueue.push(request);
    }

    this.updateQueueMetrics();
    
    logger.debug(`📦 Queued ${type} request: ${request.id} (priority: ${priority})`);
    
    return request.id;
  }

  /**
   * Process single request (used by unified data flow)
   */
  async processRequest<T>(request: any): Promise<T> {
    const startTime = Date.now();
    
    try {
      let result: T;
      
      switch (request.requestType) {
        case 'etf_metrics':
          result = await this.processETFMetrics(request);
          break;
        case 'economic_data':
          result = await this.processEconomicData(request);
          break;
        case 'technical_indicators':
          result = await this.processTechnicalIndicators(request);
          break;
        case 'market_sentiment':
          result = await this.processMarketSentiment(request);
          break;
        default:
          throw new Error(`Unknown request type: ${request.requestType}`);
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      
      logger.info(`✅ Processed ${request.requestType} in ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      
      logger.error(`❌ Failed to process ${request.requestType}:`, error);
      throw error;
    }
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    setInterval(async () => {
      await this.processBatches();
    }, this.processingInterval);
    
    logger.info('🔄 Batch processor started');
  }

  /**
   * Process queued batches
   */
  private async processBatches(): Promise<void> {
    if (this.processing.size >= 3) { // Max concurrent batches
      return;
    }

    for (const [type, requests] of Array.from(this.queue.entries())) {
      if (requests.length === 0 || this.processing.has(type)) {
        continue;
      }

      const batch = requests.splice(0, this.batchSize);
      if (batch.length === 0) continue;

      this.processing.add(type);
      this.processBatch(type, batch).finally(() => {
        this.processing.delete(type);
      });
    }
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(type: string, batch: BatchRequest[]): Promise<void> {
    logger.info(`🔄 Processing batch of ${batch.length} ${type} requests`);
    
    const startTime = Date.now();
    let successCount = 0;

    for (const request of batch) {
      try {
        // Check rate limits before processing
        const rateLimitStatus = await rateLimitingService.checkLimit(type);
        if (!rateLimitStatus.allowed) {
          // Re-queue the request
          this.requeueRequest(request);
          continue;
        }

        await this.processSingleBatchItem(request);
        successCount++;
        
      } catch (error) {
        logger.error(`❌ Batch item failed: ${request.id}`, error);
        
        // Retry logic
        if (request.retries < request.maxRetries) {
          request.retries++;
          this.requeueRequest(request);
        } else {
          logger.error(`💀 Max retries exceeded for request: ${request.id}`);
        }
      }
    }

    const processingTime = Date.now() - startTime;
    const successRate = (successCount / batch.length) * 100;
    
    logger.info(`✅ Batch processed: ${successCount}/${batch.length} succeeded (${successRate.toFixed(1)}%) in ${processingTime}ms`);
  }

  /**
   * Process individual batch item
   */
  private async processSingleBatchItem(request: BatchRequest): Promise<void> {
    switch (request.type) {
      case 'fred_update':
        await this.processFREDUpdate(request.data);
        break;
      case 'twelve_data_fetch':
        await this.processTwelveDataFetch(request.data);
        break;
      case 'zscore_calculation':
        await this.processZScoreCalculation(request.data);
        break;
      default:
        logger.warn(`Unknown batch request type: ${request.type}`);
    }
  }

  /**
   * Re-queue a failed request
   */
  private requeueRequest(request: BatchRequest): void {
    if (!this.queue.has(request.type)) {
      this.queue.set(request.type, []);
    }
    
    // Add delay before retry
    setTimeout(() => {
      this.queue.get(request.type)!.push(request);
      logger.debug(`🔄 Re-queued request: ${request.id} (attempt ${request.retries + 1})`);
    }, Math.pow(2, request.retries) * 1000); // Exponential backoff
  }

  /**
   * Specific processors for different request types
   */
  private async processETFMetrics(request: any): Promise<any> {
    // Implementation for ETF metrics processing
    logger.debug('Processing ETF metrics request');
    return { type: 'etf_metrics', processed: true };
  }

  private async processEconomicData(request: any): Promise<any> {
    // Implementation for economic data processing
    logger.debug('Processing economic data request');
    return { type: 'economic_data', processed: true };
  }

  private async processTechnicalIndicators(request: any): Promise<any> {
    // Implementation for technical indicators processing
    logger.debug('Processing technical indicators request');
    return { type: 'technical_indicators', processed: true };
  }

  private async processMarketSentiment(request: any): Promise<any> {
    // Implementation for market sentiment processing
    logger.debug('Processing market sentiment request');
    return { type: 'market_sentiment', processed: true };
  }

  private async processFREDUpdate(data: any): Promise<void> {
    // Implementation for FRED data updates
    logger.debug('Processing FRED update');
  }

  private async processTwelveDataFetch(data: any): Promise<void> {
    // Implementation for Twelve Data fetching
    logger.debug('Processing Twelve Data fetch');
  }

  private async processZScoreCalculation(data: any): Promise<void> {
    // Implementation for Z-score calculations
    logger.debug('Processing Z-score calculation');
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(success: boolean, processingTime: number): void {
    this.metrics.totalProcessed++;
    this.metrics.avgProcessingTime = (this.metrics.avgProcessingTime + processingTime) / 2;
    
    // Update success rate (rolling average)
    const successValue = success ? 100 : 0;
    this.metrics.successRate = (this.metrics.successRate * 0.9) + (successValue * 0.1);
    
    this.updateQueueMetrics();
  }

  /**
   * Update queue metrics
   */
  private updateQueueMetrics(): void {
    let totalQueueSize = 0;
    for (const requests of Array.from(this.queue.values())) {
      totalQueueSize += requests.length;
    }
    
    this.metrics.queueSize = totalQueueSize;
    this.metrics.activeJobs = this.processing.size;
  }

  /**
   * Get current metrics
   */
  getMetrics(): BatchMetrics {
    this.updateQueueMetrics();
    return { ...this.metrics };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): Map<string, number> {
    const status = new Map<string, number>();
    
    for (const [type, requests] of Array.from(this.queue.entries())) {
      status.set(type, requests.length);
    }
    
    return status;
  }

  /**
   * Clear queue for a specific type
   */
  clearQueue(type: string): number {
    const requests = this.queue.get(type);
    if (!requests) return 0;
    
    const count = requests.length;
    this.queue.set(type, []);
    
    logger.info(`🧹 Cleared ${count} requests from ${type} queue`);
    return count;
  }

  /**
   * Health check
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string[];
    metrics: BatchMetrics;
  } {
    const metrics = this.getMetrics();
    const details: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.successRate < 95) {
      details.push(`Low success rate: ${metrics.successRate.toFixed(1)}%`);
      status = 'degraded';
    }

    if (metrics.queueSize > 100) {
      details.push(`High queue size: ${metrics.queueSize}`);
      status = 'degraded';
    }

    if (metrics.avgProcessingTime > 10000) {
      details.push(`High processing time: ${metrics.avgProcessingTime.toFixed(0)}ms`);
      status = 'degraded';
    }

    if (metrics.successRate < 80 || metrics.queueSize > 500) {
      status = 'unhealthy';
    }

    return { status, details, metrics };
  }
}

export const batchProcessingService = new BatchProcessingService();