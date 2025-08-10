/**
 * Robust date utility functions that handle Date | string | number safely
 * Eliminates "toISOString is not a function" errors across the codebase
 */

/**
 * Safely converts any date-like value to ISO date string (YYYY-MM-DD)
 * @param value - Date, string, number, or unknown value
 * @returns ISO date string or null if invalid
 */
/**
 * Optimized version following recommended pattern for maximum safety
 */
export function isoDate(value: unknown): string | null {
  if (value == null) return null;
  
  if (typeof value === 'string') {
    const s = value.trim();
    // Fast path for 'YYYY-MM-DD...' strings - no conversion needed
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : 
           (new Date(s).toISOString().slice(0, 10));
  }
  
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  
  if (typeof value === 'number') {
    return new Date(value).toISOString().slice(0, 10);
  }
  
  return null;
}

/**
 * Safely converts any date-like value to timestamp (milliseconds)
 * @param value - Date, string, number, or unknown value
 * @returns timestamp number or null if invalid
 */
export function toTimestamp(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  if (typeof value === 'string') {
    const d = new Date(value.trim());
    const time = d.getTime();
    return Number.isNaN(time) ? null : time;
  }

  return null;
}

/**
 * Safe date formatter that never throws errors
 * @param value - Date, string, number, or unknown value
 * @returns formatted date string or fallback
 */
export function formatSafeDate(value: unknown, fallback: string = ''): string {
  const iso = isoDate(value);
  if (!iso) return fallback;
  
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return iso.slice(5, 10); // MM-DD fallback
  }
}

/**
 * Creates chart-ready data point with both string date and numeric timestamp
 * @param dateValue - Any date-like value
 * @param price - Numeric price value
 * @returns Chart data point with date, t (timestamp), and close
 */
export function createChartPoint(dateValue: unknown, price: number): {
  date: string;
  t: number;
  close: number;
} | null {
  const dateStr = isoDate(dateValue);
  const timestamp = toTimestamp(dateValue);
  
  if (!dateStr || !timestamp || !Number.isFinite(price)) {
    return null;
  }
  
  return {
    date: dateStr,
    t: timestamp,
    close: price
  };
}

/**
 * Legacy compatibility: safe replacement for direct toISOString() calls
 * @param d - Any date-like value (for backward compatibility)
 * @returns ISO date string or empty string
 */
export const toIsoDay = (d: unknown): string => isoDate(d) ?? '';

/**
 * Compute UTC date range for time windows (7D, 30D, 90D)
 * Returns actual Date objects for proper database comparison
 * @param window - Time window string
 * @returns Start and end Date objects (end-exclusive)
 */
export function computeUtcDateRange(window: string): { startDate: Date; endDate: Date } {
  const todayUTC = utcStartOfDay(new Date());
  const days = window === '7D' ? 7 : window === '30D' ? 30 : 90;
  
  const startDate = addDaysUTC(todayUTC, -days);
  const endDate = addDaysUTC(todayUTC, 1); // End-exclusive, includes "today"
  
  return { startDate, endDate };
}

/**
 * Get UTC start of day for a given date
 */
export function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Add days to a UTC date
 */
export function addDaysUTC(d: Date, n: number): Date {
  const result = new Date(d.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}