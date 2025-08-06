import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

/**
 * Data Quality Validation Service
 * Implements robust validation for financial data used in Z-Score calculations
 */

interface DataQualityResult {
  isValid: boolean;
  quality: number; // 0-1 scale
  issues: string[];
  recommendations: string[];
}

interface OutlierDetectionResult {
  outlierCount: number;
  outlierRatio: number;
  cleanedValues: number[];
  outlierIndices: number[];
}

export class DataQualityValidator {
  private static instance: DataQualityValidator;
  
  // Minimum observations required for reliable statistics - Updated for 10 years of data
  private readonly MIN_OBSERVATIONS = {
    EQUITIES: 1260,     // 5 years minimum (upgraded from 252) with 10 years available
    ETF_TECHNICAL: 252, // 1 year minimum (upgraded from 63) for reliable ETF analysis
    ECONOMIC_MONTHLY: 60, // 5 years monthly (upgraded from 36) for economic indicators
    ECONOMIC_QUARTERLY: 40, // 10 years quarterly data for GDP, etc.
    VOLATILITY: 63      // 3 months minimum (upgraded from 22) for volatility calculations
  };
  
  // Maximum allowable gap ratio in time series
  private readonly MAX_GAP_RATIO = 0.1; // 10% missing data points
  private readonly MAX_OUTLIER_RATIO = 0.05; // 5% outliers
  
  public static getInstance(): DataQualityValidator {
    if (!DataQualityValidator.instance) {
      DataQualityValidator.instance = new DataQualityValidator();
    }
    return DataQualityValidator.instance;
  }

  /**
   * Comprehensive data quality validation for Z-Score calculations
   */
  validateDataQuality(values: number[], assetClass: keyof typeof this.MIN_OBSERVATIONS): DataQualityResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check for sufficient data
    const minObs = this.MIN_OBSERVATIONS[assetClass];
    if (values.length < minObs) {
      issues.push(`Insufficient data: ${values.length} < ${minObs} required observations`);
      recommendations.push(`Collect at least ${minObs - values.length} more data points`);
      return { isValid: false, quality: 0, issues, recommendations };
    }

    // Check for data gaps
    const gapRatio = this.calculateGapRatio(values);
    if (gapRatio > this.MAX_GAP_RATIO) {
      issues.push(`High gap ratio: ${(gapRatio * 100).toFixed(1)}% missing data`);
      recommendations.push('Fill data gaps or use interpolation');
    }

    // Check for outliers that could skew statistics
    const outlierResult = this.detectOutliers(values);
    if (outlierResult.outlierRatio > this.MAX_OUTLIER_RATIO) {
      issues.push(`High outlier ratio: ${(outlierResult.outlierRatio * 100).toFixed(1)}% outliers detected`);
      recommendations.push('Consider outlier treatment or robust statistics');
    }

    // Check for constant values (zero variance)
    const variance = this.calculateSampleVariance(values);
    if (variance === 0) {
      issues.push('Zero variance: all values are identical');
      recommendations.push('Data may be stale or incorrectly sourced');
      return { isValid: false, quality: 0, issues, recommendations };
    }

    // Check for extreme skewness that violates normal distribution assumptions
    const skewness = this.calculateSkewness(values);
    if (Math.abs(skewness) > 2) {
      issues.push(`High skewness: ${skewness.toFixed(2)} (data not normally distributed)`);
      recommendations.push('Consider data transformation or non-parametric methods');
    }

    // Calculate overall quality score
    let quality = 1.0;
    quality *= Math.max(0, 1 - gapRatio * 2);
    quality *= Math.max(0, 1 - outlierResult.outlierRatio * 4);
    quality *= Math.max(0, 1 - Math.abs(skewness) / 4);

    const isValid = quality > 0.7 && issues.length === 0;

    logger.debug('Data quality validation', {
      assetClass,
      dataPoints: values.length,
      quality: quality.toFixed(3),
      isValid,
      issues: issues.length,
      recommendations: recommendations.length
    });

    return { isValid, quality, issues, recommendations };
  }

  /**
   * Calculate ratio of missing/null values in the dataset
   */
  private calculateGapRatio(values: number[]): number {
    const nullValues = values.filter(v => v === null || v === undefined || isNaN(v) || !isFinite(v)).length;
    return nullValues / values.length;
  }

  /**
   * Detect outliers using IQR method (more robust than z-score for outlier detection)
   */
  private detectOutliers(values: number[]): OutlierDetectionResult {
    const sortedValues = [...values].filter(v => isFinite(v)).sort((a, b) => a - b);
    const n = sortedValues.length;
    
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outlierIndices: number[] = [];
    const cleanedValues: number[] = [];
    
    values.forEach((value, index) => {
      if (isFinite(value) && value >= lowerBound && value <= upperBound) {
        cleanedValues.push(value);
      } else {
        outlierIndices.push(index);
      }
    });
    
    return {
      outlierCount: outlierIndices.length,
      outlierRatio: outlierIndices.length / values.length,
      cleanedValues,
      outlierIndices
    };
  }

  /**
   * Calculate sample variance (N-1 denominator) for finite samples
   */
  private calculateSampleVariance(values: number[]): number {
    const validValues = values.filter(v => isFinite(v));
    if (validValues.length < 2) return 0;
    
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const variance = validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (validValues.length - 1);
    
    return variance;
  }

  /**
   * Calculate skewness to test normality assumption
   */
  private calculateSkewness(values: number[]): number {
    const validValues = values.filter(v => isFinite(v));
    if (validValues.length < 3) return 0;
    
    const n = validValues.length;
    const mean = validValues.reduce((sum, val) => sum + val, 0) / n;
    const variance = this.calculateSampleVariance(validValues);
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const skewness = validValues.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / stdDev, 3);
    }, 0) / n;
    
    return skewness;
  }

  /**
   * Generate standardized data quality report
   */
  generateQualityReport(values: number[], assetClass: keyof typeof this.MIN_OBSERVATIONS, symbol: string): void {
    const result = this.validateDataQuality(values, assetClass);
    
    logger.info('Data Quality Report', {
      symbol,
      assetClass,
      dataPoints: values.length,
      quality: (result.quality * 100).toFixed(1) + '%',
      status: result.isValid ? 'PASS' : 'FAIL',
      issues: result.issues,
      recommendations: result.recommendations
    });
  }
}