import { logger } from '../middleware/logging';
import { createRateLimitTracker } from '@shared/utils/apiHelpers';

interface BatchRequest {
  id: string;
  endpoint: string;
  params?: any;
  priority?: 'high' | 'medium' | 'low';
}

interface BatchResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface BatchConfiguration {
  maxBatchSize: number;
  batchDelay: number;
  maxRetries: number;
  priorityWeights: Record<string, number>;
}

export class BatchAPIService {
  private batchQueue: BatchRequest[] = [];
  private processTimestamp: number = 0;
  private isProcessing: boolean = false;
  private rateLimitTracker = createRateLimitTracker();

  private config: BatchConfiguration = {
    maxBatchSize: 20,
    batchDelay: 100, // ms between batches
    maxRetries: 3,
    priorityWeights: {
      high: 3,
      medium: 2,
      low: 1
    }
  };

  /**
   * Add request to batch queue with automatic processing
   */
  async addToBatch(requests: BatchRequest | BatchRequest[]): Promise<BatchResponse[]> {
    const requestArray = Array.isArray(requests) ? requests : [requests];
    
    // Add to queue with timestamps
    requestArray.forEach(req => {
      this.batchQueue.push({
        ...req,
        priority: req.priority || 'medium'
      });
    });

    logger.info(`📦 Added ${requestArray.length} requests to batch queue (total: ${this.batchQueue.length})`);

    // Process if queue is full or after delay
    return this.processBatchQueue();
  }

  /**
   * Process the current batch queue
   */
  private async processBatchQueue(): Promise<BatchResponse[]> {
    if (this.isProcessing) {
      // Wait for current processing to complete
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isProcessing) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 50);
      });
      return [];
    }

    if (this.batchQueue.length === 0) {
      return [];
    }

    this.isProcessing = true;
    
    try {
      // Sort by priority
      this.batchQueue.sort((a, b) => 
        (this.config.priorityWeights[b.priority || 'medium'] || 0) - 
        (this.config.priorityWeights[a.priority || 'medium'] || 0)
      );

      // Process in batches
      const results: BatchResponse[] = [];
      
      while (this.batchQueue.length > 0) {
        const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
        
        logger.info(`🔄 Processing batch of ${batch.length} requests`);
        
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
        
        // Rate limiting delay between batches
        if (this.batchQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.batchDelay));
        }
      }
      
      logger.info(`✅ Batch processing completed: ${results.length} requests processed`);
      return results;
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single batch of requests
   */
  private async processBatch(batch: BatchRequest[]): Promise<BatchResponse[]> {
    const promises = batch.map(async (request): Promise<BatchResponse> => {
      try {
        // Simulate API call processing
        const response = await this.executeRequest(request);
        
        return {
          id: request.id,
          success: true,
          data: response
        };
        
      } catch (error) {
        logger.error(`❌ Batch request failed for ${request.id}:`, error);
        
        return {
          id: request.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Execute individual API request
   */
  private async executeRequest(request: BatchRequest): Promise<any> {
    // Rate limiting check
    const rateLimitKey = `batch-${request.endpoint}`;
    if (!this.rateLimitTracker.canMakeRequest(rateLimitKey, 144)) {
      throw new Error(`Rate limit exceeded for ${request.endpoint}`);
    }

    // Log the API call
    this.rateLimitTracker.logRequest(rateLimitKey);

    // Here you would implement the actual API calls
    // For now, this is a placeholder that simulates different endpoints
    switch (request.endpoint) {
      case 'technical-indicators':
        return this.fetchTechnicalIndicators(request.params);
      
      case 'sector-data':
        return this.fetchSectorData(request.params);
      
      case 'economic-data':
        return this.fetchEconomicData(request.params);
      
      default:
        throw new Error(`Unknown endpoint: ${request.endpoint}`);
    }
  }

  /**
   * Placeholder methods for different endpoint types
   */
  private async fetchTechnicalIndicators(params: any): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));
    return { type: 'technical', params, timestamp: new Date().toISOString() };
  }

  private async fetchSectorData(params: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { type: 'sector', params, timestamp: new Date().toISOString() };
  }

  private async fetchEconomicData(params: any): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 40));
    return { type: 'economic', params, timestamp: new Date().toISOString() };
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queueSize: number;
    isProcessing: boolean;
    estimatedWaitTime: number;
  } {
    return {
      queueSize: this.batchQueue.length,
      isProcessing: this.isProcessing,
      estimatedWaitTime: Math.ceil(this.batchQueue.length / this.config.maxBatchSize) * this.config.batchDelay
    };
  }

  /**
   * Clear the queue (emergency use)
   */
  clearQueue(): number {
    const clearedCount = this.batchQueue.length;
    this.batchQueue = [];
    logger.warn(`🗑️ Batch queue cleared: ${clearedCount} requests removed`);
    return clearedCount;
  }
}

// Export singleton instance
export const batchAPIService = new BatchAPIService();