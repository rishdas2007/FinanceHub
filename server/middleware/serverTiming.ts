import type { Request, Response, NextFunction } from 'express';

/**
 * Decorator to time handlers and emit Server-Timing header.
 */
export function withServerTiming(handler: (req: Request, res: Response, next?: NextFunction) => Promise<any>) {
  return async (req: Request, res: Response, next?: NextFunction) => {
    const t0 = performance.now();
    res.locals.serverTiming = res.locals.serverTiming || {};
    try {
      await handler(req, res, next);
    } finally {
      const total = performance.now() - t0;
      const parts: string[] = [];
      for (const [k, v] of Object.entries(res.locals.serverTiming)) {
        parts.push(`${k};dur=${v}`);
      }
      parts.push(`total;dur=${total.toFixed(1)}`);
      res.setHeader('Server-Timing', parts.join(', '));
    }
  };
}