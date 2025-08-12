import { Router } from 'express';
import { getEtfMetricsBulk } from '../../../controllers/EtfController';

const router = Router();

/**
 * GET /api/v2/etf-metrics?bulk=true
 * Returns a single payload with all ETF rows needed for the main table.
 */
router.get('/etf-metrics', async (req, res, next) => {
  try {
    if (req.query.bulk === 'true') {
      // Ensure proper content type for all responses
      res.setHeader('Content-Type', 'application/json');
      return await getEtfMetricsBulk(req, res);
    }
    // If needed, fall back to non-bulk handler (not included here).
    res.status(400).json({ ok: false, error: 'Set ?bulk=true to use the bulk endpoint.' });
  } catch (error) {
    console.error('ETF Bulk endpoint error:', error);
    next(error);
  }
});

export default router;