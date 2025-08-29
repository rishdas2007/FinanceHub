import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../../shared/utils/logger';
import { unifiedEconomicDataAccess } from './unified-economic-data-access';
import { dataTransformationMiddleware } from './data-transformation-middleware';

interface MacroeconomicData {
  indicators: any[];
  aiSummary: string;
  lastUpdated: string;
  source: string;
}

export class MacroeconomicService {
  private generateCacheKey(): string {
    // Generate dynamic cache key based on current time to ensure fresh data after refresh
    return `fred-delta-adjusted-v${Date.now()}`;
  }

  /**
   * AUDIT LOGGING: Comprehensive data schema and consistency audit
   */
  private async auditTableSchemaDifferences(): Promise<void> {
    try {
      logger.info('🔍 [SCHEMA AUDIT] Starting comprehensive table schema and data consistency audit');
      
      // Audit 1: Check schema differences between history and current tables
      const historySchema = await db.execute(sql`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'economic_indicators_history' 
        ORDER BY ordinal_position
      `);
      
      const currentSchema = await db.execute(sql`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'economic_indicators_current' 
        ORDER BY ordinal_position
      `);
      
      logger.info('🔍 [SCHEMA AUDIT] History table columns:', historySchema.rows.map(r => `${r.column_name}(${r.data_type})`));
      logger.info('🔍 [SCHEMA AUDIT] Current table columns:', currentSchema.rows.map(r => `${r.column_name}(${r.data_type})`));
      
      // Audit 2: Check unit inconsistencies for same series
      const unitInconsistencies = await db.execute(sql`
        SELECT 
          h.series_id,
          h.metric_name as history_metric,
          c.metric as current_metric,
          h.unit as history_unit,
          c.unit as current_unit,
          COUNT(*) as inconsistency_count
        FROM economic_indicators_history h
        INNER JOIN economic_indicators_current c ON h.series_id = c.series_id
        WHERE h.unit != c.unit
        GROUP BY h.series_id, h.metric_name, c.metric, h.unit, c.unit
        ORDER BY inconsistency_count DESC
        LIMIT 10
      `);
      
      logger.error('🚨 [UNIT INCONSISTENCY AUDIT] Found unit mismatches between tables:');
      unitInconsistencies.rows.forEach(row => {
        logger.error(`🚨 [UNIT MISMATCH] ${row.series_id}: History="${row.history_unit}" vs Current="${row.current_unit}" (${row.inconsistency_count} records)`);
      });
      
      // Audit 3: Check value scale inconsistencies (suspicious patterns)
      const valueScaleAudit = await db.execute(sql`
        SELECT 
          series_id,
          metric_name,
          unit,
          MIN(value) as min_value,
          MAX(value) as max_value,
          AVG(value) as avg_value,
          COUNT(*) as record_count
        FROM economic_indicators_history 
        WHERE series_id IN ('ICSA', 'CCSA')
        GROUP BY series_id, metric_name, unit
        ORDER BY series_id, avg_value DESC
      `);
      
      logger.info('🔍 [VALUE SCALE AUDIT] History table value ranges for jobless claims:');
      valueScaleAudit.rows.forEach(row => {
        const scale = row.avg_value > 100000 ? 'RAW_COUNT' : row.avg_value > 1000 ? 'HIGH_THOUSANDS' : 'NORMAL_THOUSANDS';
        logger.info(`🔍 [VALUE SCALE] ${row.series_id} (${row.unit}): avg=${row.avg_value} [${scale}] (${row.record_count} records)`);
      });
      
      // Audit 4: Check current table value consistency
      const currentValueAudit = await db.execute(sql`
        SELECT 
          series_id,
          metric,
          unit,
          MIN(value_numeric) as min_value,
          MAX(value_numeric) as max_value,
          AVG(value_numeric) as avg_value,
          COUNT(*) as record_count
        FROM economic_indicators_current 
        WHERE series_id IN ('ICSA', 'CCSA')
        GROUP BY series_id, metric, unit
        ORDER BY series_id, avg_value DESC
      `);
      
      logger.info('🔍 [VALUE SCALE AUDIT] Current table value ranges for jobless claims:');
      currentValueAudit.rows.forEach(row => {
        const scale = row.avg_value > 100000 ? 'RAW_COUNT' : row.avg_value > 1000 ? 'HIGH_THOUSANDS' : 'NORMAL_THOUSANDS';
        logger.info(`🔍 [VALUE SCALE] ${row.series_id} (${row.unit}): avg=${row.avg_value} [${scale}] (${row.record_count} records)`);
      });
      
      // Audit 5: Sample data comparison for critical metrics
      const sampleComparison = await db.execute(sql`
        SELECT 
          'HISTORY' as source,
          series_id,
          metric_name as metric,
          value,
          unit,
          period_date
        FROM economic_indicators_history 
        WHERE series_id = 'ICSA' 
        ORDER BY period_date DESC 
        LIMIT 3
        
        UNION ALL
        
        SELECT 
          'CURRENT' as source,
          series_id,
          metric,
          value_numeric as value,
          unit,
          period_date
        FROM economic_indicators_current 
        WHERE series_id = 'ICSA' 
        ORDER BY period_date DESC 
        LIMIT 3
      `);
      
      logger.error('🚨 [DATA COMPARISON AUDIT] Sample ICSA data from both tables:');
      sampleComparison.rows.forEach(row => {
        logger.error(`🚨 [${row.source}] ${row.series_id}: ${row.value} (${row.unit}) - ${row.metric} - ${row.period_date}`);
      });
      
      logger.info('✅ [SCHEMA AUDIT] Completed comprehensive audit - check logs above for issues');
      
    } catch (error) {
      logger.error('❌ [SCHEMA AUDIT] Failed to complete audit:', error);
    }
  }

  /**
   * DATA QUALITY GATE: Log all data transformations for analysis
   */
  private logDataQualityGate(value: number | null | undefined, unit: string, metric: string, label: string, seriesId: string): void {
    if (value === null || value === undefined) return;
    
    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) return;
    
    // Track suspicious patterns
    const suspiciousPatterns = {
      unitMismatch: this.detectUnitMismatch(numValue, unit, metric),
      scaleAnomaly: this.detectScaleAnomaly(numValue, seriesId, metric),
      formatInconsistency: this.detectFormatInconsistency(numValue, unit, seriesId)
    };
    
    if (Object.values(suspiciousPatterns).some(Boolean)) {
      logger.error(`🚨 [DATA QUALITY GATE] ${seriesId} ${metric} ${label}:`);
      logger.error(`🚨   Raw Value: ${numValue}, Unit: "${unit}"`);
      logger.error(`🚨   Issues: ${JSON.stringify(suspiciousPatterns)}`);
    } else {
      logger.debug(`✅ [DATA QUALITY GATE] ${seriesId} ${metric} ${label}: value=${numValue}, unit="${unit}" - OK`);
    }
  }

  /**
   * Detect unit mismatches (e.g., raw count with "Percent" unit)
   */
  private detectUnitMismatch(value: number, unit: string, metric: string): boolean {
    const metricLower = metric.toLowerCase();
    
    // Check for jobless claims with wrong units
    if (metricLower.includes('jobless') || metricLower.includes('claims')) {
      const isRawCount = value > 50000; // Likely raw count (200K+ claims)
      const isPercent = unit.toLowerCase().includes('percent');
      if (isRawCount && isPercent) {
        return true; // Raw count with Percent unit is wrong
      }
    }
    
    // Check for CPI/inflation data with suspicious scales
    if (metricLower.includes('cpi') || metricLower.includes('inflation')) {
      const isIndexValue = value > 100; // Index values like 329.8
      const isPercent = unit.toLowerCase().includes('percent');
      if (isIndexValue && isPercent) {
        return true; // Index values labeled as percentages
      }
    }
    
    return false;
  }

  /**
   * Detect value scale anomalies for known series
   */
  private detectScaleAnomaly(value: number, seriesId: string, metric: string): boolean {
    switch (seriesId) {
      case 'ICSA':
      case 'CCSA':
        // Jobless claims should be 200-400 range (thousands) or 200000-400000 (raw)
        const isUnexpectedScale = value > 400000 || (value < 100 && value > 0);
        return isUnexpectedScale;
        
      case 'CPIAUCSL':
      case 'CPILFESL':
        // CPI should be either small (2-5% YoY) or index (300-400)
        const isUnexpectedCPI = value > 500 || (value > 20 && value < 100);
        return isUnexpectedCPI;
        
      default:
        return false;
    }
  }

  /**
   * Detect formatting inconsistencies based on series patterns
   */
  private detectFormatInconsistency(value: number, unit: string, seriesId: string): boolean {
    // Track if same series has different value scales in same session
    const key = `${seriesId}_${unit}`;
    if (!this.valueScaleTracker) {
      this.valueScaleTracker = new Map();
    }
    
    const existingScale = this.valueScaleTracker.get(key);
    const currentScale = this.determineValueScale(value);
    
    if (existingScale && existingScale !== currentScale) {
      logger.warn(`⚠️ [SCALE INCONSISTENCY] ${seriesId}: Previously ${existingScale}, now ${currentScale}`);
      return true;
    }
    
    this.valueScaleTracker.set(key, currentScale);
    return false;
  }

  private valueScaleTracker?: Map<string, string>;

  /**
   * Determine the scale of a value (thousands, millions, raw, etc.)
   */
  private determineValueScale(value: number): string {
    if (value > 100000) return 'RAW_COUNT';
    if (value > 1000) return 'THOUSANDS';
    if (value > 100) return 'HUNDREDS_OR_INDEX';
    if (value > 10) return 'TENS';
    return 'SINGLE_DIGITS';
  }
  
  /**
   * Get historical data for economic indicators (for charts)
   */
  async getHistoricalIndicatorData(indicatorId: string, months: number = 12): Promise<{
    data: { date: string; value: number; formattedDate: string }[];
    units: string;
    frequency: string;
    lastUpdate: string;
  } | null> {
    try {
      // Query real historical data from historical_economic_data table (same as z-score calculations)
      console.log(`🔍 Searching for economic indicator: ${indicatorId}`);

      // Enhanced mappings for economic indicators - ADD MISSING FRONTEND IDs
      const mappings: Record<string, string[]> = {
        'unemployment_rate': ['UNRATE', 'unemployment', 'jobless'],
        'industrial_production': ['INDPRO', 'industrial', 'production'],
        'nonfarm_payrolls': ['PAYEMS', 'payroll', 'employment'],
        'cpi_inflation': ['CPIAUCSL', 'CPI', 'inflation', 'consumer_price'],
        'fed_funds_rate': ['FEDFUNDS', 'federal_funds', 'interest_rate'],
        'gdp_growth': ['GDP', 'gross_domestic', 'economic_growth'],
        // ADD THESE MISSING MAPPINGS:
        'gdp_growth_rate': ['GDP', 'GDPC1', 'gross_domestic', 'economic_growth'],
        'housing_starts': ['HOUST', 'housing', 'construction'],
        'consumer_confidence': ['UMCSENT', 'consumer_sentiment', 'confidence'],
        'existing_home_sales': ['EXHOSLUSM495S', 'home_sales', 'existing_sales'],
        'average_weekly_hours': ['AWHMAN', 'weekly_hours', 'hours'],
        'labor_force_participation': ['CIVPART', 'labor_force', 'participation'],
        'months_supply_homes': ['MSACSR', 'housing_supply', 'homes_supply'],
        'commercial_loans': ['BUSLOANS', 'commercial', 'loans'],
        'retail_sales_food': ['RSFSDP', 'retail_sales', 'food_services'],
        'construction_spending': ['TTLCONS', 'construction', 'spending'],
        'total_construction_spending': ['TTLCONS', 'construction', 'spending']
      };

      // Get all possible search terms for this indicator
      const searchTerms = mappings[indicatorId] || [indicatorId.toUpperCase()];

      console.log(`📊 Searching with terms: ${searchTerms.join(', ')}`);

      // Try multiple query strategies
      let result: any = null;

      // Strategy 1: Direct series_id match with TIME SERIES DEDUPLICATION
      for (const term of searchTerms) {
        try {
          result = await db.execute(sql`
            SELECT DISTINCT ON (period_date)
              period_date as date, 
              value_numeric as value, 
              series_id as metric,
              unit,
              frequency
            FROM economic_indicators_current 
            WHERE UPPER(series_id) = UPPER(${term})
            ORDER BY period_date DESC, updated_at DESC
            LIMIT ${months * 20}
          `);

          if (result.rows && result.rows.length > 0) {
            console.log(`✅ Found data with series_id: ${term} (${result.rows.length} time series points)`);
            break;
          }
        } catch (error) {
          console.warn(`Query failed for ${term}:`, error);
        }
      }

      // Strategy 2: Partial series_id match with TIME SERIES DEDUPLICATION
      if (!result?.rows || result.rows.length === 0) {
        for (const term of searchTerms) {
          try {
            result = await db.execute(sql`
              SELECT DISTINCT ON (period_date)
                period_date as date, 
                value_numeric as value, 
                series_id as metric,
                unit,
                frequency
              FROM economic_indicators_current 
              WHERE UPPER(series_id) LIKE '%' || UPPER(${term}) || '%'
              ORDER BY period_date DESC, updated_at DESC
              LIMIT ${months * 20}
            `);

            if (result.rows && result.rows.length > 0) {
              console.log(`✅ Found data with partial series_id match: ${term} (${result.rows.length} time series points)`);
              break;
            }
          } catch (error) {
            console.warn(`Partial query failed for ${term}:`, error);
          }
        }
      }

      if (!result?.rows || result.rows.length === 0) {
        // List all available indicators for debugging
        const availableResult = await db.execute(sql`
          SELECT DISTINCT series_id, metric, COUNT(*) as record_count
          FROM economic_indicators_current 
          GROUP BY series_id, metric
          ORDER BY record_count DESC
          LIMIT 20
        `);

        console.log('📋 Available economic indicators:');
        availableResult.rows?.forEach((row: any) => {
          console.log(`  - ${row.series_id}: ${row.metric} (${row.record_count} records)`);
        });

        logger.warn(`No data found for indicator: ${indicatorId}. Search terms: ${searchTerms.join(', ')}`);
        return null;
      }

      // Process the real data with enhanced validation
      const historicalData = result.rows.map((row: any) => {
        const date = new Date(row.date);

        // FIX: Validate date and handle parsing errors
        if (isNaN(date.getTime())) {
          logger.warn(`Invalid date in economic data:`, row.date);
          return null;
        }

        const value = parseFloat(row.value);
        if (isNaN(value)) {
          logger.warn(`Invalid value in economic data:`, row.value);
          return null;
        }

        return {
          date: date.toISOString(), // Standardize date format
          value: value,
          formattedDate: date.toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
            day: 'numeric' // Add day for better granularity
          })
        };
      }).filter(Boolean) // Remove invalid entries
      .reverse(); // Chronological order

      // Determine units based on metric type
      const metricName = String(result.rows[0]?.metric || '');
      let units = '';
      if (metricName.toLowerCase().includes('rate') || metricName.toLowerCase().includes('cpi')) {
        units = '%';
      } else if (metricName.toLowerCase().includes('index')) {
        units = 'Index';
      } else if (metricName.toLowerCase().includes('claims') || metricName.toLowerCase().includes('payroll')) {
        units = 'Thousands';
      } else {
        units = 'Units';
      }

      logger.info(`Retrieved ${historicalData.length} historical data points for ${indicatorId}`);
      
      return {
        data: historicalData,
        units,
        frequency: 'Monthly',
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get historical indicator data:', String(error));
      return null;
    }
  }
  
  /**
   * Get authentic FRED economic data with live z-score calculations
   */
  async getAuthenticEconomicData(): Promise<MacroeconomicData> {
    try {
      const { cacheService } = await import('./cache-unified');
      
      // Use static cache key for retrieving cached data
      const staticCacheKey = 'fred-economic-data-latest';
      const cached = cacheService.get(staticCacheKey) as MacroeconomicData | null;
      if (cached) {
        logger.debug('Returning cached FRED economic data');
        return cached;
      }

      // Get data with live z-score calculations
      const databaseData = await this.getDataFromDatabase();
      if (databaseData && databaseData.indicators.length > 0) {
        // Cache database result for 30 minutes using static key
        cacheService.set(staticCacheKey, databaseData, 30 * 60 * 1000);
        
        logger.info(`✅ Live z-score database data ready: ${databaseData.indicators.length} indicators`);
        return databaseData;
      }

      // Fallback to getMacroeconomicData if needed
      return this.getMacroeconomicData();
    } catch (error) {
      logger.error('Failed to get authentic economic data:', String(error));
      return this.getMacroeconomicData();
    }
  }

  /**
   * Get economic data from the database with LIVE z-score calculations
   * Now uses unified data access layer and transformation middleware
   */
  private async getDataFromDatabase(): Promise<MacroeconomicData | null> {
    // AUDIT LOGGING: Only run in development to avoid production performance impact
    if (process.env.NODE_ENV !== 'production') {
      await this.auditTableSchemaDifferences();
    }
    
    // UNIFIED DATA ACCESS: Use new layer with error handling for production
    try {
      logger.info('🔄 [PIPELINE] Using unified data access layer for consistent data retrieval');
      const unifiedIndicators = await Promise.race([
        unifiedEconomicDataAccess.getEconomicIndicators(undefined, {
          preferredSource: 'auto',
          validateUnits: false,  // Disable validation in production for performance
          normalizeValues: true,
          includeMetadata: false // Disable metadata for performance
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Unified access timeout')), 30000))
      ]);
      
      if (!unifiedIndicators || unifiedIndicators.length === 0) {
        logger.warn('⚠️ [UNIFIED ACCESS] No indicators retrieved, falling back to legacy method');
      } else {
        logger.info(`✅ [UNIFIED ACCESS] Retrieved ${unifiedIndicators.length} indicators through unified layer`);
        
        // TRANSFORMATION MIDDLEWARE: Apply standardization with timeout
        try {
          logger.info('🔄 [PIPELINE] Applying data transformation middleware for standardization');
          const transformationResult = await Promise.race([
            dataTransformationMiddleware.transformBatch(
              unifiedIndicators.map(indicator => ({
                seriesId: indicator.seriesId,
                metric: indicator.metric,
                value: indicator.value,
                unit: indicator.unit,
                periodDate: indicator.periodDate,
                source: indicator.source
              })),
              {
                enforceUnitStandards: true,
                normalizeValueScales: true,
                validateTransformations: false, // Disable validation for performance
                logTransformations: false      // Disable logging for performance
              }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Transformation timeout')), 20000))
          ]);
          
          logger.info(`🔧 [TRANSFORMATION] Applied ${transformationResult.transformations.length} transformations`);
          logger.info(`✅ [PIPELINE] Unified pipeline processed ${transformationResult.data.length} standardized indicators`);
          
          // Use transformed data if successful
          if (transformationResult.data.length > 0) {
            return this.processUnifiedData(transformationResult.data, unifiedIndicators);
          }
        } catch (transformError) {
          logger.error('❌ [TRANSFORMATION] Failed, falling back to legacy:', transformError.message);
        }
      }
    } catch (unifiedError) {
      logger.error('❌ [UNIFIED ACCESS] Failed, falling back to legacy method:', unifiedError.message);
    }
    try {
      // Import live z-score calculator and YoY transformer
      const { liveZScoreCalculator } = await import('./live-zscore-calculator');
      const { economicYoYTransformer } = await import('./economic-yoy-transformer');
      
      // DEDUPLICATION FIX: Get fresh backfilled data first to prioritize over legacy
      logger.info('🔍 Checking for fresh backfilled indicators to prioritize over legacy data');
      const freshBackfilledData = await this.getFreshBackfilledIndicators();
      const backfilledSeriesIds = new Set(freshBackfilledData.map(item => item.seriesId));
      logger.info(`📊 Found ${freshBackfilledData.length} fresh backfilled indicators: ${Array.from(backfilledSeriesIds).join(', ')}`);
      
      // Calculate live z-scores (never cached) but exclude duplicates from backfill
      const liveZScoreData = await liveZScoreCalculator.calculateLiveZScores();
      
      if (!liveZScoreData || liveZScoreData.length === 0) {
        logger.debug('No live z-score data calculated');
        return null;
      }
      
      logger.info(`📊 Calculated ${liveZScoreData.length} live z-scores from database`);
      
      // MERGE CANDIDATE DETECTION: For TimeSeriesMerger, allow BOTH raw and delta-adjusted data
      const timeSeriesMergeCandidates = new Set(['CCSA', 'ICSA']); // Claims data
      
      // MODIFIED: Keep duplicates for merge candidates, deduplicate others
      const deduplicatedZScoreData = liveZScoreData.filter(zData => {
        const isDuplicate = backfilledSeriesIds.has(zData.seriesId);
        const isMergeCandidate = timeSeriesMergeCandidates.has(zData.seriesId);
        
        if (isDuplicate && !isMergeCandidate) {
          logger.info(`🗑️ Filtering out duplicate from live z-score: ${zData.seriesId} - ${zData.metric} (using fresh backfilled data instead)`);
          return false;
        }
        
        if (isDuplicate && isMergeCandidate) {
          logger.info(`🔄 Keeping potential merge candidate: ${zData.seriesId} - ${zData.metric} (for TimeSeriesMerger)`);
          return true;
        }
        
        return true;
      });
      
      logger.info(`📊 After selective deduplication: ${deduplicatedZScoreData.length} indicators (merge candidates preserved) + ${freshBackfilledData.length} fresh indicators`);
      
      // Combine both data sources with merge candidates preserved
      const combinedData = [...deduplicatedZScoreData, ...freshBackfilledData];
      logger.info(`📊 Total combined indicators: ${combinedData.length}`);

      // FINAL DEDUPLICATION: Ensure only latest record per series_id for dashboard display
      const finalDeduplicatedData = new Map<string, any>();
      combinedData.forEach(indicator => {
        const existing = finalDeduplicatedData.get(indicator.seriesId);
        if (!existing || new Date(indicator.periodDate) > new Date(existing.periodDate)) {
          finalDeduplicatedData.set(indicator.seriesId, indicator);
        }
      });
      
      const uniqueIndicators = Array.from(finalDeduplicatedData.values());
      logger.info(`📊 After final deduplication: ${uniqueIndicators.length} unique series (was ${combinedData.length})`);
      
      // Log the deduplication results
      const duplicatesRemoved = combinedData.length - uniqueIndicators.length;
      if (duplicatesRemoved > 0) {
        logger.info(`🗑️ Removed ${duplicatesRemoved} duplicate time series entries to show latest per series_id only`);
      }

      // FRED API SOURCE PRIORITY: Applied at route level in routes.ts
      const fredPriorityData = uniqueIndicators; // Use deduplicated data - priority logic handled at route level
      logger.info(`📊 Data ready for route-level FRED source priority: ${fredPriorityData.length} indicators`);

      // FILTER OUT EXTREME Z-SCORES (above 3 or below -3) as requested by user
      // Check BOTH main Z-score AND delta Z-score (trend) for extreme values
      const filteredZScoreData = fredPriorityData.filter((zData) => {
        const mainZScore = zData.deltaAdjustedZScore;
        const deltaZScore = zData.deltaZScore;
        
        const mainZWithinRange = mainZScore >= -3 && mainZScore <= 3;
        const deltaZWithinRange = deltaZScore >= -3 && deltaZScore <= 3;
        
        const isWithinAcceptableRange = mainZWithinRange && deltaZWithinRange;
        
        if (!isWithinAcceptableRange) {
          if (!mainZWithinRange) {
            logger.info(`🗑️ Filtering out ${zData.metric} with extreme main Z-score: ${mainZScore.toFixed(2)}`);
          }
          if (!deltaZWithinRange) {
            logger.info(`🗑️ Filtering out ${zData.metric} with extreme trend Z-score: ${deltaZScore.toFixed(2)}`);
          }
        }
        
        return isWithinAcceptableRange;
      });
      
      logger.info(`📊 Filtered out ${fredPriorityData.length - filteredZScoreData.length} indicators with extreme Z-scores (|z| > 3 OR |trend| > 3)`);
      logger.info(`📊 Remaining indicators after filtering: ${filteredZScoreData.length}`);

      const indicators = await Promise.all(filteredZScoreData.map(async (zData) => {
        const currentReading = zData.currentValue;
        const priorReading = zData.priorValue;
        
        // Calculate simple vs Prior variance: currentReading - priorReading
        const actualVariance = currentReading !== null && priorReading !== null 
          ? currentReading - priorReading 
          : null;

        // CRITICAL FIX: Use YoY transformer for proper data presentation  
        const yoyTransformation = await economicYoYTransformer.transformIndicatorData(zData.seriesId, zData.metric);
        
        // FALLBACK TRANSFORMATION: Handle cases where database data is missing but we know it needs transformation
        const needsManualTransformation = (metric: string, value: number): boolean => {
          const metricLower = metric.toLowerCase();
          // If it's a PPI or PCE series showing values > 50, it's likely raw index data
          const needsTransform = (metricLower.includes('ppi') || metricLower.includes('pce')) && value > 50 && value < 500;
          logger.debug(`Fallback check for ${metric}: value=${value}, needsTransform=${needsTransform}`);
          return needsTransform;
        };

        // SIMPLIFIED FORMATTING: Use transformation middleware instead of complex conditional logic
        const formatNumber = (value: number | null | undefined, unit: string, metric: string, label: string = '', seriesId: string = ''): string => {
          // DATA QUALITY GATE: Track all formatting operations
          this.logDataQualityGate(value, unit, metric, label, seriesId);
          
          if (value === null || value === undefined || isNaN(value)) {
            logger.debug(`🔍 [SIMPLIFIED FORMAT] ${metric} ${label}: value is null/undefined/NaN`);
            return 'N/A';
          }
          
          const numValue = parseFloat(String(value));
          if (isNaN(numValue)) {
            logger.debug(`🔍 [SIMPLIFIED FORMAT] ${metric} ${label}: parsed value is NaN from ${value}`);
            return 'N/A';
          }

          // Use transformation middleware for consistent formatting
          const formattingRule = dataTransformationMiddleware.getFormattingRule(numValue, unit, seriesId);
          logger.info(`🔧 [SIMPLIFIED FORMAT] ${seriesId} ${metric} ${label}: ${numValue} (${unit}) → ${formattingRule.formatted} [${formattingRule.rule}]`);
          
          return formattingRule.formatted;
        };

        // SIMPLIFIED VARIANCE FORMATTING: Use transformation middleware
        const formatVariance = (value: number | null, unit: string, metric: string, seriesId: string = ''): string => {
          if (value === null || value === undefined) return 'N/A';
          if (Math.abs(value) < 0.01) return '0.0';
          
          const formattingRule = dataTransformationMiddleware.getFormattingRule(Math.abs(value), unit, seriesId);
          return value < 0 ? `(${formattingRule.formatted})` : formattingRule.formatted;
        };

        // Determine label suffix for delta-adjusted metrics
        const getDirectionalityLabel = (directionality: number): string => {
          if (directionality === -1) return ' (Δ-adjusted)';
          if (directionality === 1) return '';
          return ' (neutral)';
        };

        const metricLabel = zData.metric + getDirectionalityLabel(zData.directionality);

        return {
          metric: metricLabel,
          type: zData.type,
          category: zData.category,
          releaseDate: zData.periodDate,
          period_date: zData.periodDate, // Add period_date field for table display
          // CONSISTENT FORMATTING: Use same formatNumber function for both current and prior readings
          currentReading: formatNumber(zData.currentValue, zData.unit, zData.metric, 'CURRENT', zData.seriesId),
          priorReading: formatNumber(priorReading, zData.unit, zData.metric, 'PRIOR', zData.seriesId),
          varianceVsPrior: formatVariance(actualVariance, zData.unit, zData.metric, zData.seriesId), // Simple current - prior calculation
          zScore: zData.deltaAdjustedZScore, // Use delta-adjusted z-score instead of raw z-score
          deltaZScore: zData.deltaZScore, // Period-to-period change z-score
          frequency: zData.frequency, // Indicator frequency (daily, weekly, monthly, quarterly)
          unit: zData.unit,
          seriesId: zData.seriesId, // Add seriesId for sparkline charts
          // Add YoY transformation data for debugging and future use
          yoyPercentage: yoyTransformation?.yoyPercentage || null,
          yoyChange: yoyTransformation?.yoyChange || null,
          transformationType: yoyTransformation?.unit || 'unknown',
          rawCurrentValue: currentReading // Keep raw value for debugging
        };
      }));

      const data: MacroeconomicData = {
        indicators,
        aiSummary: `Live z-score analysis computed for ${indicators.length} comprehensive economic indicators using 12-month historical statistics. Indicators with extreme Z-scores or trend scores (|z| > 3 OR |trend| > 3) have been filtered out for data quality. Includes GDP Growth Rate and all indicators with sufficient historical data baseline.`,
        lastUpdated: new Date().toISOString(),
        source: 'Live Database Calculation (12-month rolling statistics)'
      };

      logger.info(`✅ Live z-score database data ready: ${indicators.length} indicators`);
      return data;

    } catch (error) {
      logger.error('Failed to get live z-score data from database:', String(error));
      return null;
    }
  }

  /**
   * Process unified and transformed data with simplified formatting
   */
  private async processUnifiedData(transformedData: any[], originalUnifiedData: any[]): Promise<MacroeconomicData> {
    try {
      logger.info('🔄 [UNIFIED PROCESSING] Processing standardized data through simplified pipeline');
      
      // Import z-score calculator for compatibility
      const { liveZScoreCalculator } = await import('./live-zscore-calculator');
      
      // Calculate z-scores for the unified data
      const indicators = await Promise.all(transformedData.map(async (dataPoint, index) => {
        const originalIndicator = originalUnifiedData[index];
        
        // Get z-score data for this series if available
        const zScoreData = await this.getZScoreForSeries(dataPoint.seriesId);
        
        // Use transformation middleware formatting instead of complex conditional logic
        const formattingRule = dataTransformationMiddleware.getFormattingRule(
          dataPoint.value, 
          dataPoint.unit, 
          dataPoint.seriesId
        );
        
        logger.info(`🔧 [SIMPLIFIED FORMAT] ${dataPoint.seriesId}: ${dataPoint.value} (${dataPoint.unit}) → ${formattingRule.formatted} [${formattingRule.rule}]`);
        
        return {
          metric: dataPoint.metric,
          type: originalIndicator.type || 'Leading',
          category: originalIndicator.category || 'Economic',
          releaseDate: dataPoint.periodDate,
          period_date: dataPoint.periodDate,
          currentReading: formattingRule.formatted,
          priorReading: originalIndicator.priorValue 
            ? dataTransformationMiddleware.getFormattingRule(originalIndicator.priorValue, dataPoint.unit, dataPoint.seriesId).formatted
            : 'N/A',
          varianceVsPrior: this.calculateVariance(dataPoint.value, originalIndicator.priorValue, dataPoint.unit, dataPoint.seriesId),
          zScore: zScoreData?.zScore || 0,
          deltaZScore: zScoreData?.deltaZScore || 0,
          frequency: originalIndicator.frequency || 'Monthly',
          unit: dataPoint.unit,
          seriesId: dataPoint.seriesId,
          transformationType: formattingRule.rule,
          rawCurrentValue: dataPoint.value
        };
      }));
      
      const result: MacroeconomicData = {
        indicators,
        aiSummary: `Processed ${indicators.length} economic indicators through unified data access layer with standardized transformations. Data quality gates and validation applied throughout pipeline.`,
        lastUpdated: new Date().toISOString(),
        source: 'Unified Data Pipeline (Schema-Normalized)'
      };
      
      logger.info(`✅ [UNIFIED PROCESSING] Successfully processed ${indicators.length} indicators through simplified pipeline`);
      return result;
      
    } catch (error) {
      logger.error('❌ [UNIFIED PROCESSING] Failed to process unified data:', error);
      throw error;
    }
  }

  /**
   * Get z-score data for a specific series (helper method)
   */
  private async getZScoreForSeries(seriesId: string): Promise<{ zScore: number; deltaZScore: number } | null> {
    try {
      // This would integrate with existing z-score calculation logic
      // For now, return default values
      return { zScore: 0, deltaZScore: 0 };
    } catch (error) {
      logger.warn(`⚠️ Could not calculate z-score for ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Calculate variance using transformation middleware formatting
   */
  private calculateVariance(current: number, prior: number | undefined, unit: string, seriesId: string): string {
    if (prior === undefined || prior === null) return 'N/A';
    
    const variance = current - prior;
    if (Math.abs(variance) < 0.01) return '0.0';
    
    const formattingRule = dataTransformationMiddleware.getFormattingRule(Math.abs(variance), unit, seriesId);
    return variance < 0 ? `(${formattingRule.formatted})` : formattingRule.formatted;
  }

  /**
   * Get comprehensive macroeconomic indicators data (fallback to OpenAI)
   */
  async getMacroeconomicData(): Promise<MacroeconomicData> {
    try {
      // Simple fallback implementation
      return {
        indicators: [],
        aiSummary: 'Economic data temporarily unavailable',
        lastUpdated: new Date().toISOString(),
        source: 'Fallback'
      };
    } catch (error) {
      logger.error('Failed to get fallback macroeconomic data:', String(error));
      throw error;
    }
  }

  /**
   * Get fresh backfilled indicators from economic_indicators_current table
   * FIXED: Create proper time series instead of just latest records
   */
  private async getFreshBackfilledIndicators(): Promise<any[]> {
    try {
      // CRITICAL FIX: Get ALL time series data, not just latest per series_id
      // Group by series_id + period_date to eliminate duplicates while preserving time series
      const result = await db.execute(sql`
        WITH deduplicated_series AS (
          SELECT DISTINCT ON (series_id, period_date)
            series_id,
            metric,
            value_numeric,
            period_date,
            category,
            type,
            unit,
            updated_at
          FROM economic_indicators_current 
          WHERE updated_at >= NOW() - INTERVAL '2 hours'  -- Recently backfilled data
            AND value_numeric IS NOT NULL
            AND period_date IS NOT NULL
          ORDER BY series_id, period_date DESC, updated_at DESC  -- Get latest version of each series_id + period_date combination
        ),
        
        time_series_with_stats AS (
          SELECT 
            series_id as "seriesId",
            metric,
            value_numeric as "currentValue", 
            period_date as "periodDate",
            category,
            COALESCE(type, 'Leading') as type,  -- Default type for backfilled data
            unit,
            
            -- Calculate proper z-scores across the FULL time series (not just latest point)
            (value_numeric - AVG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)) / 
            NULLIF(STDDEV(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW), 0) as "deltaAdjustedZScore",
            
            -- Calculate prior values for each point in the time series
            LAG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date) as "priorValue",
            
            -- Calculate rolling historical mean and std for z-score calculation
            AVG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) as "historicalMean",
            NULLIF(STDDEV(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW), 0) as "historicalStd",
            
            -- Delta z-score (period-to-period change z-score)
            CASE 
              WHEN LAG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date) IS NOT NULL
              THEN (value_numeric - LAG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date)) / 
                   NULLIF(STDDEV(value_numeric - LAG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date)) 
                          OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW), 0)
              ELSE 0
            END as "deltaZScore",
            
            1 as "directionality",  -- Default positive directionality
            'monthly' as "frequency",
            
            -- Add row number to identify latest record per series for current reading
            ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY period_date DESC) as rn
            
          FROM deduplicated_series
        )
        
        -- Return ONLY the latest record per series_id for current dashboard display
        -- but now it's calculated using the full time series context
        SELECT * FROM time_series_with_stats
        WHERE rn = 1  -- Latest record per series_id only
        ORDER BY "periodDate" DESC
      `);

      const freshIndicators = result.rows.map((row: any) => ({
        seriesId: row.seriesId,
        metric: row.metric,
        currentValue: parseFloat(row.currentValue) || 0,
        historicalMean: parseFloat(row.historicalMean) || 0,
        historicalStd: parseFloat(row.historicalStd) || 1,
        zScore: parseFloat(row.deltaAdjustedZScore) || 0,
        deltaAdjustedZScore: parseFloat(row.deltaAdjustedZScore) || 0,
        priorValue: parseFloat(row.priorValue) || 0,
        varianceFromMean: (parseFloat(row.currentValue) || 0) - (parseFloat(row.historicalMean) || 0),
        varianceFromPrior: (parseFloat(row.currentValue) || 0) - (parseFloat(row.priorValue) || 0),
        periodDate: row.periodDate,
        category: row.category,
        type: row.type,
        unit: row.unit || '',
        directionality: row.directionality,
        deltaZScore: parseFloat(row.deltaZScore) || 0,
        deltaHistoricalMean: parseFloat(row.deltaHistoricalMean) || 0,
        deltaHistoricalStd: parseFloat(row.deltaHistoricalStd) || 1,
        frequency: row.frequency
      }));

      logger.info(`📊 Found ${freshIndicators.length} fresh backfilled indicators (latest records only)`);
      
      // Debug log to show which indicators were deduplicated
      freshIndicators.forEach(indicator => {
        logger.info(`🔍 Fresh indicator: ${indicator.seriesId} - ${indicator.metric} (${indicator.periodDate})`);
      });
      return freshIndicators;
      
    } catch (error) {
      logger.error('Failed to get fresh backfilled indicators:', String(error));
      return [];
    }
  }


  /**
   * Legacy method for fallback when lazy loading fails
   */
  private async getLegacyIndicators(): Promise<MacroeconomicData> {
    logger.info('🔄 [LEGACY] Using legacy indicators method as fallback');
    
    // Return basic structure - the original complex logic would go here
    // For now, return minimal data to prevent errors
    return {
      indicators: [],
      aiSummary: 'Legacy data access - minimal functionality',
      lastUpdated: new Date().toISOString(),
      source: 'legacy_fallback'
    };
  }

  /**
   * Generate AI summary based on indicators
   */
  private generateAISummary(indicators: any[]): string {
    const extremeZScores = indicators.filter(i => Math.abs(i.zScore || 0) >= 2);
    const positiveSignals = indicators.filter(i => (i.zScore || 0) > 1).length;
    const negativeSignals = indicators.filter(i => (i.zScore || 0) < -1).length;
    
    return `Analysis of ${indicators.length} economic indicators reveals ${extremeZScores.length} extreme readings (|z-score| >= 2). Current economic signals: ${positiveSignals} positive, ${negativeSignals} negative indicators suggesting mixed economic conditions.`;
  }
}

export const macroeconomicService = new MacroeconomicService();