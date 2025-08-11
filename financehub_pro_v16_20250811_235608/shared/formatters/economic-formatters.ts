// Single formatter for all economic data - prevents unit inconsistencies
import { z } from 'zod';

export type StandardUnit = 'PCT_DECIMAL' | 'USD' | 'COUNT' | 'INDEX_PT' | 'HOURS' | 'RATIO_DECIMAL';
export type ScaleHint = 'NONE' | 'K' | 'M' | 'B';

interface FormatValueParams {
  valueStd: number;
  unit: StandardUnit;
  scaleHint?: ScaleHint;
  precision?: number;
}

/**
 * Single source of truth for all economic data formatting
 * Used by tables, cards, charts - prevents mixed units
 */
export function formatValue({
  valueStd,
  unit,
  scaleHint = 'NONE',
  precision = 2
}: FormatValueParams): string {
  if (typeof valueStd !== 'number' || isNaN(valueStd)) {
    return 'N/A';
  }

  // Apply scale transformation
  let scaledValue = valueStd;
  let scaleSymbol = '';
  
  if (scaleHint !== 'NONE' && (unit === 'USD' || unit === 'COUNT')) {
    switch (scaleHint) {
      case 'K':
        scaledValue = valueStd / 1000;
        scaleSymbol = 'K';
        break;
      case 'M':
        scaledValue = valueStd / 1000000;
        scaleSymbol = 'M';
        break;
      case 'B':
        scaledValue = valueStd / 1000000000;
        scaleSymbol = 'B';
        break;
    }
  }

  // Format based on unit type
  switch (unit) {
    case 'PCT_DECIMAL':
      return `${(scaledValue * 100).toFixed(precision)}%`;
    
    case 'USD':
      return `$${scaledValue.toFixed(precision)}${scaleSymbol}`;
    
    case 'COUNT':
      return `${scaledValue.toFixed(precision)}${scaleSymbol}`;
    
    case 'INDEX_PT':
      return scaledValue.toFixed(precision);
    
    case 'HOURS':
      return `${scaledValue.toFixed(precision)} hrs`;
    
    case 'RATIO_DECIMAL':
      return scaledValue.toFixed(precision);
    
    default:
      return scaledValue.toFixed(precision);
  }
}

/**
 * Format column headers with unit information
 */
export function formatColumnHeader(params: {
  label: string;
  unit: StandardUnit;
  scaleHint?: ScaleHint;
  transform?: string;
  seasonalAdj?: 'SA' | 'NSA';
}): string {
  const { label, unit, scaleHint = 'NONE', transform, seasonalAdj } = params;
  
  const parts = [label];
  
  // Add unit suffix
  const unitSuffix = getUnitSuffix(unit, scaleHint);
  if (unitSuffix) parts.push(`(${unitSuffix})`);
  
  // Add transform and seasonal adjustment
  const metadata = [];
  if (seasonalAdj) metadata.push(seasonalAdj);
  if (transform && transform !== 'LEVEL') metadata.push(transform);
  
  if (metadata.length > 0) {
    parts.push(`[${metadata.join(', ')}]`);
  }
  
  return parts.join(' ');
}

function getUnitSuffix(unit: StandardUnit, scaleHint: ScaleHint): string {
  switch (unit) {
    case 'PCT_DECIMAL':
      return '%';
    case 'USD':
      return scaleHint === 'NONE' ? '$' : `$${scaleHint}`;
    case 'COUNT':
      return scaleHint === 'NONE' ? '' : scaleHint;
    case 'INDEX_PT':
      return 'index';
    case 'HOURS':
      return 'hrs';
    case 'RATIO_DECIMAL':
      return 'ratio';
    default:
      return '';
  }
}

/**
 * Format z-score with consistent styling
 */
export function formatZScore(zScore: number, precision: number = 2): string {
  if (typeof zScore !== 'number' || isNaN(zScore)) {
    return 'N/A';
  }
  
  const sign = zScore >= 0 ? '+' : '';
  return `${sign}${zScore.toFixed(precision)}`;
}

/**
 * Get classification from z-scores using standard thresholds
 */
export function classifyLevel(levelZ: number): 'ABOVE' | 'NEUTRAL' | 'BELOW' {
  if (levelZ >= 1.0) return 'ABOVE';
  if (levelZ <= -1.0) return 'BELOW';
  return 'NEUTRAL';
}

export function classifyTrend(changeZ: number): 'ACCEL' | 'FLAT' | 'DECEL' {
  if (changeZ >= 0.5) return 'ACCEL';
  if (changeZ <= -0.5) return 'DECEL';
  return 'FLAT';
}

/**
 * Generate multi-signal classification from level and trend
 */
export function getMultiSignal(levelZ: number, changeZ: number): string {
  const level = classifyLevel(levelZ);
  const trend = classifyTrend(changeZ);
  
  const signalMap = {
    'ABOVE_ACCEL': 'Strong, strengthening',
    'ABOVE_FLAT': 'Strong, steady', 
    'ABOVE_DECEL': 'Strong, weakening',
    'NEUTRAL_ACCEL': 'Improving',
    'NEUTRAL_FLAT': 'Neutral',
    'NEUTRAL_DECEL': 'Softening',
    'BELOW_ACCEL': 'Weak, rebounding',
    'BELOW_FLAT': 'Weak, steady',
    'BELOW_DECEL': 'Weak, deteriorating'
  };
  
  return signalMap[`${level}_${trend}`] || 'Unknown';
}

/**
 * Get color for multi-signal classification
 */
export function getMultiSignalColor(signal: string): string {
  if (signal.includes('strengthening') || signal.includes('Improving')) return 'text-green-400';
  if (signal.includes('weakening') || signal.includes('Softening') || signal.includes('deteriorating')) return 'text-red-400';
  if (signal.includes('steady') || signal.includes('Neutral')) return 'text-gray-400';
  if (signal.includes('rebounding')) return 'text-yellow-400';
  return 'text-gray-400';
}

/**
 * Validation schema for formatted values
 */
export const formatValueSchema = z.object({
  valueStd: z.number(),
  unit: z.enum(['PCT_DECIMAL', 'USD', 'COUNT', 'INDEX_PT', 'HOURS', 'RATIO_DECIMAL']),
  scaleHint: z.enum(['NONE', 'K', 'M', 'B']).optional(),
  precision: z.number().int().min(0).max(6).optional()
});