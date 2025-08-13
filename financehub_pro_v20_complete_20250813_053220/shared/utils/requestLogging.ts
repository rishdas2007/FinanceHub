/**
 * Centralized request logging middleware
 * Consolidates API request/response logging patterns
 */

import type { Request, Response, NextFunction } from 'express';

export function logAPIRequest(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
}

export function logApiCall(
  service: string, 
  endpoint: string, 
  success: boolean, 
  duration?: number,
  data?: any
): void {
  const status = success ? '✅' : '❌';
  const timing = duration ? ` (${duration}ms)` : '';
  const dataInfo = data ? ` :: ${JSON.stringify(data).slice(0, 50)}...` : '';
  console.log(`${status} ${service} API: ${endpoint}${timing}${dataInfo}`);
}

export function logCacheOperation(
  operation: 'HIT' | 'MISS' | 'SET',
  key: string,
  duration?: number
): void {
  const icon = operation === 'HIT' ? '🎯' : operation === 'MISS' ? '❌' : '💾';
  const timing = duration ? ` (${duration}ms)` : '';
  console.log(`${icon} Cache ${operation}: ${key}${timing}`);
}