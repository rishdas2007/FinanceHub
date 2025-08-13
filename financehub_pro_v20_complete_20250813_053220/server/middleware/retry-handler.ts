import { logger } from '../utils/logger';

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: (error: any) => boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: (error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response?.status >= 500) {
      return true;
    }
    if (error.response?.status === 429) { // Rate limit
      return true;
    }
    return false;
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  serviceName: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...defaultRetryConfig, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`${serviceName}: Operation succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === retryConfig.maxAttempts) {
        logger.error(`${serviceName}: All ${attempt} attempts failed`, { error: error instanceof Error ? error.message : String(error) });
        break;
      }

      if (!retryConfig.retryableErrors(error)) {
        logger.warn(`${serviceName}: Non-retryable error, failing immediately`, { 
          error: error instanceof Error ? error.message : String(error),
          attempt 
        });
        break;
      }

      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelay
      );

      logger.warn(`${serviceName}: Attempt ${attempt} failed, retrying in ${delay}ms`, { 
        error: error instanceof Error ? error.message : String(error) 
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Predefined retry configurations for different service types
export const retryConfigs = {
  apiCall: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  },
  
  databaseOperation: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryableErrors: (error: any) => {
      return error.code === 'ECONNRESET' || 
             error.code === 'ETIMEDOUT' ||
             error.message?.includes('connection');
    }
  },

  fileOperation: {
    maxAttempts: 2,
    baseDelay: 200,
    maxDelay: 1000,
    backoffMultiplier: 1.5,
    retryableErrors: (error: any) => {
      return error.code === 'EBUSY' || 
             error.code === 'EAGAIN' ||
             error.code === 'ENOENT';
    }
  }
};