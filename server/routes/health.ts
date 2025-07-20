/**
 * Health check endpoints for monitoring and observability
 */

import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { createApiResponse, createErrorResponse } from '@shared/validation';
import { asyncHandler } from '../middleware/error-handler';
import logger from '../middleware/logging';

interface HealthCheck {
  status: 'ok' | 'error';
  timestamp: string;
  details?: any;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  database: HealthCheck;
  external_apis: HealthCheck;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  version: string;
}

// Check database connectivity
const checkDatabase = async (): Promise<HealthCheck> => {
  try {
    // Simple query to test connection
    await db.execute('SELECT 1');
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    logger.error({ error: errorMessage }, 'Database health check failed');
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      details: errorMessage
    };
  }
};

// Check external API availability
const checkExternalAPIs = async (): Promise<HealthCheck> => {
  try {
    // Test if we can reach external APIs (without using quota)
    const checks = await Promise.allSettled([
      fetch('https://api.twelvedata.com/time_series', { method: 'HEAD' }),
      fetch('https://api.openai.com/v1/models', { method: 'HEAD' })
    ]);

    const failedChecks = checks.filter(result => result.status === 'rejected');
    
    if (failedChecks.length > 0) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        details: `${failedChecks.length} external API(s) unreachable`
      };
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown external API error';
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      details: errorMessage
    };
  }
};

// Get memory usage statistics
const getMemoryStats = () => {
  const usage = process.memoryUsage();
  const totalMem = usage.heapTotal;
  const usedMem = usage.heapUsed;
  
  return {
    used: Math.round(usedMem / 1024 / 1024), // MB
    total: Math.round(totalMem / 1024 / 1024), // MB
    percentage: Math.round((usedMem / totalMem) * 100)
  };
};

export function registerHealthRoutes(app: Express) {
  // Detailed health check
  app.get('/health', asyncHandler(async (req: Request, res: Response) => {
    const [databaseHealth, externalAPIsHealth] = await Promise.all([
      checkDatabase(),
      checkExternalAPIs()
    ]);

    const memoryStats = getMemoryStats();
    const uptime = Math.floor(process.uptime());

    const systemHealth: SystemHealth = {
      overall: 'healthy',
      database: databaseHealth,
      external_apis: externalAPIsHealth,
      memory: memoryStats,
      uptime,
      version: process.env.npm_package_version || '1.0.0'
    };

    // Determine overall health
    if (databaseHealth.status === 'error') {
      systemHealth.overall = 'unhealthy';
    } else if (externalAPIsHealth.status === 'error' || memoryStats.percentage > 90) {
      systemHealth.overall = 'degraded';
    }

    const statusCode = systemHealth.overall === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json(createApiResponse(systemHealth));
  }));

  // Simple ping endpoint
  app.get('/ping', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    });
  });

  // Readiness probe (for Kubernetes)
  app.get('/ready', asyncHandler(async (req: Request, res: Response) => {
    const databaseHealth = await checkDatabase();
    
    if (databaseHealth.status === 'ok') {
      res.json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'database unavailable' });
    }
  }));

  // Liveness probe (for Kubernetes)
  app.get('/live', (req: Request, res: Response) => {
    res.json({ status: 'alive' });
  });
}