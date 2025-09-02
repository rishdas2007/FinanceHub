import { db, pool } from '../db';
import { logger } from '../utils/logger';

/**
 * Direct Economic Calendar Service
 * Uses the actual database data that we know exists
 */

export class EconomicCalendarDirect {
  private static instance: EconomicCalendarDirect;
  
  static getInstance(): EconomicCalendarDirect {
    if (!this.instance) {
      this.instance = new EconomicCalendarDirect();
    }
    return this.instance;
  }

  /**
   * Get calendar data directly from database
   */
  async getCalendarData(options: {
    startDate?: string;
    endDate?: string;
    category?: string;
    frequency?: string;
    mode?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    data: any[];
    total: number;
    page: number;
    totalPages: number;
    executionTime?: number;
    fromCache?: boolean;
    optimization?: string;
  }> {
    const { 
      startDate, 
      endDate, 
      category, 
      frequency, 
      mode = 'all', 
      limit = 100, 
      offset = 0 
    } = options;

    const startTime = Date.now();

    try {
      // Use the pool directly for a simple query
      let query = `
        SELECT 
          series_id as "seriesId",
          metric_name as "metricName",
          category,
          release_date as "releaseDate",
          period_date as "periodDate",
          actual_value as "actualValue",
          previous_value as "previousValue",
          variance,
          variance_percent as "variancePercent",
          unit,
          frequency,
          seasonal_adjustment as "seasonalAdjustment"
        FROM economic_calendar
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramCount = 1;
      
      if (startDate) {
        query += ` AND release_date >= $${paramCount}::date`;
        params.push(startDate);
        paramCount++;
      }
      
      if (endDate) {
        query += ` AND release_date <= $${paramCount}::date`;
        params.push(endDate);
        paramCount++;
      }
      
      if (category) {
        query += ` AND category = $${paramCount}`;
        params.push(category);
        paramCount++;
      }
      
      if (frequency) {
        query += ` AND frequency = $${paramCount}`;
        params.push(frequency);
        paramCount++;
      }
      
      query += ` ORDER BY release_date DESC`;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
      
      // Execute the query
      logger.info('Executing economic calendar query', { query: query.substring(0, 100), params });
      
      const result = await pool.query(query, params);
      
      // Get total count
      let countQuery = `
        SELECT COUNT(*) as count 
        FROM economic_calendar
        WHERE 1=1
      `;
      
      const countParams: any[] = [];
      let countParamCount = 1;
      
      if (startDate) {
        countQuery += ` AND release_date >= $${countParamCount}::date`;
        countParams.push(startDate);
        countParamCount++;
      }
      
      if (endDate) {
        countQuery += ` AND release_date <= $${countParamCount}::date`;
        countParams.push(endDate);
        countParamCount++;
      }
      
      if (category) {
        countQuery += ` AND category = $${countParamCount}`;
        countParams.push(category);
        countParamCount++;
      }
      
      if (frequency) {
        countQuery += ` AND frequency = $${countParamCount}`;
        countParams.push(frequency);
        countParamCount++;
      }
      
      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.count || '0');
      
      logger.info('Economic calendar query successful', { 
        rowCount: result.rows.length,
        total,
        executionTime: Date.now() - startTime
      });
      
      return {
        data: this.formatData(result.rows),
        total,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        executionTime: Date.now() - startTime,
        fromCache: false,
        optimization: 'direct-query'
      };
      
    } catch (error) {
      logger.error('Failed to fetch economic calendar data:', { 
        error: error instanceof Error ? error.message : error 
      });
      
      // Return empty result instead of fallback
      return {
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
        executionTime: Date.now() - startTime,
        fromCache: false,
        optimization: 'error'
      };
    }
  }
  
  /**
   * Format the data
   */
  private formatData(rows: any[]): any[] {
    return rows.map(row => ({
      seriesId: row.seriesId,
      metricName: row.metricName,
      category: row.category,
      releaseDate: row.releaseDate,
      periodDate: row.periodDate,
      actualValue: row.actualValue,
      previousValue: row.previousValue,
      variance: row.variance,
      variancePercent: row.variancePercent,
      unit: row.unit,
      frequency: row.frequency,
      seasonalAdjustment: row.seasonalAdjustment,
      changeDirection: this.getChangeDirection(row.variance),
      impactLevel: this.getImpactLevel(row.metricName, row.variancePercent)
    }));
  }
  
  private getChangeDirection(variance: string | null): string {
    if (!variance) return 'unchanged';
    const val = parseFloat(variance);
    if (val > 0) return 'up';
    if (val < 0) return 'down';
    return 'unchanged';
  }
  
  private getImpactLevel(metricName: string, variancePercent: string | null): string {
    if (!variancePercent) return 'low';
    const absVariance = Math.abs(parseFloat(variancePercent));
    const highImpactMetrics = ['GDP', 'Unemployment Rate', 'CPI', 'Federal Funds Rate', 'Nonfarm Payrolls'];
    const isHighImpact = highImpactMetrics.some(metric => 
      metricName?.toLowerCase().includes(metric.toLowerCase())
    );
    if (isHighImpact && absVariance > 1) return 'high';
    if (absVariance > 5) return 'high';
    if (absVariance > 2) return 'medium';
    return 'low';
  }
  
  async getRecentReleases(): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await this.getCalendarData({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      limit: 50
    });
    
    return result.data;
  }
  
  async getUpcomingReleases(): Promise<any[]> {
    // For now, return empty array since we don't have future data
    return [];
  }
}

export const economicCalendarDirect = EconomicCalendarDirect.getInstance();