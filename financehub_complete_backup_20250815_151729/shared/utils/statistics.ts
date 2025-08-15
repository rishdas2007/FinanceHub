/**
 * Statistical utilities with epsilon guards for financial calculations
 */

const EPS = 1e-8;

export interface StatsSummary {
  mean: number;
  sd: number;
  count: number;
  min: number;
  max: number;
}

/**
 * Safe z-score calculation with epsilon guard
 * Returns 0 when standard deviation is too small to avoid division by zero
 */
export function zScore(x: number, mean: number, sd: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(mean) || !Number.isFinite(sd)) {
    return 0;
  }
  return sd > EPS ? (x - mean) / sd : 0;
}

/**
 * Welford's one-pass algorithm for computing mean and standard deviation
 * More numerically stable than naive implementation
 */
export function welfordStats(values: number[]): StatsSummary {
  if (!values || values.length === 0) {
    return { mean: 0, sd: 0, count: 0, min: 0, max: 0 };
  }

  let count = 0;
  let mean = 0;
  let m2 = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const x of values) {
    if (!Number.isFinite(x)) continue;
    
    count++;
    min = Math.min(min, x);
    max = Math.max(max, x);
    
    const delta = x - mean;
    mean += delta / count;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }

  const variance = count > 1 ? m2 / (count - 1) : 0;
  const sd = Math.sqrt(variance);

  return {
    mean: count > 0 ? mean : 0,
    sd: count > 1 ? sd : 0,
    count,
    min: count > 0 ? min : 0,
    max: count > 0 ? max : 0
  };
}

/**
 * Check if we have sufficient data for reliable statistical analysis
 */
export function hasSufficientData(count: number, sd: number, minObs: number = 180): boolean {
  return count >= minObs && sd > EPS;
}

/**
 * Safe RSI calculation with proper bounds checking
 */
export function calculateRSI(prices: number[], period: number = 14): number | null {
  if (!prices || prices.length < period + 1) {
    return null;
  }

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  if (gains.length < period) {
    return null;
  }

  // Initial average
  let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

  // Smoothed averages for remaining periods
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss < EPS) {
    return 100; // No losses, RSI at maximum
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Math.max(0, Math.min(100, rsi)); // Ensure bounds [0, 100]
}