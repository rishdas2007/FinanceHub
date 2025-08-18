import { logger } from '../../shared/utils/logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  successfulRequests: number;
}

/**
 * ✅ PHASE 3 TASK 7: Circuit Breaker Pattern Implementation
 * Prevents cascading failures by tracking API call success/failure rates
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold || 8,  // Increased from 3 to 8
      recoveryTimeout: options.recoveryTimeout || 2 * 60 * 1000, // 2 minutes 
      monitoringPeriod: options.monitoringPeriod || 60 * 1000, // 1 minute
      ...options
    };
    
    this.state = {
      isOpen: false,
      failures: 0,
      totalRequests: 0,
      successfulRequests: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit breaker should be opened
    if (this.shouldOpen()) {
      this.open();
    }

    // If circuit is open, check if we can attempt recovery
    if (this.state.isOpen) {
      if (this.canAttemptRecovery()) {
        logger.info(`Circuit breaker ${this.name} attempting recovery`);
        // Allow one request through to test recovery
      } else {
        const error = new Error(`Circuit breaker ${this.name} is OPEN - rejecting request`);
        logger.warn(`Circuit breaker ${this.name} rejected request`, `Failures: ${this.state.failures}, Threshold: ${this.options.failureThreshold}, Last failure: ${this.state.lastFailureTime}`);
        throw error;
      }
    }

    this.state.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful operation
   */
  private onSuccess() {
    this.state.successfulRequests++;
    this.state.lastSuccessTime = Date.now();
    
    // Reset failures on success
    if (this.state.failures > 0) {
      logger.info(`Circuit breaker ${this.name} recording success - resetting failure count`, `Previous failures: ${this.state.failures}`);
      this.state.failures = 0;
    }

    // Close circuit breaker if it was open
    if (this.state.isOpen) {
      this.close();
    }
  }

  /**
   * Record failed operation
   */
  private onFailure() {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    
    logger.warn(`Circuit breaker ${this.name} recording failure`, `Failures: ${this.state.failures}, Threshold: ${this.options.failureThreshold}`);
  }

  /**
   * Check if circuit breaker should be opened
   */
  private shouldOpen(): boolean {
    return this.state.failures >= this.options.failureThreshold && !this.state.isOpen;
  }

  /**
   * Open the circuit breaker
   */
  private open() {
    this.state.isOpen = true;
    logger.error(`Circuit breaker ${this.name} OPENED`, `Failures: ${this.state.failures}, Threshold: ${this.options.failureThreshold}, Success rate: ${this.getSuccessRate()}%`);
  }

  /**
   * Close the circuit breaker
   */
  private close() {
    this.state.isOpen = false;
    this.state.failures = 0;
    logger.info(`Circuit breaker ${this.name} CLOSED - service recovered`, `Success rate: ${this.getSuccessRate()}%`);
  }

  /**
   * Check if we can attempt recovery
   */
  private canAttemptRecovery(): boolean {
    if (!this.state.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
    return timeSinceLastFailure >= this.options.recoveryTimeout;
  }

  /**
   * Get current success rate
   */
  getSuccessRate(): number {
    if (this.state.totalRequests === 0) return 100;
    return (this.state.successfulRequests / this.state.totalRequests) * 100;
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      isOpen: this.state.isOpen,
      failures: this.state.failures,
      threshold: this.options.failureThreshold,
      successRate: this.getSuccessRate(),
      totalRequests: this.state.totalRequests,
      successfulRequests: this.state.successfulRequests,
      canAttemptRecovery: this.state.isOpen ? this.canAttemptRecovery() : null,
      lastFailureTime: this.state.lastFailureTime,
      lastSuccessTime: this.state.lastSuccessTime
    };
  }

  /**
   * Reset circuit breaker state (for testing/admin purposes)
   */
  reset() {
    this.state = {
      isOpen: false,
      failures: 0,
      totalRequests: 0,
      successfulRequests: 0
    };
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  static getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  static getStatus(name?: string) {
    if (name) {
      const breaker = this.breakers.get(name);
      return breaker ? breaker.getStatus() : null;
    }

    // Return status of all circuit breakers
    const status: Record<string, any> = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }

  static reset(name?: string) {
    if (name) {
      const breaker = this.breakers.get(name);
      if (breaker) {
        breaker.reset();
      }
    } else {
      // Reset all circuit breakers
      for (const breaker of this.breakers.values()) {
        breaker.reset();
      }
    }
  }
}

// Export pre-configured circuit breakers for common services
export const fredApiCircuitBreaker = CircuitBreakerRegistry.getOrCreate('FRED_API', {
  failureThreshold: 8,
  recoveryTimeout: 2 * 60 * 1000, // 2 minutes
  monitoringPeriod: 60 * 1000
});

export const twelveDataCircuitBreaker = CircuitBreakerRegistry.getOrCreate('TWELVE_DATA_API', {
  failureThreshold: 5,
  recoveryTimeout: 5 * 60 * 1000, // 5 minutes
  monitoringPeriod: 60 * 1000
});

export const openaiCircuitBreaker = CircuitBreakerRegistry.getOrCreate('OPENAI_API', {
  failureThreshold: 3,
  recoveryTimeout: 1 * 60 * 1000, // 1 minute
  monitoringPeriod: 30 * 1000
});