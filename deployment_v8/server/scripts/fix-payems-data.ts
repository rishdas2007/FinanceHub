#!/usr/bin/env tsx

/**
 * Script to fix PAYEMS (Nonfarm Payrolls) data by converting from levels to changes
 * 
 * PAYEMS in FRED provides total employment levels in millions.
 * For economic analysis, we need month-over-month changes in thousands.
 * This matches the standard reporting format (e.g., "73k jobs added").
 */

import { fredApiServiceIncremental } from '../services/fred-api-service-incremental';
import { db } from '../db';
import { economicIndicatorsHistory } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

async function fixPayemsData() {
  logger.info('🔧 Starting PAYEMS data correction process...');
  
  try {
    // Step 1: Clear existing PAYEMS data
    logger.info('📊 Clearing existing PAYEMS data...');
    await db.delete(economicIndicatorsHistory).where(eq(economicIndicatorsHistory.seriesId, 'PAYEMS'));
    
    // Step 2: Fetch fresh data from FRED
    logger.info('📡 Fetching fresh PAYEMS data from FRED...');
    const sessionId = `payems-fix-${Date.now()}`;
    
    // Force a full update for PAYEMS
    const result = await fredApiServiceIncremental.performIncrementalUpdate(sessionId);
    
    if (result.success) {
      logger.info(`✅ PAYEMS data correction completed successfully`);
      logger.info(`📊 Results: ${result.newDataPoints} data points processed`);
      
      // Step 3: Verify the corrected data
      const verifyData = await db
        .select()
        .from(economicIndicatorsHistory)
        .where(eq(economicIndicatorsHistory.seriesId, 'PAYEMS'))
        .orderBy(desc(economicIndicatorsHistory.periodDate))
        .limit(5);
      
      logger.info('📋 Sample corrected data:');
      verifyData.forEach(record => {
        logger.info(`  ${record.periodDate.toISOString().split('T')[0]}: ${record.value} ${record.unit}`);
      });
      
    } else {
      logger.error('❌ PAYEMS data correction failed:', result.message);
    }
    
  } catch (error) {
    logger.error('❌ Error during PAYEMS data correction:', error);
  }
}

// Execute if run directly
fixPayemsData().catch(console.error);

export { fixPayemsData };