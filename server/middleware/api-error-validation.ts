import express from 'express';
import { logger } from '../utils/logger.js';

/**
 * API Error Validation Middleware
 * Adds comprehensive error validation for common production failure scenarios
 */

// Track API call patterns to identify problematic endpoints
const apiCallTracker = new Map();

export function apiErrorValidation(req: express.Request, res: express.Response, next: express.NextFunction) {
  const startTime = Date.now();
  const endpoint = req.path;
  
  // Track API call frequency
  const callCount = apiCallTracker.get(endpoint) || 0;
  apiCallTracker.set(endpoint, callCount + 1);
  
  // Validate critical environment variables for specific routes
  validateEnvironmentForRoute(req);
  
  // Add request validation logging
  logger.info('🔍 API REQUEST VALIDATION', {
    endpoint,
    method: req.method,
    query: req.query,
    callCount: callCount + 1,
    timestamp: new Date().toISOString(),
    userAgent: req.get('user-agent')?.substring(0, 50)
  });
  
  // Override response methods to catch errors
  const originalJson = res.json;
  const originalSend = res.send;
  
  res.json = function(data: any) {
    const duration = Date.now() - startTime;
    
    // Log successful responses for debugging
    if (res.statusCode >= 200 && res.statusCode < 300) {
      logger.info('✅ API SUCCESS', {
        endpoint,
        method: req.method,
        status: res.statusCode,
        duration,
        dataType: typeof data,
        hasData: data?.success !== false
      });
    }
    
    return originalJson.call(this, data);
  };
  
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    
    // Log non-JSON responses
    logger.info('📤 API RESPONSE', {
      endpoint,
      method: req.method,
      status: res.statusCode,
      duration,
      contentType: res.get('content-type'),
      dataLength: typeof data === 'string' ? data.length : 'non-string'
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}

function validateEnvironmentForRoute(req: express.Request) {
  const route = req.path;
  const issues = [];
  
  // Database-dependent routes
  if (route.includes('/api/etf') || route.includes('/api/economic') || route.includes('/api/macro')) {
    if (!process.env.DATABASE_URL) {
      issues.push('DATABASE_URL missing for database-dependent route');
    }
  }
  
  // External API routes
  if (route.includes('/api/fred') || route.includes('/api/economic')) {
    if (!process.env.FRED_API_KEY) {
      issues.push('FRED_API_KEY missing for economic data route');
    }
  }
  
  if (route.includes('/api/stock') || route.includes('/api/market')) {
    if (!process.env.TWELVE_DATA_API_KEY) {
      issues.push('TWELVE_DATA_API_KEY missing for stock data route');
    }
  }
  
  if (route.includes('/ai') || route.includes('/analysis')) {
    if (!process.env.OPENAI_API_KEY) {
      issues.push('OPENAI_API_KEY missing for AI analysis route');
    }
  }
  
  if (issues.length > 0) {
    logger.warn('⚠️ ROUTE ENVIRONMENT VALIDATION FAILED', {
      route,
      method: req.method,
      issues,
      impact: 'This route may fail with 500 Internal Server Error'
    });
  }
}

// Database connection validation middleware
export function databaseConnectionValidation(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Only validate for database-dependent routes
  if (!req.path.includes('/api/etf') && !req.path.includes('/api/economic') && !req.path.includes('/api/macro')) {
    return next();
  }
  
  if (!process.env.DATABASE_URL) {
    logger.error('🚨 DATABASE CONNECTION FAILURE', {
      route: req.path,
      method: req.method,
      error: 'DATABASE_URL environment variable is missing',
      impact: 'All database operations will fail'
    });
    
    return res.status(500).json({
      success: false,
      error: 'Database configuration error',
      code: 'DATABASE_CONFIG_MISSING',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

// External API validation middleware
export function externalApiValidation(req: express.Request, res: express.Response, next: express.NextFunction) {
  const issues = [];
  
  // Check API keys for specific routes
  if ((req.path.includes('/fred') || req.path.includes('/economic')) && !process.env.FRED_API_KEY) {
    issues.push('FRED_API_KEY missing');
  }
  
  if ((req.path.includes('/stock') || req.path.includes('/market')) && !process.env.TWELVE_DATA_API_KEY) {
    issues.push('TWELVE_DATA_API_KEY missing');
  }
  
  if (issues.length > 0) {
    logger.error('🚨 EXTERNAL API VALIDATION FAILURE', {
      route: req.path,
      method: req.method,
      issues,
      impact: 'External API calls will fail'
    });
    
    return res.status(500).json({
      success: false,
      error: 'External API configuration error',
      issues,
      code: 'API_CONFIG_MISSING',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

// Promise rejection handler
export function promiseRejectionHandler() {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('🚨 UNHANDLED PROMISE REJECTION', {
      reason: reason?.message || String(reason),
      stack: reason?.stack,
      promise: String(promise),
      timestamp: new Date().toISOString(),
      impact: 'This may cause 500 Internal Server Error'
    });
    
    // In production, we should continue running but log the error
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unhandled Promise Rejection:', reason);
    }
  });
  
  process.on('uncaughtException', (error: Error) => {
    logger.error('🚨 UNCAUGHT EXCEPTION', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      impact: 'This will cause server crash'
    });
    
    // In production, attempt graceful shutdown
    if (process.env.NODE_ENV === 'production') {
      console.error('Production uncaught exception - attempting graceful shutdown');
      setTimeout(() => process.exit(1), 2000);
    }
  });
}