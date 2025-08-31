import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

// Production Health Check Middleware
export function productionHealthCheck(req: Request, res: Response, next: NextFunction) {
  try {
    // Add null check for req.path
    const requestPath = req.path || req.url || '/';
    
    if (requestPath === '/health') {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || 'unknown'
      });
    }
    next();
  } catch (error) {
    console.error('❌ Production health check error:', error);
    next();
  }
}

// Static File Validation Middleware
export function staticFileValidation(req: Request, res: Response, next: NextFunction) {
  try {
    // Add null check for req.path to prevent undefined errors
    const requestPath = req.path || req.url || '/';
    
    // Add debug logging for all HTML responses
    if (!requestPath.startsWith('/api')) {
    const originalSend = res.send;
    res.send = function(body: any) {
      if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
        console.log(`🔍 [HTML DEBUG] Serving HTML for ${req.path} from ${req.route?.path || 'unknown route'}`);
        console.log(`🔍 [HTML DEBUG] First 200 chars: ${body.substring(0, 200)}`);
      }
      return originalSend.call(this, body);
    };
  }

    // Only apply to root path requests
    if (requestPath === '/' && req.method === 'GET') {
    const staticPath = path.resolve(process.cwd(), 'dist/public');
    const indexPath = path.join(staticPath, 'index.html');
    
    if (!fs.existsSync(indexPath)) {
      console.error('❌ CRITICAL: index.html not found at', indexPath);
      res.status(500).json({
        error: 'Frontend build not found',
        message: 'The application frontend is not properly deployed',
        timestamp: new Date().toISOString(),
        path: indexPath
      });
      return;
    }
    
    try {
      const content = fs.readFileSync(indexPath, 'utf8');
      if (content.length < 100) {
        console.error('❌ CRITICAL: index.html appears corrupted, size:', content.length);
        res.status(500).json({
          error: 'Frontend build corrupted',
          message: 'The application frontend appears to be corrupted',
          timestamp: new Date().toISOString(),
          size: content.length
        });
        return;
      }
    } catch (error) {
      console.error('❌ CRITICAL: Cannot read index.html:', error);
      res.status(500).json({
        error: 'Frontend read error',
        message: 'Cannot read the application frontend',
        timestamp: new Date().toISOString(),
        error_details: error instanceof Error ? error.message : 'Unknown error'
      });
      return;
    }
    }
    next();
  } catch (error) {
    console.error('❌ Static file validation error:', error);
    next();
  }
}

// Deployment Status Check
export function deploymentStatusCheck() {
  const staticPath = path.resolve(process.cwd(), 'dist/public');
  const indexPath = path.join(staticPath, 'index.html');
  const assetsPath = path.join(staticPath, 'assets');
  
  const checks = {
    static_directory: fs.existsSync(staticPath),
    index_html: fs.existsSync(indexPath),
    assets_directory: fs.existsSync(assetsPath),
    timestamp: new Date().toISOString()
  };
  
  const isHealthy = Object.values(checks).slice(0, 3).every(Boolean);
  
  if (!isHealthy) {
    console.error('❌ DEPLOYMENT HEALTH CHECK FAILED:', checks);
  } else {
    console.log('✅ Deployment health check passed:', checks);
  }
  
  return { healthy: isHealthy, checks };
}

// Error Recovery Middleware
export function errorRecoveryMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  console.error('❌ Production Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Add null check for req.path
    const requestPath = req.path || req.url || '/';
    
    // For frontend routes, try to serve a basic error page
    if (!requestPath.startsWith('/api/')) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>FinanceHub Pro - Service Temporarily Unavailable</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }
            .error { background: #2a2a2a; padding: 30px; border-radius: 10px; display: inline-block; }
            .retry { margin-top: 20px; }
            button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>FinanceHub Pro</h1>
            <h2>Service Temporarily Unavailable</h2>
            <p>We're experiencing technical difficulties. Please try again in a moment.</p>
            <div class="retry">
              <button onclick="window.location.reload()">Retry</button>
            </div>
          </div>
        </body>
      </html>
    `);
      return;
    }
    
    // For API routes, return JSON error
    if (!res.headersSent && res.status && typeof res.status === 'function') {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'A server error occurred while processing your request',
        timestamp: new Date().toISOString(),
        path: requestPath
      });
    }
  } catch (middlewareError) {
    console.error('❌ Error recovery middleware failed:', middlewareError);
    if (!res.headersSent && res.status && typeof res.status === 'function') {
      res.status(500).json({ error: 'Critical server error' });
    }
  }
}