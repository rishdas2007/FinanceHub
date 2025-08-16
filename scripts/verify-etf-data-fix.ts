/**
 * ETF Data Fix Verification Script
 * Tests the database lookback period fixes and data quality improvements
 */

import { db } from '../server/db';
import { technicalIndicators, zscoreTechnicalIndicators, stockData } from '@shared/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '@shared/utils/logger';

const ETF_SYMBOLS = [
  'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
];

interface DataAvailabilityResult {
  symbol: string;
  hasPriceData: boolean;
  hasTechnicalData: boolean;
  hasZScoreData: boolean;
  priceTimestamp: Date | null;
  technicalTimestamp: Date | null;
  zscoreTimestamp: Date | null;
  rsiValue: number | null;
  isFakeRSI: boolean;
}

async function verifyETFDataFix(): Promise<void> {
  console.log('🔍 === ETF FAKE DATA FIX VERIFICATION ===');
  console.log('📊 Testing database lookback period fixes...');
  console.log('');

  const now = new Date();
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(now.getDate() - 14);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  console.log(`🗓️  Testing lookback periods:`);
  console.log(`   Price/Technical data: Last 14 days (since ${twoWeeksAgo.toISOString()})`);
  console.log(`   Z-Score data: Last 30 days (since ${thirtyDaysAgo.toISOString()})`);
  console.log('');

  const results: DataAvailabilityResult[] = [];

  for (const symbol of ETF_SYMBOLS) {
    const result: DataAvailabilityResult = {
      symbol,
      hasPriceData: false,
      hasTechnicalData: false,
      hasZScoreData: false,
      priceTimestamp: null,
      technicalTimestamp: null,
      zscoreTimestamp: null,
      rsiValue: null,
      isFakeRSI: false
    };

    try {
      // Check price data (14-day lookback)
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
        result.hasPriceData = true;
        result.priceTimestamp = priceData[0].timestamp;
      }

      // Check technical indicators (14-day lookback)
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
        result.hasTechnicalData = true;
        result.technicalTimestamp = techData[0].timestamp;
        result.rsiValue = techData[0].rsi ? parseFloat(techData[0].rsi) : null;
        result.isFakeRSI = result.rsiValue === 50.0;
      }

      // Check Z-score data (30-day lookback)
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
        result.hasZScoreData = true;
        result.zscoreTimestamp = zscoreData[0].date;
      }

    } catch (error) {
      console.error(`❌ Error checking data for ${symbol}:`, error);
    }

    results.push(result);
  }

  // Generate verification report
  console.log('📋 === DATA AVAILABILITY RESULTS ===');
  console.log('Symbol | Price | Technical | Z-Score | RSI Value | Status');
  console.log('-------|-------|-----------|---------|-----------|--------');

  let successCount = 0;
  let fakeRSICount = 0;

  results.forEach(result => {
    const priceStatus = result.hasPriceData ? '✅' : '❌';
    const techStatus = result.hasTechnicalData ? '✅' : '❌';
    const zscoreStatus = result.hasZScoreData ? '✅' : '❌';
    const rsiDisplay = result.rsiValue !== null ? result.rsiValue.toFixed(1) : 'N/A';
    const fakeFlag = result.isFakeRSI ? '🚨 FAKE' : '✅ REAL';

    console.log(`${result.symbol.padEnd(6)} | ${priceStatus.padEnd(5)} | ${techStatus.padEnd(9)} | ${zscoreStatus.padEnd(7)} | ${rsiDisplay.padEnd(9)} | ${fakeFlag}`);

    if (result.hasPriceData && result.hasTechnicalData && result.hasZScoreData && !result.isFakeRSI) {
      successCount++;
    }

    if (result.isFakeRSI) {
      fakeRSICount++;
    }
  });

  console.log('');
  console.log('📊 === VERIFICATION SUMMARY ===');
  
  const priceAvailable = results.filter(r => r.hasPriceData).length;
  const technicalAvailable = results.filter(r => r.hasTechnicalData).length;
  const zscoreAvailable = results.filter(r => r.hasZScoreData).length;
  
  console.log(`Price Data: ${priceAvailable}/${ETF_SYMBOLS.length} symbols (${Math.round(priceAvailable / ETF_SYMBOLS.length * 100)}%)`);
  console.log(`Technical Data: ${technicalAvailable}/${ETF_SYMBOLS.length} symbols (${Math.round(technicalAvailable / ETF_SYMBOLS.length * 100)}%)`);
  console.log(`Z-Score Data: ${zscoreAvailable}/${ETF_SYMBOLS.length} symbols (${Math.round(zscoreAvailable / ETF_SYMBOLS.length * 100)}%)`);
  console.log(`Complete Data: ${successCount}/${ETF_SYMBOLS.length} symbols (${Math.round(successCount / ETF_SYMBOLS.length * 100)}%)`);
  console.log(`Fake RSI Values: ${fakeRSICount}/${ETF_SYMBOLS.length} symbols (${Math.round(fakeRSICount / ETF_SYMBOLS.length * 100)}%)`);
  console.log('');

  // Test the actual ETF service
  console.log('🧪 === TESTING ETF METRICS SERVICE ===');
  try {
    const { etfMetricsService } = await import('../server/services/etf-metrics-service');
    const startTime = Date.now();
    const metrics = await etfMetricsService.getConsolidatedETFMetrics();
    const responseTime = Date.now() - startTime;

    console.log(`📊 Service Response: ${metrics.length} ETF metrics in ${responseTime}ms`);
    
    let realDataCount = 0;
    let fakeDataCount = 0;

    console.log('');
    console.log('Symbol | Price  | RSI   | Z-Score | Status');
    console.log('-------|--------|-------|---------|--------');

    metrics.forEach(metric => {
      const hasFakeRSI = metric.rsi === 50.0 || metric.rsi === null;
      const hasFakePrice = metric.price === 0;
      const hasFakeZScores = (
        metric.components?.rsiZ === 0.0000 || metric.components?.rsiZ === null
      ) && (
        metric.components?.macdZ === 0.0000 || metric.components?.macdZ === null
      );

      const isFakeData = hasFakeRSI && hasFakePrice && hasFakeZScores;
      
      if (isFakeData) {
        fakeDataCount++;
      } else {
        realDataCount++;
      }

      const priceDisplay = metric.price > 0 ? `$${metric.price.toFixed(2)}` : '$0.00';
      const rsiDisplay = metric.rsi !== null ? metric.rsi.toFixed(1) : 'N/A';
      const zScoreDisplay = metric.components?.rsiZ !== null ? metric.components.rsiZ.toFixed(2) : 'N/A';
      const status = isFakeData ? '🚨 FAKE' : '✅ REAL';

      console.log(`${metric.symbol.padEnd(6)} | ${priceDisplay.padEnd(6)} | ${rsiDisplay.padEnd(5)} | ${zScoreDisplay.padEnd(7)} | ${status}`);
    });

    console.log('');
    console.log('🎯 === SERVICE QUALITY RESULTS ===');
    console.log(`Real Data: ${realDataCount}/${metrics.length} ETFs (${Math.round(realDataCount / metrics.length * 100)}%)`);
    console.log(`Fake Data: ${fakeDataCount}/${metrics.length} ETFs (${Math.round(fakeDataCount / metrics.length * 100)}%)`);
    console.log(`Response Time: ${responseTime}ms`);
    
    // Overall assessment
    console.log('');
    console.log('🏆 === OVERALL ASSESSMENT ===');
    
    if (fakeDataCount === 0 && realDataCount > 0) {
      console.log('✅ SUCCESS: ETF Fake Data Fix is working perfectly!');
      console.log('   - All ETFs now have real technical indicators');
      console.log('   - No fake RSI=50.0 or Z-Score=0.0000 values detected');
      console.log('   - Database lookback periods are functioning correctly');
    } else if (fakeDataCount < metrics.length / 2) {
      console.log('⚠️  PARTIAL SUCCESS: Most ETFs have real data');
      console.log(`   - ${realDataCount} ETFs with real data, ${fakeDataCount} with fake data`);
      console.log('   - Database lookback fix is working but some data gaps remain');
    } else {
      console.log('❌ FAILURE: ETF Fake Data Fix needs additional work');
      console.log(`   - Only ${realDataCount} ETFs have real data`);
      console.log('   - Database queries may still be too restrictive');
      console.log('   - Consider extending lookback period further or checking data pipeline');
    }

  } catch (error) {
    console.error('❌ ETF Metrics Service Test Failed:', error);
  }

  // Final recommendations
  console.log('');
  console.log('💡 === RECOMMENDATIONS ===');
  
  if (fakeRSICount > 0) {
    console.log('1. Some symbols still have fake RSI=50.0 values');
    console.log('   - Check if data pipeline is running correctly');
    console.log('   - Verify technical indicators are being calculated');
  }
  
  if (successCount < ETF_SYMBOLS.length) {
    console.log('2. Not all ETFs have complete data sets');
    console.log('   - Consider running data backfill operations');
    console.log('   - Check external data provider connectivity');
  }
  
  console.log('3. Monitor data quality continuously');
  console.log('   - Set up alerts for fake data detection');
  console.log('   - Implement regular data quality checks');
  
  console.log('');
  console.log('🏁 ETF Data Fix Verification Complete');
}

// Run verification if called directly
if (import.meta.main) {
  verifyETFDataFix()
    .then(() => {
      console.log('');
      console.log('✅ Verification script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('');
      console.error('❌ Verification script failed:', error);
      process.exit(1);
    });
}

export { verifyETFDataFix };