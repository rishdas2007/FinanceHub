# Z-Score Methodology Issue Analysis

## Current Problem: Inconsistent Data Sources

### What We're Doing Wrong ❌
1. **Current MACD**: Calculated from fresh Twelve Data API prices using `EMA12 - EMA26`
2. **Historical MACD for Z-Score**: Using **static sample values** `[-2.5, -1.2, -0.8, ...]`
3. **Result**: Comparing apples to oranges - not statistically valid

### The Issue
```javascript
// Current reading (authentic)
const macd = calculateMACD(realPrices); // e.g., 6.22 for SPY

// Historical baseline (fake sample data)
const historicalMACD = [-2.5, -1.2, -0.8, -0.3, 0.1, 0.5, 1.2, 1.8, ...];

// Z-Score calculation
const macdZScore = calculateZScore(6.22, historicalMACD); // INVALID COMPARISON
```

### Why This Produces Extreme Z-Scores
- SPY MACD: `6.22` (real calculation)
- Historical mean: `~0.1` (arbitrary sample data)  
- Z-Score: `5.97` (artificially extreme because baselines don't match)

## Required Fix: Consistent Data Sources

### Option 1: Use Database Historical MACD Values ✅
```javascript
// Get historical MACD values calculated with same formula
const historicalQuery = `
  SELECT macd_value 
  FROM technical_indicators_history 
  WHERE symbol = ? AND macd_value IS NOT NULL
  ORDER BY date DESC LIMIT 90
`;
```

### Option 2: Calculate Historical MACD from Price History ✅
```javascript
// Get 150+ days of prices, calculate MACD for each 26-day window
const historicalPrices = await getHistoricalPrices(symbol, 150);
const historicalMACDs = [];
for (let i = 26; i < historicalPrices.length; i++) {
  const window = historicalPrices.slice(i-26, i);
  const macd = calculateMACD(window);
  historicalMACDs.push(macd);
}
```

### Option 3: Use Twelve Data Technical Indicators API ✅
```javascript
// Get pre-calculated MACD history from Twelve Data
const macdHistory = await fetch(`/macd?symbol=${symbol}&interval=1day&outputsize=90`);
```

## Statistical Validity Requirements
- **Same calculation method** for current and historical values
- **Same time period** (daily intervals)
- **Same parameters** (EMA12, EMA26)
- **Sufficient sample size** (30+ historical values minimum)

## Current Z-Score Issues
- **SPY**: 5.97 (should be ~±2 max for reasonable signals)
- **All ETFs**: Showing extreme values due to mismatched baselines
- **Trading signals**: Mostly SELL because Z-scores artificially high

**Status**: Z-Score methodology is fundamentally flawed and needs authentic historical data