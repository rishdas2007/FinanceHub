import { logger } from '@shared/utils/logger';

export interface ETFDataQualityReport {
  isValid: boolean;
  realDataRatio: number;
  totalDataPoints: number;
  realDataPoints: number;
  issues: string[];
  recommendation: 'CACHE' | 'REJECT' | 'WARN';
}

export class ETFDataQualityValidator {
  
  /**
   * Validate ETF metrics data quality before caching
   */
  static validateETFMetrics(metrics: any[]): ETFDataQualityReport {
    const report: ETFDataQualityReport = {
      isValid: false,
      realDataRatio: 0,
      totalDataPoints: 0,
      realDataPoints: 0,
      issues: [],
      recommendation: 'REJECT'
    };

    if (!Array.isArray(metrics) || metrics.length === 0) {
      report.issues.push('No metrics data provided');
      return report;
    }

    let realDataCount = 0;
    let totalDataPoints = 0;
    let fakeRSICount = 0;
    let fakeZScoreCount = 0;
    let allHoldSignals = 0;

    for (const metric of metrics) {
      // 1. Check RSI for fake 50.0 pattern
      if (metric.rsi !== null && metric.rsi !== undefined) {
        totalDataPoints++;
        if (metric.rsi === 50.0) {
          fakeRSICount++;
        } else {
          realDataCount++;
        }
      }

      // 2. Check Z-scores for fake 0.0 pattern  
      if (metric.zScoreData?.compositeZScore !== null && metric.zScoreData?.compositeZScore !== undefined) {
        totalDataPoints++;
        if (Math.abs(metric.zScoreData.compositeZScore) <= 0.001) {
          fakeZScoreCount++;
        } else {
          realDataCount++;
        }
      }

      // 3. Check for generic HOLD signals (suspicious if all are HOLD)
      if (metric.zScoreData?.signal) {
        if (metric.zScoreData.signal === 'HOLD') {
          allHoldSignals++;
        }
      }

      // 4. Check for N/A MACD values (indicator of missing data)
      if (metric.components?.macdZ === null || metric.components?.macdZ === undefined) {
        report.issues.push(`${metric.symbol}: MACD data missing`);
      }
    }

    // Calculate quality metrics
    report.totalDataPoints = totalDataPoints;
    report.realDataPoints = realDataCount;
    report.realDataRatio = totalDataPoints > 0 ? realDataCount / totalDataPoints : 0;

    // Quality thresholds
    const HIGH_QUALITY_THRESHOLD = 0.8;  // 80% real data
    const ACCEPTABLE_QUALITY_THRESHOLD = 0.5;  // 50% real data

    // Issue detection
    if (fakeRSICount >= metrics.length * 0.8) {
      report.issues.push(`Fake RSI pattern: ${fakeRSICount}/${metrics.length} ETFs have RSI=50.0`);
    }

    if (fakeZScoreCount >= totalDataPoints * 0.8) {
      report.issues.push(`Fake Z-score pattern: ${fakeZScoreCount} zero Z-scores detected`);
    }

    if (allHoldSignals >= metrics.length * 0.8) {
      report.issues.push(`Generic signals: ${allHoldSignals}/${metrics.length} ETFs showing HOLD`);
    }

    // Quality determination
    if (report.realDataRatio >= HIGH_QUALITY_THRESHOLD) {
      report.isValid = true;
      report.recommendation = 'CACHE';
    } else if (report.realDataRatio >= ACCEPTABLE_QUALITY_THRESHOLD) {
      report.isValid = true;
      report.recommendation = 'WARN';
    } else {
      report.isValid = false;
      report.recommendation = 'REJECT';
    }

    // Logging
    logger.info(`📊 ETF Data Quality Report:`, {
      realDataRatio: report.realDataRatio,
      totalDataPoints: report.totalDataPoints,
      realDataPoints: report.realDataPoints,
      recommendation: report.recommendation,
      issues: report.issues
    });

    return report;
  }
}

export function validateETFDataQuality(metrics: any[]): ETFDataQualityReport {
  return ETFDataQualityValidator.validateETFMetrics(metrics);
}