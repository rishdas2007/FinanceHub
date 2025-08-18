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