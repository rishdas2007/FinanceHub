import { historicalMACDServiceDeduplicated } from '../server/services/historical-macd-service-deduplicated';
import { db } from '../server/db';
import { historicalTechnicalIndicators } from '../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function debugSPYPercentBCalculation() {
  console.log('🔍 Debugging SPY %B Z-Score Calculation');
  console.log('='.repeat(60));
  
  const symbol = 'SPY';
  
  try {
    // Step 1: Get the current %B value that's being used
    console.log('\n📊 Step 1: Current %B Value');
    
    // Get most recent %B from live data (simulating what API provides)
    const recentData = await db.select({
      date: historicalTechnicalIndicators.date,
      percentB: historicalTechnicalIndicators.percentB
    })
      .from(historicalTechnicalIndicators)
      .where(eq(historicalTechnicalIndicators.symbol, symbol))
      .orderBy(desc(historicalTechnicalIndicators.date))
      .limit(1);
    
    if (recentData.length > 0) {
      const currentPercentB = Number(recentData[0].percentB);
      console.log(`  Current %B value: ${currentPercentB} (${(currentPercentB * 100).toFixed(2)}%)`);
      console.log(`  Date: ${recentData[0].date.toISOString()}`);
      
      // Step 2: Get deduplicated historical data
      console.log('\n📊 Step 2: Deduplicated Historical %B Data');
      
      const historicalPercentB = await historicalMACDServiceDeduplicated.getHistoricalPercentBValues(symbol, 30);
      console.log(`  Historical %B records retrieved: ${historicalPercentB.length}`);
      
      if (historicalPercentB.length > 0) {
        console.log(`  Sample historical values: [${historicalPercentB.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
        
        // Calculate statistics manually
        const mean = historicalPercentB.reduce((a, b) => a + b, 0) / historicalPercentB.length;
        const variance = historicalPercentB.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalPercentB.length;
        const stdDev = Math.sqrt(variance);
        const range = Math.max(...historicalPercentB) - Math.min(...historicalPercentB);
        
        console.log(`  Historical statistics:`);
        console.log(`    Mean: ${mean.toFixed(4)}`);
        console.log(`    StdDev: ${stdDev.toFixed(4)}`);
        console.log(`    Range: ${range.toFixed(4)}`);
        console.log(`    Min: ${Math.min(...historicalPercentB).toFixed(4)}`);
        console.log(`    Max: ${Math.max(...historicalPercentB).toFixed(4)}`);
        
        // Data quality check
        const uniqueValues = new Set(historicalPercentB).size;
        const duplicateRatio = 1 - (uniqueValues / historicalPercentB.length);
        console.log(`    Unique values: ${uniqueValues}/${historicalPercentB.length} (${(duplicateRatio * 100).toFixed(1)}% duplicates)`);
        
        // Check if data passes quality validation
        const isDataCorrupted = stdDev < 0.1 || range < 0.2 || duplicateRatio > 0.8;
        console.log(`    Data corruption detected: ${isDataCorrupted}`);
        
        if (isDataCorrupted) {
          console.log(`    🚨 Data quality flags:`);
          if (stdDev < 0.1) console.log(`      - StdDev too low: ${stdDev.toFixed(4)} < 0.1`);
          if (range < 0.2) console.log(`      - Range too narrow: ${range.toFixed(4)} < 0.2`);
          if (duplicateRatio > 0.8) console.log(`      - Too many duplicates: ${(duplicateRatio * 100).toFixed(1)}% > 80%`);
        }
        
        // Step 3: Calculate Z-score using historical data
        console.log('\n📊 Step 3: Z-Score Calculation Using Historical Data');
        
        if (!isDataCorrupted && historicalPercentB.length >= 10) {
          const historicalZScore = (currentPercentB - mean) / stdDev;
          console.log(`  Z-score = (${currentPercentB.toFixed(4)} - ${mean.toFixed(4)}) / ${stdDev.toFixed(4)}`);
          console.log(`  Z-score = ${historicalZScore.toFixed(4)}`);
        } else {
          console.log(`  ⚠️ Historical data insufficient or corrupted, using fallback`);
        }
      }
      
      // Step 4: Show what the service actually returns
      console.log('\n📊 Step 4: Service Z-Score Calculation');
      
      const serviceZScore = await historicalMACDServiceDeduplicated.calculateZScoreWithFallback(
        symbol, currentPercentB, 'percent_b'
      );
      console.log(`  Service returned Z-score: ${serviceZScore.toFixed(4)}`);
      
      // Step 5: Show fallback parameters being used
      console.log('\n📊 Step 5: Fallback Parameters');
      
      const fallbackParams = historicalMACDServiceDeduplicated.getRealisticPercentBFallback();
      console.log(`  Fallback mean: ${fallbackParams.mean}`);
      console.log(`  Fallback stddev: ${fallbackParams.stddev}`);
      
      const fallbackZScore = (currentPercentB - fallbackParams.mean) / fallbackParams.stddev;
      console.log(`  Fallback Z-score = (${currentPercentB.toFixed(4)} - ${fallbackParams.mean}) / ${fallbackParams.stddev}`);
      console.log(`  Fallback Z-score = ${fallbackZScore.toFixed(4)}`);
      
      // Step 6: Analyze the problem
      console.log('\n🔍 Step 6: Problem Analysis');
      
      if (serviceZScore === fallbackZScore) {
        console.log(`  ✅ Service is using fallback parameters (expected due to data corruption)`);
      } else {
        console.log(`  ⚠️ Service Z-score differs from both historical and fallback calculations`);
      }
      
      // Check if the current %B value is reasonable
      if (currentPercentB >= 0 && currentPercentB <= 1.5) {
        console.log(`  ✅ Current %B value is in reasonable range: ${currentPercentB}`);
      } else {
        console.log(`  🚨 Current %B value is outside normal range: ${currentPercentB}`);
      }
      
      // Check if Z-score makes sense
      if (Math.abs(serviceZScore) <= 5) {
        console.log(`  ✅ Z-score is within reasonable bounds: ${serviceZScore.toFixed(4)}`);
      } else {
        console.log(`  🚨 Z-score is extreme: ${serviceZScore.toFixed(4)}`);
      }
      
      // Step 7: Identify why all %B Z-scores are negative
      console.log('\n🎯 Step 7: Why Are All %B Z-Scores Negative?');
      
      console.log(`  Current %B: ${currentPercentB.toFixed(4)} (${(currentPercentB * 100).toFixed(1)}%)`);
      console.log(`  Fallback mean: ${fallbackParams.mean} (${(fallbackParams.mean * 100).toFixed(1)}%)`);
      
      if (currentPercentB < fallbackParams.mean) {
        console.log(`  🔍 Analysis: %B (${(currentPercentB * 100).toFixed(1)}%) < Mean (${(fallbackParams.mean * 100).toFixed(1)}%)`);
        console.log(`  This means the current %B is below the expected center (0.5)`);
        console.log(`  Negative Z-score indicates the stock is in the lower half of its Bollinger Band`);
      } else {
        console.log(`  🔍 Analysis: %B (${(currentPercentB * 100).toFixed(1)}%) >= Mean (${(fallbackParams.mean * 100).toFixed(1)}%)`);
        console.log(`  This should produce a positive Z-score`);
      }
      
    } else {
      console.log('❌ No recent %B data found for SPY');
    }
    
  } catch (error) {
    console.error('❌ Error debugging SPY %B calculation:', error);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugSPYPercentBCalculation()
    .then(() => {
      console.log('\n✅ SPY %B debugging completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 SPY %B debugging failed:', error);
      process.exit(1);
    });
}

export { debugSPYPercentBCalculation };