import { logger } from '../utils/logger.js';
import { Request, Response, NextFunction } from 'express';

/**
 * Production Environment Validation Middleware
 * Validates critical environment variables and logs deployment state
 */

export function validateProductionEnvironment(req: Request, res: Response, next: NextFunction) {
  // Only run on first request to avoid spam
  if (!global.productionValidationRun) {
    global.productionValidationRun = true;
    
    logger.info('🔍 PRODUCTION VALIDATION START', {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      deploymentId: process.env.REPL_ID || 'unknown',
      deploymentSlug: process.env.REPL_SLUG || 'unknown'
    });

    // Critical Environment Variables Check
    const criticalEnvVars = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      FRED_API_KEY: !!process.env.FRED_API_KEY,
      TWELVE_DATA_API_KEY: !!process.env.TWELVE_DATA_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT
    };

    logger.info('🔍 ENVIRONMENT VARIABLES STATUS', criticalEnvVars);

    // Database Connection Test
    testDatabaseConnection();
    
    // External API Keys Test
    testExternalAPIKeys();
    
    // Memory and Resource Check
    checkResourceConstraints();
    
    // Deployment State Check
    checkDeploymentState();
  }
  
  next();
}

async function testDatabaseConnection() {
  try {
    const { neon } = await import('@neondatabase/serverless');
    if (!process.env.DATABASE_URL) {
      logger.error('🚨 DATABASE_URL missing in production');
      return;
    }
    
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT 1 as test`;
    logger.info('✅ PRODUCTION DATABASE CONNECTION', { success: true, result: result[0] });
  } catch (error) {
    logger.error('🚨 PRODUCTION DATABASE CONNECTION FAILED', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

function testExternalAPIKeys() {
  const apiKeyTests = {
    FRED_API: {
      present: !!process.env.FRED_API_KEY,
      length: process.env.FRED_API_KEY?.length || 0,
      startsWithExpected: process.env.FRED_API_KEY?.startsWith('...') || false
    },
    TWELVE_DATA_API: {
      present: !!process.env.TWELVE_DATA_API_KEY,
      length: process.env.TWELVE_DATA_API_KEY?.length || 0
    },
    OPENAI_API: {
      present: !!process.env.OPENAI_API_KEY,
      length: process.env.OPENAI_API_KEY?.length || 0,
      startsWithExpected: process.env.OPENAI_API_KEY?.startsWith('sk-') || false
    }
  };
  
  logger.info('🔍 EXTERNAL API KEYS STATUS', apiKeyTests);
}

function checkResourceConstraints() {
  const memoryUsage = process.memoryUsage();
  const resourceInfo = {
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    uptime: `${Math.round(process.uptime())}s`,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
  
  logger.info('🔍 PRODUCTION RESOURCE STATUS', resourceInfo);
}

function checkDeploymentState() {
  const deploymentInfo = {
    timestamp: new Date().toISOString(),
    replId: process.env.REPL_ID || 'unknown',
    replSlug: process.env.REPL_SLUG || 'unknown',
    nodeEnv: process.env.NODE_ENV,
    deploymentDomain: process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + '.replit.app',
    hasGitCommit: !!process.env.REPLIT_GIT_COMMIT,
    currentDirectory: process.cwd(),
    packageJsonExists: require('fs').existsSync('package.json')
  };
  
  logger.info('🔍 DEPLOYMENT STATE', deploymentInfo);
}

/**
 * Express Route Error Capture Middleware
 * Captures and logs any remaining unhandled route errors
 */
export function captureRouteErrors(req: Request, res: Response, next: NextFunction) {
  // Override res.status to catch error responses
  const originalStatus = res.status.bind(res);
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  
  res.status = function(code: number) {
    if (code >= 500) {
      logger.error('🚨 PRODUCTION 500 ERROR DETECTED', {
        statusCode: code,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        headers: req.headers,
        query: req.query,
        params: req.params
      });
    }
    return originalStatus(code);
  };
  
  res.send = function(body: any) {
    if (res.statusCode >= 500) {
      logger.error('🚨 PRODUCTION ERROR RESPONSE BODY', {
        statusCode: res.statusCode,
        body: typeof body === 'string' ? body.substring(0, 1000) : body,
        url: req.url,
        method: req.method
      });
    }
    return originalSend(body);
  };
  
  res.json = function(obj: any) {
    if (res.statusCode >= 500) {
      logger.error('🚨 PRODUCTION ERROR JSON RESPONSE', {
        statusCode: res.statusCode,
        response: obj,
        url: req.url,
        method: req.method
      });
    }
    return originalJson(obj);
  };
  
  next();
}

// Global error event listeners for production
export function initializeProductionErrorCapture() {
  process.on('uncaughtException', (error: Error) => {
    logger.error('🚨 PRODUCTION UNCAUGHT EXCEPTION', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage()
    });
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('🚨 PRODUCTION UNHANDLED REJECTION', {
      reason: reason?.message || String(reason),
      stack: reason?.stack,
      promise: String(promise),
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage()
    });
  });

  process.on('warning', (warning: any) => {
    logger.warn('⚠️ PRODUCTION WARNING', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      timestamp: new Date().toISOString()
    });
  });

  logger.info('🛡️ Production error capture initialized');
}

declare global {
  var productionValidationRun: boolean;
}