// Enhanced data normalization for API responses
// Ensures consistent types and handles the new 3-layer economic data model

import { z } from 'zod';

// Raw data types as received from APIs (may have mixed types)
export interface RawStockData {
  price?: string | number;
  change?: string | number;
  changePercent?: string | number;
  timestamp?: string | Date;
  [key: string]: any;
}

export interface RawEconomicData {
  valueStd?: string | number;
  levelZ?: string | number;
  changeZ?: string | number;
  periodEnd?: string | Date;
  [key: string]: any;
}

// Normalized data types (consistent numbers and dates)
export interface NormalizedStockData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export interface NormalizedEconomicData {
  valueStd: number;
  levelZ: number;
  changeZ: number;
  periodEnd: Date;
}

/**
 * Normalize stock data to ensure consistent types
 */
export function normalizeStockData(raw: RawStockData): NormalizedStockData | null {
  try {
    return {
      price: toNumber(raw.price),
      change: toNumber(raw.change),
      changePercent: toNumber(raw.changePercent),
      timestamp: toDate(raw.timestamp)
    };
  } catch (error) {
    console.warn('Failed to normalize stock data:', error, raw);
    return null;
  }
}

/**
 * Normalize economic data from 3-layer model
 */
export function normalizeEconomicData(raw: RawEconomicData): NormalizedEconomicData | null {
  try {
    return {
      valueStd: toNumber(raw.valueStd),
      levelZ: toNumber(raw.levelZ),
      changeZ: toNumber(raw.changeZ),
      periodEnd: toDate(raw.periodEnd)
    };
  } catch (error) {
    console.warn('Failed to normalize economic data:', error, raw);
    return null;
  }
}

/**
 * Convert various input types to number
 */
export function toNumber(value: string | number | undefined | null): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    // Remove common formatting characters
    const cleaned = value.replace(/[$,%]/g, '');
    const parsed = parseFloat(cleaned);
    
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  throw new Error(`Cannot convert to number: ${value}`);
}

/**
 * Convert various input types to Date
 */
export function toDate(value: string | Date | undefined | null): Date {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  throw new Error(`Cannot convert to Date: ${value}`);
}

/**
 * Normalize array of stock data
 */
export function normalizeStockDataArray(rawArray: RawStockData[]): NormalizedStockData[] {
  return rawArray
    .map(normalizeStockData)
    .filter((item): item is NormalizedStockData => item !== null);
}

/**
 * Normalize array of economic data
 */
export function normalizeEconomicDataArray(rawArray: RawEconomicData[]): NormalizedEconomicData[] {
  return rawArray
    .map(normalizeEconomicData)
    .filter((item): item is NormalizedEconomicData => item !== null);
}

/**
 * Validation schema for stock data
 */
export const stockDataSchema = z.object({
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  timestamp: z.date()
});

/**
 * Validation schema for economic data
 */
export const economicDataSchema = z.object({
  valueStd: z.number(),
  levelZ: z.number(),
  changeZ: z.number(),
  periodEnd: z.date()
});

/**
 * Safe number formatting with fallback
 */
export function formatNumber(value: unknown, decimals: number = 2): string {
  if (typeof value === 'number' && !isNaN(value)) {
    return value.toFixed(decimals);
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num.toFixed(decimals);
    }
  }
  
  return 'N/A';
}

/**
 * Safe percentage formatting
 */
export function formatPercentage(value: unknown, decimals: number = 2): string {
  const num = toNumberSafe(value);
  if (num === null) return 'N/A';
  
  return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * Safe number conversion that returns null on failure
 */
export function toNumberSafe(value: unknown): number | null {
  try {
    return toNumber(value as string | number);
  } catch {
    return null;
  }
}

/**
 * Safe date conversion that returns null on failure
 */
export function toDateSafe(value: unknown): Date | null {
  try {
    return toDate(value as string | Date);
  } catch {
    return null;
  }
}