import { Request, Response, NextFunction } from 'express';

interface ApiCallStats {
  callsThisMinute: number;
  totalCalls: number;
  lastResetTime: number;
  slowCalls: Array<{ endpoint: string; duration: number; timestamp: number }>;
}

const stats: ApiCallStats = {
  callsThisMinute: 0,
  totalCalls: 0,
  lastResetTime: Date.now(),
  slowCalls: []
};

export function apiLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Track API call
  const now = Date.now();
  const minutesSinceReset = (now - stats.lastResetTime) / (1000 * 60);
  
  if (minutesSinceReset >= 1) {
    stats.callsThisMinute = 1;
    stats.lastResetTime = now;
  } else {
    stats.callsThisMinute++;
  }
  stats.totalCalls++;

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Log slow calls (>5 seconds)
    if (duration > 5000) {
      stats.slowCalls.push({
        endpoint: req.path,
        duration,
        timestamp: now
      });
      
      // Keep only last 10 slow calls
      if (stats.slowCalls.length > 10) {
        stats.slowCalls.shift();
      }
      
      console.warn(`⚠️  Slow API call: ${req.method} ${req.path} took ${duration}ms`);
    }
    
    console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms :: ${chunk ? JSON.stringify(chunk).substring(0, 100) + '…' : 'no body'}`);
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

export function getApiStats() {
  return {
    ...stats,
    slowCalls: stats.slowCalls.slice(-10) // Return last 10 slow calls
  };
}