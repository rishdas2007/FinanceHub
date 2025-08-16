# ETF Fake Data Fix - Implementation Plan

## Problem Summary
ETF Technical Metrics are displaying fake/placeholder data (Z-scores all 0.0000, RSI all 50.0, signals all HOLD, "Invalid Date" timestamps) due to overly aggressive database date filters implemented during performance optimization.

## Root Cause Analysis (5-Why)
1. **Why fake data?** → Database-first pipeline failing, falling back to placeholder values
2. **Why pipeline failing?** → No recent technical/price data found in database queries
3. **Why no recent data?** → Overly restrictive date filters (2-day lookback) 
4. **Why restrictive filters?** → Performance optimization prioritized speed over reliability
5. **Why sacrifice reliability?** → Optimization didn't account for weekends/holidays/pipeline delays

## Solution Overview
Extend database lookback periods from 2 days to 14 days to handle weekends, holidays, and data pipeline delays while maintaining caching performance optimizations.

---

## Implementation Steps

### Phase 1: Database Query Date Filter Fixes

#### File: `server/services/etf-metrics-service.ts`

**Change 1: Fix Technical Indicators Lookback**
```typescript
// Line ~407: Extend technical indicators lookback period
private async getLatestTechnicalIndicatorsFromDB(): Promise<Map<string, TechnicalIndicatorData>> {
  const results = new Map();
  const cutoffDate = new Date();
  // OLD: cutoffDate.setDate(cutoffDate.getDate() - 2); // Reduced lookback to 2 days for fresher data
  cutoffDate.setDate(cutoffDate.getDate() - 14); // Extended lookback to 2 weeks to handle weekends/holidays
```

**Change 2: Fix Price Data Lookback**
```typescript
// Line ~364: Extend price data lookback period
private async getLatestPricesFromDB(symbolsToFetch?: string[]) {
  const results = new Map();
  const cutoffDate = new Date();
  // OLD: cutoffDate.setDate(cutoffDate.getDate() - 2); // Reduced lookback to 2 days for fresher data
  cutoffDate.setDate(cutoffDate.getDate() - 14); // Extended lookback to 2 weeks to handle weekends/holidays
```

**Change 3: Update Error Messages**
```typescript
// Line ~425: Update technical data error message
} else {
  // OLD: logger.error(`❌ No recent technical data for ${symbol} in last 7 days`);
  logger.error(`❌ No recent technical data for ${symbol} in last 2 weeks`);
}

// Line ~391: Update price data error message  
} else {
  // OLD: logger.warn(`⚠️ No recent price data for ${symbol} in last 7 days`);
  logger.warn(`⚠️ No recent price data for ${symbol} in last 2 weeks`);
}
```

**Change 4: Keep Z-Score Data Lookback (30 days is appropriate)**
```typescript
// Line ~441: Z-score lookback is already appropriate at 30 days - NO CHANGE NEEDED
private async getLatestZScoreDataFromDB(): Promise<Map<string, ZScoreData>> {
  const results = new Map();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Get data from last 30 days only - KEEP THIS
```

### Phase 2: Data Validation Enhancement

#### File: `server/services/etf-metrics-service.ts`

**Enhancement 1: Add Real Data Validation**
```typescript
// Add after line ~688 in processETFMetricParallel method
private validateRealData(etfMetrics: ETFMetrics): boolean {
  // Check for fake data patterns
  const hasFakeRSI = etfMetrics.rsi === 50.0;
  const hasFakeZScores = etfMetrics.components?.rsiZ === 0.0000 && 
                         etfMetrics.components?.macdZ === 0.0000 && 
                         etfMetrics.components?.bbZ === 0.0000;
  const hasFakeSignals = etfMetrics.rsiSignal === 'HOLD' && 
                         etfMetrics.vwapSignal === 'HOLD' && 
                         etfMetrics.maSignal === 'HOLD';
  
  if (hasFakeRSI || hasFakeZScores || hasFakeSignals) {
    logger.warn(`🚨 FAKE DATA DETECTED for ${etfMetrics.symbol}:`, {
      fakeRSI: hasFakeRSI,
      fakeZScores: hasFakeZScores, 
      fakeSignals: hasFakeSignals
    });
    return false;
  }
  
  return true;
}
```

**Enhancement 2: Add Data Quality Check**
```typescript
// Add after line ~285 in getConsolidatedETFMetrics method
// 9. CRITICAL: Validate data quality before caching
let validMetricsCount = 0;
etfMetrics.forEach(metric => {
  if (this.validateRealData(metric)) {
    validMetricsCount++;
  }
});

const dataQualityRatio = validMetricsCount / etfMetrics.length;
if (dataQualityRatio < 0.5) {
  logger.error(`🚨 DATA QUALITY ALERT: Only ${validMetricsCount}/${etfMetrics.length} ETFs have real data (${(dataQualityRatio * 100).toFixed(1)}%)`);
  
  // Don't cache poor quality data
  logger.warn('⚠️ Skipping cache update due to poor data quality');
} else {
  // Cache results in both standard and fast cache with data provenance
  cacheService.set(this.CACHE_KEY, etfMetrics, this.CACHE_TTL);
  cacheService.set(this.FAST_CACHE_KEY, etfMetrics, this.FAST_CACHE_TTL);
  logger.info(`✅ Cached high-quality data: ${validMetricsCount}/${etfMetrics.length} ETFs validated`);
}
```

### Phase 3: Fallback Strategy Improvement

#### File: `server/services/etf-metrics-service.ts`

**Improvement 1: Smart Fallback Logic**
```typescript
// Replace getFallbackMetrics method around line 1194
private getFallbackMetrics(): ETFMetrics[] {
  logger.warn('⚠️ Using fallback ETF metrics due to service error');
  
  // Try to get cached data first before using empty fallback
  const cachedData = cacheService.get(this.CACHE_KEY) || cacheService.get(this.FAST_CACHE_KEY);
  if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
    logger.info('📦 Using cached data as fallback instead of empty metrics');
    return cachedData as ETFMetrics[];
  }
  
  // Last resort: return empty metrics with clear indicators
  return this.ETF_SYMBOLS.map(symbol => ({
    symbol,
    name: ETFMetricsService.ETF_NAMES[symbol as keyof typeof ETFMetricsService.ETF_NAMES] || symbol,
    price: 0,
    changePercent: 0,
    change30Day: null,
    
    // Required Z-Score weighted fields
    weightedScore: null,
    weightedSignal: 'DATA_UNAVAILABLE', // Clear indicator this is fallback
    zScoreData: null,
    
    // Frontend expects components property
    components: {
      macdZ: null,
      rsi14: null,
      rsiZ: null,
      bbPctB: null,
      bbZ: null,
      maGapPct: null,
      maGapZ: null,
      mom5dZ: null,
    },
    
    bollingerPosition: null,
    bollingerSqueeze: false,
    bollingerStatus: 'SERVICE_UNAVAILABLE', // Clear indicator
    atr: null,
    volatility: null,
    maSignal: 'SERVICE_UNAVAILABLE', // Clear indicator
    maTrend: 'neutral' as const,
    maGap: null,
    rsi: null,
    rsiSignal: 'SERVICE_UNAVAILABLE', // Clear indicator
    rsiDivergence: false,
    zScore: null,
    sharpeRatio: null,
    fiveDayReturn: null,
    volumeRatio: null,
    vwapSignal: 'SERVICE_UNAVAILABLE', // Clear indicator
    obvTrend: 'neutral' as const
  }));
}
```

### Phase 4: Database Data Verification

#### Script: `scripts/verify-etf-data-availability.ts`

```typescript
import { db } from '../server/db.js';
import { technicalIndicators, zscoreTechnicalIndicators, stockData } from '@shared/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';

const ETF_SYMBOLS = [
  'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
];

async function verifyETFDataAvailability() {
  console.log('🔍 Verifying ETF data availability...\n');
  
  const now = new Date();
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(now.getDate() - 14);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  
  console.log(`Checking data from ${twoWeeksAgo.toISOString()} to ${now.toISOString()}\n`);
  
  for (const symbol of ETF_SYMBOLS) {
    console.log(`📊 ${symbol}:`);
    
    // Check price data (last 2 weeks)
    try {
      const priceData = await db
        .select()
        .from(stockData)
        .where(and(
          eq(stockData.symbol, symbol),
          gte(stockData.timestamp, twoWeeksAgo)
        ))
        .orderBy(desc(stockData.timestamp))
        .limit(1);
      
      if (priceData.length > 0) {
        const latest = priceData[0];
        console.log(`  ✅ Price: $${latest.price} (${latest.timestamp.toISOString()})`);
      } else {
        console.log(`  ❌ No price data in last 2 weeks`);
      }
    } catch (error) {
      console.log(`  🚨 Price data error: ${error.message}`);
    }
    
    // Check technical indicators (last 2 weeks)
    try {
      const techData = await db
        .select()
        .from(technicalIndicators)
        .where(and(
          eq(technicalIndicators.symbol, symbol),
          gte(technicalIndicators.timestamp, twoWeeksAgo)
        ))
        .orderBy(desc(technicalIndicators.timestamp))
        .limit(1);
      
      if (techData.length > 0) {
        const latest = techData[0];
        console.log(`  ✅ Technical: RSI=${latest.rsi}, SMA20=${latest.sma_20} (${latest.timestamp.toISOString()})`);
      } else {
        console.log(`  ❌ No technical indicators in last 2 weeks`);
      }
    } catch (error) {
      console.log(`  🚨 Technical data error: ${error.message}`);
    }
    
    // Check Z-score data (last 30 days)
    try {
      const zscoreData = await db
        .select()
        .from(zscoreTechnicalIndicators)
        .where(and(
          eq(zscoreTechnicalIndicators.symbol, symbol),
          gte(zscoreTechnicalIndicators.date, thirtyDaysAgo)
        ))
        .orderBy(desc(zscoreTechnicalIndicators.date))
        .limit(1);
      
      if (zscoreData.length > 0) {
        const latest = zscoreData[0];
        console.log(`  ✅ Z-Score: RSI=${latest.rsiZscore}, MACD=${latest.macdZscore} (${latest.date.toISOString()})`);
      } else {
        console.log(`  ❌ No Z-score data in last 30 days`);
      }
    } catch (error) {
      console.log(`  🚨 Z-score data error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Summary statistics
  const summaryQuery = await db.execute(sql`
    SELECT 
      'price_data' as data_type,
      COUNT(DISTINCT symbol) as symbols_with_data,
      MAX(timestamp) as latest_timestamp
    FROM stock_data 
    WHERE symbol IN (${ETF_SYMBOLS.map(s => `'${s}'`).join(',')})
      AND timestamp >= ${twoWeeksAgo.toISOString()}
    
    UNION ALL
    
    SELECT 
      'technical_indicators' as data_type,
      COUNT(DISTINCT symbol) as symbols_with_data,
      MAX(timestamp) as latest_timestamp
    FROM technical_indicators 
    WHERE symbol IN (${ETF_SYMBOLS.map(s => `'${s}'`).join(',')})
      AND timestamp >= ${twoWeeksAgo.toISOString()}
    
    UNION ALL
    
    SELECT 
      'zscore_data' as data_type,
      COUNT(DISTINCT symbol) as symbols_with_data,
      MAX(date) as latest_timestamp
    FROM zscore_technical_indicators 
    WHERE symbol IN (${ETF_SYMBOLS.map(s => `'${s}'`).join(',')})
      AND date >= ${thirtyDaysAgo.toISOString()}
  `);
  
  console.log('📋 SUMMARY:');
  summaryQuery.rows.forEach(row => {
    console.log(`  ${row.data_type}: ${row.symbols_with_data}/${ETF_SYMBOLS.length} symbols have data (latest: ${row.latest_timestamp})`);
  });
}

// Run verification
verifyETFDataAvailability()
  .then(() => {
    console.log('\n✅ ETF data verification complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ ETF data verification failed:', error);
    process.exit(1);
  });
```

### Phase 5: Testing & Validation

#### Test Script: `scripts/test-etf-metrics-quality.ts`

```typescript
import { etfMetricsService } from '../server/services/etf-metrics-service';
import { logger } from '@shared/utils/logger';

async function testETFMetricsQuality() {
  console.log('🧪 Testing ETF metrics data quality...\n');
  
  try {
    const metrics = await etfMetricsService.getConsolidatedETFMetrics();
    
    console.log(`📊 Retrieved ${metrics.length} ETF metrics\n`);
    
    let realDataCount = 0;
    let fakeDataCount = 0;
    
    metrics.forEach(metric => {
      const hasFakeRSI = metric.rsi === 50.0 || metric.rsi === null;
      const hasFakePrice = metric.price === 0;
      const hasFakeZScores = (
        metric.components?.rsiZ === 0.0000 || metric.components?.rsiZ === null
      ) && (
        metric.components?.macdZ === 0.0000 || metric.components?.macdZ === null
      );
      const hasFakeSignals = (
        metric.rsiSignal === 'HOLD' || 
        metric.rsiSignal === 'DATA_UNAVAILABLE' ||
        metric.rsiSignal === 'SERVICE_UNAVAILABLE'
      );
      
      const isFakeData = hasFakeRSI && hasFakePrice && hasFakeZScores && hasFakeSignals;
      
      if (isFakeData) {
        fakeDataCount++;
        console.log(`❌ ${metric.symbol}: FAKE DATA DETECTED`);
        console.log(`   Price: ${metric.price}, RSI: ${metric.rsi}, RSI Signal: ${metric.rsiSignal}`);
        console.log(`   Z-Scores: RSI=${metric.components?.rsiZ}, MACD=${metric.components?.macdZ}`);
      } else {
        realDataCount++;
        console.log(`✅ ${metric.symbol}: REAL DATA`);
        console.log(`   Price: $${metric.price}, RSI: ${metric.rsi}, Change: ${metric.changePercent}%`);
        if (metric.components) {
          console.log(`   Z-Scores: RSI=${metric.components.rsiZ}, MACD=${metric.components.macdZ}`);
        }
      }
      console.log('');
    });
    
    const realDataPercentage = (realDataCount / metrics.length) * 100;
    
    console.log(`📋 QUALITY SUMMARY:`);
    console.log(`   Real Data: ${realDataCount}/${metrics.length} (${realDataPercentage.toFixed(1)}%)`);
    console.log(`   Fake Data: ${fakeDataCount}/${metrics.length} (${(100 - realDataPercentage).toFixed(1)}%)`);
    
    if (realDataPercentage >= 80) {
      console.log(`\n🎉 SUCCESS: Data quality is GOOD (${realDataPercentage.toFixed(1)}% real data)`);
      return true;
    } else if (realDataPercentage >= 50) {
      console.log(`\n⚠️ WARNING: Data quality is MIXED (${realDataPercentage.toFixed(1)}% real data)`);
      return false;
    } else {
      console.log(`\n🚨 FAILURE: Data quality is POOR (${realDataPercentage.toFixed(1)}% real data)`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run test
testETFMetricsQuality()
  .then(success => {
    if (success) {
      console.log('\n✅ ETF metrics quality test PASSED');
      process.exit(0);
    } else {
      console.log('\n❌ ETF metrics quality test FAILED');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n🚨 Test execution failed:', error);
    process.exit(1);
  });
```

---

## Execution Order

1. **Phase 1**: Apply database query fixes to `etf-metrics-service.ts`
2. **Phase 2**: Add data validation enhancements 
3. **Phase 3**: Improve fallback strategy
4. **Phase 4**: Run data verification script to confirm database has data
5. **Phase 5**: Run quality test to validate fixes work

## Expected Results

After implementation:
- ETF metrics should show real RSI values (not 50.0)
- Z-scores should have meaningful values (not all 0.0000)
- Signals should vary based on technical analysis (not all HOLD)
- Timestamps should be valid dates
- Data quality should be >80% real data

## Rollback Plan

If issues occur:
1. Revert date filter changes back to 2-day lookback
2. Remove data validation enhancements
3. Restore original fallback logic
4. Clear cache to force fresh data fetch

## Monitoring

Monitor these logs after deployment:
- `📊 ETF metrics consolidated from database and cached` - Should show real prices
- `🚨 FAKE DATA DETECTED` - Should be rare after fix
- `❌ No recent technical data` - Should decrease significantly
- `✅ Cached high-quality data` - Should show high percentage of valid ETFs