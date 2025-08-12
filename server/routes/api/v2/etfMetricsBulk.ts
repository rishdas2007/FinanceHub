import { Router } from 'express';
import { getEtfMetricsBulk } from '../../../controllers/EtfController';

const router = Router();

/**
 * GET /api/v2/etf-metrics?bulk=true
 * Returns a single payload with all ETF rows needed for the main table.
 */
router.get('/etf-metrics', (req, res, next) => {
  if (req.query.bulk === 'true') return getEtfMetricsBulk(req, res).catch(next);
  // If needed, fall back to non-bulk handler (not included here).
  res.status(400).json({ ok: false, error: 'Set ?bulk=true to use the bulk endpoint.' });
});

export default router;