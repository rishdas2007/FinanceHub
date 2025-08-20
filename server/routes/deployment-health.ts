import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Production health check endpoint
router.get('/status', async (req, res) => {
  try {
    const healthCheck: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      port: process.env.PORT || '5000',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env_vars: {
        DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
        FRED_API_KEY: process.env.FRED_API_KEY ? '✅ Set' : '❌ Missing',
        TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY ? '✅ Set' : '❌ Missing',
        NODE_ENV: process.env.NODE_ENV || 'not set'
      }
    };

    // Test database connection
    try {
      await db.execute(sql`SELECT 1 as test`);
      healthCheck.database = '✅ Connected';
    } catch (dbError) {
      healthCheck.database = `❌ Failed: ${String(dbError).substring(0, 100)}`;
      healthCheck.status = 'unhealthy';
    }

    res.status(healthCheck.status === 'healthy' ? 200 : 500).json(healthCheck);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'FinanceHub Pro is running'
  });
});

export default router;