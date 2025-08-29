#!/usr/bin/env npx tsx

/**
 * Economic Calendar Historical Data Backfill Script
 * 
 * This script backfills 2 years of historical economic data from the FRED API
 * with proper rate limiting (120 requests/minute) and error handling.
 * 
 * Usage:
 *   npx tsx scripts/backfill-economic-calendar.ts
 *   npx tsx scripts/backfill-economic-calendar.ts --start-date=2022-01-01
 *   npx tsx scripts/backfill-economic-calendar.ts --series=GDP,UNRATE
 */

import { economicCalendarService, FRED_SERIES_MAP } from '../server/services/economic-calendar-service';
import { logger } from '../shared/utils/logger';
import { db } from '../server/db';

interface BackfillOptions {
  startDate?: string;
  endDate?: string;
  seriesIds?: string[];
  dryRun?: boolean;
  resumeFrom?: string;
}

class EconomicCalendarBackfill {
  private readonly defaultStartDate: string;
  private readonly defaultEndDate: string;
  private processedSeries: Set<string> = new Set();
  private failedSeries: Set<string> = new Set();
  private startTime: number = 0;

  constructor() {
    // Default to 2 years of historical data
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    this.defaultStartDate = twoYearsAgo.toISOString().split('T')[0];
    
    const today = new Date();
    this.defaultEndDate = today.toISOString().split('T')[0];
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(): BackfillOptions {
    const args = process.argv.slice(2);
    const options: BackfillOptions = {};

    for (const arg of args) {
      if (arg.startsWith('--start-date=')) {
        options.startDate = arg.split('=')[1];
      } else if (arg.startsWith('--end-date=')) {
        options.endDate = arg.split('=')[1];
      } else if (arg.startsWith('--series=')) {
        options.seriesIds = arg.split('=')[1].split(',').map(s => s.trim());
      } else if (arg === '--dry-run') {
        options.dryRun = true;
      } else if (arg.startsWith('--resume-from=')) {
        options.resumeFrom = arg.split('=')[1];
      }
    }

    return options;
  }

  /**
   * Validate date format and range
   */
  private validateDate(dateString: string): boolean {
    const date = new Date(dateString);
    const now = new Date();
    const minDate = new Date('1900-01-01');
    
    return !isNaN(date.getTime()) && date >= minDate && date <= now;
  }

  /**
   * Get database statistics before starting
   */
  private async getDatabaseStats(): Promise<{ totalRecords: number; seriesCount: number }> {
    try {
      const result = await db.execute(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT series_id) as series_count
        FROM economic_calendar
      `);
      
      const row = result.rows[0];
      return {
        totalRecords: parseInt(row.total_records as string || '0'),
        seriesCount: parseInt(row.series_count as string || '0')
      };
    } catch (error) {
      logger.warn('Could not get database stats:', error);
      return { totalRecords: 0, seriesCount: 0 };
    }
  }

  /**
   * Display progress information
   */
  private displayProgress(current: number, total: number, seriesId: string, seriesName: string): void {
    const progress = Math.round((current / total) * 100);
    const elapsed = (Date.now() - this.startTime) / 1000;
    const estimatedTotal = elapsed * (total / current);
    const remaining = Math.max(0, estimatedTotal - elapsed);
    
    console.log(`\n📊 Progress: ${progress}% (${current}/${total})`);
    console.log(`🔄 Processing: ${seriesId} - ${seriesName}`);
    console.log(`⏱️  Elapsed: ${Math.round(elapsed)}s | Remaining: ${Math.round(remaining)}s`);
    console.log(`✅ Success: ${this.processedSeries.size} | ❌ Failed: ${this.failedSeries.size}`);
    console.log('─'.repeat(60));
  }

  /**
   * Run the backfill process
   */
  async run(options: BackfillOptions = {}): Promise<void> {
    this.startTime = Date.now();
    
    // Parse and validate options
    const startDate = options.startDate || this.defaultStartDate;
    const endDate = options.endDate || this.defaultEndDate;
    
    if (!this.validateDate(startDate) || !this.validateDate(endDate)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD format.');
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      throw new Error('Start date must be before end date.');
    }

    // Determine which series to process
    let seriesToProcess = Object.keys(FRED_SERIES_MAP);
    
    if (options.seriesIds) {
      const invalidSeries = options.seriesIds.filter(id => !FRED_SERIES_MAP[id as keyof typeof FRED_SERIES_MAP]);
      if (invalidSeries.length > 0) {
        throw new Error(`Invalid series IDs: ${invalidSeries.join(', ')}`);
      }
      seriesToProcess = options.seriesIds;
    }

    // Resume from specific series if specified
    if (options.resumeFrom) {
      const resumeIndex = seriesToProcess.indexOf(options.resumeFrom);
      if (resumeIndex === -1) {
        throw new Error(`Resume series '${options.resumeFrom}' not found in series list.`);
      }
      seriesToProcess = seriesToProcess.slice(resumeIndex);
      logger.info(`🔄 Resuming from series: ${options.resumeFrom}`);
    }

    // Get initial database stats
    const initialStats = await this.getDatabaseStats();

    // Display backfill information
    console.log('\n🚀 Economic Calendar Data Backfill');
    console.log('═'.repeat(60));
    console.log(`📅 Date Range: ${startDate} to ${endDate}`);
    console.log(`📊 Series to Process: ${seriesToProcess.length}`);
    console.log(`💾 Current DB Records: ${initialStats.totalRecords.toLocaleString()}`);
    console.log(`📈 Current Series Count: ${initialStats.seriesCount}`);
    console.log(`🔧 Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log(`⏱️  Rate Limit: 120 requests/minute (500ms delay)`);
    console.log(`⏳ Estimated Time: ${Math.round(seriesToProcess.length * 0.5 / 60)} minutes`);
    console.log('═'.repeat(60));

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN - No data will be written to database');
      console.log('\nSeries that would be processed:');
      seriesToProcess.forEach((seriesId, index) => {
        const seriesInfo = FRED_SERIES_MAP[seriesId as keyof typeof FRED_SERIES_MAP];
        console.log(`${index + 1}. ${seriesId} - ${seriesInfo.name} (${seriesInfo.category}, ${seriesInfo.frequency})`);
      });
      return;
    }

    // Confirm before starting
    console.log('\n⚠️  This will fetch data from FRED API and write to the database.');
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Process each series
    let currentIndex = 0;
    
    for (const seriesId of seriesToProcess) {
      currentIndex++;
      const seriesInfo = FRED_SERIES_MAP[seriesId as keyof typeof FRED_SERIES_MAP];
      
      try {
        this.displayProgress(currentIndex, seriesToProcess.length, seriesId, seriesInfo.name);
        
        await economicCalendarService.processSeries(seriesId, startDate, endDate);
        
        this.processedSeries.add(seriesId);
        logger.info(`✅ Successfully processed: ${seriesId} - ${seriesInfo.name}`);
        
      } catch (error) {
        this.failedSeries.add(seriesId);
        logger.error(`❌ Failed to process ${seriesId} - ${seriesInfo.name}:`, error);
        
        // Continue with next series instead of failing entire process
        console.log(`⚠️  Continuing with next series...`);
      }
    }

    // Final results
    const finalStats = await this.getDatabaseStats();
    const totalTime = (Date.now() - this.startTime) / 1000;
    
    console.log('\n🎉 Backfill Process Complete!');
    console.log('═'.repeat(60));
    console.log(`✅ Successfully Processed: ${this.processedSeries.size}/${seriesToProcess.length} series`);
    console.log(`❌ Failed: ${this.failedSeries.size} series`);
    console.log(`⏱️  Total Time: ${Math.round(totalTime)} seconds`);
    console.log(`📊 Records Added: ${(finalStats.totalRecords - initialStats.totalRecords).toLocaleString()}`);
    console.log(`📈 Final Record Count: ${finalStats.totalRecords.toLocaleString()}`);
    console.log(`🎯 Final Series Count: ${finalStats.seriesCount}`);
    
    if (this.failedSeries.size > 0) {
      console.log('\n⚠️  Failed Series (you can retry these):');
      this.failedSeries.forEach(seriesId => {
        const seriesInfo = FRED_SERIES_MAP[seriesId as keyof typeof FRED_SERIES_MAP];
        console.log(`   - ${seriesId}: ${seriesInfo.name}`);
      });
      
      console.log(`\n🔄 To retry failed series, run:`);
      console.log(`npx tsx scripts/backfill-economic-calendar.ts --series=${Array.from(this.failedSeries).join(',')}`);
    }
    
    console.log('\n✨ Economic Calendar is ready for use!');
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const backfill = new EconomicCalendarBackfill();
    const options = backfill['parseArgs'](); // Access private method for CLI parsing
    
    await backfill.run(options);
    
  } catch (error) {
    logger.error('❌ Backfill failed:', error);
    console.error('\n💥 Backfill Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => {
    console.log('\n👋 Backfill process completed. Exiting...');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { EconomicCalendarBackfill };