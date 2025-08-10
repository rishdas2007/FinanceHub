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
  private readonly CACHE_KEY = `fred-delta-adjusted-v${Math.floor(Date.now() / 100)}`;
  
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
      // Try to find data by matching various patterns
      const mappings: Record<string, string> = {
        'unemployment_rate': 'UNRATE',
        'industrial_production': 'INDPRO',
        'nonfarm_payrolls': 'PAYEMS',
        'cpi_inflation': 'CPIAUCSL',
        'fed_funds_rate': 'FEDFUNDS',
        'gdp_growth': 'GDP',
        'housing_starts': 'HOUST',
        'consumer_confidence': 'UMCSENT'
      };

      const searchId = mappings[indicatorId] || indicatorId.toUpperCase();
      
      // Use economic_indicators_current for real data that feeds the dashboard
      const result = await db.execute(sql`
        SELECT period_date as date, value_numeric as value, series_id as metric
        FROM economic_indicators_current 
        WHERE series_id LIKE '%' || ${searchId} || '%'
        OR series_id LIKE '%' || ${indicatorId.toUpperCase()} || '%'
        ORDER BY period_date DESC
        LIMIT ${months * 12}
      `);

      if (!result.rows || result.rows.length === 0) {
        logger.warn(`No historical data found for indicator: ${indicatorId}`);
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
      // Import live z-score calculator
      const { liveZScoreCalculator } = await import('./live-zscore-calculator');
      
      // Calculate live z-scores (never cached)
      const liveZScoreData = await liveZScoreCalculator.calculateLiveZScores();
      
      if (!liveZScoreData || liveZScoreData.length === 0) {
        logger.debug('No live z-score data calculated');
        return null;
      }
      
      logger.info(`📊 Calculated ${liveZScoreData.length} live z-scores from database`);

      const indicators = liveZScoreData.map((zData) => {
        const currentReading = zData.currentValue;
        const priorReading = zData.priorValue;
        
        // Calculate simple vs Prior variance: currentReading - priorReading
        const actualVariance = currentReading !== null && priorReading !== null 
          ? currentReading - priorReading 
          : null;

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
          
          // CPI and Price Index indicators - always percentages regardless of unit field
          if (metricLower.includes('cpi') || metricLower.includes('price index') || 
              metricLower.includes('ppi') || metricLower.includes('pce')) {
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
          currentReading: formatNumber(currentReading, zData.unit, zData.metric),
          priorReading: formatNumber(priorReading, zData.unit, zData.metric),
          varianceVsPrior: formatVariance(actualVariance, zData.unit, zData.metric), // Simple current - prior calculation
          zScore: zData.deltaAdjustedZScore, // Use delta-adjusted z-score instead of raw z-score
          deltaZScore: zData.deltaZScore, // Period-to-period change z-score
          frequency: zData.frequency, // Indicator frequency (daily, weekly, monthly, quarterly)
          unit: zData.unit
        };
      });

      const data: MacroeconomicData = {
        indicators,
        aiSummary: `Live z-score analysis computed for ${indicators.length} comprehensive economic indicators using 12-month historical statistics. Includes GDP Growth Rate and all indicators with sufficient historical data baseline.`,
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
}

export const macroeconomicService = new MacroeconomicService();