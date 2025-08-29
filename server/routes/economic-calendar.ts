import { Router } from 'express';
import { economicCalendarService } from '../services/economic-calendar-service';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /api/economic-calendar
 * Fetch economic calendar data with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      category,
      frequency,
      limit = '100',
      offset = '0'
    } = req.query;

    logger.info('📊 [ECONOMIC CALENDAR] GET request:', {
      startDate,
      endDate,
      category,
      frequency,
      limit,
      offset
    });

    // Validate and parse query parameters
    const limitNum = Math.min(parseInt(limit as string) || 100, 500); // Max 500 records
    const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

    const startTime = Date.now();
    
    const result = await economicCalendarService.getCalendarData({
      startDate: startDate as string,
      endDate: endDate as string,
      category: category as string,
      frequency: frequency as string,
      limit: limitNum,
      offset: offsetNum
    });

    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Data retrieved successfully: ${result.data.length} records (${responseTime}ms)`);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: limitNum,
        offset: offsetNum
      },
      metadata: {
        responseTime,
        categories: ['Growth', 'Inflation', 'Labor', 'Housing', 'Finance', 'Consumption', 'Government', 'Trade'],
        frequencies: ['daily', 'weekly', 'monthly', 'quarterly', 'annual']
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to fetch calendar data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch economic calendar data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/recent
 * Get recent releases (last 30 days)
 */
router.get('/recent', async (req, res) => {
  try {
    logger.info('📈 [ECONOMIC CALENDAR] GET recent releases');
    
    const startTime = Date.now();
    const data = await economicCalendarService.getRecentReleases();
    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Recent releases retrieved: ${data.length} records (${responseTime}ms)`);

    res.json({
      success: true,
      data,
      count: data.length,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to fetch recent releases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent releases',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/category/:category
 * Get data for a specific category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ['Growth', 'Inflation', 'Labor', 'Housing', 'Finance', 'Consumption', 'Government', 'Trade'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
        validCategories,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`📊 [ECONOMIC CALENDAR] GET category: ${category}`);
    
    const startTime = Date.now();
    const data = await economicCalendarService.getByCategory(category);
    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Category data retrieved: ${data.length} records for ${category} (${responseTime}ms)`);

    res.json({
      success: true,
      data,
      category,
      count: data.length,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ [ECONOMIC CALENDAR] Failed to fetch category data:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/economic-calendar/refresh
 * Trigger manual data refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { startDate, endDate, seriesId } = req.body;
    
    logger.info('🔄 [ECONOMIC CALENDAR] POST refresh request:', {
      startDate,
      endDate,
      seriesId
    });

    const startTime = Date.now();

    if (seriesId) {
      // Refresh specific series
      await economicCalendarService.processSeries(seriesId, startDate, endDate);
      logger.info(`✅ [ECONOMIC CALENDAR] Refreshed series: ${seriesId}`);
    } else {
      // Refresh all series
      await economicCalendarService.processAllSeries(startDate, endDate);
      logger.info('✅ [ECONOMIC CALENDAR] Refreshed all series');
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      message: seriesId 
        ? `Successfully refreshed series: ${seriesId}` 
        : 'Successfully refreshed all economic calendar data',
      seriesId: seriesId || null,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to refresh data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh economic calendar data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/stats
 * Get database statistics and data coverage
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('📊 [ECONOMIC CALENDAR] GET stats');
    
    const startTime = Date.now();
    
    // Get comprehensive stats in a single query
    const result = await economicCalendarService.getCalendarData({
      limit: 1 // We only need the metadata, not the actual data
    });

    // TODO: Add more detailed stats query here if needed
    const stats = {
      totalRecords: result.total,
      dataAvailable: result.total > 0,
      categories: ['Growth', 'Inflation', 'Labor', 'Housing', 'Finance', 'Consumption', 'Government', 'Trade'],
      frequencies: ['daily', 'weekly', 'monthly', 'quarterly', 'annual'],
      seriesCount: Object.keys((await import('../services/economic-calendar-service')).FRED_SERIES_MAP).length,
    };

    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Stats retrieved (${responseTime}ms):`, stats);

    res.json({
      success: true,
      stats,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to fetch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch economic calendar stats',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;