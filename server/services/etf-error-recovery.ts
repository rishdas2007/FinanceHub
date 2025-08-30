/**
 * ETF Error Recovery Service
 * Provides centralized error handling and recovery for ETF operations
 */

import { logger } from '../utils/logger';

export interface ETFErrorRecoveryOptions {
  maxRetries: number;
  retryDelay: number;
  fallbackToCache: boolean;
  enableCircuitBreaker: boolean;
}

export interface ETFRecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'primary' | 'retry' | 'cache_fallback' | 'emergency_fallback';
  attempts: number;
  warnings: string[];
}

export class ETFErrorRecoveryService {
  private static instance: ETFErrorRecoveryService;
  private retryCount: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();
  
  private readonly defaultOptions: ETFErrorRecoveryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    fallbackToCache: true,
    enableCircuitBreaker: true
  };

  static getInstance(): ETFErrorRecoveryService {
    if (!ETFErrorRecoveryService.instance) {
      ETFErrorRecoveryService.instance = new ETFErrorRecoveryService();
    }
    return ETFErrorRecoveryService.instance;
  }

  /**
   * Execute ETF operation with automatic error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: Partial<ETFErrorRecoveryOptions> = {}
  ): Promise<ETFRecoveryResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    const warnings: string[] = [];
    let lastError: any;
    
    // Check circuit breaker
    if (config.enableCircuitBreaker && this.isCircuitOpen(operationName)) {
      warnings.push(`Circuit breaker open for ${operationName} - skipping to fallback`);
      return this.createRecoveryResult(false, undefined, 'Circuit breaker open', 'emergency_fallback', 0, warnings);
    }

    // Attempt primary operation with retries
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        logger.info(`🔄 [ETF RECOVERY] Attempting ${operationName} - try ${attempt}/${config.maxRetries}`);
        
        const result = await operation();
        
        // Success - reset retry count and close circuit
        this.retryCount.delete(operationName);
        this.lastFailureTime.delete(operationName);
        
        return this.createRecoveryResult(true, result, undefined, attempt === 1 ? 'primary' : 'retry', attempt, warnings);
        
      } catch (error) {
        lastError = error;
        logger.error(`❌ [ETF RECOVERY] ${operationName} failed on attempt ${attempt}:`, error);
        
        // Track failure for circuit breaker
        this.recordFailure(operationName);
        
        // Wait before retry (except on last attempt)
        if (attempt < config.maxRetries) {
          await this.sleep(config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed - log and return error result
    logger.error(`💥 [ETF RECOVERY] All ${config.maxRetries} attempts failed for ${operationName}`);
    
    return this.createRecoveryResult(
      false, 
      undefined, 
      lastError instanceof Error ? lastError.message : String(lastError),
      'emergency_fallback',
      config.maxRetries,
      warnings
    );
  }

  /**
   * Create standardized recovery result
   */
  private createRecoveryResult<T>(
    success: boolean,
    data: T | undefined,
    error: string | undefined,
    source: ETFRecoveryResult<T>['source'],
    attempts: number,
    warnings: string[]
  ): ETFRecoveryResult<T> {
    return {
      success,
      data,
      error,
      source,
      attempts,
      warnings
    };
  }

  /**
   * Simple circuit breaker implementation
   */
  private isCircuitOpen(operationName: string): boolean {
    const failureCount = this.retryCount.get(operationName) || 0;
    const lastFailure = this.lastFailureTime.get(operationName) || 0;
    const timeSinceLastFailure = Date.now() - lastFailure;
    
    // Circuit breaker: open if >5 failures in last 5 minutes
    if (failureCount > 5 && timeSinceLastFailure < 5 * 60 * 1000) {
      return true;
    }
    
    // Auto-reset after 10 minutes
    if (timeSinceLastFailure > 10 * 60 * 1000) {
      this.retryCount.delete(operationName);
      this.lastFailureTime.delete(operationName);
    }
    
    return false;
  }

  /**
   * Record failure for circuit breaker tracking
   */
  private recordFailure(operationName: string): void {
    const currentCount = this.retryCount.get(operationName) || 0;
    this.retryCount.set(operationName, currentCount + 1);
    this.lastFailureTime.set(operationName, Date.now());
  }

  /**
   * Sleep utility for retry delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics for monitoring
   */
  getRecoveryStats(): { [operationName: string]: { failures: number; lastFailure: Date | null; circuitOpen: boolean } } {
    const stats: any = {};
    
    for (const [operationName, failures] of this.retryCount.entries()) {
      const lastFailure = this.lastFailureTime.get(operationName);
      stats[operationName] = {
        failures,
        lastFailure: lastFailure ? new Date(lastFailure) : null,
        circuitOpen: this.isCircuitOpen(operationName)
      };
    }
    
    return stats;
  }

  /**
   * Reset circuit breaker for specific operation
   */
  resetCircuitBreaker(operationName: string): void {
    this.retryCount.delete(operationName);
    this.lastFailureTime.delete(operationName);
    logger.info(`🔄 [ETF RECOVERY] Circuit breaker reset for ${operationName}`);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.retryCount.clear();
    this.lastFailureTime.clear();
    logger.info('🔄 [ETF RECOVERY] All circuit breakers reset');
  }
}

// Global instance for easy access
export const etfErrorRecovery = ETFErrorRecoveryService.getInstance();