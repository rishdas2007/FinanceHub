import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../../shared/utils/logger';

interface MacroeconomicData {
  indicators: any[];
  aiSummary: string;
  lastUpdated: string;
  source: string;
}

export class MacroeconomicService {
  private readonly CACHE_KEY = `fred-delta-adjusted-v${Date.now()}`;
  
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

      // Strategy 1: Direct series_id match
      for (const term of searchTerms) {
        try {
          result = await db.execute(sql`
            SELECT 
              period_date as date, 
              value_numeric as value, 
              series_id as metric,
              unit,
              frequency
            FROM economic_indicators_current 
            WHERE UPPER(series_id) = UPPER(${term})
            ORDER BY period_date DESC
            LIMIT ${months * 20}
          `);

          if (result.rows && result.rows.length > 0) {
            console.log(`✅ Found data with series_id: ${term}`);
            break;
          }
        } catch (error) {
          console.warn(`Query failed for ${term}:`, error);
        }
      }

      // Strategy 2: Partial series_id match
      if (!result?.rows || result.rows.length === 0) {
        for (const term of searchTerms) {
          try {
            result = await db.execute(sql`
              SELECT 
                period_date as date, 
                value_numeric as value, 
                series_id as metric,
                unit,
                frequency
              FROM economic_indicators_current 
              WHERE UPPER(series_id) LIKE '%' || UPPER(${term}) || '%'
              ORDER BY period_date DESC
              LIMIT ${months * 20}
            `);

            if (result.rows && result.rows.length > 0) {
              console.log(`✅ Found data with partial series_id match: ${term}`);
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
      
      // Check memory cache first  
      const cached = cacheService.get(this.CACHE_KEY) as MacroeconomicData | null;
      if (cached) {
        logger.debug('Returning cached FRED economic data');
        return cached;
      }

      // Get data with live z-score calculations
      const databaseData = await this.getDataFromDatabase();
      if (databaseData && databaseData.indicators.length > 0) {
        // Cache database result for 30 minutes
        cacheService.set(this.CACHE_KEY, databaseData, 30 * 60 * 1000);
        
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
   */
  private async getDataFromDatabase(): Promise<MacroeconomicData | null> {
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
      
      // DEDUPLICATION FIX: Filter out duplicates where we have fresh backfilled data
      const deduplicatedZScoreData = liveZScoreData.filter(zData => {
        const isDuplicate = backfilledSeriesIds.has(zData.seriesId);
        if (isDuplicate) {
          logger.info(`🗑️ Filtering out duplicate from live z-score: ${zData.seriesId} - ${zData.metric} (using fresh backfilled data instead)`);
        }
        return !isDuplicate;
      });
      
      logger.info(`📊 After deduplication: ${deduplicatedZScoreData.length} unique live z-scores + ${freshBackfilledData.length} fresh indicators`);
      
      // Combine both data sources without duplicates
      const combinedData = [...deduplicatedZScoreData, ...freshBackfilledData];
      logger.info(`📊 Total combined indicators: ${combinedData.length}`);

      // FILTER OUT EXTREME Z-SCORES (above 3 or below -3) as requested by user
      // Check BOTH main Z-score AND delta Z-score (trend) for extreme values
      const filteredZScoreData = combinedData.filter((zData) => {
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
      
      logger.info(`📊 Filtered out ${combinedData.length - filteredZScoreData.length} indicators with extreme Z-scores (|z| > 3 OR |trend| > 3)`);
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

        // Enhanced unit-based formatting function with metric-specific handling
        const formatNumber = (value: number | null | undefined, unit: string, metric: string): string => {
          if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
          }
          const numValue = parseFloat(String(value));
          if (isNaN(numValue)) return 'N/A';

          // Handle specific metric formatting based on known patterns
          const metricLower = metric.toLowerCase();
          
          // Jobless Claims - always in thousands, format as K or M
          if (metricLower.includes('jobless claims')) {
            if (numValue >= 1000) {
              return (numValue / 1000).toFixed(1) + 'M';
            } else {
              return numValue.toFixed(0) + 'K';
            }
          }
          
          // CRITICAL: Smart formatting for CPI/PPI/PCE based on value range
          if (metricLower.includes('cpi') || metricLower.includes('price index') || 
              metricLower.includes('ppi') || metricLower.includes('pce')) {
            // For PCE and similar indicators with small values (< 10), they're already YoY percentages
            if (numValue <= 10) {
              return (numValue >= 0 ? '+' : '') + numValue.toFixed(1) + '%';
            }
            // For larger values, they might be raw indices - let transformer handle
            return numValue.toFixed(1) + '%';
          }

          // Standard unit-based formatting
          switch (unit) {
            case 'percent':
              return numValue.toFixed(1) + '%';
            
            case 'thousands':
              if (numValue >= 1000) {
                return (numValue / 1000).toFixed(2) + 'M';
              } else {
                return numValue.toFixed(0) + 'K';
              }
            
            case 'millions_dollars':
              return '$' + numValue.toFixed(1) + 'M';
            
            case 'billions_dollars':
              if (numValue >= 1000) {
                return '$' + (numValue / 1000).toFixed(2) + 'T';
              } else {
                return '$' + numValue.toFixed(1) + 'B';
              }
            
            case 'chained_dollars':
              return '$' + numValue.toFixed(2) + 'T';
            
            case 'index':
              // For CPI/PPI indices, treat as percentages
              if (metricLower.includes('cpi') || metricLower.includes('ppi')) {
                return numValue.toFixed(1) + '%';
              }
              return numValue.toFixed(1);
            
            case 'basis_points':
              return numValue.toFixed(0) + ' bps';
            
            case 'dollars_per_hour':
              return '$' + numValue.toFixed(2);
            
            case 'hours':
              return numValue.toFixed(1) + ' hrs';
            
            case 'months_supply':
              return numValue.toFixed(1) + ' months';
            
            default:
              return numValue.toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              });
          }
        };

        // Enhanced variance formatting for vs Prior calculation with metric context
        const formatVariance = (value: number | null, unit: string, metric: string): string => {
          if (value === null || value === undefined) return 'N/A';
          if (Math.abs(value) < 0.01) return '0.0';
          const formatted = formatNumber(Math.abs(value), unit, metric);
          return value < 0 ? `(${formatted})` : formatted;
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
          currentReading: formatNumber(zData.currentValue, zData.unit, zData.metric),
          priorReading: formatNumber(priorReading, zData.unit, zData.metric),
          varianceVsPrior: formatVariance(actualVariance, zData.unit, zData.metric), // Simple current - prior calculation
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
   * These take priority over legacy historical data to avoid duplicates
   */
  private async getFreshBackfilledIndicators(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT
          series_id as "seriesId",
          metric,
          value_numeric as "currentValue", 
          period_date as "periodDate",
          category,
          'Leading' as type,  -- Default type for backfilled data
          unit,
          -- Calculate basic z-scores for fresh data (simplified approach)
          (value_numeric - AVG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)) / 
          NULLIF(STDDEV(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW), 0) as "deltaAdjustedZScore",
          
          LAG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date) as "priorValue",
          
          -- Calculate rolling historical mean and std for z-score calculation
          AVG(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) as "historicalMean",
          NULLIF(STDDEV(value_numeric) OVER (PARTITION BY series_id ORDER BY period_date ROWS BETWEEN 11 PRECEDING AND CURRENT ROW), 0) as "historicalStd",
          
          -- Delta z-score (change from prior period)
          0 as "deltaZScore",  -- Simplified for fresh data
          0 as "deltaHistoricalMean",
          1 as "deltaHistoricalStd",
          
          1 as "directionality",  -- Default positive directionality
          'monthly' as "frequency"
          
        FROM economic_indicators_current 
        WHERE updated_at >= NOW() - INTERVAL '2 hours'  -- Recently backfilled data
          AND value_numeric IS NOT NULL
          AND period_date IS NOT NULL
        ORDER BY period_date DESC
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

      logger.info(`📊 Found ${freshIndicators.length} fresh backfilled indicators`);
      return freshIndicators;
      
    } catch (error) {
      logger.error('Failed to get fresh backfilled indicators:', String(error));
      return [];
    }
  }
}

export const macroeconomicService = new MacroeconomicService();