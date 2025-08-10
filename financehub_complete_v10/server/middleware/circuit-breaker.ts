import { logger } from '../utils/logger';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitorWindow: number;
}

class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private serviceName: string;

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 60000, // 1 minute
      monitorWindow: config.monitorWindow || 300000, // 5 minutes
      ...config
    };

    this.state = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED'
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() - this.state.lastFailure > this.config.resetTimeout) {
        this.state.state = 'HALF_OPEN';
        logger.info(`Circuit breaker ${this.serviceName}: Moving to HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.serviceName} is OPEN - service unavailable`);
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
    if (this.state.state === 'HALF_OPEN') {
      this.state.state = 'CLOSED';
      this.state.failures = 0;
      logger.info(`Circuit breaker ${this.serviceName}: Reset to CLOSED state after successful operation`);
    }
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();

    // Clean old failures outside monitor window
    if (Date.now() - this.state.lastFailure > this.config.monitorWindow) {
      this.state.failures = 1;
    }

    if (this.state.failures >= this.config.failureThreshold) {
      this.state.state = 'OPEN';
      logger.warn(`Circuit breaker ${this.serviceName}: OPENED after ${this.state.failures} failures`);
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  getHealth(): { status: string; failures: number; state: string } {
    return {
      status: this.state.state === 'CLOSED' ? 'healthy' : 'degraded',
      failures: this.state.failures,
      state: this.state.state
    };
  }
}

// Circuit breaker instances for different services
export const circuitBreakers = {
  openai: new CircuitBreaker('OpenAI', { failureThreshold: 3, resetTimeout: 30000 }),
  twelveData: new CircuitBreaker('TwelveData', { failureThreshold: 5, resetTimeout: 60000 }),
  fred: new CircuitBreaker('FRED', { failureThreshold: 4, resetTimeout: 45000 }),
  sendgrid: new CircuitBreaker('SendGrid', { failureThreshold: 3, resetTimeout: 120000 })
};

export { CircuitBreaker };