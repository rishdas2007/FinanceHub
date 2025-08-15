import { logger } from '../../utils/logger.js';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
  name: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastSuccessTime: number | null;
  totalRequests: number;
  successCount: number;
}

/**
 * Circuit Breaker Pattern Implementation for Data Quality-First Architecture
 * Prevents cascading failures when data quality issues occur
 */
export class DataQualityCircuitBreaker {
  private state: CircuitBreakerState;
  private options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
    this.state = {
      failures: 0,
      lastFailureTime: null,
      state: 'CLOSED',
      lastSuccessTime: null,
      totalRequests: 0,
      successCount: 0
    };

    logger.info(`🔧 Circuit breaker initialized: ${options.name}`, {
      failureThreshold: options.failureThreshold,
      resetTimeout: options.resetTimeout
    });
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.state.totalRequests++;

    if (this.state.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state.state = 'HALF_OPEN';
        logger.info(`🔄 Circuit breaker ${this.options.name} attempting reset (HALF_OPEN)`);
      } else {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN - operation rejected`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;
    this.state.lastSuccessTime = Date.now();
    this.state.successCount++;

    if (this.state.state === 'HALF_OPEN') {
      this.state.state = 'CLOSED';
      logger.info(`✅ Circuit breaker ${this.options.name} reset to CLOSED after successful operation`);
    }
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failures >= this.options.failureThreshold) {
      this.state.state = 'OPEN';
      logger.warn(`⚠️ Circuit breaker ${this.options.name} opened due to ${this.state.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.state.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
    return timeSinceLastFailure >= this.options.resetTimeout;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  getHealthMetrics(): {
    name: string;
    state: string;
    failureRate: number;
    totalRequests: number;
    successCount: number;
    failures: number;
    lastFailure: string | null;
    lastSuccess: string | null;
  } {
    const failureRate = this.state.totalRequests > 0 
      ? ((this.state.totalRequests - this.state.successCount) / this.state.totalRequests) * 100
      : 0;

    return {
      name: this.options.name,
      state: this.state.state,
      failureRate: Number(failureRate.toFixed(2)),
      totalRequests: this.state.totalRequests,
      successCount: this.state.successCount,
      failures: this.state.failures,
      lastFailure: this.state.lastFailureTime ? new Date(this.state.lastFailureTime).toISOString() : null,
      lastSuccess: this.state.lastSuccessTime ? new Date(this.state.lastSuccessTime).toISOString() : null
    };
  }

  reset(): void {
    logger.info(`🔄 Manually resetting circuit breaker: ${this.options.name}`);
    this.state = {
      failures: 0,
      lastFailureTime: null,
      state: 'CLOSED',
      lastSuccessTime: null,
      totalRequests: 0,
      successCount: 0
    };
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers: Map<string, DataQualityCircuitBreaker> = new Map();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): DataQualityCircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringWindow: 300000, // 5 minutes
        name,
        ...options
      };

      this.breakers.set(name, new DataQualityCircuitBreaker(defaultOptions));
    }

    return this.breakers.get(name)!;
  }

  getAllHealthMetrics(): Array<any> {
    return Array.from(this.breakers.values()).map(breaker => breaker.getHealthMetrics());
  }

  resetAll(): void {
    logger.info('🔄 Resetting all circuit breakers');
    this.breakers.forEach(breaker => breaker.reset());
  }
}