import { logger } from '../middleware/logging';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  name: string;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successes: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      ...options
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`🔄 Circuit breaker ${this.options.name} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN`);
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

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successes++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      logger.info(`✅ Circuit breaker ${this.options.name} reset to CLOSED`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.warn(`🚫 Circuit breaker ${this.options.name} opened due to ${this.failureCount} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failures: number; successes: number; lastFailure: number } {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successes,
      lastFailure: this.lastFailureTime
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    logger.info(`🔄 Circuit breaker ${this.options.name} manually reset`);
  }
}

// Global circuit breakers for key services
export const circuitBreakers = {
  database: new CircuitBreaker({
    name: 'database',
    failureThreshold: 3,
    resetTimeout: 30000,
    monitoringPeriod: 5000
  }),
  
  fredApi: new CircuitBreaker({
    name: 'fred-api',
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 10000
  }),
  
  twelveData: new CircuitBreaker({
    name: 'twelve-data-api',
    failureThreshold: 10,
    resetTimeout: 120000,
    monitoringPeriod: 15000
  }),
  
  etfMetrics: new CircuitBreaker({
    name: 'etf-metrics',
    failureThreshold: 3,
    resetTimeout: 30000,
    monitoringPeriod: 5000
  })
};

// Health check for all circuit breakers
export function getCircuitBreakerHealth(): Record<string, any> {
  const health: Record<string, any> = {};
  
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    health[name] = breaker.getStats();
  }
  
  return health;
}