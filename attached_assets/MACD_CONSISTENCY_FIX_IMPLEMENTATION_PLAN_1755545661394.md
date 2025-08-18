# MACD Calculation Consistency Fix - Detailed Implementation Plan

## Executive Summary

This plan addresses the critical MACD calculation inconsistencies identified in the audit report. The core issue is that current MACD values (~6.0) are calculated from Twelve Data API while historical baselines (~-5.0) come from database z-score tables, creating statistically invalid z-scores.

**Root Cause**: Different data sources and calculation methods for current vs historical MACD values
**Solution**: Implement database-first consistent MACD pipeline with proper EMA storage and historical baselines

## Current State Analysis

### Database Schema ✅ (Correctly Designed)
```sql
-- technicalIndicators table has proper EMA columns
ema_12: decimal("ema_12", { precision: 10, scale: 2 }),
ema_26: decimal("ema_26", { precision: 10, scale: 2 }),
macd_line: decimal("macd_line", { precision: 10, scale: 4 }),
```

### Current Issues ❌
1. **EMA columns are NULL** in actual database records
2. **historical_technical_indicators table is empty**
3. **Multiple data insertion points** don't store EMA values
4. **Z-score calculation uses hardcoded fallbacks** instead of database historical data

## Implementation Plan

---

## Phase 1: Fix Current Data Storage (Priority: Critical)

### Task 1.1: Update ETF Technical Clean Route
**File**: `/server/routes/etf-technical-clean.ts`

**Current MACD Calculation** (Lines 40-51):
```javascript
function calculateMACD(prices: number[]): { macd: number | null; signal: number | null } {
  if (prices.length < 26) return { macd: null, signal: null };
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (!ema12 || !ema26) return { macd: null, signal: null };
  
  const macd = ema12 - ema26;
  return { macd, signal: null }; // ❌ EMA values not returned
}
```

**Updated MACD Calculation**:
```javascript
function calculateMACD(prices: number[]): { 
  macd: number | null; 
  signal: number | null;
  ema12: number | null;
  ema26: number | null;
} {
  if (prices.length < 26) return { macd: null, signal: null, ema12: null, ema26: null };
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (!ema12 || !ema26) return { macd: null, signal: null, ema12: null, ema26: null };
  
  const macd = ema12 - ema26;
  return { macd, signal: null, ema12, ema26 }; // ✅ Return EMA values for storage
}
```

**Updated Usage in Route** (Lines 151-153):
```javascript
// Current
const macdResult = calculateMACD(prices);
technicalData.macd = macdResult.macd;
technicalData.macdSignal = macdResult.signal;

// Updated
const macdResult = calculateMACD(prices);
technicalData.macd = macdResult.macd;
technicalData.macdSignal = macdResult.signal;
technicalData.ema12 = macdResult.ema12; // ✅ Store EMA12
technicalData.ema26 = macdResult.ema26; // ✅ Store EMA26
```

### Task 1.2: Store EMA Values in Database
**File**: `/server/routes/etf-technical-clean.ts` (Lines 238-250)

**Add EMA fields to ETF result object**:
```javascript
const etfResult = {
  symbol: symbol,
  name: `${symbol} ETF`,
  price: parseFloat(quoteData.close),
  changePercent: parseFloat(quoteData.percent_change) || 0,
  ...technicalData,
  ema12: technicalData.ema12,     // ✅ Include EMA12
  ema26: technicalData.ema26,     // ✅ Include EMA26
  zScore: compositeZScore,
  rsiZScore: rsiZScore,
  macdZScore: macdZScore,
  bbZScore: bbZScore,
  signal: generateSignal(compositeZScore),
  lastUpdated: new Date().toISOString()
};
```

### Task 1.3: Update Database Insert Services
**Files to Update**:
1. `/server/services/data-conversion-service.ts` (Lines 140-160)
2. `/server/services/historical-data-integration.ts` (Lines 85-105) 
3. `/server/services/financial-data.ts` (Lines 95-115)

**Example Update for data-conversion-service.ts**:
```javascript
// Current insert (missing EMA values)
await db.insert(technicalIndicators).values({
  symbol: symbol,
  timestamp: currentData.date,
  rsi: technicalData.rsi,
  macd_line: technicalData.macd,
  macdSignal: technicalData.macdSignal,
  // ❌ Missing EMA values
});

// Updated insert (including EMA values)
await db.insert(technicalIndicators).values({
  symbol: symbol,
  timestamp: currentData.date,
  rsi: technicalData.rsi,
  macd_line: technicalData.macd,
  macdSignal: technicalData.macdSignal,
  ema_12: technicalData.ema12,     // ✅ Store EMA12
  ema_26: technicalData.ema26,     // ✅ Store EMA26
  // ... other fields
});
```

---

## Phase 2: Create Historical MACD Baseline (Priority: Critical)

### Task 2.1: Backfill Historical Technical Indicators Table
**File**: `/scripts/backfill-historical-technical-indicators.ts` (NEW FILE)

```javascript
import { db } from '../server/db';
import { technicalIndicators, historicalTechnicalIndicators } from '../shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';
import { logger } from '../shared/utils/logger';

export async function backfillHistoricalTechnicalIndicators() {
  logger.info('🔄 Starting historical technical indicators backfill');
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
  const LOOKBACK_DAYS = 365; // 1 year of historical data
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);
  
  for (const symbol of ETF_SYMBOLS) {
    try {
      // Get existing technical indicators for this symbol
      const existingData = await db.select()
        .from(technicalIndicators)
        .where(and(
          eq(technicalIndicators.symbol, symbol),
          gte(technicalIndicators.timestamp, cutoffDate)
        ))
        .orderBy(desc(technicalIndicators.timestamp))
        .limit(252); // ~1 trading year
      
      logger.info(`📊 Found ${existingData.length} existing records for ${symbol}`);
      
      // Convert to historical format and insert
      for (const record of existingData) {
        // Check if already exists in historical table
        const existing = await db.select()
          .from(historicalTechnicalIndicators)
          .where(and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            eq(historicalTechnicalIndicators.date, record.timestamp)
          ))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(historicalTechnicalIndicators).values({
            symbol: record.symbol,
            rsi: record.rsi,
            macd: record.macd_line,        // Map macd_line to macd
            macd_signal: record.macdSignal, // Map macdSignal to macd_signal
            percent_b: record.percent_b,
            atr: record.atr,
            date: record.timestamp,
            created_at: new Date(),
            updated_at: new Date(),
            // Note: price_change and ma_trend can be calculated if needed
          });
        }
      }
      
      logger.info(`✅ Backfilled historical data for ${symbol}`);
      
    } catch (error) {
      logger.error(`❌ Error backfilling ${symbol}:`, error);
    }
  }
  
  logger.info('🎯 Historical technical indicators backfill completed');
}

// Run if called directly
if (require.main === module) {
  backfillHistoricalTechnicalIndicators()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Backfill failed:', error);
      process.exit(1);
    });
}
```

### Task 2.2: Create Historical Data Service
**File**: `/server/services/historical-macd-service.ts` (NEW FILE)

```javascript
import { db } from '../db';
import { historicalTechnicalIndicators } from '../../shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

export class HistoricalMACDService {
  
  /**
   * Get historical MACD values for z-score calculation
   */
  async getHistoricalMACDValues(symbol: string, lookbackDays: number = 90): Promise<number[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      
      const historicalData = await db.select({
        macd: historicalTechnicalIndicators.macd
      })
        .from(historicalTechnicalIndicators)
        .where(and(
          eq(historicalTechnicalIndicators.symbol, symbol),
          gte(historicalTechnicalIndicators.date, cutoffDate)
        ))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(lookbackDays);
      
      const macdValues = historicalData
        .map(row => row.macd)
        .filter(val => val !== null)
        .map(val => Number(val));
      
      logger.info(`📈 Retrieved ${macdValues.length} historical MACD values for ${symbol}`);
      return macdValues;
      
    } catch (error) {
      logger.error(`❌ Error getting historical MACD for ${symbol}:`, error);
      return [];
    }
  }
  
  /**
   * Calculate Z-score using database historical data
   */
  calculateZScore(currentValue: number, historicalValues: number[]): number | null {
    if (historicalValues.length < 10) {
      logger.warn('Insufficient historical data for z-score calculation');
      return null;
    }
    
    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0; // Avoid division by zero
    
    const zScore = (currentValue - mean) / stdDev;
    
    // Validate reasonable z-score range
    if (Math.abs(zScore) > 5) {
      logger.warn(`Extreme z-score detected: ${zScore} for current=${currentValue}, mean=${mean.toFixed(2)}, stdDev=${stdDev.toFixed(2)}`);
    }
    
    return zScore;
  }
  
  /**
   * Get fallback realistic MACD values if database is insufficient
   */
  getRealisticMACDFallback(symbol: string): number[] {
    // Based on typical ETF MACD ranges - more conservative than current hardcoded values
    const baseFallback = [4.2, 4.8, 5.1, 5.7, 6.2, 6.8, 5.9, 4.5, 5.4, 6.0, 5.2, 4.9, 6.1, 5.8, 5.5];
    
    // Symbol-specific adjustments based on volatility
    const volatilityMultiplier = {
      'SPY': 1.0,    // Base case
      'XLK': 1.2,    // Tech - more volatile  
      'XLE': 1.5,    // Energy - most volatile
      'XLF': 0.8,    // Financials - less volatile
      'XLP': 0.6,    // Consumer staples - least volatile
    }[symbol] || 1.0;
    
    return baseFallback.map(val => val * volatilityMultiplier);
  }
}

export const historicalMACDService = new HistoricalMACDService();
```

---

## Phase 3: Implement Consistent Z-Score Calculation (Priority: Critical)

### Task 3.1: Update ETF Technical Clean Route Z-Score Logic
**File**: `/server/routes/etf-technical-clean.ts` (Lines 175-224)

**Replace Current Hardcoded Logic**:
```javascript
// Current approach (Lines 206-223) - REMOVE
const realisticMACDFallback = [4.2, 4.8, 5.1, 5.7, 6.2, 6.8, ...];
const finalHistoricalMACD = historicalMACDs.length >= 10 ? historicalMACDs : realisticMACDFallback;
const macdZScore = technicalData.macd !== null ? calculateZScore(technicalData.macd, finalHistoricalMACD) : null;
```

**New Database-First Approach**:
```javascript
import { historicalMACDService } from '../services/historical-macd-service';

// Replace the entire historical calculation section (Lines 175-224)
// Calculate Z-scores using consistent database historical data
let rsiZScore = null;
let macdZScore = null;
let bbZScore = null;

// Get historical data for consistent z-score calculation
const historicalMACDs = await historicalMACDService.getHistoricalMACDValues(symbol, 90);
const historicalRSIs = await historicalMACDService.getHistoricalRSIValues(symbol, 90);
const historicalBBs = await historicalMACDService.getHistoricalBBValues(symbol, 90);

// Calculate z-scores using database historical data
if (technicalData.macd !== null) {
  if (historicalMACDs.length >= 30) {
    macdZScore = historicalMACDService.calculateZScore(technicalData.macd, historicalMACDs);
  } else {
    // Use realistic fallback only if insufficient database data
    const fallbackMACDs = historicalMACDService.getRealisticMACDFallback(symbol);
    macdZScore = historicalMACDService.calculateZScore(technicalData.macd, fallbackMACDs);
    console.log(`⚠️ ${symbol}: Using MACD fallback data (${historicalMACDs.length} db records insufficient)`);
  }
}

// Similar logic for RSI and Bollinger %B...

// Validate z-scores before using
const validatedMACDZScore = validateZScore(macdZScore, 'MACD', symbol);
```

### Task 3.2: Add Z-Score Validation Function
**File**: `/server/routes/etf-technical-clean.ts` (NEW FUNCTION)

```javascript
/**
 * Validate z-score reasonableness and cap extreme values
 */
function validateZScore(zscore: number | null, metric: string, symbol: string): number | null {
  if (zscore === null) return null;
  
  // Log extreme z-scores for investigation
  if (Math.abs(zscore) > 4) {
    console.log(`🚨 Extreme ${metric} z-score for ${symbol}: ${zscore.toFixed(2)} - possible calculation error`);
  }
  
  // Cap extreme values to reasonable range
  if (Math.abs(zscore) > 3) {
    const cappedValue = Math.sign(zscore) * 3;
    console.log(`📊 Capping ${metric} z-score for ${symbol}: ${zscore.toFixed(2)} → ${cappedValue}`);
    return cappedValue;
  }
  
  return zscore;
}
```

---

## Phase 4: Database Schema & Migration Updates (Priority: Important)

### Task 4.1: Add Data Consistency Constraints
**File**: `/migrations/add_macd_consistency_constraints.sql` (NEW FILE)

```sql
-- Ensure EMA values are populated when MACD is present
ALTER TABLE technical_indicators 
ADD CONSTRAINT check_macd_ema_consistency 
CHECK (
  (macd_line IS NULL AND ema_12 IS NULL AND ema_26 IS NULL) OR
  (macd_line IS NOT NULL AND ema_12 IS NOT NULL AND ema_26 IS NOT NULL)
);

-- Add index for efficient historical MACD queries
CREATE INDEX IF NOT EXISTS idx_historical_tech_symbol_date_macd 
ON historical_technical_indicators (symbol, date DESC) 
INCLUDE (macd, macd_signal, rsi, percent_b);

-- Add computed column to verify MACD = EMA12 - EMA26 (for validation)
ALTER TABLE technical_indicators 
ADD COLUMN macd_calculated AS (ema_12 - ema_26) STORED;

-- Add check constraint to ensure MACD calculation consistency
ALTER TABLE technical_indicators
ADD CONSTRAINT check_macd_calculation_accuracy
CHECK (ABS(macd_line - (ema_12 - ema_26)) < 0.01);
```

### Task 4.2: Create Data Quality Monitoring Views
**File**: `/migrations/create_macd_quality_views.sql` (NEW FILE)

```sql
-- View to monitor MACD calculation consistency
CREATE OR REPLACE VIEW macd_quality_check AS
SELECT 
  symbol,
  COUNT(*) as total_records,
  COUNT(CASE WHEN ema_12 IS NOT NULL AND ema_26 IS NOT NULL THEN 1 END) as records_with_emas,
  COUNT(CASE WHEN macd_line IS NOT NULL THEN 1 END) as records_with_macd,
  AVG(ABS(macd_line - (ema_12 - ema_26))) as avg_calculation_error,
  MAX(timestamp) as latest_record
FROM technical_indicators 
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY symbol
ORDER BY symbol;

-- View to monitor z-score statistical validity
CREATE OR REPLACE VIEW zscore_validity_check AS
SELECT 
  symbol,
  COUNT(*) as total_records,
  AVG(macd_zscore) as avg_macd_zscore,
  STDDEV(macd_zscore) as stddev_macd_zscore,
  COUNT(CASE WHEN ABS(macd_zscore) > 3 THEN 1 END) as extreme_zscores,
  MAX(date) as latest_record
FROM zscore_technical_indicators 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY symbol
ORDER BY extreme_zscores DESC;
```

---

## Phase 5: Testing & Validation (Priority: Important)

### Task 5.1: Create MACD Consistency Test Script
**File**: `/scripts/test-macd-consistency.ts` (NEW FILE)

```javascript
import { db } from '../server/db';
import { technicalIndicators, historicalTechnicalIndicators } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { historicalMACDService } from '../server/services/historical-macd-service';

async function testMACDConsistency() {
  console.log('🧪 Testing MACD calculation consistency...');
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY'];
  
  for (const symbol of ETF_SYMBOLS) {
    try {
      // Get latest technical indicator record
      const latest = await db.select()
        .from(technicalIndicators)
        .where(eq(technicalIndicators.symbol, symbol))
        .orderBy(desc(technicalIndicators.timestamp))
        .limit(1);
      
      if (latest.length === 0) {
        console.log(`❌ ${symbol}: No technical indicator records found`);
        continue;
      }
      
      const record = latest[0];
      
      // Test 1: Verify MACD = EMA12 - EMA26
      if (record.ema_12 && record.ema_26 && record.macd_line) {
        const calculatedMACD = Number(record.ema_12) - Number(record.ema_26);
        const storedMACD = Number(record.macd_line);
        const difference = Math.abs(calculatedMACD - storedMACD);
        
        console.log(`${symbol}: MACD=${storedMACD.toFixed(4)}, EMA12-EMA26=${calculatedMACD.toFixed(4)}, Diff=${difference.toFixed(4)}`);
        
        if (difference > 0.01) {
          console.log(`⚠️ ${symbol}: MACD calculation inconsistency detected`);
        } else {
          console.log(`✅ ${symbol}: MACD calculation consistent`);
        }
      } else {
        console.log(`❌ ${symbol}: Missing EMA values - EMA12=${record.ema_12}, EMA26=${record.ema_26}`);
      }
      
      // Test 2: Verify historical data availability
      const historicalMACDs = await historicalMACDService.getHistoricalMACDValues(symbol, 90);
      console.log(`📊 ${symbol}: ${historicalMACDs.length} historical MACD values available`);
      
      // Test 3: Calculate and validate z-score
      if (record.macd_line && historicalMACDs.length >= 30) {
        const zScore = historicalMACDService.calculateZScore(Number(record.macd_line), historicalMACDs);
        const isReasonable = zScore !== null && Math.abs(zScore) <= 3;
        
        console.log(`📈 ${symbol}: Current MACD=${Number(record.macd_line).toFixed(4)}, Z-Score=${zScore?.toFixed(2)}, Reasonable=${isReasonable ? '✅' : '❌'}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error testing ${symbol}:`, error);
    }
  }
}

// Run test
testMACDConsistency()
  .then(() => console.log('🎯 MACD consistency test completed'))
  .catch(error => console.error('Test failed:', error));
```

### Task 5.2: Create Z-Score Validation Report
**File**: `/scripts/validate-zscore-distribution.ts` (NEW FILE)

```javascript
async function validateZScoreDistribution() {
  console.log('📊 Validating z-score statistical distribution...');
  
  // Expected: ~68% within ±1, ~95% within ±2, ~99.7% within ±3
  const zscores = await db.select({ macdZScore: zscoreTechnicalIndicators.macdZScore })
    .from(zscoreTechnicalIndicators)
    .where(gte(zscoreTechnicalIndicators.date, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  
  const validZScores = zscores.filter(z => z.macdZScore !== null).map(z => Number(z.macdZScore));
  
  const within1 = validZScores.filter(z => Math.abs(z) <= 1).length;
  const within2 = validZScores.filter(z => Math.abs(z) <= 2).length;
  const within3 = validZScores.filter(z => Math.abs(z) <= 3).length;
  
  console.log(`📈 Z-Score Distribution Analysis (${validZScores.length} samples):`);
  console.log(`   Within ±1: ${within1}/${validZScores.length} (${(within1/validZScores.length*100).toFixed(1)}%) - Expected ~68%`);
  console.log(`   Within ±2: ${within2}/${validZScores.length} (${(within2/validZScores.length*100).toFixed(1)}%) - Expected ~95%`);
  console.log(`   Within ±3: ${within3}/${validZScores.length} (${(within3/validZScores.length*100).toFixed(1)}%) - Expected ~99.7%`);
  
  const extremes = validZScores.filter(z => Math.abs(z) > 3);
  if (extremes.length > 0) {
    console.log(`⚠️ Extreme z-scores found: ${extremes.map(z => z.toFixed(2)).join(', ')}`);
  }
}
```

---

## Phase 6: Monitoring & Alerting (Priority: Medium)

### Task 6.1: Create MACD Data Quality Dashboard
**File**: `/server/routes/macd-quality-dashboard.ts` (NEW FILE)

```javascript
import express from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = express.Router();

router.get('/api/macd-quality-dashboard', async (req, res) => {
  try {
    // Get MACD calculation consistency metrics
    const consistencyCheck = await db.execute(sql`
      SELECT * FROM macd_quality_check ORDER BY avg_calculation_error DESC
    `);
    
    // Get z-score validity metrics  
    const zscoreCheck = await db.execute(sql`
      SELECT * FROM zscore_validity_check ORDER BY extreme_zscores DESC
    `);
    
    // Get historical data coverage
    const historicalCoverage = await db.execute(sql`
      SELECT 
        symbol,
        COUNT(*) as historical_records,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM historical_technical_indicators 
      GROUP BY symbol
      ORDER BY historical_records DESC
    `);
    
    res.json({
      success: true,
      data: {
        consistency: consistencyCheck.rows,
        zscoreValidity: zscoreCheck.rows,
        historicalCoverage: historicalCoverage.rows
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('MACD quality dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quality metrics'
    });
  }
});

export default router;
```

### Task 6.2: Add Alerting for Data Quality Issues
**File**: `/server/services/macd-quality-monitor.ts` (NEW FILE)

```javascript
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

export class MACDQualityMonitor {
  
  async checkDataQuality(): Promise<void> {
    try {
      // Check for missing EMA values
      const missingEMAs = await db.execute(sql`
        SELECT symbol, COUNT(*) as missing_count
        FROM technical_indicators 
        WHERE timestamp >= CURRENT_DATE - INTERVAL '1 day'
          AND macd_line IS NOT NULL 
          AND (ema_12 IS NULL OR ema_26 IS NULL)
        GROUP BY symbol
      `);
      
      if (missingEMAs.rows.length > 0) {
        logger.warn('🚨 Missing EMA values detected:', missingEMAs.rows);
      }
      
      // Check for extreme z-scores
      const extremeZScores = await db.execute(sql`
        SELECT symbol, macd_zscore, date
        FROM zscore_technical_indicators 
        WHERE date >= CURRENT_DATE - INTERVAL '1 day'
          AND ABS(macd_zscore) > 4
        ORDER BY ABS(macd_zscore) DESC
      `);
      
      if (extremeZScores.rows.length > 0) {
        logger.warn('🚨 Extreme MACD z-scores detected:', extremeZScores.rows);
      }
      
      // Check historical data freshness
      const staleDatabases = await db.execute(sql`
        SELECT symbol, MAX(date) as latest_date
        FROM historical_technical_indicators 
        GROUP BY symbol
        HAVING MAX(date) < CURRENT_DATE - INTERVAL '7 days'
      `);
      
      if (staleDatabases.rows.length > 0) {
        logger.warn('🚨 Stale historical data detected:', staleDatabases.rows);
      }
      
    } catch (error) {
      logger.error('❌ MACD quality check failed:', error);
    }
  }
}

export const macdQualityMonitor = new MACDQualityMonitor();
```

---

## Execution Timeline

### Week 1: Critical Foundation
- **Day 1-2**: Update ETF technical clean route to store EMA values (Tasks 1.1-1.2)
- **Day 3**: Update all database insert services to include EMA values (Task 1.3)
- **Day 4-5**: Create and run historical data backfill script (Task 2.1)

### Week 2: Z-Score Consistency 
- **Day 1-2**: Implement historical MACD service (Task 2.2)
- **Day 3-4**: Update z-score calculation logic in ETF route (Task 3.1-3.2)
- **Day 5**: Database schema updates and constraints (Task 4.1-4.2)

### Week 3: Testing & Validation
- **Day 1-2**: Create and run consistency test scripts (Task 5.1-5.2)
- **Day 3-4**: Implement quality monitoring dashboard (Task 6.1)
- **Day 5**: Deploy alerting system (Task 6.2)

## Success Criteria

### Technical Validation
- [ ] All ETF MACD records have non-NULL `ema_12` and `ema_26` values
- [ ] `historical_technical_indicators` table populated with 90+ days per ETF
- [ ] Z-scores follow normal distribution (~95% within ±2)
- [ ] MACD calculation consistency: `|macd_line - (ema_12 - ema_26)| < 0.01`

### User Experience
- [ ] ETF z-scores display reasonable values (-2 to +2 typically)
- [ ] No more extreme z-scores like -7.8, -8.4 in production
- [ ] Statistical validity restored: consistent EMA12-EMA26 calculations

### Expected Results
```
Before Fix:
SPY: MACD=6.19, Z-Score=5.97 (unreasonable)
XLB: MACD=0.08, Z-Score=-7.80 (extreme)

After Fix:  
SPY: MACD=6.19, Z-Score=0.55 (reasonable)
XLB: MACD=0.08, Z-Score=-0.43 (reasonable)
```

## Rollback Plan

If issues occur:
1. **Disable EMA constraints** temporarily
2. **Revert to hardcoded fallback arrays** in ETF route
3. **Restore previous z-score calculation logic**
4. **Keep historical backfill** for future fix attempts

---

**Implementation Status**: 📋 Ready for execution  
**Risk Level**: Medium (database schema changes)  
**Expected Impact**: High (statistical validity restoration)