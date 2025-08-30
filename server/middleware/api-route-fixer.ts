import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * API Route Fixer Middleware
 * Prevents API routes from returning HTML instead of JSON
 */

export function ensureApiJsonResponse(req: Request, res: Response, next: NextFunction) {
  // Only apply to API routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Override res.send to ensure JSON responses for API routes
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  res.send = function(body: any) {
    // If this is an API route and we're sending HTML, convert to JSON error
    if (typeof body === 'string' && body.startsWith('<!DOCTYPE')) {
      logger.warn('🔧 PRODUCTION API FIX - Converting HTML response to JSON for API route', {
        path: req.path,
        method: req.method
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error - API route misconfiguration',
        message: 'API endpoint returned HTML instead of JSON',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    }
    return originalSend(body);
  };

  // Ensure proper content-type for API routes
  if (req.path.startsWith('/api/') && !res.getHeader('content-type')) {
    res.setHeader('content-type', 'application/json');
  }

  next();
}

/**
 * API Route Health Check Middleware
 * Validates that API routes are responding correctly
 */
export function validateApiRoutes(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Log API requests for debugging
  logger.debug('🔍 PRODUCTION API REQUEST', {
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    timestamp: new Date().toISOString()
  });

  // Set up response validation
  const originalJson = res.json.bind(res);
  res.json = function(obj: any) {
    // Validate that we're sending proper JSON responses
    if (!obj || typeof obj !== 'object') {
      logger.warn('🔧 PRODUCTION API WARNING - Invalid JSON response structure', {
        path: req.path,
        responseType: typeof obj,
        response: obj
      });
    }
    return originalJson(obj);
  };

  next();
}

/**
 * Production API Error Handler
 * Catches any remaining API errors and formats them properly
 */
export function handleApiErrors(error: any, req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) {
    return next(error);
  }

  logger.error('🚨 PRODUCTION API ERROR CAUGHT', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Always return JSON for API routes
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }
}