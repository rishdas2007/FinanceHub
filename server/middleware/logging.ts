/**
 * Structured logging middleware
 */

import { logger } from '../utils/logger.js';
import type { Request, Response, NextFunction } from 'express';

// Export logger for compatibility
export { logger };

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  // Log incoming request
  logger.info({
    requestId,
    method: req.method,
    url: req.url,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  }, 'Incoming request');

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;
    
    logger.info({
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    }, 'Request completed');

    // Call original end
    return originalEnd.apply(res, args);
  };

  next();
};

// Error logging middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.error({
    requestId,
    method: req.method,
    url: req.url,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  }, 'Request error');

  next(err);
};