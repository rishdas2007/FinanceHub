import { sql } from 'drizzle-orm';
import { db } from '../db';
import { economicCalendar, econDerivedMetrics, type InsertEconomicCalendar } from '../../shared/schema';
import { logger } from '../../shared/utils/logger';
import { economicCalendarService, FRED_SERIES_MAP } from './economic-calendar-service';

// Data quality thresholds for investment-grade requirements
export const QUALITY_THRESHOLDS = {
  // Missing data tolerance (percentage)
  MISSING_DATA_WARNING: 0.05,  // Warn if >5% missing
  MISSING_DATA_CRITICAL: 0.15, // Critical if >15% missing
  
  // Outlier detection (standard deviations from mean)
  OUTLIER_THRESHOLD: 4.0, // 4 standard deviations
  
  // Volatility spike detection (percentage change)
  VOLATILITY_SPIKE: 0.25, // 25% single-period change threshold
  
  // Stale data detection (days)
  STALE_DATA_WARNING: 7,   // Warn if data >7 days old
  STALE_DATA_CRITICAL: 30, // Critical if data >30 days old
  
  // Minimum confidence for derived metrics
  MIN_CONFIDENCE: 0.6,     // Below 60% confidence is flagged
  
  // Maximum acceptable gaps (days)
  MAX_GAP_DAILY: 5,        // 5 business days for daily series
  MAX_GAP_WEEKLY: 14,      // 2 weeks for weekly series
  MAX_GAP_MONTHLY: 45,     // 1.5 months for monthly series
  MAX_GAP_QUARTERLY: 120,  // 4 months for quarterly series
} as const;

export interface DataQualityIssue {
  seriesId: string;
  metricName: string;
  category: string;
  issueType: 'missing_data' | 'outlier' | 'stale_data' | 'high_volatility' | 'low_confidence' | 'data_gap' | 'calculation_error';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  affectedPeriods?: string[];
  suggestedAction: string;
  detectedAt: Date;
  value?: number;
  expectedRange?: [number, number];
}

export interface DataQualityReport {
  overallScore: number; // 0-100 quality score
  totalIssues: number;
  issuesBySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
  seriesQuality: {
    [seriesId: string]: {
      score: number;
      issues: DataQualityIssue[];
      completeness: number;
      staleness: number;
      outliers: number;
    };
  };
  recommendations: string[];
  generatedAt: Date;
}

export class EconomicDataQualityService {
  
  /**
   * Comprehensive data quality assessment
   */
  async assessDataQuality(options: {
    seriesIds?: string[];
    lookbackDays?: number;
    includeDerivatives?: boolean;
  } = {}): Promise<DataQualityReport> {
    const { seriesIds, lookbackDays = 90, includeDerivatives = true } = options;
    
    logger.info('🔍 Starting comprehensive data quality assessment');
    
    const issues: DataQualityIssue[] = [];
    const seriesQuality: { [key: string]: any } = {};
    
    // Get series to check
    const seriesToCheck = seriesIds || Object.keys(FRED_SERIES_MAP);
    
    for (const seriesId of seriesToCheck) {
      try {
        const seriesInfo = FRED_SERIES_MAP[seriesId as keyof typeof FRED_SERIES_MAP];
        if (!seriesInfo) continue;
        
        const seriesIssues = await this.assessSeriesQuality(seriesId, lookbackDays);
        issues.push(...seriesIssues);
        
        // Calculate series quality metrics
        const criticalIssues = seriesIssues.filter(i => i.severity === 'critical').length;
        const warningIssues = seriesIssues.filter(i => i.severity === 'warning').length;
        
        const completeness = await this.calculateCompleteness(seriesId, lookbackDays);
        const staleness = await this.calculateStaleness(seriesId);
        const outlierCount = seriesIssues.filter(i => i.issueType === 'outlier').length;
        
        // Calculate series score (0-100)
        let score = 100;
        score -= criticalIssues * 20; // -20 for each critical issue
        score -= warningIssues * 5;   // -5 for each warning
        score -= (1 - completeness) * 30; // -30 for missing data
        score -= staleness * 10;       // -10 for stale data
        score -= outlierCount * 2;     // -2 for each outlier
        
        seriesQuality[seriesId] = {
          score: Math.max(0, score),
          issues: seriesIssues,
          completeness,
          staleness,
          outliers: outlierCount
        };
        
      } catch (error) {
        logger.error(`❌ Failed to assess quality for ${seriesId}:`, error);
        issues.push({
          seriesId,
          metricName: seriesInfo?.name || seriesId,
          category: seriesInfo?.category || 'Unknown',
          issueType: 'calculation_error',
          severity: 'critical',
          description: `Failed to assess data quality: ${error}`,
          suggestedAction: 'Investigate data processing pipeline',
          detectedAt: new Date()
        });
      }
    }
    
    // Calculate overall quality score
    const scores = Object.values(seriesQuality).map(s => s.score);
    const overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    const report: DataQualityReport = {
      overallScore: Math.round(overallScore),
      totalIssues: issues.length,
      issuesBySeverity: {
        info: issues.filter(i => i.severity === 'info').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        critical: issues.filter(i => i.severity === 'critical').length
      },
      seriesQuality,
      recommendations: this.generateRecommendations(issues),
      generatedAt: new Date()
    };
    
    logger.info(`✅ Data quality assessment complete. Overall score: ${report.overallScore}/100`);
    return report;
  }
  
  /**
   * Assess quality of individual series
   */
  private async assessSeriesQuality(seriesId: string, lookbackDays: number): Promise<DataQualityIssue[]> {
    const issues: DataQualityIssue[] = [];
    const seriesInfo = FRED_SERIES_MAP[seriesId as keyof typeof FRED_SERIES_MAP];
    if (!seriesInfo) return issues;
    
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    
    // Get series data
    const data = await db.execute(sql`
      SELECT 
        period_date,
        actual_value,
        variance_percent,
        created_at,
        updated_at
      FROM economic_calendar
      WHERE series_id = ${seriesId} 
        AND period_date >= ${startDate.toISOString().split('T')[0]}
      ORDER BY period_date ASC
    `);
    
    if (data.rows.length === 0) {
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'missing_data',
        severity: 'critical',
        description: 'No data available for the specified period',
        suggestedAction: 'Check data ingestion pipeline and FRED API connectivity',
        detectedAt: new Date()
      });
      return issues;
    }
    
    // Check for missing data
    await this.checkMissingData(seriesId, seriesInfo, data.rows, issues);
    
    // Check for outliers
    await this.checkOutliers(seriesId, seriesInfo, data.rows, issues);
    
    // Check for high volatility spikes
    await this.checkVolatilitySpikes(seriesId, seriesInfo, data.rows, issues);
    
    // Check for stale data
    await this.checkStaleData(seriesId, seriesInfo, data.rows, issues);
    
    // Check data gaps
    await this.checkDataGaps(seriesId, seriesInfo, data.rows, issues);
    
    return issues;
  }
  
  /**
   * Check for missing or incomplete data
   */
  private async checkMissingData(seriesId: string, seriesInfo: any, data: any[], issues: DataQualityIssue[]): Promise<void> {
    const nullValues = data.filter(row => !row.actual_value || row.actual_value === null).length;
    const missingPercentage = nullValues / data.length;
    
    if (missingPercentage > QUALITY_THRESHOLDS.MISSING_DATA_CRITICAL) {
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'missing_data',
        severity: 'critical',
        description: `${(missingPercentage * 100).toFixed(1)}% of data points are missing`,
        suggestedAction: 'Investigate data collection process and FRED API issues',
        detectedAt: new Date()
      });
    } else if (missingPercentage > QUALITY_THRESHOLDS.MISSING_DATA_WARNING) {
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'missing_data',
        severity: 'warning',
        description: `${(missingPercentage * 100).toFixed(1)}% of data points are missing`,
        suggestedAction: 'Monitor data collection and consider data imputation',
        detectedAt: new Date()
      });
    }
  }
  
  /**
   * Detect statistical outliers
   */
  private async checkOutliers(seriesId: string, seriesInfo: any, data: any[], issues: DataQualityIssue[]): Promise<void> {
    const values = data.filter(row => row.actual_value !== null).map(row => parseFloat(row.actual_value));
    if (values.length < 10) return; // Need sufficient data for outlier detection
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length);
    
    const outliers = data.filter(row => {
      if (!row.actual_value) return false;
      const value = parseFloat(row.actual_value);
      return Math.abs(value - mean) > QUALITY_THRESHOLDS.OUTLIER_THRESHOLD * stdDev;
    });
    
    for (const outlier of outliers) {
      const value = parseFloat(outlier.actual_value);
      const zScore = Math.abs(value - mean) / stdDev;
      
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'outlier',
        severity: zScore > 6 ? 'critical' : 'warning',
        description: `Statistical outlier detected: ${value} (${zScore.toFixed(1)} standard deviations from mean)`,
        affectedPeriods: [outlier.period_date],
        suggestedAction: 'Verify data accuracy and consider data validation rules',
        detectedAt: new Date(),
        value,
        expectedRange: [mean - 2 * stdDev, mean + 2 * stdDev]
      });
    }
  }
  
  /**
   * Check for unusual volatility spikes
   */
  private async checkVolatilitySpikes(seriesId: string, seriesInfo: any, data: any[], issues: DataQualityIssue[]): Promise<void> {
    const spikes = data.filter(row => {
      if (!row.variance_percent) return false;
      const changePercent = Math.abs(parseFloat(row.variance_percent));
      return changePercent > QUALITY_THRESHOLDS.VOLATILITY_SPIKE * 100;
    });
    
    for (const spike of spikes) {
      const changePercent = parseFloat(spike.variance_percent);
      
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'high_volatility',
        severity: Math.abs(changePercent) > 50 ? 'critical' : 'warning',
        description: `High volatility spike: ${changePercent.toFixed(2)}% change`,
        affectedPeriods: [spike.period_date],
        suggestedAction: 'Investigate economic events or data revision announcements',
        detectedAt: new Date(),
        value: changePercent
      });
    }
  }
  
  /**
   * Check for stale data
   */
  private async checkStaleData(seriesId: string, seriesInfo: any, data: any[], issues: DataQualityIssue[]): Promise<void> {
    if (data.length === 0) return;
    
    const latestData = data[data.length - 1];
    const latestDate = new Date(latestData.period_date);
    const daysSinceUpdate = (Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000);
    
    if (daysSinceUpdate > QUALITY_THRESHOLDS.STALE_DATA_CRITICAL) {
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'stale_data',
        severity: 'critical',
        description: `Data is ${Math.round(daysSinceUpdate)} days old`,
        suggestedAction: 'Check data ingestion schedule and FRED API connectivity',
        detectedAt: new Date()
      });
    } else if (daysSinceUpdate > QUALITY_THRESHOLDS.STALE_DATA_WARNING) {
      issues.push({
        seriesId,
        metricName: seriesInfo.name,
        category: seriesInfo.category,
        issueType: 'stale_data',
        severity: 'warning',
        description: `Data is ${Math.round(daysSinceUpdate)} days old`,
        suggestedAction: 'Monitor data refresh schedule',
        detectedAt: new Date()
      });
    }
  }
  
  /**
   * Check for data gaps
   */
  private async checkDataGaps(seriesId: string, seriesInfo: any, data: any[], issues: DataQualityIssue[]): Promise<void> {
    if (data.length < 2) return;
    
    const getMaxGap = (frequency: string): number => {
      switch (frequency.toLowerCase()) {
        case 'daily': return QUALITY_THRESHOLDS.MAX_GAP_DAILY;
        case 'weekly': return QUALITY_THRESHOLDS.MAX_GAP_WEEKLY;
        case 'monthly': return QUALITY_THRESHOLDS.MAX_GAP_MONTHLY;
        case 'quarterly': return QUALITY_THRESHOLDS.MAX_GAP_QUARTERLY;
        default: return QUALITY_THRESHOLDS.MAX_GAP_MONTHLY;
      }
    };
    
    const maxGapDays = getMaxGap(seriesInfo.frequency);
    
    for (let i = 1; i < data.length; i++) {
      const currentDate = new Date(data[i].period_date);
      const previousDate = new Date(data[i - 1].period_date);
      const gapDays = (currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000);
      
      if (gapDays > maxGapDays) {
        issues.push({
          seriesId,
          metricName: seriesInfo.name,
          category: seriesInfo.category,
          issueType: 'data_gap',
          severity: gapDays > maxGapDays * 2 ? 'critical' : 'warning',
          description: `Data gap of ${Math.round(gapDays)} days detected`,
          affectedPeriods: [data[i - 1].period_date, data[i].period_date],
          suggestedAction: 'Check for missing data releases or data source issues',
          detectedAt: new Date()
        });
      }
    }
  }
  
  /**
   * Calculate data completeness percentage
   */
  private async calculateCompleteness(seriesId: string, lookbackDays: number): Promise<number> {
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(actual_value) as valid
      FROM economic_calendar
      WHERE series_id = ${seriesId} 
        AND period_date >= ${startDate.toISOString().split('T')[0]}
    `);
    
    const row = result.rows[0];
    if (!row || !row.total) return 0;
    
    return parseFloat(row.valid as string) / parseFloat(row.total as string);
  }
  
  /**
   * Calculate staleness score (0-1, where 1 is most stale)
   */
  private async calculateStaleness(seriesId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT period_date
      FROM economic_calendar
      WHERE series_id = ${seriesId}
      ORDER BY period_date DESC
      LIMIT 1
    `);
    
    if (!result.rows.length) return 1;
    
    const latestDate = new Date(result.rows[0].period_date as string);
    const daysSince = (Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000);
    
    return Math.min(1, daysSince / QUALITY_THRESHOLDS.STALE_DATA_CRITICAL);
  }
  
  /**
   * Generate recommendations based on detected issues
   */
  private generateRecommendations(issues: DataQualityIssue[]): string[] {
    const recommendations: string[] = [];
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const warningIssues = issues.filter(i => i.severity === 'warning');
    
    if (criticalIssues.length > 0) {
      recommendations.push(`🚨 Address ${criticalIssues.length} critical data quality issues immediately`);
    }
    
    if (warningIssues.length > 0) {
      recommendations.push(`⚠️ Monitor ${warningIssues.length} warning-level data quality issues`);
    }
    
    const missingDataIssues = issues.filter(i => i.issueType === 'missing_data');
    if (missingDataIssues.length > 0) {
      recommendations.push('📊 Implement data imputation strategies for missing economic data');
    }
    
    const staleDataIssues = issues.filter(i => i.issueType === 'stale_data');
    if (staleDataIssues.length > 0) {
      recommendations.push('🔄 Review and optimize data ingestion schedules');
    }
    
    const outlierIssues = issues.filter(i => i.issueType === 'outlier');
    if (outlierIssues.length > 0) {
      recommendations.push('🎯 Implement automated outlier validation and alert system');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Data quality is within acceptable thresholds');
    }
    
    return recommendations;
  }
  
  /**
   * Handle missing data with appropriate imputation strategies
   */
  async handleMissingData(options: {
    seriesId?: string;
    method?: 'forward_fill' | 'interpolation' | 'moving_average';
    updateDatabase?: boolean;
  } = {}): Promise<{ filled: number; errors: string[] }> {
    const { seriesId, method = 'forward_fill', updateDatabase = false } = options;
    
    logger.info(`🔧 Handling missing data using ${method} method`);
    
    const errors: string[] = [];
    let filled = 0;
    
    try {
      // Implementation would depend on chosen strategy
      switch (method) {
        case 'forward_fill':
          filled = await this.forwardFillMissingData(seriesId);
          break;
        case 'interpolation':
          filled = await this.interpolateMissingData(seriesId);
          break;
        case 'moving_average':
          filled = await this.movingAverageFill(seriesId);
          break;
      }
      
      if (updateDatabase && filled > 0) {
        logger.info(`✅ Filled ${filled} missing data points using ${method}`);
      }
      
    } catch (error) {
      errors.push(`Failed to handle missing data: ${error}`);
      logger.error('❌ Error handling missing data:', error);
    }
    
    return { filled, errors };
  }
  
  /**
   * Forward fill missing data points
   */
  private async forwardFillMissingData(seriesId?: string): Promise<number> {
    // Implementation would forward-fill missing values with the last known value
    // This is a placeholder - actual implementation would query and update data
    return 0;
  }
  
  /**
   * Interpolate missing data points
   */
  private async interpolateMissingData(seriesId?: string): Promise<number> {
    // Implementation would use linear interpolation between known values
    // This is a placeholder - actual implementation would query and update data
    return 0;
  }
  
  /**
   * Fill missing data with moving average
   */
  private async movingAverageFill(seriesId?: string): Promise<number> {
    // Implementation would use moving average to estimate missing values
    // This is a placeholder - actual implementation would query and update data
    return 0;
  }
}

export const economicDataQualityService = new EconomicDataQualityService();