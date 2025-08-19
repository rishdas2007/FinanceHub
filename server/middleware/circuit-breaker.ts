/**
 * Circuit Breaker Pattern Implementation for ETF API Calls
 * Provides graceful degradation when performance degrades
 */

import { logger } from '../utils/logger';

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringInterval: number;
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  
  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringInterval: 10000 // 10 seconds
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        logger.info(`🔄 Circuit breaker ${this.name} attempting reset`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN - operation rejected`);
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
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info(`✅ Circuit breaker ${this.name} reset to CLOSED`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(`🚨 Circuit breaker ${this.name} opened due to ${this.failureCount} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breakers for key services
export const etfMetricsCircuitBreaker = new CircuitBreaker('ETF_METRICS', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  monitoringInterval: 5000
});

export const databaseCircuitBreaker = new CircuitBreaker('DATABASE', {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  monitoringInterval: 10000
});