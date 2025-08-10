/**
 * Chart utility functions for normalizing data and handling empty states
 */

export interface ChartDataPoint {
  date: string;
  price: number;
}

/**
 * Normalizes stock history data from various API response formats
 * to the standard chart format: { date: string, price: number }[]
 */
export function toChartSeries(input: any): ChartDataPoint[] {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((r: any) => ({
      date: r.timestamp || r.datetime || r.date || r.t,
      price: Number(r.close ?? r.price ?? r.c ?? r.adjClose),
    }))
    .filter((r) => r.date && Number.isFinite(r.price))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Formats date for chart axis display
 */
export function formatChartDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return iso.slice(5, 10); // fallback to MM-DD
  }
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