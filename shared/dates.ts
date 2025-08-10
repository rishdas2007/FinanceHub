/**
 * Robust date utility functions that handle Date | string | number safely
 * Eliminates "toISOString is not a function" errors across the codebase
 */

/**
 * Safely converts any date-like value to ISO date string (YYYY-MM-DD)
 * @param value - Date, string, number, or unknown value
 * @returns ISO date string or null if invalid
 */
export function isoDate(value: unknown): string | null {
  if (value == null) return null;

  // Already an ISO date string?
  if (typeof value === 'string') {
    const s = value.trim();
    // Fast path for 'YYYY-MM-DD...' strings
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // Try to parse other formats
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    return null;
  }

  if (typeof value === 'number') {
    const d = new Date(value); // ms since epoch
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
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
 * @param window - Time window string
 * @returns Start and end ISO date strings
 */
export function computeUtcDateRange(window: string): { startISO: string; endISO: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  
  const days = window === '7D' ? 7 : window === '30D' ? 30 : 90;
  start.setUTCDate(start.getUTCDate() - days);
  
  return { 
    startISO: start.toISOString().slice(0, 10), 
    endISO: end.toISOString().slice(0, 10) 
  };
}