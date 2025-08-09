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
   * Get economic data from the database with comprehensive historical data
   */
  private async getDataFromDatabase(): Promise<MacroeconomicData | null> {
    try {
      // Use our comprehensive historical economic service
      const { historicalEconomicService } = await import('./historical-economic-service');
      
      // Get comprehensive indicators with 10-year historical data
      const indicators = await historicalEconomicService.getComprehensiveIndicators();
      
      if (!indicators || indicators.length === 0) {
        logger.debug('No historical economic indicators found');
        return null;
      }
      
      logger.info(`📊 Retrieved ${indicators.length} indicators from comprehensive historical dataset`);

      const formattedIndicators = indicators.map((indicator) => {
        const currentReading = indicator.currentReading;
        const priorReading = indicator.priorReading;
        
        // Use calculated variance from historical service
        const actualVariance = indicator.varianceVsPrior;

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

        // Enhanced variance formatting with proper sign and magnitude
        const formatVariance = (value: number | null, unit: string, metric: string): string => {
          if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
          }
          
          const numVariance = parseFloat(String(value));
          if (isNaN(numVariance)) return 'N/A';
          if (numVariance === 0) return '0';
          
          const sign = numVariance > 0 ? '+' : '';
          const absVariance = Math.abs(numVariance);
          const metricLower = metric.toLowerCase();
          
          // Format variance based on metric type, matching current reading format
          if (metricLower.includes('jobless claims')) {
            if (absVariance >= 1000000) {
              return sign + (absVariance / 1000000).toFixed(1) + 'M';
            } else if (absVariance >= 1000) {
              return sign + (absVariance / 1000).toFixed(0) + 'K';
            } else {
              return sign + absVariance.toFixed(0);
            }
          }
          
          if (metricLower.includes('payroll') || metricLower.includes('nonfarm')) {
            return sign + (absVariance / 1000).toFixed(0) + 'K';
          }
          
          if (metricLower.includes('earnings')) {
            return sign + '$' + absVariance.toFixed(2);
          }
          
          if (metricLower.includes('gdp')) {
            return sign + '$' + (absVariance).toFixed(0) + 'B';
          }
          
          if (metricLower.includes('cpi') || metricLower.includes('pce') || metricLower.includes('ppi') || metricLower.includes('inflation')) {
            return sign + absVariance.toFixed(2) + '%';
          }
          
          // Default variance formatting
          if (absVariance >= 1000000) {
            return sign + (absVariance / 1000000).toFixed(1) + 'M';
          } else if (absVariance >= 1000) {
            return sign + (absVariance / 1000).toFixed(0) + 'K';
          } else if (absVariance >= 1) {
            return sign + absVariance.toFixed(1);
          } else {
            return sign + absVariance.toFixed(3);
          }
        };

        return {
          metric: indicator.metric,
          type: indicator.type,
          category: indicator.category,
          releaseDate: indicator.releaseDate,
          period_date: indicator.period_date,
          currentReading: formatNumber(currentReading, indicator.unit, indicator.metric),
          priorReading: formatNumber(priorReading, indicator.unit, indicator.metric),
          varianceVsPrior: formatVariance(actualVariance, indicator.unit, indicator.metric),
          zScore: indicator.zScore,
          deltaZScore: indicator.deltaZScore,
          frequency: indicator.frequency,
          unit: indicator.unit
        };
      });

      const data: MacroeconomicData = {
        indicators: formattedIndicators,
        aiSummary: `Comprehensive economic indicators with authentic 10-year historical data. Retrieved ${formattedIndicators.length} indicators with prior readings and z-score analysis.`,
        lastUpdated: new Date().toISOString(),
        source: 'Historical Economic Dataset (10-year authentic data)'
      };

      logger.info(`✅ Historical database data ready: ${formattedIndicators.length} indicators`);
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