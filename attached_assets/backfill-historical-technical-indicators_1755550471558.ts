import { db } from '../server/db';
import { technicalIndicators, historicalTechnicalIndicators } from '../shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';

export async function backfillHistoricalTechnicalIndicators() {
  console.log('🔄 Starting historical technical indicators backfill');
  
  const ETF_SYMBOLS = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
  const LOOKBACK_DAYS = 365; // 1 year of historical data
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);
  
  let totalBackfilled = 0;
  
  for (const symbol of ETF_SYMBOLS) {
    try {
      console.log(`📊 Processing ${symbol}...`);
      
      // Get existing technical indicators for this symbol
      const existingData = await db.select()
        .from(technicalIndicators)
        .where(and(
          eq(technicalIndicators.symbol, symbol),
          gte(technicalIndicators.timestamp, cutoffDate)
        ))
        .orderBy(desc(technicalIndicators.timestamp))
        .limit(252); // ~1 trading year
      
      console.log(`📈 Found ${existingData.length} existing records for ${symbol}`);
      
      let backfilledForSymbol = 0;
      
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
            date: record.timestamp,
            rsi: record.rsi,
            macd: record.macd_line,        // Map macd_line to macd
            macd_signal: record.macdSignal, // Map macdSignal to macd_signal
            percent_b: record.percent_b,
            atr: record.atr,
            price_change: null, // Not available from technical_indicators table
            ma_trend: null,     // Not available from technical_indicators table
            created_at: new Date(),
            updated_at: new Date()
          });
          backfilledForSymbol++;
        }
      }
      
      console.log(`✅ Backfilled ${backfilledForSymbol} historical records for ${symbol}`);
      totalBackfilled += backfilledForSymbol;
      
      // Log date range if records exist
      if (existingData.length > 0) {
        const earliest = existingData[existingData.length - 1].timestamp;
        const latest = existingData[0].timestamp;
        console.log(`   Date range: ${earliest.toISOString().split('T')[0]} to ${latest.toISOString().split('T')[0]}`);
      }
      
    } catch (error) {
      console.error(`❌ Error backfilling ${symbol}:`, error);
    }
  }
  
  console.log(`🎯 Historical technical indicators backfill completed`);
  console.log(`📈 Total records backfilled: ${totalBackfilled}`);
  
  // Verify results
  console.log('🔍 Verifying backfill results...');
  for (const symbol of ETF_SYMBOLS.slice(0, 3)) { // Check first 3 symbols
    const count = await db.select({ count: 'count(*)' })
      .from(historicalTechnicalIndicators)
      .where(eq(historicalTechnicalIndicators.symbol, symbol));
    
    console.log(`${symbol}: ${count.length > 0 ? count[0].count : 0} historical records available`);
  }
}

// Run if called directly
if (require.main === module) {
  backfillHistoricalTechnicalIndicators()
    .then(() => {
      console.log('✅ Backfill completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
}