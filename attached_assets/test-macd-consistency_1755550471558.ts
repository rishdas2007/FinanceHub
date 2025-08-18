import { db } from '../server/db';
import { technicalIndicators, historicalTechnicalIndicators } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { historicalMACDService } from '../server/services/historical-macd-service';

async function testMACDConsistency() {
  console.log('🧪 Testing MACD calculation consistency...');
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY'];
  
  for (const symbol of ETF_SYMBOLS) {
    try {
      console.log(`\n=== Testing ${symbol} ===`);
      
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
      
      // Test 1: Verify MACD = EMA12 - EMA26 (if EMA values are stored)
      if (record.ema_12 && record.ema_26 && record.macd_line) {
        const calculatedMACD = Number(record.ema_12) - Number(record.ema_26);
        const storedMACD = Number(record.macd_line);
        const difference = Math.abs(calculatedMACD - storedMACD);
        
        console.log(`📊 MACD Calculation Check:`);
        console.log(`   Stored MACD: ${storedMACD.toFixed(4)}`);
        console.log(`   EMA12-EMA26: ${calculatedMACD.toFixed(4)}`);
        console.log(`   Difference:  ${difference.toFixed(4)}`);
        
        if (difference > 0.01) {
          console.log(`⚠️  ${symbol}: MACD calculation inconsistency detected (diff: ${difference.toFixed(4)})`);
        } else {
          console.log(`✅ ${symbol}: MACD calculation consistent`);
        }
      } else {
        console.log(`⚠️  ${symbol}: Missing data - EMA12=${record.ema_12}, EMA26=${record.ema_26}, MACD=${record.macd_line}`);
      }
      
      // Test 2: Verify historical data availability
      console.log(`📈 Historical Data Check:`);
      const historicalMACDs = await historicalMACDService.getHistoricalMACDValues(symbol, 90);
      console.log(`   Historical MACD records: ${historicalMACDs.length}`);
      
      const historicalRSIs = await historicalMACDService.getHistoricalRSIValues(symbol, 90);
      console.log(`   Historical RSI records:  ${historicalRSIs.length}`);
      
      const historicalBBs = await historicalMACDService.getHistoricalBBValues(symbol, 90);
      console.log(`   Historical %B records:   ${historicalBBs.length}`);
      
      // Test 3: Calculate and validate z-score
      console.log(`📊 Z-Score Validation:`);
      if (record.macd_line && historicalMACDs.length >= 10) {
        const currentMACD = Number(record.macd_line);
        const zScore = historicalMACDService.calculateZScore(currentMACD, historicalMACDs);
        const isReasonable = zScore !== null && Math.abs(zScore) <= 3;
        
        console.log(`   Current MACD: ${currentMACD.toFixed(4)}`);
        console.log(`   Z-Score:      ${zScore?.toFixed(2) || 'null'}`);
        console.log(`   Reasonable:   ${isReasonable ? '✅' : '❌'}`);
        
        if (zScore !== null && Math.abs(zScore) > 3) {
          console.log(`🚨 Extreme z-score detected! This may indicate data inconsistency.`);
        }
      } else {
        console.log(`   Cannot calculate z-score: MACD=${record.macd_line}, Historical records=${historicalMACDs.length}`);
      }
      
      // Test 4: Database record age check
      console.log(`📅 Data Freshness Check:`);
      if (record.timestamp) {
        const ageMinutes = Math.floor((Date.now() - new Date(record.timestamp).getTime()) / (1000 * 60));
        console.log(`   Latest record age: ${ageMinutes} minutes`);
        
        if (ageMinutes > 60) {
          console.log(`⚠️  Data may be stale (>${ageMinutes} minutes old)`);
        } else {
          console.log(`✅ Data is fresh`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${symbol}:`, error);
    }
  }
  
  console.log('\n🎯 MACD consistency test completed');
}

// Additional function to check z-score distribution
async function validateZScoreDistribution() {
  console.log('\n📊 Validating z-score statistical distribution...');
  
  try {
    // Get recent z-score data for analysis
    const symbols = ['SPY', 'XLK', 'XLV'];
    
    for (const symbol of symbols) {
      const historicalMACDs = await historicalMACDService.getHistoricalMACDValues(symbol, 60);
      
      if (historicalMACDs.length >= 30) {
        // Calculate z-scores for historical data to check distribution
        const zScores = historicalMACDs.map(macd => 
          historicalMACDService.calculateZScore(macd, historicalMACDs)
        ).filter(z => z !== null) as number[];
        
        if (zScores.length > 10) {
          const within1 = zScores.filter(z => Math.abs(z) <= 1).length;
          const within2 = zScores.filter(z => Math.abs(z) <= 2).length;
          const within3 = zScores.filter(z => Math.abs(z) <= 3).length;
          const extremes = zScores.filter(z => Math.abs(z) > 3);
          
          console.log(`\n${symbol} Z-Score Distribution (${zScores.length} samples):`);
          console.log(`   Within ±1: ${within1}/${zScores.length} (${(within1/zScores.length*100).toFixed(1)}%) - Expected ~68%`);
          console.log(`   Within ±2: ${within2}/${zScores.length} (${(within2/zScores.length*100).toFixed(1)}%) - Expected ~95%`);
          console.log(`   Within ±3: ${within3}/${zScores.length} (${(within3/zScores.length*100).toFixed(1)}%) - Expected ~99.7%`);
          
          if (extremes.length > 0) {
            console.log(`⚠️  Extreme z-scores (>3): ${extremes.length} found - ${extremes.map(z => z.toFixed(2)).join(', ')}`);
          } else {
            console.log(`✅ No extreme z-scores detected`);
          }
        }
      } else {
        console.log(`${symbol}: Insufficient data for distribution analysis (${historicalMACDs.length} records)`);
      }
    }
  } catch (error) {
    console.error('Error validating z-score distribution:', error);
  }
}

// Run both tests
async function runFullValidation() {
  await testMACDConsistency();
  await validateZScoreDistribution();
  
  console.log('\n✅ Full MACD validation completed');
}

// Execute if called directly
if (require.main === module) {
  runFullValidation()
    .then(() => {
      console.log('🎉 Validation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Validation failed:', error);
      process.exit(1);
    });
}

export { testMACDConsistency, validateZScoreDistribution, runFullValidation };