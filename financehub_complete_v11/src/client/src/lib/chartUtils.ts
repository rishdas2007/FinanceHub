/**
 * Chart utility functions for normalizing data and handling empty states
 * Updated to use robust date handling that prevents toISOString errors
 */

export interface ChartDataPoint {
  date: string;
  t?: number;    // numeric timestamp for Recharts
  price: number;
}

/**
 * Normalizes stock history data from various API response formats
 * to the standard chart format. Now handles mixed date formats safely.
 */
export function toChartSeries(input: any): ChartDataPoint[] {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((r: any) => {
      // Extract date/timestamp values safely
      const dateValue = r.timestamp || r.datetime || r.date || r.t;
      const priceValue = Number(r.close ?? r.price ?? r.c ?? r.adjClose);
      const timestampValue = r.t || (dateValue ? Date.parse(dateValue) : undefined);
      
      // Basic validation
      if (!dateValue || !Number.isFinite(priceValue)) return null;
      
      // Ensure date is string format for compatibility
      let dateStr: string;
      if (typeof dateValue === 'string') {
        dateStr = dateValue.slice(0, 10); // YYYY-MM-DD
      } else if (dateValue instanceof Date) {
        dateStr = dateValue.toISOString().slice(0, 10);
      } else if (typeof dateValue === 'number') {
        dateStr = new Date(dateValue).toISOString().slice(0, 10);
      } else {
        return null;
      }
      
      return {
        date: dateStr,
        t: timestampValue,
        price: priceValue
      };
    })
    .filter((r): r is ChartDataPoint => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Formats date for chart axis display - safe version that never throws
 */
export function formatChartDate(value: unknown): string {
  if (!value) return '';
  
  // Handle string dates
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
      // Fallback for ISO strings
      return value.slice(5, 10).replace('-', '/');
    } catch {
      return String(value).slice(5, 10) || String(value);
    }
  }
  
  // Handle numeric timestamps
  if (typeof value === 'number') {
    try {
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    try {
      return value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  }
  
  return String(value);
}

/**
 * Formats date for chart axis display with time (for intraday data)
 */
export function formatChartDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso.slice(5, 16); // fallback to MM-DD HH:mm
  }
}

/**
 * Determines if the data contains intraday timestamps
 */
export function isIntradayData(data: ChartDataPoint[]): boolean {
  return data.some(d => d.date.length > 10); // More than YYYY-MM-DD
}

/**
 * Calculates price change percentage over the series
 */
export function calculatePriceChange(data: ChartDataPoint[]): { 
  change: number; 
  changePercent: number; 
} {
  if (data.length < 2) {
    return { change: 0, changePercent: 0 };
  }
  
  const first = data[0].price;
  const last = data[data.length - 1].price;
  const change = last - first;
  const changePercent = first !== 0 ? (change / first) * 100 : 0;
  
  return { change, changePercent };
}