import { db } from '../server/db';
import { historicalTechnicalIndicators } from '../shared/schema';
import { historicalMACDService } from '../server/services/historical-macd-service';
import { eq } from 'drizzle-orm';

async function debugCurrentZScoreCalculation() {
  console.log('🔬 Debugging Current Z-Score Calculation for SPY RSI = 58.29');
  console.log('='.repeat(70));
  
  const symbol = 'SPY';
  const currentRSI = 58.29;
  
  try {
    // Step 1: Get raw historical data
    console.log('\n📊 Step 1: Raw Historical Data Query');
    const rawHistoricalRSIs = await historicalMACDService.getHistoricalRSIValues(symbol, 90);
    console.log(`Service returned: ${rawHistoricalRSIs.length} RSI values`);
    
    if (rawHistoricalRSIs.length > 0) {
      console.log(`First 10: [${rawHistoricalRSIs.slice(0, 10).map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`Last 10: [${rawHistoricalRSIs.slice(-10).map(v => v.toFixed(2)).join(', ')}]`);
      
      // Check for duplicates
      const uniqueCount = new Set(rawHistoricalRSIs).size;
      const duplicateRatio = 1 - (uniqueCount / rawHistoricalRSIs.length);
      console.log(`Unique values: ${uniqueCount}/${rawHistoricalRSIs.length} (${(duplicateRatio * 100).toFixed(1)}% duplicates)`);
      
      // Store duplicateRatio, mean, and stdDev for later use
      let mean = 0, stdDev = 0;
    }
    
    // Step 2: Manual statistics calculation
    console.log('\n🧮 Step 2: Statistics Calculation');
    const dataToUse = rawHistoricalRSIs.length >= 30 ? rawHistoricalRSIs : historicalMACDService.getRealisticRSIFallback();
    const isUsingFallback = rawHistoricalRSIs.length < 30;
    
    console.log(`Using: ${isUsingFallback ? 'fallback' : 'historical'} data (${dataToUse.length} values)`);
    
    if (!isUsingFallback) {
      mean = dataToUse.reduce((a, b) => a + b, 0) / dataToUse.length;
      const variance = dataToUse.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataToUse.length;
      stdDev = Math.sqrt(variance);
      const range = Math.max(...dataToUse) - Math.min(...dataToUse);
      
      console.log(`Mean: ${mean.toFixed(4)}`);
      console.log(`Standard Deviation: ${stdDev.toFixed(4)}`);
      console.log(`Range: ${range.toFixed(2)}`);
      console.log(`Min/Max: ${Math.min(...dataToUse).toFixed(2)} / ${Math.max(...dataToUse).toFixed(2)}`);
      
      // Manual z-score
      const manualZScore = (currentRSI - mean) / stdDev;
      console.log(`Manual Z-Score: (${currentRSI} - ${mean.toFixed(4)}) / ${stdDev.toFixed(4)} = ${manualZScore.toFixed(4)}`);
      
      // Service z-score
      const serviceZScore = historicalMACDService.calculateZScore(currentRSI, dataToUse);
      console.log(`Service Z-Score: ${serviceZScore?.toFixed(4) || 'null'}`);
      
      // Data quality flags
      console.log('\n🚨 Data Quality Checks:');
      if (stdDev < 1) console.log(`❌ StdDev too low: ${stdDev.toFixed(4)} (should be >5 for RSI)`);
      if (range < 10) console.log(`❌ Range too narrow: ${range.toFixed(2)} (should be >20 for RSI)`);
      if (duplicateRatio > 0.5) console.log(`❌ Too many duplicates: ${(duplicateRatio * 100).toFixed(1)}%`);
      if (Math.abs(manualZScore) > 5) console.log(`❌ Extreme z-score: ${manualZScore.toFixed(2)}`);
      
      // Show most common values
      const valueCounts: Record<string, number> = {};
      dataToUse.forEach(val => {
        const rounded = Math.round(val * 100) / 100;
        valueCounts[rounded] = (valueCounts[rounded] || 0) + 1;
      });
      const sortedCounts = Object.entries(valueCounts)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5);
      console.log('\nMost common values:');
      sortedCounts.forEach(([value, count]) => {
        console.log(`  ${value}: ${count} times (${((count as number)/dataToUse.length*100).toFixed(1)}%)`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    if (rawHistoricalRSIs.length < 30) {
      console.log('• Historical data insufficient - using fallback');
    } else if (duplicateRatio > 0.7) {
      console.log('• Implement daily deduplication to reduce duplicates');
    } else if (stdDev < 1) {
      console.log('• StdDev too low - indicates corrupted narrow-variance data');
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugCurrentZScoreCalculation()
    .then(() => {
      console.log('\n🎯 Z-Score debugging completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Debug failed:', error);
      process.exit(1);
    });
}

export { debugCurrentZScoreCalculation };