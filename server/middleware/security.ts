/**
 * Security middleware for production hardening
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createErrorResponse } from '@shared/validation';
import { nanoid } from 'nanoid';

// Rate limiting configuration
export const createRateLimit = (windowMs: number, max: number, message: string) => 
  rateLimit({
    windowMs,
    max,
    message: createErrorResponse(message, 'RATE_LIMIT_EXCEEDED'),
    standardHeaders: true,
    legacyHeaders: false
    // Use default key generator for proper IPv6 handling
  });

// API rate limits
export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many API requests, please try again later'
);

export const strictApiRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 requests per minute for intensive endpoints
  'Rate limit exceeded for this endpoint'
);

// Auth rate limiting
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 auth attempts per window
  'Too many authentication attempts, please try again later'
);

// Helmet configuration for security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss:", "https://api.twelvedata.com", "https://api.openai.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers['x-request-id'] as string || nanoid();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
};

// Input validation middleware factory
export const validateInput = <T>(schema: z.ZodSchema<T>, source: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'params' ? req.params : 
                   req.query;
      
      const validated = schema.parse(data);
      
      // Attach validated data to request
      if (source === 'body') req.body = validated;
      else if (source === 'params') req.params = validated as any;
      else req.query = validated as any;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const requestId = req.headers['x-request-id'] as string;
        return res.status(400).json(createErrorResponse(
          'Invalid input data',
          'VALIDATION_ERROR',
          requestId
        ));
      }
      next(error);
    }
  };
};

// CORS configuration
export const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] // Replace with actual domain
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};