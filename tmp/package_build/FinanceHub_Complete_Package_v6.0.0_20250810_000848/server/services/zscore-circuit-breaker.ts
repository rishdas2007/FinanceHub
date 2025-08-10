import { logger } from '../middleware/logging';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitorWindow: number;
}

/**
 * Circuit Breaker pattern implementation for Z-Score calculations
 * Prevents cascading failures and provides graceful degradation
 */
export class ZScoreCircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: CircuitState = 'closed';
  private successCount: number = 0;

  constructor(
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitorWindow: 300000 // 5 minutes
    }
  ) {
    logger.info('🛡️ Z-Score Circuit Breaker initialized', {
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string = 'z-score-calculation'
  ): Promise<T> {
    
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        logger.info('🔄 Circuit breaker transitioning to HALF-OPEN state', {
          operationName,
          timeSinceLastFailure
        });
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        logger.warn('⚠️ Circuit breaker is OPEN - operation blocked', {
          operationName,
          failureCount: this.failures,
          timeUntilReset: this.config.resetTimeout - timeSinceLastFailure
        });
        throw new Error(`Circuit breaker is OPEN for ${operationName} - too many failures. Try again in ${Math.ceil((this.config.resetTimeout - timeSinceLastFailure) / 1000)}s`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;

    } catch (error) {
      this.onFailure(error as Error, operationName);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(operationName: string): void {
    if (this.state === 'half-open') {
      this.successCount++;
      
      // Reset circuit breaker after successful operations
      if (this.successCount >= 3) {
        logger.info('✅ Circuit breaker RESET - returning to CLOSED state', {
          operationName,
          successCount: this.successCount
        });
        this.reset();
      }
    } else {
      // Reset failure count on success during normal operation
      this.failures = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error, operationName: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    logger.error('❌ Circuit breaker recorded failure', {
      operationName,
      failureCount: this.failures,
      threshold: this.config.failureThreshold,
      error: error.message
    });

    if (this.failures >= this.config.failureThreshold) {
      logger.error('🚨 Circuit breaker OPENED - too many failures', {
        operationName,
        failureCount: this.failures,
        resetTimeout: this.config.resetTimeout
      });
      this.state = 'open';
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  private reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): {
    state: CircuitState;
    failures: number;
    successCount: number;
    isHealthy: boolean;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      isHealthy: this.state === 'closed'
    };
  }

  /**
   * Manually reset circuit breaker (for administrative purposes)
   */
  manualReset(): void {
    logger.info('🔧 Circuit breaker manually reset');
    this.reset();
  }

  /**
   * Execute with fallback operation if circuit is open
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName: string = 'z-score-calculation'
  ): Promise<T> {
    try {
      return await this.executeWithCircuitBreaker(primaryOperation, operationName);
    } catch (error) {
      if (this.state === 'open') {
        logger.info('🔄 Executing fallback operation - circuit breaker is open', {
          operationName
        });
        return await fallbackOperation();
      }
      throw error; // Re-throw if not a circuit breaker issue
    }
  }
}

// Export singleton instances for different types of operations
export const zScoreCalculationCircuitBreaker = new ZScoreCircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,  // 1 minute
  monitorWindow: 300000 // 5 minutes
});

export const databaseQueryCircuitBreaker = new ZScoreCircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,  // 30 seconds
  monitorWindow: 180000 // 3 minutes
});

export const externalApiCircuitBreaker = new ZScoreCircuitBreaker({
  failureThreshold: 10,
  resetTimeout: 120000, // 2 minutes
  monitorWindow: 600000 // 10 minutes
});