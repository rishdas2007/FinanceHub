import { logger } from '../../shared/utils/logger';
import { db } from '../db.js';
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
  private readonly TRANSFORMATION_RULES: Record<string, { transform: 'yoy' | 'none'; name: string; unit: 'percentage' | 'index' | 'rate' | 'count' }> = {
    // Index series - need YoY calculation
    'CPIAUCSL': { transform: 'yoy', name: 'CPI All Items', unit: 'index' },
    'CPILFESL': { transform: 'yoy', name: 'Core CPI', unit: 'index' },
    'PPIACO': { transform: 'yoy', name: 'Producer Price Index', unit: 'index' },
    'PPIFIS': { transform: 'yoy', name: 'PPI Final Demand', unit: 'index' },
    'PPIFGS': { transform: 'yoy', name: 'PPI Final Demand Goods', unit: 'index' },
    'WPUSOP3000': { transform: 'yoy', name: 'Core PPI', unit: 'index' },
    'PCEPI': { transform: 'yoy', name: 'PCE Price Index', unit: 'index' },
    'PCEPILFE': { transform: 'yoy', name: 'Core PCE Price Index', unit: 'index' },
    'CPIENGSL': { transform: 'yoy', name: 'CPI Energy', unit: 'index' },
    'PPIENG': { transform: 'yoy', name: 'PPI Energy', unit: 'index' },
    'PPIFGS': { transform: 'yoy', name: 'PPI Final Demand Goods', unit: 'index' },
    
    // Rate series - display as-is  
    'UNRATE': { transform: 'none', name: 'Unemployment Rate', unit: 'rate' },
    'FEDFUNDS': { transform: 'none', name: 'Federal Funds Rate', unit: 'rate' },
    'DGS10': { transform: 'none', name: '10-Year Treasury Yield', unit: 'rate' },
    'T10Y2Y': { transform: 'none', name: 'Yield Curve (10yr-2yr)', unit: 'rate' },
    'MORTGAGE30US': { transform: 'none', name: '30-Year Mortgage Rate', unit: 'rate' },
    
    // Count series - need YoY calculation but different display format
    'PAYEMS': { transform: 'yoy', name: 'Nonfarm Payrolls', unit: 'count' },
    'ICSA': { transform: 'yoy', name: 'Initial Jobless Claims', unit: 'count' },
    'CCSA': { transform: 'yoy', name: 'Continuing Jobless Claims', unit: 'count' },
    
    // Other percentage/growth series - display as-is
    'CIVPART': { transform: 'none', name: 'Labor Force Participation Rate', unit: 'rate' },
    'EMRATIO': { transform: 'none', name: 'Employment Population Ratio', unit: 'rate' },
    'AWHMAN': { transform: 'none', name: 'Average Weekly Hours', unit: 'rate' },
    'CES0500000003': { transform: 'yoy', name: 'Average Hourly Earnings', unit: 'index' }
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

    if (rule.transform === 'none') {
      // For rates, return current value as-is
      const currentData = await this.getCurrentValue(seriesId);
      if (!currentData) return null;
      
      return {
        seriesId,
        currentValue: currentData.value,
        previousYearValue: 0,
        yoyChange: 0,
        yoyPercentage: 0,
        displayValue: this.formatRateValue(currentData.value, rule.unit),
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
  private inferTransformationRule(metric: string, seriesId: string): { transform: 'yoy' | 'none'; name: string; unit: 'percentage' | 'index' | 'rate' | 'count' } | null {
    const metricLower = metric.toLowerCase();
    
    // Price indices need YoY transformation
    if (metricLower.includes('ppi') || metricLower.includes('cpi') || 
        metricLower.includes('price index') || metricLower.includes('inflation')) {
      return { transform: 'yoy', name: metric, unit: 'index' };
    }
    
    // Rates display as-is
    if (metricLower.includes('rate') || metricLower.includes('yield') || 
        metricLower.includes('unemployment') || metricLower.includes('participation')) {
      return { transform: 'none', name: metric, unit: 'rate' };
    }
    
    // Employment counts need YoY
    if (metricLower.includes('payroll') || metricLower.includes('claims') || 
        metricLower.includes('employment') || metricLower.includes('jobs')) {
      return { transform: 'yoy', name: metric, unit: 'count' };
    }
    
    // Default to YoY for unknown series
    return { transform: 'yoy', name: metric, unit: 'index' };
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
      logger.error(`YoY calculation failed for ${seriesId}:`, error);
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
      logger.error(`Failed to get current value for ${seriesId}:`, error);
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