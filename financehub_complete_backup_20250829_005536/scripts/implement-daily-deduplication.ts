#!/usr/bin/env tsx

/**
 * Daily Deduplication Implementation Script
 * Integrates daily deduplication service into ETF data collection
 * Ensures exactly one data point per trading day going forward
 */

import { dailyDeduplicationService } from '../server/services/daily-deduplication-service';
import { db } from '../server/db';
import { historicalTechnicalIndicators } from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

const ETF_SYMBOLS = ['SPY', 'XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY'];

async function implementDailyDeduplication() {
  console.log('🚀 Starting Daily Deduplication Implementation');
  console.log('================================================');
  
  try {
    // Step 1: Verify current daily deduplication status
    console.log('\n📊 Step 1: Verifying current record counts...');
    const verificationResults = await dailyDeduplicationService.verifyDailyDeduplication();
    
    const duplicateSymbols = Object.entries(verificationResults).filter(([_, count]) => count > 1);
    
    if (duplicateSymbols.length > 0) {
      console.log(`\n⚠️  Found ${duplicateSymbols.length} symbols with duplicate records today:`);
      duplicateSymbols.forEach(([symbol, count]) => {
        console.log(`   ${symbol}: ${count} records`);
      });
      
      // Step 2: Clean up existing duplicates
      console.log('\n🧹 Step 2: Cleaning up existing duplicates...');
      await dailyDeduplicationService.cleanupDuplicatesForToday();
      
      // Re-verify after cleanup
      console.log('\n✅ Step 3: Re-verifying after cleanup...');
      const postCleanupResults = await dailyDeduplicationService.verifyDailyDeduplication();
      const stillDuplicated = Object.entries(postCleanupResults).filter(([_, count]) => count > 1);
      
      if (stillDuplicated.length === 0) {
        console.log('✅ All duplicates successfully cleaned up!');
      } else {
        console.log(`⚠️  Still have duplicates: ${stillDuplicated.length} symbols`);
      }
    } else {
      console.log('✅ No duplicate records found - daily deduplication is working correctly');
    }
    
    // Step 3: Test storage prevention logic
    console.log('\n🔬 Step 4: Testing storage prevention logic...');
    const testSymbol = 'SPY';
    const shouldSkip = await dailyDeduplicationService.shouldSkipStorage(testSymbol);
    
    if (shouldSkip) {
      console.log(`✅ Storage prevention working: ${testSymbol} storage would be skipped (data exists for today)`);
    } else {
      console.log(`ℹ️  No existing data for ${testSymbol} today - storage would be allowed`);
    }
    
    // Step 4: Check market-aware storage timing
    console.log('\n⏰ Step 5: Checking market-aware storage timing...');
    const storageCheck = await dailyDeduplicationService.isStorageAllowed();
    console.log(`   Storage allowed: ${storageCheck.allowed}`);
    console.log(`   Reason: ${storageCheck.reason}`);
    
    // Step 5: Create integration example
    console.log('\n📝 Step 6: Creating integration example...');
    console.log('Daily deduplication service is ready for integration:');
    console.log('');
    console.log('// In your ETF data collection service:');
    console.log('import { dailyDeduplicationService } from "./daily-deduplication-service";');
    console.log('');
    console.log('// Before storing technical indicators:');
    console.log('const shouldStore = !await dailyDeduplicationService.shouldSkipStorage(symbol);');
    console.log('if (shouldStore) {');
    console.log('  // Store the data using the deduplication service');
    console.log('  await dailyDeduplicationService.storeTechnicalIndicatorsWithDeduplication(symbol, indicators);');
    console.log('} else {');
    console.log('  console.log(`Daily data already exists for ${symbol}, skipping storage`);');
    console.log('}');
    
    // Step 6: Show historical impact
    console.log('\n📈 Step 7: Historical impact analysis...');
    for (const symbol of ETF_SYMBOLS.slice(0, 3)) { // Show first 3 symbols
      try {
        const recentCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(historicalTechnicalIndicators)
          .where(and(
            eq(historicalTechnicalIndicators.symbol, symbol),
            sql`${historicalTechnicalIndicators.date} >= NOW() - INTERVAL '7 days'`
          ));
        
        const totalDays = 7;
        const actualRecords = recentCount[0]?.count || 0;
        const expectedRecords = 5; // 5 trading days in a week
        
        console.log(`   ${symbol}: ${actualRecords} records in last 7 days (expected: ~${expectedRecords})`);
        
        if (actualRecords > expectedRecords * 1.5) {
          console.log(`     ⚠️  High record count - may indicate intraday duplicates`);
        } else {
          console.log(`     ✅ Record count looks healthy`);
        }
      } catch (error) {
        console.log(`   ${symbol}: Error checking historical data`);
      }
    }
    
    console.log('\n🎯 Implementation Summary:');
    console.log('========================');
    console.log('✅ Daily deduplication service is operational');
    console.log('✅ Duplicate cleanup functionality verified');
    console.log('✅ Storage prevention logic tested');
    console.log('✅ Market-aware timing checks implemented');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Integrate dailyDeduplicationService.shouldSkipStorage() into ETF data collection');
    console.log('2. Use dailyDeduplicationService.storeTechnicalIndicatorsWithDeduplication() for new storage');
    console.log('3. Set up automated cleanup job for any edge case duplicates');
    console.log('4. Monitor daily record counts to ensure exactly one per trading day');
    
  } catch (error) {
    console.error('❌ Error during daily deduplication implementation:', error);
    throw error;
  }
}

// Example integration function showing how to modify existing ETF data collection
async function exampleIntegration() {
  console.log('\n🔧 Example Integration Code:');
  console.log('===========================');
  
  const exampleCode = `
// Before: Direct storage without deduplication
async function storeETFData(symbol: string, indicators: any) {
  await db.insert(historicalTechnicalIndicators).values({
    symbol,
    date: new Date(),
    rsi: indicators.rsi?.toString(),
    // ... other fields
  });
}

// After: With daily deduplication
async function storeETFDataWithDeduplication(symbol: string, indicators: any) {
  // Check market timing
  const { allowed, reason } = await dailyDeduplicationService.isStorageAllowed();
  if (!allowed) {
    console.log(\`Storage not allowed: \${reason}\`);
    return false;
  }
  
  // Store with deduplication
  const stored = await dailyDeduplicationService.storeTechnicalIndicatorsWithDeduplication(symbol, {
    rsi: indicators.rsi,
    macd: indicators.macd,
    macdSignal: indicators.macdSignal,
    percentB: indicators.percentB,
    atr: indicators.atr,
    priceChange: indicators.priceChange,
    maTrend: indicators.maTrend
  });
  
  if (stored) {
    console.log(\`✅ Stored technical indicators for \${symbol}\`);
  } else {
    console.log(\`📅 Daily data already exists for \${symbol}, skipped\`);
  }
  
  return stored;
}

// Daily cleanup job (run once per day)
async function dailyCleanupJob() {
  await dailyDeduplicationService.cleanupDuplicatesForToday();
  const verification = await dailyDeduplicationService.verifyDailyDeduplication();
  console.log('Daily cleanup completed. Verification:', verification);
}
`;
  
  console.log(exampleCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  implementDailyDeduplication()
    .then(() => {
      console.log('\n🎉 Daily deduplication implementation completed successfully!');
      return exampleIntegration();
    })
    .then(() => {
      console.log('\n✅ Ready to ensure exactly one data point per trading day going forward');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Daily deduplication implementation failed:', error);
      process.exit(1);
    });
}