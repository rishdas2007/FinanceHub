/**
 * Economic Indicators Advanced Calculation Service
 * 
 * Implements all calculation logic from the user's specification:
 * - Z-Score calculations (12-month rolling)
 * - 3-Month Annualized Rate calculations
 * - YoY Change calculations
 * - Variance vs Forecast and Prior calculations
 * - Historical data management
 */

import { logger } from '../utils/logger';

export interface EconomicDataPoint {
  date: string;
  value: number;
  isRevised?: boolean;
}

export interface CalculatedMetrics {
  current: number | null;
  prior: number | null;
  forecast: number | null;
  vsForecast: number | null;
  vsPrior: number | null;
  zScore: number | null;
  threeMonthAnnualized: number | null;
  yoyChange: number | null;
}

export class EconomicCalculationsService {
  
  /**
   * Calculate all metrics according to specification
   */
  calculateMetrics(
    historicalData: EconomicDataPoint[],
    forecast?: number,
    unit: string = 'percent'
  ): CalculatedMetrics {
    if (!historicalData || historicalData.length === 0) {
      return this.getEmptyMetrics();
    }

    // Sort by date to ensure chronological order
    const sortedData = [...historicalData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const current = sortedData[sortedData.length - 1]?.value || null;
    const prior = sortedData[sortedData.length - 2]?.value || null;

    return {
      current: current,
      prior: prior,
      forecast: forecast || null,
      vsForecast: this.calculateVarianceVsForecast(current, forecast),
      vsPrior: this.calculateVarianceVsPrior(current, prior),
      zScore: this.calculateZScore(sortedData),
      threeMonthAnnualized: this.calculateThreeMonthAnnualized(sortedData, unit),
      yoyChange: this.calculateYoYChange(sortedData, unit)
    };
  }

  /**
   * Variance vs. Forecast = Current Reading - Forecast
   */
  private calculateVarianceVsForecast(current: number | null, forecast?: number): number | null {
    if (current === null || forecast === null || forecast === undefined) {
      return null;
    }
    return Math.round((current - forecast) * 100) / 100;
  }

  /**
   * Variance vs. Prior = Current Reading - Prior Reading
   */
  private calculateVarianceVsPrior(current: number | null, prior: number | null): number | null {
    if (current === null || prior === null) {
      return null;
    }
    return Math.round((current - prior) * 100) / 100;
  }

  /**
   * Z-Score = (Current - 12M Avg) ÷ 12M Std Dev
   */
  private calculateZScore(sortedData: EconomicDataPoint[]): number | null {
    if (sortedData.length < 12) {
      logger.debug('Insufficient data for Z-Score calculation (need 12+ months)');
      return null;
    }

    // Filter out invalid values
    const validData = sortedData.filter(d => 
      d.value !== null && 
      d.value !== undefined && 
      !isNaN(d.value) && 
      isFinite(d.value)
    );

    if (validData.length < 12) {
      logger.debug('Insufficient valid data for Z-Score calculation');
      return null;
    }

    // Use last 12 data points for rolling window
    const last12Months = validData.slice(-12);
    const values = last12Months.map(d => d.value);
    
    const current = validData[validData.length - 1].value;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate sample standard deviation (N-1) for better accuracy with finite samples
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      logger.debug('Standard deviation is zero, cannot calculate Z-Score');
      return null;
    }

    const zScore = (current - mean) / stdDev;
    
    // Cap extreme Z-Score values to prevent outlier distortion
    const cappedZScore = Math.max(-5, Math.min(5, zScore));
    
    return Math.round(cappedZScore * 100) / 100;
  }

  /**
   * 3-Month Annualized Rate = (3-month Avg Change) × 12
   */
  private calculateThreeMonthAnnualized(sortedData: EconomicDataPoint[], unit: string): number | null {
    if (sortedData.length < 4) {
      return null;
    }

    // Get last 4 data points to calculate 3 monthly changes
    const last4Points = sortedData.slice(-4);
    const monthlyChanges: number[] = [];

    for (let i = 1; i < last4Points.length; i++) {
      const current = last4Points[i].value;
      const previous = last4Points[i - 1].value;
      
      if (unit === 'percent') {
        // For percentage data, calculate absolute change
        monthlyChanges.push(current - previous);
      } else {
        // For other units, calculate percentage change
        if (previous !== 0) {
          monthlyChanges.push(((current - previous) / Math.abs(previous)) * 100);
        }
      }
    }

    if (monthlyChanges.length === 0) {
      return null;
    }

    const avgMonthlyChange = monthlyChanges.reduce((sum, change) => sum + change, 0) / monthlyChanges.length;
    const annualized = avgMonthlyChange * 12;
    
    return Math.round(annualized * 100) / 100;
  }

  /**
   * 12-Month YoY Change = Current Reading - Value 12 Months Ago
   * For rates: ((Current / Value 12M Ago) - 1) × 100%
   */
  private calculateYoYChange(sortedData: EconomicDataPoint[], unit: string): number | null {
    if (sortedData.length < 13) {
      return null;
    }

    const current = sortedData[sortedData.length - 1].value;
    const yearAgo = sortedData[sortedData.length - 13].value;

    if (yearAgo === 0 || yearAgo === null) {
      return null;
    }

    let yoyChange: number;
    
    if (unit === 'percent' || unit === 'index') {
      // For rates and indexes, use percentage change
      yoyChange = ((current / yearAgo) - 1) * 100;
    } else {
      // For absolute values, use absolute change
      yoyChange = current - yearAgo;
    }

    return Math.round(yoyChange * 100) / 100;
  }

  /**
   * Create time series data from FRED-style response
   */
  createTimeSeriesFromFRED(observations: any[]): EconomicDataPoint[] {
    if (!Array.isArray(observations)) {
      return [];
    }

    return observations
      .filter(obs => obs.value !== '.' && !isNaN(parseFloat(obs.value)))
      .map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value),
        isRevised: obs.revised === 'true'
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Generate realistic historical data for testing (when FRED fails)
   */
  generateRealisticHistoricalData(
    currentValue: number,
    months: number = 24,
    volatility: number = 0.1
  ): EconomicDataPoint[] {
    const data: EconomicDataPoint[] = [];
    const now = new Date();
    
    let value = currentValue * (1 - volatility); // Start lower for trend
    
    for (let i = months; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 15);
      
      // Add realistic economic trend and noise
      const trend = (months - i) / months * volatility * currentValue;
      const noise = (Math.random() - 0.5) * volatility * currentValue * 0.5;
      
      value = Math.max(0, currentValue - trend + noise);
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100
      });
    }

    // Ensure the last value matches current
    if (data.length > 0) {
      data[data.length - 1].value = currentValue;
    }

    return data;
  }

  private getEmptyMetrics(): CalculatedMetrics {
    return {
      current: null,
      prior: null,
      forecast: null,
      vsForecast: null,
      vsPrior: null,
      zScore: null,
      threeMonthAnnualized: null,
      yoyChange: null
    };
  }

  /**
   * Validate calculation results
   */
  validateCalculations(metrics: CalculatedMetrics): boolean {
    // Basic sanity checks
    if (metrics.current !== null && metrics.forecast !== null) {
      const expectedVsForecast = metrics.current - metrics.forecast;
      const actualVsForecast = metrics.vsForecast;
      
      if (actualVsForecast !== null && Math.abs(expectedVsForecast - actualVsForecast) > 0.01) {
        logger.warn('Variance vs Forecast calculation may be incorrect');
        return false;
      }
    }

    // Z-Score should be reasonable (-5 to 5 typically)
    if (metrics.zScore !== null && (metrics.zScore < -10 || metrics.zScore > 10)) {
      logger.warn('Z-Score appears extreme:', metrics.zScore);
    }

    return true;
  }
}

export const economicCalculationsService = new EconomicCalculationsService();