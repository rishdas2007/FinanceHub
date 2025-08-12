import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

/**
 * Smart compression middleware for ETF bulk endpoints
 * Prioritizes brotli > gzip for JSON payloads
 */
export function smartCompressionMiddleware() {
  return compression({
    level: 6, // Balanced compression vs speed
    threshold: 1024, // Only compress responses > 1KB
    filter: (req: Request, res: Response) => {
      // Skip compression for already compressed content
      if (res.getHeader('content-encoding')) {
        return false;
      }
      
      // Prioritize JSON compression for bulk endpoints
      const contentType = res.getHeader('content-type') as string;
      if (contentType && contentType.includes('application/json')) {
        return true;
      }
      
      // Use default compression filter for other content
      return compression.filter(req, res);
    }
  });
}

/**
 * ETag header middleware for conditional requests
 * Works with compression by using weak ETags
 */
export function etagMiddleware(req: Request, res: Response, next: NextFunction) {
  // Let Express handle ETag generation after compression
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  next();
}