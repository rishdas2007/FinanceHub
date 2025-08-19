/**
 * Centralized Economic Unit Formatter
 * Handles all economic indicator value formatting using standard_unit database column
 */

interface EconomicFormatterParams {
  value: number;
  standardUnit: string;
  scaleHint: string;
  displayPrecision: number;
  transformCode?: string;
  yoyChange?: number | null;
}

export class EconomicUnitFormatter {
  /**
   * Main formatting function that handles all economic indicator value formatting
   */
  static formatValue(params: EconomicFormatterParams): string {
    const { value, standardUnit, scaleHint, displayPrecision, transformCode, yoyChange } = params;

    // Handle null/undefined values
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }

    switch (standardUnit) {
      case 'PCT_DECIMAL':
        return this.formatPercentage(value, displayPrecision);
      
      case 'USD':
        return this.formatCurrency(value, scaleHint, displayPrecision);
      
      case 'COUNT':
        return this.formatCount(value, scaleHint, displayPrecision);
      
      case 'INDEX_PT':
        return this.formatIndex(value, displayPrecision, yoyChange, transformCode);
      
      case 'HOURS':
        return this.formatHours(value, displayPrecision);
      
      case 'RATIO_DECIMAL':
        return this.formatRatio(value, displayPrecision);
      
      default:
        // Fallback for unknown units
        return this.formatGeneric(value, displayPrecision);
    }
  }

  /**
   * Get display unit suffix based on standard unit and scale hint
   */
  static getDisplayUnit(standardUnit: string, scaleHint: string): string {
    const baseUnit = this.getBaseUnit(standardUnit);
    const scalePrefix = this.getScalePrefix(scaleHint);
    
    return scalePrefix ? `${scalePrefix}${baseUnit}` : baseUnit;
  }

  /**
   * Format percentage values (PCT_DECIMAL)
   */
  static formatPercentage(value: number, precision: number): string {
    // Value is already in decimal form (0.05 = 5%)
    const percentage = value * 100;
    return `${percentage.toFixed(precision)}%`;
  }

  /**
   * Format currency values (USD)
   */
  static formatCurrency(value: number, scaleHint: string, precision: number): string {
    const scaledValue = this.applyScale(value, scaleHint);
    const scaleLabel = this.getScaleLabel(scaleHint);
    
    if (scaleLabel) {
      return `$${scaledValue.toFixed(precision)}${scaleLabel}`;
    }
    
    return `$${scaledValue.toLocaleString('en-US', { 
      minimumFractionDigits: precision,
      maximumFractionDigits: precision 
    })}`;
  }

  /**
   * Format count values (COUNT)
   */
  static formatCount(value: number, scaleHint: string, precision: number): string {
    const scaledValue = this.applyScale(value, scaleHint);
    const scaleLabel = this.getScaleLabel(scaleHint);
    
    if (scaleLabel) {
      return `${scaledValue.toFixed(precision)}${scaleLabel}`;
    }
    
    return scaledValue.toLocaleString('en-US', { 
      minimumFractionDigits: precision,
      maximumFractionDigits: precision 
    });
  }

  /**
   * Format index point values (INDEX_PT)
   */
  static formatIndex(value: number, precision: number, yoyChange?: number | null, transformCode?: string): string {
    const formattedValue = value.toFixed(precision);
    
    // If we have YoY change and this is a level reading, show both
    if (yoyChange !== null && yoyChange !== undefined && transformCode === 'LEVEL') {
      const yoyFormatted = this.formatPercentage(yoyChange / 100, 1);
      return `${formattedValue} (${yoyFormatted} YoY)`;
    }
    
    // If this is already a YoY transform, show as percentage
    if (transformCode === 'YOY') {
      return this.formatPercentage(value / 100, precision);
    }
    
    return formattedValue;
  }

  /**
   * Format hours values (HOURS)
   */
  static formatHours(value: number, precision: number): string {
    return `${value.toFixed(precision)} hrs`;
  }

  /**
   * Format ratio values (RATIO_DECIMAL)
   */
  static formatRatio(value: number, precision: number): string {
    return value.toFixed(precision);
  }

  /**
   * Generic formatter for unknown units
   */
  static formatGeneric(value: number, precision: number): string {
    return value.toFixed(precision);
  }

  /**
   * Apply scale transformation to value
   */
  private static applyScale(value: number, scaleHint: string): number {
    switch (scaleHint) {
      case 'K':
        return value / 1000;
      case 'M':
        return value / 1000000;
      case 'B':
        return value / 1000000000;
      case 'NONE':
      default:
        return value;
    }
  }

  /**
   * Get scale label for display
   */
  private static getScaleLabel(scaleHint: string): string {
    switch (scaleHint) {
      case 'K': return 'K';
      case 'M': return 'M';
      case 'B': return 'B';
      case 'NONE':
      default: return '';
    }
  }

  /**
   * Get base unit symbol
   */
  private static getBaseUnit(standardUnit: string): string {
    switch (standardUnit) {
      case 'PCT_DECIMAL': return '%';
      case 'USD': return '$';
      case 'COUNT': return '';
      case 'INDEX_PT': return '';
      case 'HOURS': return 'hrs';
      case 'RATIO_DECIMAL': return '';
      default: return '';
    }
  }

  /**
   * Get scale prefix for unit display
   */
  private static getScalePrefix(scaleHint: string): string {
    switch (scaleHint) {
      case 'K': return 'K';
      case 'M': return 'M';
      case 'B': return 'B';
      case 'NONE':
      default: return '';
    }
  }

  /**
   * Validate formatting parameters
   */
  static validateParams(params: EconomicFormatterParams): boolean {
    const { standardUnit, scaleHint } = params;
    
    const validUnits = ['PCT_DECIMAL', 'USD', 'COUNT', 'INDEX_PT', 'HOURS', 'RATIO_DECIMAL'];
    const validScales = ['NONE', 'K', 'M', 'B'];
    
    return validUnits.includes(standardUnit) && validScales.includes(scaleHint);
  }

  /**
   * Format economic indicator with full context
   */
  static formatIndicatorValue(
    value: number,
    seriesId: string,
    standardUnit: string,
    scaleHint: string = 'NONE',
    displayPrecision: number = 1,
    transformCode?: string,
    yoyChange?: number | null
  ): string {
    const params: EconomicFormatterParams = {
      value,
      standardUnit,
      scaleHint,
      displayPrecision,
      transformCode,
      yoyChange
    };

    if (!this.validateParams(params)) {
      console.warn(`Invalid formatting params for series ${seriesId}:`, params);
      return this.formatGeneric(value, displayPrecision);
    }

    return this.formatValue(params);
  }
}