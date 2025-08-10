/**
 * Structured logging middleware using Pino
 */

import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

// Create logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { 
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      } 
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'unknown'
  }
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  // Log incoming request
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentLength: req.get('Content-Length')
  }, 'Incoming request');

  // Capture response data
  const originalSend = res.json;
  let responseBody: any;

  res.json = function(body) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    logger[logLevel]({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      responseSize: res.get('Content-Length'),
      // Only log response body in development for non-sensitive data
      ...(process.env.NODE_ENV === 'development' && res.statusCode >= 400 && {
        responseBody: typeof responseBody === 'object' ? JSON.stringify(responseBody).slice(0, 500) : undefined
      })
    }, 'Request completed');
  });

  next();
};

// Health check logging (less verbose)
export const healthCheckLogger = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/ping') {
    // Skip detailed logging for health checks
    return next();
  }
  return requestLogger(req, res, next);
};

// Export logger for use in other modules
export { logger as default };