import { db } from '../server/db';
import { historicalTechnicalIndicators } from '../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function analyzeHistoricalDataCorruption() {
  console.log('🔍 Analyzing Historical Data Corruption Patterns');
  console.log('='.repeat(60));
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
  
  for (const symbol of ETF_SYMBOLS) {
    try {
      console.log(`\n📊 Analyzing ${symbol}:`);
      
      // Get all historical records
      const records = await db.select({
        date: historicalTechnicalIndicators.date,
        rsi: historicalTechnicalIndicators.rsi,
        macd: historicalTechnicalIndicators.macd,
        percent_b: historicalTechnicalIndicators.percentB
      })
        .from(historicalTechnicalIndicators)
        .where(eq(historicalTechnicalIndicators.symbol, symbol))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(500);
      
      if (records.length === 0) {
        console.log(`  ❌ No records found`);
        continue;
      }
      
      // Analyze RSI duplicates
      const rsiValues = records.map(r => Number(r.rsi)).filter(v => !isNaN(v));
      const uniqueRSI = new Set(rsiValues).size;
      const rsiDuplicateRatio = 1 - (uniqueRSI / rsiValues.length);
      
      console.log(`  RSI: ${rsiValues.length} total, ${uniqueRSI} unique (${(rsiDuplicateRatio * 100).toFixed(1)}% duplicates)`);
      
      if (rsiValues.length > 0) {
        const rsiMean = rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length;
        const rsiVariance = rsiValues.reduce((sum, val) => sum + Math.pow(val - rsiMean, 2), 0) / rsiValues.length;
        const rsiStdDev = Math.sqrt(rsiVariance);
        const rsiRange = Math.max(...rsiValues) - Math.min(...rsiValues);
        
        console.log(`  RSI Stats: mean=${rsiMean.toFixed(2)}, stddev=${rsiStdDev.toFixed(4)}, range=${rsiRange.toFixed(2)}`);
        
        // Check for corruption patterns
        if (rsiStdDev < 1) console.log(`  🚨 RSI stddev suspiciously low: ${rsiStdDev.toFixed(4)}`);
        if (rsiDuplicateRatio > 0.7) console.log(`  🚨 RSI high duplicate ratio: ${(rsiDuplicateRatio * 100).toFixed(1)}%`);
        if (rsiRange < 5) console.log(`  🚨 RSI narrow range: ${rsiRange.toFixed(2)}`);
      }
      
      // Analyze MACD duplicates
      const macdValues = records.map(r => Number(r.macd)).filter(v => !isNaN(v));
      if (macdValues.length > 0) {
        const uniqueMACD = new Set(macdValues).size;
        const macdDuplicateRatio = 1 - (uniqueMACD / macdValues.length);
        const macdMean = macdValues.reduce((a, b) => a + b, 0) / macdValues.length;
        const macdVariance = macdValues.reduce((sum, val) => sum + Math.pow(val - macdMean, 2), 0) / macdValues.length;
        const macdStdDev = Math.sqrt(macdVariance);
        
        console.log(`  MACD: ${macdValues.length} total, ${uniqueMACD} unique (${(macdDuplicateRatio * 100).toFixed(1)}% duplicates)`);
        console.log(`  MACD Stats: mean=${macdMean.toFixed(4)}, stddev=${macdStdDev.toFixed(4)}`);
        
        if (macdStdDev < 0.1) console.log(`  🚨 MACD stddev suspiciously low: ${macdStdDev.toFixed(4)}`);
      }
      
      // Analyze %B duplicates  
      const percentBValues = records.map(r => Number(r.percent_b)).filter(v => !isNaN(v));
      if (percentBValues.length > 0) {
        const uniquePercentB = new Set(percentBValues).size;
        const percentBDuplicateRatio = 1 - (uniquePercentB / percentBValues.length);
        const percentBMean = percentBValues.reduce((a, b) => a + b, 0) / percentBValues.length;
        const percentBVariance = percentBValues.reduce((sum, val) => sum + Math.pow(val - percentBMean, 2), 0) / percentBValues.length;
        const percentBStdDev = Math.sqrt(percentBVariance);
        
        console.log(`  %B: ${percentBValues.length} total, ${uniquePercentB} unique (${(percentBDuplicateRatio * 100).toFixed(1)}% duplicates)`);
        console.log(`  %B Stats: mean=${percentBMean.toFixed(4)}, stddev=${percentBStdDev.toFixed(4)}`);
        
        // Check for >1.0 values
        const aboveOne = percentBValues.filter(v => v > 1.0).length;
        if (aboveOne > 0) console.log(`  🚨 %B values >1.0: ${aboveOne} records (${(aboveOne/percentBValues.length*100).toFixed(1)}%)`);
        
        if (percentBStdDev < 0.05) console.log(`  🚨 %B stddev suspiciously low: ${percentBStdDev.toFixed(4)}`);
      }
      
      // Daily grouping analysis
      const dailyGroups = new Map();
      records.forEach(record => {
        const dayKey = record.date.toISOString().split('T')[0];
        if (!dailyGroups.has(dayKey)) dailyGroups.set(dayKey, []);
        dailyGroups.get(dayKey).push(record);
      });
      
      console.log(`  Daily groups: ${dailyGroups.size} days, avg ${(records.length / dailyGroups.size).toFixed(1)} records/day`);
      
      // Show sample of daily duplicates
      const firstDay = Array.from(dailyGroups.entries())[0];
      if (firstDay) {
        const [date, dayRecords] = firstDay;
        console.log(`  Sample day (${date}): ${dayRecords.length} records`);
        if (dayRecords.length > 1) {
          const firstRSI = Number(dayRecords[0].rsi);
          const identicalRSI = dayRecords.filter(r => Number(r.rsi) === firstRSI).length;
          console.log(`    RSI identical values: ${identicalRSI}/${dayRecords.length}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
    }
  }
  
  console.log('\n🎯 Analysis completed. Look for 🚨 warnings above.');
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeHistoricalDataCorruption()
    .then(() => {
      console.log('✅ Analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzeHistoricalDataCorruption };