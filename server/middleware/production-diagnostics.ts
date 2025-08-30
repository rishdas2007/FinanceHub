import express from 'express';
import { logger } from '../utils/logger.js';

/**
 * Production Diagnostics Middleware
 * Validates environment and logs system state for debugging production issues
 */
export function productionDiagnostics(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Only run comprehensive checks on first request or health checks
  const isHealthCheck = req.path.includes('/health') || req.path.includes('/api/health');
  const isFirstRequest = !global.diagnosticsRun;
  
  if (isFirstRequest) {
    global.diagnosticsRun = true;
    runComprehensiveDiagnostics();
  }
  
  // Log all incoming requests in production for debugging
  if (process.env.NODE_ENV === 'production') {
    logger.info('🔍 PRODUCTION REQUEST', {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

function runComprehensiveDiagnostics() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    
    // Environment Variables Check
    environmentVariables: {
      NODE_ENV: !!process.env.NODE_ENV,
      DATABASE_URL: !!process.env.DATABASE_URL,
      FRED_API_KEY: !!process.env.FRED_API_KEY,
      TWELVE_DATA_API_KEY: !!process.env.TWELVE_DATA_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      PORT: !!process.env.PORT
    },
    
    // Database URL Analysis (without exposing sensitive data)
    database: {
      hasUrl: !!process.env.DATABASE_URL,
      urlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 10) + '...' : null,
      isPostgres: process.env.DATABASE_URL?.startsWith('postgres'),
      hasSSL: process.env.DATABASE_URL?.includes('sslmode')
    },
    
    // API Key Status (without exposing keys)
    apiKeys: {
      fredKeyLength: process.env.FRED_API_KEY?.length || 0,
      twelveDataKeyLength: process.env.TWELVE_DATA_API_KEY?.length || 0,
      openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      sendgridKeyLength: process.env.SENDGRID_API_KEY?.length || 0
    }
  };
  
  logger.info('🔧 PRODUCTION DIAGNOSTICS COMPLETE', diagnostics);
  
  // Test critical environment variables
  validateCriticalEnvironment();
}

function validateCriticalEnvironment() {
  const critical = [];
  const warnings = [];
  
  // Critical checks that would cause 500 errors
  if (!process.env.DATABASE_URL) {
    critical.push('DATABASE_URL missing - database connections will fail');
  }
  
  if (!process.env.FRED_API_KEY) {
    critical.push('FRED_API_KEY missing - economic data APIs will fail');
  }
  
  if (!process.env.TWELVE_DATA_API_KEY) {
    critical.push('TWELVE_DATA_API_KEY missing - stock data APIs will fail');
  }
  
  // Warning checks for degraded functionality
  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY missing - AI analysis features will be disabled');
  }
  
  if (!process.env.SENDGRID_API_KEY) {
    warnings.push('SENDGRID_API_KEY missing - email notifications will fail');
  }
  
  if (critical.length > 0) {
    logger.error('🚨 CRITICAL ENVIRONMENT ISSUES', {
      critical,
      impact: 'These will cause 500 Internal Server Errors',
      action: 'Fix immediately before deployment'
    });
  }
  
  if (warnings.length > 0) {
    logger.warn('⚠️ ENVIRONMENT WARNINGS', {
      warnings,
      impact: 'Features will be degraded but app should function'
    });
  }
  
  if (critical.length === 0 && warnings.length === 0) {
    logger.info('✅ ENVIRONMENT VALIDATION PASSED', {
      message: 'All critical environment variables are present'
    });
  }
}

// Global flag to track if diagnostics have run
declare global {
  var diagnosticsRun: boolean;
}