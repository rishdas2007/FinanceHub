# ETF Cache Poisoning Fix - Implementation Plan

## Problem Summary
ETF Technical Metrics table displaying cached fallback data (RSI=50.0, MACD=N/A, "Invalid Date") despite database containing real technical indicators. Root cause: cache poisoning with stale fallback responses served repeatedly.

## Confirmed Database State ✅
**Real data exists and is accessible:**
```sql
-- Current database contains valid technical indicators:
SPY: RSI=58.29, %B=0.6140, MACD=5.6503 (2025-08-05)
XLY: RSI=68.16, %B=0.6500, MACD=8.2560 (2025-07-23)  
XLC: RSI=68.16, %B=0.6500, MACD=8.2560 (2025-07-23)
```

## Critical Issues Identified

### 1. Frontend Timestamp Bug
**Location**: `/client/src/components/ETFMetricsTableOptimized.tsx:260`
**Issue**: `new Date(data.timestamp)` when timestamp is undefined/invalid

### 2. Cache Contamination
**Location**: `/server/services/etf-metrics-service.ts:265-275`  
**Issue**: Serving cached fallback data without quality validation

### 3. Service Architecture Chaos
**Issue**: 4 competing ETF service implementations causing confusion

## Implementation Plan

---

## Phase 1: Immediate Cache Clearing & Validation (Priority 1)

### Task 1.1: Clear All ETF Caches
**Goal**: Force fresh database queries by clearing contaminated cache

#### Code Changes:

**File**: `/server/services/cache-unified.ts`
```typescript
// Add cache clearing method
export class CacheService {
  // ... existing code ...

  /**
   * Clear all ETF-related cache entries to force fresh data retrieval
   */
  clearETFCaches(): void {
    const etfCacheKeys = [
      'etf-metrics-fast',
      'etf-metrics-standard', 
      'etf-metrics-cache',
      'etf-technical-indicators',
      'etf-zscore-data',
      'consolidated-etf-metrics'
    ];
    
    etfCacheKeys.forEach(key => {
      this.cache.del(key);
      console.log(`🧹 Cleared cache key: ${key}`);
    });
    
    console.log('✅ All ETF caches cleared - fresh data will be fetched');
  }
}
```

**File**: `/scripts/clear-etf-cache.ts` (NEW FILE)
```typescript
import { cacheService } from '../server/services/cache-unified';
import { logger } from '../shared/utils/logger';

async function clearETFCache() {
  console.log('🧹 Starting ETF cache clearing process...');
  
  try {
    // Clear all ETF-related caches
    cacheService.clearETFCaches();
    
    // Verify cache is empty
    const testKeys = ['etf-metrics-fast', 'etf-metrics-standard'];
    const remainingData = testKeys.map(key => cacheService.get(key)).filter(Boolean);
    
    if (remainingData.length === 0) {
      console.log('✅ ETF cache successfully cleared');
      console.log('📊 Next API request will fetch fresh data from database');
    } else {
      console.log('⚠️ Some cache entries may still exist');
    }
    
  } catch (error) {
    console.error('❌ Failed to clear ETF cache:', error);
  }
}

clearETFCache();
```

### Task 1.2: Add Cache Quality Validation
**Goal**: Prevent caching of fallback data patterns

#### Code Changes:

**File**: `/server/services/etf-metrics-service.ts`
```typescript
// Add after line 10 imports
import { validateETFDataQuality } from './etf-data-quality-validator';

// Replace cache retrieval logic around lines 265-275
async getConsolidatedETFMetrics(): Promise<ETFMetrics[]> {
  const startTime = Date.now();
  
  try {
    return await etfMetricsCircuitBreaker.execute(async () => {
      // 1. Check fast cache first BUT validate quality
      const fastCached = cacheService.get(this.FAST_CACHE_KEY);
      if (fastCached && this.validateCachedDataQuality(fastCached)) {
        logger.info(`⚡ ETF metrics served from VALIDATED fast cache`);
        return fastCached;
      } else if (fastCached) {
        logger.warn(`🚨 Fast cache contains poor quality data - clearing and refetching`);
        cacheService.delete(this.FAST_CACHE_KEY);
      }

      // 2. Check standard cache with validation
      const standardCached = cacheService.get(this.STANDARD_CACHE_KEY);  
      if (standardCached && this.validateCachedDataQuality(standardCached)) {
        logger.info(`📊 ETF metrics served from VALIDATED standard cache`);
        return standardCached;
      } else if (standardCached) {
        logger.warn(`🚨 Standard cache contains poor quality data - clearing and refetching`);
        cacheService.delete(this.STANDARD_CACHE_KEY);
      }
      
      // 3. Fetch fresh data from database
      const freshMetrics = await this.fetchFreshETFMetrics();
      
      // 4. Validate fresh data before caching
      if (this.validateCachedDataQuality(freshMetrics)) {
        // Cache validated data
        cacheService.set(this.FAST_CACHE_KEY, freshMetrics, this.FAST_CACHE_TTL);
        cacheService.set(this.STANDARD_CACHE_KEY, freshMetrics, this.STANDARD_CACHE_TTL);
        logger.info(`✅ Fresh validated ETF data cached`);
      } else {
        logger.error(`🚨 Fresh data failed quality validation - not caching`);
      }
      
      return freshMetrics;
    });
  } catch (error) {
    // ... existing error handling
  }
}

/**
 * Validate ETF data quality before caching or serving
 */
private validateCachedDataQuality(metrics: ETFMetrics[]): boolean {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return false;
  }

  let realDataCount = 0;
  let totalDataPoints = 0;

  for (const metric of metrics) {
    // Check for fake RSI pattern (exactly 50.0)
    if (metric.rsi !== null) {
      totalDataPoints++;
      if (metric.rsi !== 50.0) {
        realDataCount++;
      }
    }

    // Check for fake Z-score pattern (exactly 0.0)
    if (metric.zScore !== null) {
      totalDataPoints++;
      if (Math.abs(metric.zScore) > 0.001) {
        realDataCount++;
      }
    }

    // Check for generic signals (all HOLD is suspicious)
    if (metric.zScoreData?.signal) {
      totalDataPoints++;
      if (metric.zScoreData.signal !== 'HOLD') {
        realDataCount++;
      }
    }
  }

  const qualityRatio = totalDataPoints > 0 ? realDataCount / totalDataPoints : 0;
  const isQualityData = qualityRatio >= 0.5; // At least 50% real data

  logger.info(`📊 Data quality check: ${realDataCount}/${totalDataPoints} real data points (${Math.round(qualityRatio * 100)}%)`);
  
  if (!isQualityData) {
    logger.warn(`🚨 Poor data quality detected - ratio: ${qualityRatio.toFixed(2)}`);
  }

  return isQualityData;
}
```

---

## Phase 2: Frontend Defensive Programming (Priority 1)

### Task 2.1: Fix "Invalid Date" Timestamp Display

#### Code Changes:

**File**: `/client/src/components/ETFMetricsTableOptimized.tsx`
```typescript
// Replace line 260 timestamp rendering:

// BEFORE (line ~260)
<span className="text-xs text-gray-400">
  Updated: {new Date(data.timestamp).toLocaleTimeString()}
</span>

// AFTER
<span className="text-xs text-gray-400">
  Updated: {this.formatTimestamp(data.timestamp)}
</span>

// Add helper method to component:
private formatTimestamp(timestamp: any): string {
  if (!timestamp) {
    return 'Recently';
  }
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Recently';
    }
    return date.toLocaleTimeString();
  } catch (error) {
    return 'Recently';
  }
}
```

### Task 2.2: Add Data Quality Indicators in Frontend

#### Code Changes:

**File**: `/client/src/components/ETFMetricsTable.tsx`
```typescript
// Add after line 598 (ETF count display)
<div className="flex items-center gap-2">
  <BarChart3 className="h-5 w-5 text-blue-400" />
  <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>
  <span className="text-sm text-gray-400">({etfMetrics.length} ETFs)</span>
  
  {/* ADD: Data quality indicator */}
  <span className={`text-xs px-2 py-1 rounded ${this.getDataQualityStyle(etfMetrics)}`}>
    {this.getDataQualityLabel(etfMetrics)}
  </span>
</div>

// Add helper methods:
private getDataQualityStyle(metrics: any[]): string {
  const realDataRatio = this.calculateRealDataRatio(metrics);
  if (realDataRatio >= 0.8) return 'bg-green-900/30 text-green-400 border border-green-500/30';
  if (realDataRatio >= 0.5) return 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30';
  return 'bg-red-900/30 text-red-400 border border-red-500/30';
}

private getDataQualityLabel(metrics: any[]): string {
  const realDataRatio = this.calculateRealDataRatio(metrics);
  if (realDataRatio >= 0.8) return 'Live Data';
  if (realDataRatio >= 0.5) return 'Mixed Data';
  return 'Cached Data';
}

private calculateRealDataRatio(metrics: any[]): number {
  if (!metrics.length) return 0;
  
  let realCount = 0;
  let totalChecks = 0;
  
  metrics.forEach(metric => {
    // Check RSI for fake 50.0 pattern
    if (metric.rsi !== null) {
      totalChecks++;
      if (metric.rsi !== 50.0) realCount++;
    }
    
    // Check Z-scores for fake 0.0 pattern
    if (metric.zScoreData?.compositeZScore !== null) {
      totalChecks++;
      if (Math.abs(metric.zScoreData.compositeZScore) > 0.001) realCount++;
    }
  });
  
  return totalChecks > 0 ? realCount / totalChecks : 0;
}
```

---

## Phase 3: Backend Cache Quality Gates (Priority 1)

### Task 3.1: Create ETF Data Quality Validator Service

#### Code Changes:

**File**: `/server/services/etf-data-quality-validator.ts` (NEW FILE)
```typescript
import { logger } from '../../shared/utils/logger';

export interface ETFDataQualityReport {
  isValid: boolean;
  realDataRatio: number;
  totalDataPoints: number;
  realDataPoints: number;
  issues: string[];
  recommendation: 'CACHE' | 'REJECT' | 'WARN';
}

export class ETFDataQualityValidator {
  
  /**
   * Validate ETF metrics data quality before caching
   */
  static validateETFMetrics(metrics: any[]): ETFDataQualityReport {
    const report: ETFDataQualityReport = {
      isValid: false,
      realDataRatio: 0,
      totalDataPoints: 0,
      realDataPoints: 0,
      issues: [],
      recommendation: 'REJECT'
    };

    if (!Array.isArray(metrics) || metrics.length === 0) {
      report.issues.push('No metrics data provided');
      return report;
    }

    let realDataCount = 0;
    let totalDataPoints = 0;
    let fakeRSICount = 0;
    let fakeZScoreCount = 0;
    let allHoldSignals = 0;

    for (const metric of metrics) {
      // 1. Check RSI for fake 50.0 pattern
      if (metric.rsi !== null && metric.rsi !== undefined) {
        totalDataPoints++;
        if (metric.rsi === 50.0) {
          fakeRSICount++;
        } else {
          realDataCount++;
        }
      }

      // 2. Check Z-scores for fake 0.0 pattern  
      if (metric.zScoreData?.compositeZScore !== null && metric.zScoreData?.compositeZScore !== undefined) {
        totalDataPoints++;
        if (Math.abs(metric.zScoreData.compositeZScore) <= 0.001) {
          fakeZScoreCount++;
        } else {
          realDataCount++;
        }
      }

      // 3. Check for generic HOLD signals (suspicious if all are HOLD)
      if (metric.zScoreData?.signal) {
        if (metric.zScoreData.signal === 'HOLD') {
          allHoldSignals++;
        }
      }

      // 4. Check for N/A MACD values (indicator of missing data)
      if (metric.components?.macdZ === null || metric.components?.macdZ === undefined) {
        report.issues.push(`${metric.symbol}: MACD data missing`);
      }
    }

    // Calculate quality metrics
    report.totalDataPoints = totalDataPoints;
    report.realDataPoints = realDataCount;
    report.realDataRatio = totalDataPoints > 0 ? realDataCount / totalDataPoints : 0;

    // Quality thresholds
    const HIGH_QUALITY_THRESHOLD = 0.8;  // 80% real data
    const ACCEPTABLE_QUALITY_THRESHOLD = 0.5;  // 50% real data

    // Issue detection
    if (fakeRSICount >= metrics.length * 0.8) {
      report.issues.push(`Fake RSI pattern: ${fakeRSICount}/${metrics.length} ETFs have RSI=50.0`);
    }

    if (fakeZScoreCount >= totalDataPoints * 0.8) {
      report.issues.push(`Fake Z-score pattern: ${fakeZScoreCount} zero Z-scores detected`);
    }

    if (allHoldSignals >= metrics.length * 0.8) {
      report.issues.push(`Generic signals: ${allHoldSignals}/${metrics.length} ETFs showing HOLD`);
    }

    // Quality determination
    if (report.realDataRatio >= HIGH_QUALITY_THRESHOLD) {
      report.isValid = true;
      report.recommendation = 'CACHE';
    } else if (report.realDataRatio >= ACCEPTABLE_QUALITY_THRESHOLD) {
      report.isValid = true;
      report.recommendation = 'WARN';
    } else {
      report.isValid = false;
      report.recommendation = 'REJECT';
    }

    // Logging
    logger.info(`📊 ETF Data Quality Report:`, {
      realDataRatio: report.realDataRatio,
      totalDataPoints: report.totalDataPoints,
      realDataPoints: report.realDataPoints,
      recommendation: report.recommendation,
      issues: report.issues
    });

    return report;
  }

  /**
   * Check if cached data should be invalidated
   */
  static shouldInvalidateCache(cachedMetrics: any[]): boolean {
    const report = this.validateETFMetrics(cachedMetrics);
    return report.recommendation === 'REJECT';
  }
}
```

### Task 3.2: Integrate Quality Validation into ETF Service

#### Code Changes:

**File**: `/server/services/etf-metrics-service.ts`
```typescript
// Add import after line 10
import { ETFDataQualityValidator } from './etf-data-quality-validator';

// Replace getConsolidatedETFMetrics method (lines ~250-300)
async getConsolidatedETFMetrics(): Promise<ETFMetrics[]> {
  const startTime = Date.now();
  
  try {
    return await etfMetricsCircuitBreaker.execute(async () => {
      // 1. Check fast cache with quality validation
      const fastCached = cacheService.get(this.FAST_CACHE_KEY);
      if (fastCached) {
        const qualityReport = ETFDataQualityValidator.validateETFMetrics(fastCached);
        
        if (qualityReport.recommendation === 'CACHE') {
          logger.info(`⚡ ETF metrics served from VALIDATED fast cache (${qualityReport.realDataRatio.toFixed(2)} quality)`);
          return fastCached;
        } else {
          logger.warn(`🚨 Fast cache failed quality check (${qualityReport.realDataRatio.toFixed(2)} real data) - clearing`);
          cacheService.delete(this.FAST_CACHE_KEY);
        }
      }

      // 2. Check standard cache with quality validation
      const standardCached = cacheService.get(this.STANDARD_CACHE_KEY);
      if (standardCached) {
        const qualityReport = ETFDataQualityValidator.validateETFMetrics(standardCached);
        
        if (qualityReport.recommendation !== 'REJECT') {
          logger.info(`📊 ETF metrics served from standard cache (${qualityReport.realDataRatio.toFixed(2)} quality)`);
          return standardCached;
        } else {
          logger.warn(`🚨 Standard cache failed quality check - clearing`);
          cacheService.delete(this.STANDARD_CACHE_KEY);
        }
      }

      // 3. Fetch fresh data from database
      logger.info(`🔄 Fetching fresh ETF data from database`);
      const freshMetrics = await this.fetchFreshETFMetrics();
      
      // 4. Validate fresh data before caching
      const freshQualityReport = ETFDataQualityValidator.validateETFMetrics(freshMetrics);
      
      if (freshQualityReport.recommendation === 'CACHE') {
        // Cache high-quality data
        cacheService.set(this.FAST_CACHE_KEY, freshMetrics, this.FAST_CACHE_TTL);
        cacheService.set(this.STANDARD_CACHE_KEY, freshMetrics, this.STANDARD_CACHE_TTL);
        logger.info(`✅ Fresh high-quality ETF data cached (${freshQualityReport.realDataRatio.toFixed(2)} real data)`);
      } else if (freshQualityReport.recommendation === 'WARN') {
        // Cache with short TTL
        cacheService.set(this.STANDARD_CACHE_KEY, freshMetrics, 2 * 60 * 1000); // 2 minute TTL
        logger.warn(`⚠️ Fresh data has quality issues but cached temporarily (${freshQualityReport.realDataRatio.toFixed(2)} real data)`);
      } else {
        logger.error(`❌ Fresh data failed quality validation - serving without caching`);
      }

      performanceBudgetMonitor.recordMetric('etf-metrics', Date.now() - startTime, process.memoryUsage().heapUsed / 1024 / 1024);
      
      return freshMetrics;
    });

  } catch (error: any) {
    if (error?.name === 'CircuitBreakerError') {
      logger.error('🚨 Circuit breaker triggered for ETF metrics:', error);
    } else {
      logger.error('❌ ETF metrics service error:', error);
    }
    return this.getFallbackMetrics();
  }
}

/**
 * Fetch fresh metrics with comprehensive data assembly
 */
private async fetchFreshETFMetrics(): Promise<ETFMetrics[]> {
  logger.info(`🔄 Starting fresh ETF data fetch from database`);
  
  // Get all required data in parallel
  const [prices, technicals, zscoreData, momentumData, standardIndicators] = await Promise.all([
    this.getLatestPricesWithRealTime(),
    this.getLatestTechnicalIndicatorsFromDB(),
    this.getLatestZScoreData(),
    this.getMomentumData(),
    this.getStandardTechnicalIndicators()
  ]);

  logger.info(`📊 Data fetch complete: ${prices.size} prices, ${technicals.size} technicals, ${zscoreData.size} zscores`);

  // Process ETF metrics in parallel
  const processedMetrics = await Promise.all(
    this.ETF_SYMBOLS.map(symbol => this.processETFMetricParallel(symbol, technicals, zscoreData, momentumData, prices, standardIndicators))
  );
  
  logger.info(`⚡ Processed ${processedMetrics.length} ETFs in parallel`);
  return processedMetrics;
}
```

### Task 2.3: Fix API Response Timestamp

#### Code Changes:

**File**: `/server/routes.ts`
```typescript
// Fix around line 357 - ensure timestamp is always included
app.get('/api/etf-metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    console.log('📊 ETF Metrics API called');
    
    const rawMetrics = await etfMetricsService.getConsolidatedETFMetrics();
    
    // FIX: Ensure metrics is always an array (never null)
    const metrics = Array.isArray(rawMetrics) ? rawMetrics : [];
    
    const responseTime = Date.now() - startTime;
    console.log(`⚡ ETF Metrics response time: ${responseTime}ms`);
    
    // CONSISTENT RESPONSE FORMAT: Always include valid timestamp
    res.json({
      success: true,
      data: { 
        rows: metrics, 
        meta: { 
          count: metrics.length, 
          horizon: req.query.horizon || '60D',
          dataQuality: metrics.length > 0 ? 'available' : 'limited'
        } 
      },
      timestamp: new Date().toISOString(), // ✅ Always valid timestamp
      source: 'fast-market-aware-pipeline',
      responseTime
    });
    
  } catch (error) {
    console.error('❌ ETF Metrics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ETF metrics',
      timestamp: new Date().toISOString(), // ✅ Always valid timestamp even on error
      source: 'error-fallback'
    });
  }
});
```

---

## Phase 4: Service Consolidation (Priority 2)

### Task 4.1: Disable Competing ETF Services

#### Code Changes:

**File**: `/server/routes.ts` 
```typescript
// Comment out or remove duplicate ETF routes:

// DISABLE these routes temporarily:
// app.get('/api/etf-metrics-v2', ...)
// app.get('/api/etf-metrics-direct', ...)  
// app.get('/api/fast-etf-metrics', ...)

// Add route consolidation middleware
app.get('/api/etf-metrics*', (req, res, next) => {
  // Redirect all ETF metrics requests to primary endpoint
  if (req.path !== '/api/etf-metrics') {
    logger.warn(`🔄 Redirecting ${req.path} to /api/etf-metrics`);
    return res.redirect('/api/etf-metrics');
  }
  next();
});
```

### Task 4.2: Archive Unused ETF Services

#### Code Changes:

**Move to archive folder**:
- `/server/services/etf-metrics-service-v2.ts` → `/archive/etf-metrics-service-v2.ts`
- `/server/services/etf-metrics-fallback.ts` → `/archive/etf-metrics-fallback.ts`  
- `/server/routes/etf-metrics-direct-fix.ts` → `/archive/etf-metrics-direct-fix.ts`

**Update import statements** to only reference primary service:
```typescript
// In routes.ts and other files, ensure only:
import { ETFMetricsService } from './services/etf-metrics-service';
```

---

## Phase 5: Testing & Validation Scripts (Priority 2)

### Task 5.1: Create Cache Validation Script

#### Code Changes:

**File**: `/scripts/validate-etf-cache-quality.ts` (NEW FILE)
```typescript
import { ETFMetricsService } from '../server/services/etf-metrics-service';
import { ETFDataQualityValidator } from '../server/services/etf-data-quality-validator';
import { cacheService } from '../server/services/cache-unified';
import { logger } from '../shared/utils/logger';

async function validateETFCacheQuality() {
  console.log('🔍 Starting ETF cache quality validation...');
  
  try {
    const etfService = new ETFMetricsService();
    
    // 1. Check current cache quality
    const fastCached = cacheService.get('etf-metrics-fast');
    if (fastCached) {
      const fastReport = ETFDataQualityValidator.validateETFMetrics(fastCached);
      console.log(`📊 Fast Cache Quality: ${fastReport.realDataRatio.toFixed(2)} (${fastReport.recommendation})`);
      
      if (fastReport.recommendation === 'REJECT') {
        console.log('🧹 Clearing contaminated fast cache...');
        cacheService.delete('etf-metrics-fast');
      }
    }

    const standardCached = cacheService.get('etf-metrics-standard');
    if (standardCached) {
      const standardReport = ETFDataQualityValidator.validateETFMetrics(standardCached);
      console.log(`📊 Standard Cache Quality: ${standardReport.realDataRatio.toFixed(2)} (${standardReport.recommendation})`);
      
      if (standardReport.recommendation === 'REJECT') {
        console.log('🧹 Clearing contaminated standard cache...');
        cacheService.delete('etf-metrics-standard');
      }
    }

    // 2. Test fresh data quality
    console.log('🔄 Testing fresh data fetch...');
    const freshMetrics = await etfService.getConsolidatedETFMetrics();
    const freshReport = ETFDataQualityValidator.validateETFMetrics(freshMetrics);
    
    console.log('');
    console.log('📈 Fresh Data Quality Report:');
    console.log(`   Real Data Ratio: ${freshReport.realDataRatio.toFixed(2)}`);
    console.log(`   Total Data Points: ${freshReport.totalDataPoints}`);
    console.log(`   Real Data Points: ${freshReport.realDataPoints}`);
    console.log(`   Recommendation: ${freshReport.recommendation}`);
    
    if (freshReport.issues.length > 0) {
      console.log('⚠️ Quality Issues:');
      freshReport.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    // 3. Sample data verification
    console.log('');
    console.log('📊 Sample ETF Data:');
    console.log('Symbol | RSI   | MACD  | Z-Score | Signal | Quality');
    console.log('-------|-------|-------|---------|--------|--------');
    
    freshMetrics.slice(0, 5).forEach(metric => {
      const rsi = metric.rsi?.toFixed(1) || 'N/A';
      const macd = metric.components?.macdZ?.toFixed(3) || 'N/A';
      const zscore = metric.zScoreData?.compositeZScore?.toFixed(3) || 'N/A';
      const signal = metric.zScoreData?.signal || 'N/A';
      const quality = (metric.rsi === 50.0) ? '❌ FAKE' : '✅ REAL';
      
      console.log(`${metric.symbol.padEnd(6)} | ${rsi.padEnd(5)} | ${macd.padEnd(5)} | ${zscore.padEnd(7)} | ${signal.padEnd(6)} | ${quality}`);
    });

  } catch (error) {
    console.error('❌ Cache validation failed:', error);
  }
}

validateETFCacheQuality();
```

### Task 5.2: Create End-to-End Validation Script

#### Code Changes:

**File**: `/scripts/test-etf-pipeline-e2e.ts` (NEW FILE)
```typescript
import axios from 'axios';
import { ETFDataQualityValidator } from '../server/services/etf-data-quality-validator';

async function testETFPipelineE2E() {
  console.log('🧪 Starting ETF pipeline end-to-end test...');
  
  try {
    // 1. Test API endpoint directly
    const response = await axios.get('http://localhost:3000/api/etf-metrics');
    
    console.log('📡 API Response Status:', response.status);
    console.log('📊 API Response Structure:', {
      success: response.data.success,
      hasData: !!response.data.data,
      rowCount: response.data.data?.rows?.length || 0,
      hasTimestamp: !!response.data.timestamp,
      timestamp: response.data.timestamp
    });

    // 2. Validate data quality
    const metrics = response.data.data?.rows || [];
    const qualityReport = ETFDataQualityValidator.validateETFMetrics(metrics);
    
    console.log('');
    console.log('🎯 End-to-End Quality Results:');
    console.log(`   API Responds: ${response.status === 200 ? '✅' : '❌'}`);
    console.log(`   Data Available: ${metrics.length > 0 ? '✅' : '❌'}`);
    console.log(`   Valid Timestamp: ${response.data.timestamp && !response.data.timestamp.includes('Invalid') ? '✅' : '❌'}`);
    console.log(`   Real Data Ratio: ${qualityReport.realDataRatio.toFixed(2)} ${qualityReport.realDataRatio >= 0.8 ? '✅' : '❌'}`);
    console.log(`   Quality Recommendation: ${qualityReport.recommendation}`);

    // 3. Test specific ETFs
    console.log('');
    console.log('🔍 Individual ETF Analysis:');
    ['SPY', 'XLY', 'XLC'].forEach(symbol => {
      const etf = metrics.find(m => m.symbol === symbol);
      if (etf) {
        const rsi = etf.rsi;
        const zscore = etf.zScoreData?.compositeZScore;
        const signal = etf.zScoreData?.signal;
        
        const rsiQuality = (rsi === 50.0) ? '❌ FAKE' : '✅ REAL';
        const zscoreQuality = (Math.abs(zscore || 0) <= 0.001) ? '❌ FAKE' : '✅ REAL';
        
        console.log(`   ${symbol}: RSI=${rsi} ${rsiQuality}, Z=${zscore?.toFixed(3)} ${zscoreQuality}, Signal=${signal}`);
      } else {
        console.log(`   ${symbol}: ❌ NOT FOUND`);
      }
    });

    return {
      apiWorking: response.status === 200,
      dataAvailable: metrics.length > 0,
      qualityAcceptable: qualityReport.realDataRatio >= 0.5,
      timestampValid: response.data.timestamp && !response.data.timestamp.includes('Invalid')
    };

  } catch (error) {
    console.error('❌ End-to-end test failed:', error);
    return {
      apiWorking: false,
      dataAvailable: false,
      qualityAcceptable: false,
      timestampValid: false
    };
  }
}

// Run test if called directly
if (require.main === module) {
  testETFPipelineE2E().then(results => {
    console.log('');
    console.log('🏁 End-to-End Test Results:', results);
    const allPassed = Object.values(results).every(Boolean);
    console.log(`Overall Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    process.exit(allPassed ? 0 : 1);
  });
}

export { testETFPipelineE2E };
```

---

## Phase 6: Frontend Data Quality Enhancement (Priority 3)

### Task 6.1: Enhance useEtfMetrics Hook

#### Code Changes:

**File**: `/client/src/hooks/useEtfMetrics.ts`
```typescript
// Add data quality validation to the hook
export function useEtfMetrics(horizon: string = '60D') {
  const [dataQuality, setDataQuality] = useState<'high' | 'medium' | 'low' | 'unknown'>('unknown');
  
  // ... existing hook logic ...

  useEffect(() => {
    // Validate data quality when data changes
    if (data?.rows) {
      const qualityScore = calculateFrontendDataQuality(data.rows);
      setDataQuality(qualityScore);
    }
  }, [data]);

  return {
    data,
    isLoading,
    isError,
    dataQuality, // ✅ New field for frontend quality indication
    refetch: () => {
      // Force cache bust on manual refresh
      return queryClient.invalidateQueries(['etfMetrics', horizon]);
    }
  };
}

function calculateFrontendDataQuality(metrics: any[]): 'high' | 'medium' | 'low' {
  if (!metrics.length) return 'low';
  
  let realDataCount = 0;
  let totalChecks = 0;
  
  metrics.forEach(metric => {
    // Check for fake RSI=50.0 pattern
    if (metric.rsi !== null) {
      totalChecks++;
      if (metric.rsi !== 50.0) realDataCount++;
    }
    
    // Check for missing MACD
    if (metric.components?.macdZ !== undefined) {
      totalChecks++;
      if (metric.components.macdZ !== null) realDataCount++;
    }
  });
  
  const ratio = totalChecks > 0 ? realDataCount / totalChecks : 0;
  
  if (ratio >= 0.8) return 'high';
  if (ratio >= 0.5) return 'medium';
  return 'low';
}
```

---

## Execution Order & Commands

### Step 1: Clear Contaminated Caches (IMMEDIATE)
```bash
cd "/Users/rishabhdas/Downloads/financehub v30_20250816"
npm run tsx scripts/clear-etf-cache.ts
```

### Step 2: Apply Frontend Fixes (15 minutes)
```bash
# Fix timestamp rendering in ETFMetricsTableOptimized.tsx
# Fix API response timestamp in routes.ts
```

### Step 3: Implement Cache Quality Validation (30 minutes)
```bash
# Create etf-data-quality-validator.ts
# Update etf-metrics-service.ts with quality gates
```

### Step 4: Test and Validate (15 minutes)
```bash
npm run tsx scripts/validate-etf-cache-quality.ts
npm run tsx scripts/test-etf-pipeline-e2e.ts
```

### Step 5: Service Consolidation (30 minutes)
```bash
# Archive duplicate services
# Update route consolidation
# Test unified endpoint
```

## Expected Results After Implementation

### Frontend Display:
- **RSI Column**: Real values (58.29, 68.16, etc.) instead of uniform 50.0
- **MACD Column**: Real calculations (5.6503, 8.2560) instead of N/A
- **%B Column**: Real Bollinger values (61.40%, 65.00%) instead of uniform 50.0%
- **Header Timestamp**: Valid time display instead of "Invalid Date"
- **Z-Scores**: Real statistical values instead of "Z: N/A"

### System Health:
- **Cache Quality**: >80% real data ratio maintained
- **API Performance**: <500ms response time with quality validation
- **Data Freshness**: Database queries successful within 14-day window
- **Service Reliability**: Single consolidated ETF service endpoint

## Rollback Plan

If issues occur during implementation:

1. **Restore Cache**: Re-enable caching without quality validation temporarily
2. **Revert Frontend**: Use original timestamp rendering  
3. **Re-enable Services**: Restore multiple ETF service routes
4. **Database Fallback**: Use cached ETF data from `database_complete_backup_20250816_190404.sql`

## Risk Assessment

**Low Risk**: Frontend timestamp fixes (isolated changes)
**Medium Risk**: Cache quality validation (may impact performance)  
**High Risk**: Service consolidation (may break existing integrations)

**Mitigation**: Implement in phases with testing at each step.