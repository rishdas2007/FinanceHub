import { logger } from '../../shared/utils/logger';
import { sql } from 'drizzle-orm';
import { db } from '../db';

export interface DeltaZScoreData {
  seriesId: string;
  currentValue: number;
  priorValue: number;
  deltaZScore: number;
  rollingMean: number;
  rollingStdDev: number;
  confidence: 'High' | 'Medium' | 'Low';
  sampleSize: number;
}

/**
 * Delta-Adjusted Z-Score Calculator
 * Provides statistical significance analysis using rolling historical windows
 */
export class DeltaZScoreCalculator {
  
  /**
   * Calculate delta-adjusted Z-score for an economic indicator
   * Uses 252-day window for high-frequency data, 60-period for others
   */
  async calculateDeltaZScore(seriesId: string, frequency: string): Promise<DeltaZScoreData | null> {
    try {
      // Determine appropriate window size based on frequency
      const windowSize = this.getWindowSize(frequency);
      
      // Get historical data with proper ordering
      const historicalQuery = sql`
        SELECT 
          value,
          period_date
        FROM historical_economic_data
        WHERE series_id = ${seriesId}
          AND value IS NOT NULL
        ORDER BY period_date DESC
        LIMIT ${sql.raw(windowSize.toString())}
      `;
      
      const result = await db.execute(historicalQuery);
      
      if (result.rows.length < 10) {
        logger.warn(`Insufficient data for delta Z-score: ${seriesId} (${result.rows.length} records)`);
        return null;
      }
      
      // Calculate period-over-period changes (deltas)
      const deltas: number[] = [];
      const values = result.rows.map((r: any) => parseFloat(String(r.value))).reverse(); // chronological order
      
      for (let i = 1; i < values.length; i++) {
        if (values[i-1] !== 0) {
          // Calculate percentage change
          const delta = ((values[i] - values[i-1]) / Math.abs(values[i-1])) * 100;
          if (isFinite(delta)) {
            deltas.push(delta);
          }
        }
      }
      
      if (deltas.length < 5) {
        logger.warn(`Insufficient valid deltas for ${seriesId}: ${deltas.length}`);
        return null;
      }
      
      // Statistical calculations on deltas
      const mean = this.calculateMean(deltas);
      const stdDev = this.calculateStandardDeviation(deltas, mean);
      
      // Current period delta (most recent change)
      const currentValue = values[values.length - 1];
      const priorValue = values[values.length - 2];
      const currentDelta = priorValue !== 0 ? ((currentValue - priorValue) / Math.abs(priorValue)) * 100 : 0;
      
      // Delta-adjusted Z-score
      const deltaZScore = stdDev !== 0 ? (currentDelta - mean) / stdDev : 0;
      
      // Confidence assessment based on sample size and stability
      const confidence = this.assessConfidence(deltas.length, stdDev, Math.abs(deltaZScore));
      
      return {
        seriesId,
        currentValue,
        priorValue,
        deltaZScore: Number(deltaZScore.toFixed(4)),
        rollingMean: Number(mean.toFixed(4)),
        rollingStdDev: Number(stdDev.toFixed(4)),
        confidence,
        sampleSize: deltas.length
      };
      
    } catch (error) {
      logger.error(`Failed to calculate delta Z-score for ${seriesId}:`, String(error));
      return null;
    }
  }
  
  /**
   * Calculate delta Z-scores for multiple indicators in parallel
   */
  async calculateBulkDeltaZScores(seriesIds: string[]): Promise<Map<string, DeltaZScoreData>> {
    const results = new Map<string, DeltaZScoreData>();
    
    const calculations = seriesIds.map(async (seriesId) => {
      // Get frequency for this series
      const freqQuery = sql`
        SELECT DISTINCT frequency FROM historical_economic_data 
        WHERE series_id = ${seriesId} LIMIT 1
      `;
      const freqResult = await db.execute(freqQuery);
      const frequency = freqResult.rows[0] ? String(freqResult.rows[0].frequency) : 'monthly';
      
      const deltaData = await this.calculateDeltaZScore(seriesId, frequency);
      if (deltaData) {
        results.set(seriesId, deltaData);
      }
    });
    
    await Promise.all(calculations);
    
    logger.info(`✅ Calculated delta Z-scores for ${results.size}/${seriesIds.length} indicators`);
    return results;
  }
  
  /**
   * Determine appropriate window size based on data frequency
   */
  private getWindowSize(frequency: string): number {
    switch (frequency.toLowerCase()) {
      case 'daily':
        return 252; // ~1 year of trading days
      case 'weekly':
        return 104; // ~2 years of weeks
      case 'monthly':
        return 60;  // ~5 years of months
      case 'quarterly':
        return 40;  // ~10 years of quarters
      default:
        return 60;  // Default monthly window
    }
  }
  
  /**
   * Calculate mean of an array
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calculate sample standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1); // Sample std dev
    return Math.sqrt(variance);
  }
  
  /**
   * Assess confidence level based on sample size and volatility
   */
  private assessConfidence(sampleSize: number, stdDev: number, absZScore: number): 'High' | 'Medium' | 'Low' {
    // High confidence: large sample, reasonable volatility, significant Z-score
    if (sampleSize >= 30 && stdDev < 10 && absZScore > 1.5) {
      return 'High';
    }
    
    // Medium confidence: moderate sample or moderate significance
    if (sampleSize >= 15 && absZScore > 1.0) {
      return 'Medium';
    }
    
    // Low confidence: small sample or low significance
    return 'Low';
  }
  
  /**
   * Interpret delta Z-score for economic significance
   */
  interpretDeltaZScore(deltaZScore: number): string {
    const abs = Math.abs(deltaZScore);
    
    if (abs >= 3.0) {
      return deltaZScore > 0 ? 'Extreme Positive Deviation' : 'Extreme Negative Deviation';
    } else if (abs >= 2.0) {
      return deltaZScore > 0 ? 'Strong Positive Signal' : 'Strong Negative Signal';
    } else if (abs >= 1.5) {
      return deltaZScore > 0 ? 'Moderate Positive Signal' : 'Moderate Negative Signal';
    } else if (abs >= 1.0) {
      return deltaZScore > 0 ? 'Weak Positive Signal' : 'Weak Negative Signal';
    } else {
      return 'Normal Range';
    }
  }
}

export const deltaZScoreCalculator = new DeltaZScoreCalculator();