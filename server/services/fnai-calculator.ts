import { logger } from '../../shared/utils/logger';

export interface FNAIResult {
  fnai: number;
  interpretation: string;
  recentVelocity: number;
  historicalVelocity: number;
  historicalVolatility: number;
}

export interface FNAIData {
  value: number;
  period_date: string;
}

/**
 * Frequency-Normalized Acceleration Index (FNAI) Calculator
 * Analyzes trends across different time frequencies in economic data
 */
export class FNAICalculator {
  
  /**
   * Frequency mapping for 12-month equivalents
   */
  private readonly frequencyMapping: Record<string, number> = {
    'Daily': 252,    // Trading days
    'Weekly': 52,    // Weeks  
    'Monthly': 12,   // Months
    'Quarterly': 4   // Quarters
  };

  /**
   * Calculate FNAI for time series data
   * 
   * @param data Array of data points with values and dates
   * @param frequency Data frequency (Daily, Weekly, Monthly, Quarterly)
   * @returns FNAI result with score and interpretation
   */
  calculateFNAI(data: FNAIData[], frequency: string): FNAIResult {
    try {
      if (!data || data.length < 4) {
        logger.warn(`Insufficient data for FNAI calculation: ${data?.length || 0} points`);
        return this.getDefaultFNAI();
      }

      const periods12m = this.frequencyMapping[frequency] || 12;
      
      // Sort data by date to ensure proper chronological order
      const sortedData = data.sort((a, b) => 
        new Date(a.period_date).getTime() - new Date(b.period_date).getTime()
      );

      // Recent Velocity (last 3 observations)
      const recentData = sortedData.slice(-4); // Last 4 points to calculate 3-period change
      if (recentData.length < 4) {
        return this.getDefaultFNAI();
      }

      const recentVelocity = (recentData[3].value - recentData[0].value) / 3;

      // Historical metrics (12-month equivalent)
      const historicalLength = Math.min(periods12m + 1, sortedData.length);
      const historicalData = sortedData.slice(-historicalLength);
      
      if (historicalData.length < 2) {
        return this.getDefaultFNAI();
      }

      // Calculate period-over-period changes
      const historicalChanges: number[] = [];
      for (let i = 1; i < historicalData.length; i++) {
        historicalChanges.push(historicalData[i].value - historicalData[i - 1].value);
      }

      if (historicalChanges.length === 0) {
        return this.getDefaultFNAI();
      }

      const historicalVelocity = historicalChanges.reduce((sum, change) => sum + change, 0) / historicalChanges.length;
      const historicalVolatility = this.calculateStandardDeviation(historicalChanges);

      // Calculate FNAI
      let fnai = 0;
      if (historicalVolatility > 0) {
        fnai = (recentVelocity - historicalVelocity) / historicalVolatility;
      }

      return {
        fnai,
        interpretation: this.interpretFNAI(fnai),
        recentVelocity,
        historicalVelocity,
        historicalVolatility
      };

    } catch (error) {
      logger.error('Failed to calculate FNAI:', String(error));
      return this.getDefaultFNAI();
    }
  }

  /**
   * Batch calculate FNAI for multiple series
   */
  calculateBatchFNAI(seriesData: Record<string, { data: FNAIData[], frequency: string }>): Record<string, FNAIResult> {
    const results: Record<string, FNAIResult> = {};
    
    for (const [seriesId, { data, frequency }] of Object.entries(seriesData)) {
      results[seriesId] = this.calculateFNAI(data, frequency);
    }

    return results;
  }

  /**
   * Interpret FNAI score
   */
  private interpretFNAI(fnai: number): string {
    if (fnai > 1.0) return 'Strong acceleration';
    if (fnai > 0.5) return 'Moderate acceleration';
    if (fnai > -0.5) return 'Stable trend';
    if (fnai > -1.0) return 'Moderate deceleration';
    return 'Strong deceleration';
  }

  /**
   * Get FNAI color coding for UI
   */
  getFNAIColor(fnai: number): string {
    if (fnai > 1.0) return 'text-green-400';
    if (fnai > 0.5) return 'text-green-300';
    if (fnai > -0.5) return 'text-yellow-400';
    if (fnai > -1.0) return 'text-orange-400';
    return 'text-red-400';
  }

  /**
   * Get FNAI trend arrow for UI
   */
  getFNAIArrow(fnai: number): string {
    if (fnai > 0.5) return '↗️';
    if (fnai > 0) return '→';
    if (fnai > -0.5) return '→';
    if (fnai > -1.0) return '↘️';
    return '↓';
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Get default FNAI result for error cases
   */
  private getDefaultFNAI(): FNAIResult {
    return {
      fnai: 0,
      interpretation: 'Insufficient data',
      recentVelocity: 0,
      historicalVelocity: 0,
      historicalVolatility: 0
    };
  }

  /**
   * Simple Acceleration Ratio (alternative formula)
   */
  calculateSimpleAccelerationRatio(data: FNAIData[], frequency: string): { ratio: number; interpretation: string } {
    try {
      if (!data || data.length < 4) {
        return { ratio: 1, interpretation: 'Insufficient data' };
      }

      const periods12m = this.frequencyMapping[frequency] || 12;
      const sortedData = data.sort((a, b) => 
        new Date(a.period_date).getTime() - new Date(b.period_date).getTime()
      );

      // Recent rate (last 3 observations, annualized)
      const recentData = sortedData.slice(-4);
      const recentChange = (recentData[3].value - recentData[0].value) / recentData[0].value;
      const recentRate = recentChange * (periods12m / 3); // Annualized

      // Historical rate (12-month equivalent)
      const historicalLength = Math.min(periods12m + 1, sortedData.length);
      const historicalData = sortedData.slice(-historicalLength);
      const historicalChange = (historicalData[historicalData.length - 1].value - historicalData[0].value) / historicalData[0].value;
      const historicalRate = historicalChange;

      const ratio = Math.abs(historicalRate) > 0.001 ? recentRate / historicalRate : 1;

      let interpretation: string;
      if (ratio > 1.2) interpretation = 'Accelerating';
      else if (ratio < 0.8) interpretation = 'Decelerating';
      else interpretation = 'Stable';

      return { ratio, interpretation };

    } catch (error) {
      logger.error('Failed to calculate acceleration ratio:', String(error));
      return { ratio: 1, interpretation: 'Calculation error' };
    }
  }
}

export const fnaiCalculator = new FNAICalculator();