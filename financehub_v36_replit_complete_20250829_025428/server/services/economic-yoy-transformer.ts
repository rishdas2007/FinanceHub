import { logger } from '../../shared/utils/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface YoYTransformation {
  seriesId: string;
  currentValue: number;
  previousYearValue: number;
  yoyChange: number;
  yoyPercentage: number;
  displayValue: string;
  unit: 'percentage' | 'index' | 'rate' | 'count';
  metric: string;
}

export class EconomicYoYTransformer {
  
  // Define which series need YoY transformation vs raw display
  private readonly TRANSFORMATION_RULES: Record<string, { transform: 'yoy' | 'none'; name: string; unit: 'percentage' | 'index' | 'rate' | 'count'; isAlreadyYoY: boolean }> = {
    // ✅ CRITICAL FIX: These are RAW INDEX LEVELS from FRED - DO transform to YoY
    'CPIAUCSL': { transform: 'yoy', name: 'CPI All Items', unit: 'index', isAlreadyYoY: false },
    'CPILFESL': { transform: 'yoy', name: 'Core CPI', unit: 'index', isAlreadyYoY: false },
    'PCEPI': { transform: 'yoy', name: 'PCE Price Index', unit: 'index', isAlreadyYoY: false },
    'PCEPILFE': { transform: 'yoy', name: 'Core PCE Price Index', unit: 'index', isAlreadyYoY: false },

    // These are RAW INDEX LEVELS - DO transform to YoY
    'PPIACO': { transform: 'yoy', name: 'Producer Price Index', unit: 'index', isAlreadyYoY: false },
    'PPIFIS': { transform: 'yoy', name: 'PPI Final Demand', unit: 'index', isAlreadyYoY: false },
    'PPIFGS': { transform: 'yoy', name: 'PPI Final Demand Goods', unit: 'index', isAlreadyYoY: false },
    'WPUSOP3000': { transform: 'yoy', name: 'Core PPI', unit: 'index', isAlreadyYoY: false },
    'CPIENGSL': { transform: 'yoy', name: 'CPI Energy', unit: 'index', isAlreadyYoY: false },
    'PPIENG': { transform: 'yoy', name: 'PPI Energy', unit: 'index', isAlreadyYoY: false },
    
    // Rates - display as-is
    'UNRATE': { transform: 'none', name: 'Unemployment Rate', unit: 'rate', isAlreadyYoY: false },
    'FEDFUNDS': { transform: 'none', name: 'Federal Funds Rate', unit: 'rate', isAlreadyYoY: false },
    'DGS10': { transform: 'none', name: '10-Year Treasury Yield', unit: 'rate', isAlreadyYoY: false },
    'T10Y2Y': { transform: 'none', name: 'Yield Curve (10yr-2yr)', unit: 'rate', isAlreadyYoY: false },
    'MORTGAGE30US': { transform: 'none', name: '30-Year Mortgage Rate', unit: 'rate', isAlreadyYoY: false },
    
    // Count series - need YoY calculation
    'PAYEMS': { transform: 'yoy', name: 'Nonfarm Payrolls', unit: 'count', isAlreadyYoY: false },
    'ICSA': { transform: 'yoy', name: 'Initial Jobless Claims', unit: 'count', isAlreadyYoY: false },
    'CCSA': { transform: 'yoy', name: 'Continuing Jobless Claims', unit: 'count', isAlreadyYoY: false },
    
    // Other percentage/growth series - display as-is
    'CIVPART': { transform: 'none', name: 'Labor Force Participation Rate', unit: 'rate', isAlreadyYoY: false },
    'EMRATIO': { transform: 'none', name: 'Employment Population Ratio', unit: 'rate', isAlreadyYoY: false },
    'AWHMAN': { transform: 'none', name: 'Average Weekly Hours', unit: 'rate', isAlreadyYoY: false },
    'CES0500000003': { transform: 'yoy', name: 'Average Hourly Earnings', unit: 'index', isAlreadyYoY: false }
  };

  /**
   * Transform economic data to appropriate display format
   */
  async transformIndicatorData(seriesId: string, metric?: string): Promise<YoYTransformation | null> {
    let rule = this.TRANSFORMATION_RULES[seriesId];
    
    // If no exact match, try to infer from metric name
    if (!rule && metric) {
      const inferredRule = this.inferTransformationRule(metric, seriesId);
      if (inferredRule) {
        rule = inferredRule;
      }
    }
    
    if (!rule) {
      logger.warn(`No transformation rule found for series: ${seriesId}, metric: ${metric}`);
      return null;
    }

    // Get current value first
    const currentData = await this.getCurrentValue(seriesId);
    if (!currentData) {
      // FALLBACK: If no database data available, but we know it needs transformation
      if (rule.transform === 'yoy') {
        logger.warn(`No data found for ${seriesId}, but transformation needed - series likely missing from database`);
      }
      return null;
    }

    if (rule.transform === 'none') {
      // For rates and already-YoY data, return current value as-is
      let displayValue: string;

      if (rule.isAlreadyYoY || rule.unit === 'percentage') {
        // CPI, Core CPI etc. are already YoY percentages
        displayValue = `${currentData.value >= 0 ? '+' : ''}${currentData.value.toFixed(1)}%`;
      } else if (rule.unit === 'rate') {
        // Interest rates, unemployment rates
        displayValue = `${currentData.value.toFixed(1)}%`;
      } else {
        displayValue = `${currentData.value.toFixed(1)}`;
      }

      return {
        seriesId,
        currentValue: currentData.value,
        previousYearValue: 0,
        yoyChange: 0,
        yoyPercentage: currentData.value,
        displayValue,
        unit: rule.unit,
        metric: rule.name
      };
    }

    // For index/count series, calculate YoY change
    return await this.calculateYoYChange(seriesId, rule);
  }

  /**
   * Infer transformation rule from metric name when exact series ID not found
   */
  private inferTransformationRule(metric: string, seriesId: string): { transform: 'yoy' | 'none'; name: string; unit: 'percentage' | 'index' | 'rate' | 'count'; isAlreadyYoY: boolean } | null {
    const metricLower = metric.toLowerCase();
    
    // ✅ CRITICAL FIX: CPI series are RAW INDEX LEVELS from FRED - need YoY transformation
    if (metricLower.includes('cpi') && !metricLower.includes('ppi')) {
      return { transform: 'yoy', name: metric, unit: 'index', isAlreadyYoY: false };
    }
    
    // PPI series are usually raw index levels that need YoY calculation
    if (metricLower.includes('ppi') || metricLower.includes('producer price')) {
      return { transform: 'yoy', name: metric, unit: 'index', isAlreadyYoY: false };
    }
    
    // ✅ CRITICAL FIX: PCE series are RAW INDEX LEVELS from FRED - need YoY transformation
    if (metricLower.includes('pce')) {
      return { transform: 'yoy', name: metric, unit: 'index', isAlreadyYoY: false };
    }
    
    // Rates display as-is
    if (metricLower.includes('rate') || metricLower.includes('yield') || 
        metricLower.includes('unemployment') || metricLower.includes('participation')) {
      return { transform: 'none', name: metric, unit: 'rate', isAlreadyYoY: false };
    }
    
    // Employment counts need YoY
    if (metricLower.includes('payroll') || metricLower.includes('claims') || 
        metricLower.includes('employment') || metricLower.includes('jobs')) {
      return { transform: 'yoy', name: metric, unit: 'count', isAlreadyYoY: false };
    }
    
    // Default to no transformation for unknown series
    return { transform: 'none', name: metric, unit: 'percentage', isAlreadyYoY: false };
  }

  /**
   * Calculate Year-over-Year change for index/count series
   */
  private async calculateYoYChange(seriesId: string, rule: any): Promise<YoYTransformation | null> {
    try {
      // Get current and year-ago values using the existing database structure
      const result = await db.execute(sql`
        WITH latest_data AS (
          SELECT 
            value_numeric as current_value,
            period_date as current_date
          FROM economic_indicators_current 
          WHERE series_id = ${seriesId}
          ORDER BY period_date DESC
          LIMIT 1
        ),
        year_ago_data AS (
          SELECT 
            value_numeric as previous_value,
            period_date as previous_date
          FROM economic_indicators_current 
          WHERE series_id = ${seriesId}
            AND period_date >= (SELECT current_date - INTERVAL '13 months' FROM latest_data)
            AND period_date <= (SELECT current_date - INTERVAL '11 months' FROM latest_data)
          ORDER BY period_date DESC
          LIMIT 1
        )
        SELECT 
          ld.current_value,
          ld.current_date,
          COALESCE(yad.previous_value, ld.current_value) as previous_value,
          COALESCE(yad.previous_date, ld.current_date) as previous_date
        FROM latest_data ld
        LEFT JOIN year_ago_data yad ON true
      `);

      if (!result.rows || result.rows.length === 0) {
        logger.warn(`No data found for series: ${seriesId}`);
        return null;
      }

      const row = result.rows[0] as any;
      const currentValue = parseFloat(String(row.current_value)) || 0;
      const previousValue = parseFloat(String(row.previous_value)) || 0;
      
      if (previousValue === 0) {
        logger.warn(`No valid previous year data for series: ${seriesId}`);
        return null;
      }

      // Calculate YoY percentage change
      const yoyChange = currentValue - previousValue;
      const yoyPercentage = (yoyChange / previousValue) * 100;

      const displayValue = this.formatYoYValue(yoyPercentage, yoyChange, rule.unit);

      return {
        seriesId,
        currentValue,
        previousYearValue: previousValue,
        yoyChange,
        yoyPercentage,
        displayValue,
        unit: rule.unit,
        metric: rule.name
      };

    } catch (error) {
      logger.error(`YoY calculation failed for ${seriesId}:`, String(error));
      return null;
    }
  }

  /**
   * Format YoY values based on unit type
   */
  private formatYoYValue(yoyPercentage: number, yoyChange: number, unit: string): string {
    if (unit === 'index') {
      // For price indices, show as percentage
      return `${yoyPercentage >= 0 ? '+' : ''}${yoyPercentage.toFixed(1)}%`;
    } else if (unit === 'count') {
      // For employment data, show change in thousands
      if (Math.abs(yoyChange) >= 1000) {
        return `${yoyChange >= 0 ? '+' : ''}${(yoyChange / 1000).toFixed(0)}K`;
      } else {
        return `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(0)}`;
      }
    } else {
      return `${yoyPercentage >= 0 ? '+' : ''}${yoyPercentage.toFixed(1)}%`;
    }
  }

  /**
   * Format rate values (no YoY calculation needed)
   */
  private formatRateValue(value: number, unit: string): string {
    if (unit === 'rate') {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(1);
  }

  /**
   * Get current value for a series
   */
  private async getCurrentValue(seriesId: string): Promise<{ value: number; date: string } | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          value_numeric as value,
          period_date as date
        FROM economic_indicators_current 
        WHERE series_id = ${seriesId}
        ORDER BY period_date DESC
        LIMIT 1
      `);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        value: parseFloat(String(row.value)) || 0,
        date: String(row.date)
      };
    } catch (error) {
      logger.error(`Failed to get current value for ${seriesId}:`, String(error));
      return null;
    }
  }

  /**
   * Transform all indicators for dashboard display
   */
  async transformAllIndicators(): Promise<Map<string, YoYTransformation>> {
    const results = new Map<string, YoYTransformation>();
    
    for (const seriesId of Object.keys(this.TRANSFORMATION_RULES)) {
      const transformation = await this.transformIndicatorData(seriesId);
      if (transformation) {
        results.set(seriesId, transformation);
      }
    }
    
    logger.info(`✅ Transformed ${results.size} economic indicators with proper YoY calculations`);
    return results;
  }

  /**
   * Transform indicator by series ID or metric name
   */
  async transformBySeriesOrMetric(seriesId: string, metric: string): Promise<YoYTransformation | null> {
    return await this.transformIndicatorData(seriesId, metric);
  }
}

export const economicYoYTransformer = new EconomicYoYTransformer();