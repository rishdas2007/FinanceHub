/**
 * ✅ PHASE 3 TASK 1: Circuit Breaker Implementation
 * Simple circuit breaker pattern for API reliability
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
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
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Circuit breaker instances for different services
export const circuitBreakers = {
  fred: new CircuitBreaker('FRED_API', {
    failureThreshold: 8,
    recoveryTimeout: 2 * 60 * 1000, // 2 minutes
    monitoringPeriod: 60 * 60 * 1000 // 1 hour
  }),
  
  twelveData: new CircuitBreaker('TWELVE_DATA_API', {
    failureThreshold: 5,
    recoveryTimeout: 5 * 60 * 1000, // 5 minutes
    monitoringPeriod: 60 * 60 * 1000 // 1 hour
  }),
  
  openai: new CircuitBreaker('OPENAI_API', {
    failureThreshold: 3,
    recoveryTimeout: 10 * 60 * 1000, // 10 minutes
    monitoringPeriod: 60 * 60 * 1000 // 1 hour
  })
};

export default circuitBreakers;