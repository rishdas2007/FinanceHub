/**
 * Centralized error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '@shared/validation';
import { logApiCall } from '@shared/utils/requestLogging';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class HttpError extends Error implements AppError {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public isOperational = true
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Main error handler
export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // Log error details
  logApiCall('ErrorHandler', req.path, false, undefined, {
    requestId,
    statusCode,
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    isOperational: err.isOperational
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid resource ID';
  }

  // Don't leak internal errors in production
  if (!err.isOperational && !isDevelopment) {
    message = 'Something went wrong';
    code = 'INTERNAL_ERROR';
  }

  res.status(statusCode).json(createErrorResponse(message, code, requestId));
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  res.status(404).json(createErrorResponse(
    `Route ${req.path} not found`,
    'NOT_FOUND',
    requestId
  ));
};

// Graceful shutdown handler
export const gracefulShutdown = (server: any) => {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};