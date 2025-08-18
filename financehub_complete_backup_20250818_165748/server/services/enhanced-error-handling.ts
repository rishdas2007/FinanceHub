import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/utils/logger';

export interface StandardErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: any;
}

/**
 * ✅ PHASE 3 TASK 8: Enhanced Error Handling System
 */
export class ApplicationError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 400, true, details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, true);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, true);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true);
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(service: string, message: string, details?: any) {
    super(`External service error (${service}): ${message}`, 502, true, details);
  }
}

export class DatabaseError extends ApplicationError {
  constructor(operation: string, details?: any) {
    super(`Database operation failed: ${operation}`, 500, true, details);
  }
}

/**
 * Global error handler middleware
 */
export const globalErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  if (error instanceof ApplicationError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }

  // Log error with appropriate level
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  const logMessage = `${req.method} ${req.path} - ${statusCode} - ${message}`;
  
  logger[logLevel](logMessage, `RequestID: ${requestId}, Status: ${statusCode}, Error: ${error.message}, User: ${(req as any).user?.id || 'anonymous'}, IP: ${req.ip}, Operational: ${isOperational}`);

  // Prepare error response
  const errorResponse: StandardErrorResponse = {
    error: error.name || 'Error',
    message: isOperational ? message : 'An unexpected error occurred',
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId
  };

  // Add details for development/debugging
  if (process.env.NODE_ENV === 'development' && error instanceof ApplicationError && error.details) {
    errorResponse.details = error.details;
  }

  // Don't expose stack traces in production
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request ID middleware - adds tracking ID to all requests
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
  /**
   * Retry wrapper with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>, 
    retries: number = 3, 
    delay: number = 1000,
    serviceName?: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.info(`Recovery successful for ${serviceName || 'operation'} on attempt ${attempt}`, '');
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
          logger.error(`All ${retries} retry attempts failed for ${serviceName || 'operation'}`, `Final error: ${lastError.message}, Attempts: ${retries}`);
          break;
        }
        
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        logger.warn(`Attempt ${attempt} failed for ${serviceName || 'operation'}, retrying in ${backoffDelay}ms`, `Error: ${lastError.message}, Next attempt: ${attempt + 1}`);
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Graceful degradation wrapper
   */
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T> | T,
    serviceName?: string
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      logger.warn(`Primary operation failed for ${serviceName || 'service'}, using fallback`, `Error: ${(error as Error).message}`);
      return await fallback();
    }
  }
}

/**
 * Health check utilities
 */
export class HealthCheck {
  private static checks: Map<string, () => Promise<boolean>> = new Map();

  static register(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
  }

  static async runAll(): Promise<{ healthy: boolean; checks: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        results[name] = await check();
        if (!results[name]) allHealthy = false;
      } catch (error) {
        results[name] = false;
        allHealthy = false;
        logger.error(`Health check failed for ${name}`, `Error: ${(error as Error).message}`);
      }
    }

    return { healthy: allHealthy, checks: results };
  }
}