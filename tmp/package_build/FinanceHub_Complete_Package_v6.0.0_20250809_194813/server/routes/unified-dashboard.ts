import { Router } from 'express';
import { unifiedDashboardCache } from '../services/unified-dashboard-cache';
import { logger } from '../middleware/logging';

const router = Router();

/**
 * Get SPY baseline data for consistent cross-section comparison
 */
router.get('/spy-baseline', async (req, res) => {
  try {
    const spyData = await unifiedDashboardCache.getSPYBaseline();
    res.json(spyData);
  } catch (error) {
    logger.error('❌ Error fetching SPY baseline:', error);
    res.status(500).json({ error: 'SPY baseline data temporarily unavailable' });
  }
});

/**
 * Get sector data with consistent Z-Score calculations
 */
router.get('/sectors', async (req, res) => {
  try {
    const sectorData = await unifiedDashboardCache.getSectorData();
    res.json(sectorData);
  } catch (error) {
    logger.error('❌ Error fetching unified sector data:', error);
    res.status(500).json({ error: 'Sector data temporarily unavailable' });
  }
});

/**
 * Get technical indicators
 */
router.get('/technical', async (req, res) => {
  try {
    const technicalData = await unifiedDashboardCache.getTechnicalData();
    res.json(technicalData);
  } catch (error) {
    logger.error('❌ Error fetching technical data:', error);
    res.status(500).json({ error: 'Technical data temporarily unavailable' });
  }
});

/**
 * Get complete unified dashboard data
 */
router.get('/complete', async (req, res) => {
  try {
    const unifiedData = await unifiedDashboardCache.getUnifiedData();
    res.json(unifiedData);
  } catch (error) {
    logger.error('❌ Error fetching complete unified data:', error);
    res.status(500).json({ error: 'Dashboard data temporarily unavailable' });
  }
});

/**
 * Force refresh all unified data
 */
router.post('/refresh', async (req, res) => {
  try {
    logger.info('🔄 Manual refresh of unified dashboard data requested');
    const refreshedData = await unifiedDashboardCache.refreshUnifiedData();
    res.json({
      message: 'Dashboard data refreshed successfully',
      lastUpdated: refreshedData.lastUpdated,
      sectorCount: refreshedData.sectorData.length,
      economicCount: refreshedData.economicData.length
    });
  } catch (error) {
    logger.error('❌ Error refreshing unified data:', error);
    res.status(500).json({ error: 'Failed to refresh dashboard data' });
  }
});

/**
 * Get cache statistics for monitoring
 */
router.get('/cache-stats', async (req, res) => {
  try {
    const stats = unifiedDashboardCache.getCacheStats();
    res.json(stats);
  } catch (error) {
    logger.error('❌ Error fetching cache stats:', error);
    res.status(500).json({ error: 'Cache stats unavailable' });
  }
});

export default router;