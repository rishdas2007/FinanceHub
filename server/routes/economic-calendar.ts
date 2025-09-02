import { Router } from 'express';
import { economicCalendarPG } from '../services/economic-calendar-pg';
import { logger } from '../utils/logger';

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
      mode = 'all',
      limit = '100',
      offset = '0'
    } = req.query;

    logger.info('📊 [ECONOMIC CALENDAR] GET request:', {
      startDate,
      endDate,
      category,
      frequency,
      mode,
      limit,
      offset
    });

    // Validate and parse query parameters
    const limitNum = Math.min(parseInt(limit as string) || 100, 500); // Max 500 records
    const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

    const startTime = Date.now();
    
    const result = await economicCalendarPG.getCalendarData({
      startDate: startDate as string,
      endDate: endDate as string,
      category: category as string,
      frequency: frequency as string,
      mode: mode as string,
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
      performance: {
        executionTime: result.executionTime,
        fromCache: result.fromCache,
        optimization: result.optimization
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
    const data = await economicCalendarPG.getRecentReleases();
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
    const data = await economicCalendarPG.getByCategory(category);
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
    const result = await economicCalendarPG.getCalendarData({
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

/**
 * GET /api/economic-calendar/critical
 * Get critical economic indicators (ultra-fast < 5ms)
 */
router.get('/critical', async (req, res) => {
  try {
    logger.info('⚡ [ECONOMIC CALENDAR] GET critical indicators');
    
    const startTime = Date.now();
    const data = await economicCalendarPG.getCriticalIndicators();
    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Critical indicators retrieved: ${data.length} records (${responseTime}ms)`);

    res.json({
      success: true,
      data,
      count: data.length,
      responseTime,
      optimization: 'priority_view',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to fetch critical indicators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch critical indicators',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/signals
 * Get investment signals with filtering
 */
router.get('/signals', async (req, res) => {
  try {
    const {
      signalType,
      minStrength = '0.5',
      categories,
      limit = '100'
    } = req.query;

    const categoriesArray = categories ? 
      (Array.isArray(categories) ? categories : [categories]) : undefined;

    logger.info('📊 [ECONOMIC CALENDAR] GET investment signals:', {
      signalType,
      minStrength,
      categories: categoriesArray,
      limit
    });
    
    const startTime = Date.now();
    const data = await economicCalendarPG.getInvestmentSignals({
      signalType: signalType as any,
      minStrength: parseFloat(minStrength as string),
      categories: categoriesArray as string[],
      limit: parseInt(limit as string)
    });
    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Investment signals retrieved: ${data.length} records (${responseTime}ms)`);

    res.json({
      success: true,
      data,
      count: data.length,
      responseTime,
      filters: {
        signalType,
        minStrength: parseFloat(minStrength as string),
        categories: categoriesArray
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to fetch investment signals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch investment signals',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/performance
 * Get query performance statistics
 */
router.get('/performance', async (req, res) => {
  try {
    const { hours = '24' } = req.query;
    
    logger.info(`📈 [ECONOMIC CALENDAR] GET performance stats for ${hours} hours`);
    
    const startTime = Date.now();
    const stats = await economicCalendarService.getPerformanceStats(parseInt(hours as string));
    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Performance stats retrieved (${responseTime}ms)`);

    res.json({
      success: true,
      ...stats,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to fetch performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/economic-calendar/refresh-cache
 * Manually refresh materialized views and cache
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    logger.info('🔄 [ECONOMIC CALENDAR] POST refresh cache');
    
    const startTime = Date.now();
    const result = await economicCalendarService.refreshCache();
    const responseTime = Date.now() - startTime;

    logger.info(`✅ [ECONOMIC CALENDAR] Cache refreshed successfully (${responseTime}ms)`);

    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      result,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to refresh cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/data-quality/health
 * Quick data quality health check for economic indicators
 */
router.get('/data-quality/health', async (req, res) => {
  try {
    logger.info('🔍 [ECONOMIC CALENDAR] GET data quality health');
    
    const startTime = Date.now();
    const criticalSeries = ['GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'UNRATE', 'PAYEMS', 'FEDFUNDS'];
    
    const report = await economicDataQualityService.assessDataQuality({
      seriesIds: criticalSeries,
      lookbackDays: 30
    });
    
    const criticalIssues = Object.values(report.seriesQuality).reduce((count, series) => {
      return count + ((series as any).issues?.filter((i: any) => i.severity === 'critical').length || 0);
    }, 0);
    
    const healthStatus = report.overallScore >= 90 ? 'excellent' : 
                        report.overallScore >= 75 ? 'good' : 
                        report.overallScore >= 60 ? 'fair' : 'poor';
    
    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ [ECONOMIC CALENDAR] Data quality health: ${healthStatus} (${responseTime}ms)`);
    
    res.json({
      success: true,
      data: {
        status: healthStatus,
        overallScore: report.overallScore,
        criticalIssues,
        seriesAssessed: criticalSeries.length,
        lastAssessed: report.generatedAt,
        recommendations: report.recommendations.slice(0, 3)
      },
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to get data quality health:', error);
    res.status(500).json({
      success: false,
      error: 'Data quality health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/data-quality/report
 * Comprehensive data quality assessment report
 */
router.get('/data-quality/report', async (req, res) => {
  try {
    const { series, lookback = '90', includeDerivatives = 'true' } = req.query;
    
    const options = {
      seriesIds: series ? (series as string).split(',') : undefined,
      lookbackDays: parseInt(lookback as string),
      includeDerivatives: includeDerivatives === 'true'
    };
    
    logger.info('📊 [ECONOMIC CALENDAR] GET data quality report:', options);
    
    const startTime = Date.now();
    const report = await economicDataQualityService.assessDataQuality(options);
    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ [ECONOMIC CALENDAR] Data quality report generated: score ${report.overallScore}/100 (${responseTime}ms)`);
    
    res.json({
      success: true,
      data: report,
      metadata: {
        executionTimeMs: responseTime,
        reportGeneratedAt: new Date().toISOString(),
        coverage: {
          seriesAnalyzed: Object.keys(report.seriesQuality).length,
          lookbackDays: options.lookbackDays
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to generate data quality report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate data quality report',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/economic-calendar/data-quality/issues
 * Get current data quality issues with filtering
 */
router.get('/data-quality/issues', async (req, res) => {
  try {
    const { severity, category, type, limit = '50' } = req.query;
    
    logger.info('🚨 [ECONOMIC CALENDAR] GET data quality issues:', { severity, category, type, limit });
    
    const startTime = Date.now();
    const report = await economicDataQualityService.assessDataQuality({
      lookbackDays: 30 // Focus on recent issues
    });
    
    let allIssues: any[] = [];
    
    // Collect all issues from series quality reports
    Object.entries(report.seriesQuality).forEach(([seriesId, quality]) => {
      allIssues.push(...(quality as any).issues);
    });
    
    // Apply filters
    if (severity) allIssues = allIssues.filter(issue => issue.severity === severity);
    if (category) allIssues = allIssues.filter(issue => issue.category === category);
    if (type) allIssues = allIssues.filter(issue => issue.issueType === type);
    
    // Sort by severity and limit results
    allIssues.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] ?? 3;
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] ?? 3;
      return aSeverity !== bSeverity ? aSeverity - bSeverity : 
             new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });
    
    allIssues = allIssues.slice(0, parseInt(limit as string));
    
    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ [ECONOMIC CALENDAR] Data quality issues retrieved: ${allIssues.length} issues (${responseTime}ms)`);
    
    res.json({
      success: true,
      data: {
        issues: allIssues,
        summary: {
          total: allIssues.length,
          bySeverity: {
            critical: allIssues.filter(i => i.severity === 'critical').length,
            warning: allIssues.filter(i => i.severity === 'warning').length,
            info: allIssues.filter(i => i.severity === 'info').length
          }
        },
        overallQualityScore: report.overallScore
      },
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ [ECONOMIC CALENDAR] Failed to get data quality issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data quality issues',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;