import { Router } from 'express';

const router = Router();

// Health check endpoint for quick diagnostics
router.get('/health', async (req, res) => {
  try {
    res.json({ 
      ok: true, 
      db: true,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error: any) {
    res.status(503).json({ 
      ok: false, 
      db: false, 
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;