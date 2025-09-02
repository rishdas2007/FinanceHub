import { CronJob } from 'cron';
import { ParseBotService, type FiveDayChangeData } from './parse-bot-service';
import { db } from '../db';
import { etfFiveDayChanges } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class EtfFiveDayScheduler {
  private cronJob: CronJob;
  private parseBotService: ParseBotService;

  constructor() {
    this.parseBotService = new ParseBotService();
    
    // Schedule for 8:00 AM ET (13:00 UTC during EST, 12:00 UTC during EDT)
    // Using 0 12 * * * for EDT (daylight saving) - adjust as needed
    this.cronJob = new CronJob(
      '0 12 * * *', // 8:00 AM ET in UTC (adjusted for EDT)
      this.fetchAndStoreFiveDayChanges.bind(this),
      null,
      false, // Don't start automatically
      'America/New_York' // Use ET timezone
    );
  }

  start() {
    console.log('🕐 Starting ETF 5-day change scheduler for 8:00 AM ET');
    this.cronJob.start();
  }

  stop() {
    console.log('🛑 Stopping ETF 5-day change scheduler');
    this.cronJob.stop();
  }

  async fetchAndStoreFiveDayChanges(): Promise<void> {
    try {
      console.log('📊 Fetching 5-day ETF changes from parse.bot...');
      
      const data = await this.parseBotService.fetchFiveDayChanges();
      console.log(`✅ Received ${data.length} ETF records from parse.bot`);

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      for (const item of data) {
        const mappedSymbol = this.parseBotService.mapSymbol(item.symbol);
        
        try {
          // Check if record already exists for today
          const existing = await db
            .select()
            .from(etfFiveDayChanges)
            .where(
              and(
                eq(etfFiveDayChanges.symbol, mappedSymbol),
                eq(etfFiveDayChanges.date, today)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            // Insert new record
            await db.insert(etfFiveDayChanges).values({
              symbol: mappedSymbol,
              companyName: item.company_name,
              totalPctChange: item.total_pct_change,
              date: today,
            });
            
            console.log(`✅ Stored 5-day change for ${mappedSymbol}: ${item.total_pct_change}`);
          } else {
            console.log(`⏭️ Record already exists for ${mappedSymbol} on ${today}`);
          }
        } catch (error) {
          console.error(`❌ Failed to store data for ${mappedSymbol}:`, error);
        }
      }

      console.log('✅ ETF 5-day changes update completed');
    } catch (error) {
      console.error('❌ Failed to fetch and store 5-day changes:', error);
    }
  }

  // Manual trigger for testing
  async runNow(): Promise<void> {
    console.log('🧪 Manually triggering 5-day change fetch...');
    await this.fetchAndStoreFiveDayChanges();
  }
}