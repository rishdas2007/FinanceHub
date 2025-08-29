import { db } from '../server/db';
import { historicalTechnicalIndicators } from '../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function analyzePercentBDataQuality() {
  console.log('🔍 Analyzing Bollinger %B Data Quality Issues');
  console.log('='.repeat(60));
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY'];
  
  for (const symbol of ETF_SYMBOLS) {
    console.log(`\n📊 Analyzing ${symbol} %B Data:`);
    
    try {
      // Get raw %B data to see the problem
      const rawData = await db.select({
        date: historicalTechnicalIndicators.date,
        percentB: historicalTechnicalIndicators.percentB
      })
        .from(historicalTechnicalIndicators)
        .where(eq(historicalTechnicalIndicators.symbol, symbol))
        .orderBy(desc(historicalTechnicalIndicators.date))
        .limit(50);
      
      console.log(`  Raw records retrieved: ${rawData.length}`);
      
      if (rawData.length > 0) {
        const percentBValues = rawData.map(r => Number(r.percentB)).filter(v => !isNaN(v));
        console.log(`  Valid %B values: ${percentBValues.length}`);
        
        // Analyze data quality
        if (percentBValues.length > 0) {
          const uniqueValues = new Set(percentBValues).size;
          const duplicateRatio = 1 - (uniqueValues / percentBValues.length);
          const mean = percentBValues.reduce((a, b) => a + b, 0) / percentBValues.length;
          const variance = percentBValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / percentBValues.length;
          const stdDev = Math.sqrt(variance);
          const range = Math.max(...percentBValues) - Math.min(...percentBValues);
          
          console.log(`  Statistics: mean=${mean.toFixed(4)}, stddev=${stdDev.toFixed(4)}, range=${range.toFixed(4)}`);
          console.log(`  Unique values: ${uniqueValues}/${percentBValues.length} (${(duplicateRatio * 100).toFixed(1)}% duplicates)`);
          
          // Show sample values
          console.log(`  Sample values: [${percentBValues.slice(0, 10).map(v => v.toFixed(4)).join(', ')}]`);
          
          // Data quality flags
          if (stdDev < 0.1) console.log(`  🚨 StdDev too low: ${stdDev.toFixed(4)}`);
          if (range < 0.2) console.log(`  🚨 Range too narrow: ${range.toFixed(4)}`);
          if (duplicateRatio > 0.7) console.log(`  🚨 Too many duplicates: ${(duplicateRatio * 100).toFixed(1)}%`);
          
          // Check for values outside normal range
          const belowZero = percentBValues.filter(v => v < 0).length;
          const aboveOne = percentBValues.filter(v => v > 1).length;
          if (belowZero > 0) console.log(`  ⚠️ Values below 0: ${belowZero}`);
          if (aboveOne > 0) console.log(`  ⚠️ Values above 1: ${aboveOne}`);
        }
        
        // Daily grouping analysis
        const dailyGroups = new Map();
        rawData.forEach(record => {
          const dayKey = record.date.toISOString().split('T')[0];
          if (!dailyGroups.has(dayKey)) dailyGroups.set(dayKey, []);
          dailyGroups.get(dayKey).push(Number(record.percentB));
        });
        
        console.log(`  Daily groups: ${dailyGroups.size} unique days`);
        
        // Show sample of daily duplicates
        let duplicateDays = 0;
        for (const [date, dayValues] of dailyGroups.entries()) {
          if (dayValues.length > 1) {
            duplicateDays++;
            if (duplicateDays <= 2) { // Show first 2 examples
              const uniqueInDay = new Set(dayValues).size;
              console.log(`    ${date}: ${dayValues.length} records, ${uniqueInDay} unique values`);
              console.log(`      Values: [${dayValues.map(v => v.toFixed(4)).join(', ')}]`);
            }
          }
        }
        console.log(`  Days with multiple records: ${duplicateDays}/${dailyGroups.size}`);
      }
      
      // Test deduplicated query
      console.log(`\n  Testing DISTINCT ON deduplication:`);
      const deduplicatedData = await db.execute(sql`
        SELECT DISTINCT ON (DATE(date)) 
               DATE(date) as trading_day,
               percent_b::numeric as percent_b_value,
               date as full_timestamp
        FROM historical_technical_indicators 
        WHERE symbol = ${symbol} 
          AND percent_b IS NOT NULL
        ORDER BY DATE(date) DESC, date DESC
        LIMIT 10
      `);
      
      console.log(`  Deduplicated records: ${deduplicatedData.rows.length}`);
      deduplicatedData.rows.forEach((row: any, index) => {
        if (index < 5) {
          console.log(`    ${row.trading_day}: %B=${Number(row.percent_b_value).toFixed(4)} (${row.full_timestamp})`);
        }
      });
      
    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
    }
  }
  
  console.log('\n🎯 Analysis Summary:');
  console.log('• Look for narrow ranges and high duplicate ratios');
  console.log('• Verify DISTINCT ON is selecting proper records per day');
  console.log('• %B should range 0-1 with reasonable variance');
  console.log('• Daily deduplication should pick latest timestamp per day');
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzePercentBDataQuality()
    .then(() => {
      console.log('\n✅ %B Analysis completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 %B Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzePercentBDataQuality };