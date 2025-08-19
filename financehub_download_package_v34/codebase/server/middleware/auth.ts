import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../../shared/utils/logger';

// Extend Express Request type for user data
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * ✅ PHASE 2 TASK 5: Authentication middleware for protected routes
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    logger.warn(`Authentication required for ${req.path}`, `IP: ${req.ip}`);
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide a valid authorization token'
    });
  }
  
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable not configured');
      return res.status(500).json({ error: 'Authentication service unavailable' });
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    logger.info(`Authenticated user access to ${req.path}`, `User ID: ${(decoded as any).id}`);
    next();
  } catch (error) {
    logger.warn(`Invalid token for ${req.path}`, `Error: ${String(error)}, IP: ${req.ip}`);
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }
};

/**
 * ✅ PHASE 2 TASK 5: Rate limiting for admin operations
 */
export const adminRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 admin operations per hour
  message: {
    error: 'Admin operation rate limit exceeded',
    message: 'Too many admin operations. Please try again in an hour.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Admin rate limit exceeded', `IP: ${req.ip}, Path: ${req.path}, Method: ${req.method}`);
    res.status(429).json({
      error: 'Admin operation rate limit exceeded',
      message: 'Too many admin operations. Please try again in an hour.',
      retryAfter: 3600
    });
  }
});

/**
 * ✅ PHASE 2 TASK 5: Rate limiting for API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: 'API rate limit exceeded',
    message: 'Too many requests. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', `IP: ${req.ip}, Path: ${req.path}, Method: ${req.method}`);
    res.status(429).json({
      error: 'API rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: 900
    });
  }
});

/**
 * Optional authentication - doesn't block access but adds user context if token provided
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
      }
    } catch (error) {
      // Silently ignore invalid tokens for optional auth
      logger.debug(`Optional auth failed for ${req.path}`, String(error));
    }
  }
  
  next();
};