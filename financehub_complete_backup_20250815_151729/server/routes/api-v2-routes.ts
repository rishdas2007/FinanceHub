import { Router } from 'express';
import { apiV2Service } from '../services/api-v2-service';

const router = Router();

// New v2 API routes with unified response envelope
router.get('/market-status', (req, res) => apiV2Service.getMarketStatus(req, res));
router.get('/etf-metrics', (req, res) => apiV2Service.getETFMetrics(req, res));
router.get('/stocks/:symbol/history', (req, res) => apiV2Service.getStockHistory(req, res));
router.get('/sparkline', (req, res) => apiV2Service.getSparkline(req, res));
router.get('/economic-indicators', (req, res) => apiV2Service.getEconomicIndicators(req, res));
router.get('/health', (req, res) => apiV2Service.getHealth(req, res));

export default router;