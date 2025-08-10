import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ERROR_MESSAGES } from '../../shared/config/constants';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errors?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const standardizedErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Request failed', {
    error: error.message,
    stack: error.stack,
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent')
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: ERROR_MESSAGES.VALIDATION_ERROR,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    });
  }

  // Custom HTTP errors
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors && { errors: error.errors })
    });
  }

  // API rate limit errors
  if (error.message?.includes('rate limit') || error.message?.includes('429')) {
    return res.status(429).json({
      success: false,
      message: ERROR_MESSAGES.API_LIMIT_REACHED
    });
  }

  // Database connection errors
  if (error.code === 'ECONNREFUSED' || error.code === '42P01') {
    return res.status(503).json({
      success: false,
      message: ERROR_MESSAGES.SERVICE_UNAVAILABLE
    });
  }

  // Authentication errors
  if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.AUTHENTICATION_FAILED
    });
  }

  // Default server error - hide stack trace in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    message: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && error.stack && { stack: error.stack })
  });
};