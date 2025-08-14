/**
 * Emergency Circuit Breaker for API Rate Limiting
 * Immediately stops all Twelve Data API calls when rate limits are exceeded
 */

import { logger } from '../middleware/logging';

interface CircuitState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
}

export class EmergencyCircuitBreaker {
  private static instance: EmergencyCircuitBreaker;
  private circuits: Map<string, CircuitState> = new Map();
  
  // EMERGENCY: Aggressive circuit breaker settings
  private readonly FAILURE_THRESHOLD = 3; // Open after 3 failures
  private readonly RECOVERY_TIMEOUT = 300000; // 5 minutes before retry
  private readonly RATE_LIMIT_COOLDOWN = 900000; // 15 minutes for rate limit recovery

  static getInstance(): EmergencyCircuitBreaker {
    if (!EmergencyCircuitBreaker.instance) {
      EmergencyCircuitBreaker.instance = new EmergencyCircuitBreaker();
    }
    return EmergencyCircuitBreaker.instance;
  }

  /**
   * Check if API calls are allowed for a service
   */
  canExecute(serviceName: string): boolean {
    const circuit = this.circuits.get(serviceName) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0
    };

    const now = Date.now();

    // If circuit is open, check if we can retry
    if (circuit.isOpen) {
      if (now >= circuit.nextRetryTime) {
        logger.info(`🔄 Circuit breaker half-open for ${serviceName} - attempting retry`);
        circuit.isOpen = false;
        circuit.failureCount = 0;
        this.circuits.set(serviceName, circuit);
        return true;
      } else {
        const waitTime = Math.round((circuit.nextRetryTime - now) / 1000);
        logger.warn(`⛔ Circuit breaker OPEN for ${serviceName} - retry in ${waitTime}s`);
        return false;
      }
    }

    return true;
  }

  /**
   * Record a successful API call
   */
  recordSuccess(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.failureCount = 0;
      circuit.isOpen = false;
      this.circuits.set(serviceName, circuit);
      logger.debug(`✅ Circuit breaker success recorded for ${serviceName}`);
    }
  }

  /**
   * Record a failed API call (especially rate limiting)
   */
  recordFailure(serviceName: string, isRateLimit = false): void {
    const circuit = this.circuits.get(serviceName) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0
    };

    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    // For rate limiting, open circuit immediately
    if (isRateLimit) {
      circuit.isOpen = true;
      circuit.nextRetryTime = Date.now() + this.RATE_LIMIT_COOLDOWN;
      logger.error(`🚨 RATE LIMIT: Circuit breaker OPENED for ${serviceName} - cooldown 15min`);
    } 
    // For other failures, use threshold
    else if (circuit.failureCount >= this.FAILURE_THRESHOLD) {
      circuit.isOpen = true;
      circuit.nextRetryTime = Date.now() + this.RECOVERY_TIMEOUT;
      logger.error(`🚨 Circuit breaker OPENED for ${serviceName} after ${circuit.failureCount} failures`);
    }

    this.circuits.set(serviceName, circuit);
  }

  /**
   * Force open circuit breaker for emergency situations
   */
  forceOpen(serviceName: string, durationMs: number = 900000): void {
    const circuit = this.circuits.get(serviceName) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0
    };

    circuit.isOpen = true;
    circuit.nextRetryTime = Date.now() + durationMs;
    this.circuits.set(serviceName, circuit);
    
    logger.error(`🚨 EMERGENCY: Circuit breaker FORCE OPENED for ${serviceName} for ${durationMs/1000}s`);
  }

  /**
   * Get status of all circuit breakers
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [service, circuit] of this.circuits.entries()) {
      status[service] = {
        isOpen: circuit.isOpen,
        failureCount: circuit.failureCount,
        nextRetryTime: circuit.nextRetryTime,
        canExecute: this.canExecute(service)
      };
    }
    
    return status;
  }
}

// Export singleton instance
export const emergencyCircuitBreaker = EmergencyCircuitBreaker.getInstance();