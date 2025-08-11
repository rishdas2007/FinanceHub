// New API endpoints for the 3-layer economic data model
import { Router } from 'express';
import { db } from '../db';
import { econSeriesDef, econSeriesObservation, econSeriesFeatures } from '../../shared/economic-data-model';
import { eq, desc, and, gte } from 'drizzle-orm';
import { formatValue, formatColumnHeader } from '../../shared/formatters/economic-formatters';
import { ResponseUtils } from '../utils/ResponseUtils';
import { asyncHandler } from '../middleware/standardized-error-handler';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /api/econ/observations
 * Silver layer - standardized values for tables/charts
 */
router.get('/observations', asyncHandler(async (req, res) => {
  const { series_id, limit = 50 } = req.query;

  if (!series_id) {
    return ResponseUtils.badRequest(res, 'series_id parameter required');
  }

  try {
    // Get observations with metadata
    const observations = await db
      .select({
        observation: econSeriesObservation,
        definition: econSeriesDef
      })
      .from(econSeriesObservation)
      .innerJoin(econSeriesDef, eq(econSeriesObservation.seriesId, econSeriesDef.seriesId))
      .where(eq(econSeriesObservation.seriesId, series_id as string))
      .orderBy(desc(econSeriesObservation.periodEnd))
      .limit(Number(limit));

    // Format observations for consistent display
    const formattedData = observations.map(({ observation, definition }) => ({
      periodEnd: observation.periodEnd,
      valueStd: observation.valueStd,
      formattedValue: formatValue({
        valueStd: observation.valueStd,
        unit: observation.standardUnit,
        scaleHint: observation.scaleHint,
        precision: observation.displayPrecision
      }),
      metadata: {
        seriesId: definition.seriesId,
        displayName: definition.displayName,
        category: definition.category,
        typeTag: definition.typeTag,
        columnHeader: formatColumnHeader({
          label: 'Current',
          unit: observation.standardUnit,
          scaleHint: observation.scaleHint,
          transform: observation.transformCode,
          seasonalAdj: definition.seasonalAdj
        })
      }
    }));

    ResponseUtils.success(res, {
      observations: formattedData,
      count: formattedData.length,
      seriesId: series_id
    });

  } catch (error) {
    logger.error('Failed to fetch observations:', error);
    ResponseUtils.internalError(res, 'Failed to fetch economic observations');
  }
}));

/**
 * GET /api/econ/features  
 * Gold layer - signals and z-scores for analysis
 */
router.get('/features', asyncHandler(async (req, res) => {
  const { series_id, limit = 50 } = req.query;

  if (!series_id) {
    return ResponseUtils.badRequest(res, 'series_id parameter required');
  }

  try {
    const features = await db
      .select({
        feature: econSeriesFeatures,
        definition: econSeriesDef
      })
      .from(econSeriesFeatures)
      .innerJoin(econSeriesDef, eq(econSeriesFeatures.seriesId, econSeriesDef.seriesId))
      .where(eq(econSeriesFeatures.seriesId, series_id as string))
      .orderBy(desc(econSeriesFeatures.periodEnd))
      .limit(Number(limit));

    const formattedFeatures = features.map(({ feature, definition }) => ({
      periodEnd: feature.periodEnd,
      valueT: feature.valueT,
      deltaT: feature.deltaT,
      levelZ: feature.levelZ,
      changeZ: feature.changeZ,
      levelClass: feature.levelClass,
      trendClass: feature.trendClass,
      multiSignal: feature.multiSignal,
      formattedLevelZ: feature.levelZ >= 0 ? `+${feature.levelZ.toFixed(2)}` : feature.levelZ.toFixed(2),
      formattedChangeZ: feature.changeZ >= 0 ? `+${feature.changeZ.toFixed(2)}` : feature.changeZ.toFixed(2),
      metadata: {
        seriesId: definition.seriesId,
        displayName: definition.displayName,
        refWindow: feature.refWindowMonths,
        pipelineVersion: feature.pipelineVersion
      }
    }));

    ResponseUtils.success(res, {
      features: formattedFeatures,
      count: formattedFeatures.length,
      seriesId: series_id
    });

  } catch (error) {
    logger.error('Failed to fetch features:', error);
    ResponseUtils.internalError(res, 'Failed to fetch economic features');
  }
}));

/**
 * GET /api/econ/dashboard
 * Combined view for dashboard display
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  try {
    // Get latest observations and features for all series
    const dashboardData = await db
      .select({
        definition: econSeriesDef,
        observation: econSeriesObservation,
        feature: econSeriesFeatures
      })
      .from(econSeriesDef)
      .leftJoin(
        econSeriesObservation,
        and(
          eq(econSeriesObservation.seriesId, econSeriesDef.seriesId),
          eq(econSeriesObservation.transformCode, econSeriesDef.defaultTransform)
        )
      )
      .leftJoin(
        econSeriesFeatures,
        and(
          eq(econSeriesFeatures.seriesId, econSeriesDef.seriesId),
          eq(econSeriesFeatures.transformCode, econSeriesDef.defaultTransform)
        )
      );

    // Group by series and get latest data
    const seriesMap = new Map();
    
    for (const row of dashboardData) {
      const seriesId = row.definition.seriesId;
      
      if (!seriesMap.has(seriesId) || 
          (row.observation?.periodEnd && row.observation.periodEnd > seriesMap.get(seriesId)?.observation?.periodEnd)) {
        seriesMap.set(seriesId, row);
      }
    }

    // Format for dashboard display
    const indicators = Array.from(seriesMap.values())
      .filter(row => row.observation && row.feature)
      .map(({ definition, observation, feature }) => ({
        seriesId: definition.seriesId,
        displayName: definition.displayName,
        category: definition.category,
        typeTag: definition.typeTag,
        current: {
          value: observation.valueStd,
          formatted: formatValue({
            valueStd: observation.valueStd,
            unit: observation.standardUnit,
            scaleHint: observation.scaleHint,
            precision: observation.displayPrecision
          }),
          periodEnd: observation.periodEnd
        },
        signals: {
          levelZ: feature.levelZ,
          changeZ: feature.changeZ,
          levelClass: feature.levelClass,
          trendClass: feature.trendClass,
          multiSignal: feature.multiSignal,
          formattedLevelZ: feature.levelZ >= 0 ? `+${feature.levelZ.toFixed(2)}` : feature.levelZ.toFixed(2),
          formattedChangeZ: feature.changeZ >= 0 ? `+${feature.changeZ.toFixed(2)}` : feature.changeZ.toFixed(2)
        },
        metadata: {
          columnHeader: formatColumnHeader({
            label: 'Current',
            unit: observation.standardUnit,
            scaleHint: observation.scaleHint,
            transform: observation.transformCode,
            seasonalAdj: definition.seasonalAdj
          })
        }
      }));

    ResponseUtils.success(res, {
      indicators,
      count: indicators.length,
      timestamp: new Date().toISOString(),
      source: 'Economic Data Model v3.2'
    });

  } catch (error) {
    logger.error('Failed to fetch dashboard data:', error);
    ResponseUtils.internalError(res, 'Failed to fetch economic dashboard');
  }
}));

/**
 * GET /api/econ/series-definitions
 * Metadata for all series
 */
router.get('/series-definitions', asyncHandler(async (req, res) => {
  try {
    const definitions = await db.select().from(econSeriesDef);
    
    ResponseUtils.success(res, {
      definitions,
      count: definitions.length
    });

  } catch (error) {
    logger.error('Failed to fetch series definitions:', error);
    ResponseUtils.internalError(res, 'Failed to fetch series definitions');
  }
}));

/**
 * GET /api/econ/sparkline
 * Monthly resampled data for inline sparklines (12-month trends)
 */
router.get('/sparkline', asyncHandler(async (req, res) => {
  const { seriesId, months = 12, transform = 'LEVEL' } = req.query;

  if (!seriesId || typeof seriesId !== 'string') {
    return res.json({
      success: true,
      data: [],
      meta: { seriesId: seriesId || 'unknown', transform, months: parseInt(months as string), points: 0 },
      warning: 'missing_series_id'
    });
  }

  try {
    // Get default transform from series definition if not provided
    let finalTransform = transform;
    if (transform === 'LEVEL') {
      try {
        const seriesDef = await db
          .select({ defaultTransform: econSeriesDef.defaultTransform })
          .from(econSeriesDef)
          .where(eq(econSeriesDef.seriesId, seriesId))
          .limit(1);
        
        if (seriesDef.length > 0) {
          finalTransform = seriesDef[0].defaultTransform || 'LEVEL';
        }
      } catch (error) {
        logger.warn(`Failed to get series definition for ${seriesId}:`, error);
      }
    }

    // Query Silver layer with monthly resampling
    const monthsInt = parseInt(months as string);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsInt);
    
    const observations = await db
      .select({
        periodEnd: econSeriesObservation.periodEnd,
        valueStd: econSeriesObservation.valueStd
      })
      .from(econSeriesObservation)
      .where(
        and(
          eq(econSeriesObservation.seriesId, seriesId),
          gte(econSeriesObservation.periodEnd, cutoffDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(econSeriesObservation.periodEnd))
      .limit(50);

    // Transform data for client (latest points first, then reverse for chronological order)
    const data = observations
      .reverse() // Chronological order for sparkline
      .map((row) => ({
        t: Date.parse(row.periodEnd), // epoch milliseconds
        date: row.periodEnd,
        value: parseFloat(row.valueStd?.toString() || '0') || 0
      }));

    res.json({
      success: true,
      data,
      meta: {
        seriesId,
        transform: finalTransform,
        months: monthsInt,
        points: data.length
      },
      cached: false
    });

  } catch (error) {
    logger.error(`Failed to fetch sparkline for ${seriesId}:`, error);
    
    // Return empty data on error (never return error response)
    res.json({
      success: true,
      data: [],
      meta: {
        seriesId,
        transform: finalTransform,
        months: parseInt(months as string),
        points: 0
      },
      warning: 'data_unavailable'
    });
  }
}));

export { router as economicDataRoutes };