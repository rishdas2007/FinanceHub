// Z-Score color coding utility with proper polarity handling

type Component = 'macdZ' | 'rsiZ' | 'bollZ' | 'maGapZ' | 'mom5dZ';

// Polarity mapping: +1 = higher is bullish, -1 = lower is bullish (mean-reversion)
const POLARITY: Record<Component, 1 | -1> = {
  macdZ: +1,     // higher MACD vs history = bullish trend
  maGapZ: +1,    // higher MA gap vs history = bullish trend  
  mom5dZ: +1,    // higher momentum vs history = bullish
  rsiZ: -1,      // lower RSI vs history = oversold = bullish
  bollZ: -1      // lower %B vs history = near lower band = bullish
};

/**
 * Get color class for Z-score based on oriented thresholds
 * @param component The technical indicator component
 * @param z The raw Z-score value
 * @returns Tailwind color class
 */
export function getZScoreColor(component: Component, z?: number | null): string {
  if (z == null || !isFinite(z)) return 'text-gray-300'; // show "—"
  
  // Apply polarity to get oriented score (green = bullish direction)
  const orientedScore = z * POLARITY[component];
  
  if (orientedScore >= 0.75) return 'text-green-300';   // Strong bullish signal
  if (orientedScore <= -0.75) return 'text-red-300';   // Strong bearish signal
  return 'text-yellow-300';                             // Neutral/caution
}

/**
 * Get signal text based on oriented Z-score
 * @param component The technical indicator component  
 * @param z The raw Z-score value
 * @returns Signal description
 */
export function getZScoreSignal(component: Component, z?: number | null): string {
  if (z == null || !isFinite(z)) return 'N/A';
  
  const orientedScore = z * POLARITY[component];
  
  if (orientedScore >= 0.75) return 'Strong';
  if (orientedScore <= -0.75) return 'Weak';
  return 'Neutral';
}

/**
 * Format Z-score with proper sign and precision
 * @param z The Z-score value
 * @param precision Number of decimal places
 * @returns Formatted Z-score string
 */
export function formatZScore(z?: number | null, precision: number = 3): string {
  if (z == null || !isFinite(z)) return 'N/A';
  
  const sign = z >= 0 ? '+' : '';
  return `${sign}${z.toFixed(precision)}`;
}