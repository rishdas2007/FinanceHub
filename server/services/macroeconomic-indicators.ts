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
  private readonly CACHE_KEY = 'fred-economic-indicators-v21';
  
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

        // Comprehensive unit-based formatting function
        const formatNumber = (value: number | null | undefined, unit: string): string => {
          if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
          }
          const numValue = parseFloat(String(value));

          switch (unit) {
            case 'percent':
              return numValue.toFixed(1) + '%';
            case 'thousands':
              if (numValue >= 1000000) {
                return (numValue / 1000000).toFixed(2) + 'M';
              } else if (numValue >= 1000) {
                return (numValue / 1000).toFixed(1) + 'K';
              } else {
                return numValue.toFixed(1) + 'K';
              }
            case 'millions_dollars':
              return '$' + numValue.toFixed(1) + 'M';
            case 'billions_dollars':
              return '$' + numValue.toFixed(2) + 'T';
            case 'index':
              return numValue.toFixed(1);
            case 'basis_points':
              return numValue.toFixed(0) + ' bps';
            case 'dollars_per_hour':
              return '$' + numValue.toFixed(2);
            case 'hours':
              return numValue.toFixed(1) + ' hrs';
            case 'months_supply':
              return numValue.toFixed(1) + ' months';
            case 'chained_dollars':
              return '$' + numValue.toFixed(2) + 'T';
            default:
              return numValue.toLocaleString('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              });
          }
        };

        // Enhanced variance formatting for vs Prior calculation
        const formatVariance = (value: number | null): string => {
          if (value === null || value === undefined) return 'N/A';
          if (Math.abs(value) < 0.01) return '0.0';
          const formatted = formatNumber(Math.abs(value), zData.unit);
          return value < 0 ? `(${formatted})` : formatted;
        };

        return {
          metric: zData.metric,
          type: zData.type,
          category: zData.category,
          releaseDate: zData.periodDate,
          period_date: zData.periodDate, // Add period_date field for table display
          currentReading: formatNumber(currentReading, zData.unit),
          priorReading: formatNumber(priorReading, zData.unit),
          varianceVsPrior: formatVariance(actualVariance), // Simple current - prior calculation
          zScore: zData.zScore,
          unit: zData.unit
        };
      });

      const data: MacroeconomicData = {
        indicators,
        aiSummary: `Live z-score analysis computed for ${indicators.length} economic indicators using 12-month historical statistics. Z-scores measure deviation from historical mean.`,
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