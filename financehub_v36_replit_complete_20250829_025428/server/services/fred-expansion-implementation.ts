import { logger } from '../../shared/utils/logger';
import { FredApiServiceIncremental, CURATED_SERIES } from './fred-api-service-incremental';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Implementation service for FRED API expansion
 * Handles adding new indicators and historical backfill
 */
export class FredExpansionImplementation {
  private fredService: FredApiServiceIncremental;
  
  constructor() {
    this.fredService = new FredApiServiceIncremental();
  }
  
  /**
   * Validate that new indicators were properly added to CURATED_SERIES
   */
  async validateExpansion(): Promise<{
    totalSeries: number;
    newIndicators: string[];
    expansionComplete: boolean;
  }> {
    logger.info('✅ Validating FRED expansion implementation...');
    
    const totalSeries = CURATED_SERIES.length;
    
    // New indicators added in this expansion
    const newIndicators = [
      'GDPCPIM', 'CCCI', 'NHSUSSPT', 'MORTGAGE30US', 'TB1YR',
      'LEICONF', 'CPILFENS', 'CPINSA', 'MEDLISPRI'
    ];
    
    // Verify each new indicator exists in CURATED_SERIES
    const foundIndicators = newIndicators.filter(id => 
      CURATED_SERIES.some(series => series.id === id)
    );
    
    const expansionComplete = foundIndicators.length === newIndicators.length;
    
    logger.info(`📊 Total CURATED_SERIES: ${totalSeries}`);
    logger.info(`🆕 New indicators added: ${foundIndicators.length}/${newIndicators.length}`);
    logger.info(`✅ Expansion complete: ${expansionComplete}`);
    
    foundIndicators.forEach(id => {
      logger.info(`  ✓ ${id} - Successfully added to CURATED_SERIES`);
    });
    
    const missing = newIndicators.filter(id => !foundIndicators.includes(id));
    missing.forEach(id => {
      logger.warn(`  ❌ ${id} - Missing from CURATED_SERIES`);
    });
    
    return {
      totalSeries,
      newIndicators: foundIndicators,
      expansionComplete
    };
  }
  
  /**
   * Run incremental updates for new indicators
   */
  async updateNewIndicators(): Promise<void> {
    logger.info('🔄 Running incremental updates for new indicators...');
    
    try {
      // Generate session ID for tracking
      const sessionId = `expansion-${Date.now()}`;
      
      // Run full incremental update (includes all series including new ones)
      const updateResult = await this.fredService.performIncrementalUpdate(sessionId);
      
      const newIndicatorIds = ['GDPCPIM', 'CCCI', 'NHSUSSPT', 'MORTGAGE30US', 'TB1YR', 
                              'LEICONF', 'CPILFENS', 'CPINSA', 'MEDLISPRI'];
      
      const newIndicatorResults = updateResult.results.filter(result => 
        newIndicatorIds.includes(result.seriesId)
      );
      
      logger.info(`📈 Incremental update completed: ${updateResult.success ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`📊 Total API calls used: ${updateResult.apiCallsUsed}`);
      logger.info(`📈 New indicator results: ${newIndicatorResults.length}/${newIndicatorIds.length}`);
      
      newIndicatorResults.forEach(result => {
        if (result.error) {
          logger.warn(`  ❌ ${result.seriesId}: ${result.error}`);
        } else {
          logger.info(`  ✅ ${result.seriesId}: ${result.operation} (${result.newDataPoints} new points)`);
        }
      });
      
    } catch (error) {
      logger.error('❌ Failed to update new indicators:', String(error));
      throw error;
    }
  }
  
  /**
   * Check data availability for new indicators
   */
  async checkDataAvailability(): Promise<void> {
    logger.info('🔍 Checking data availability for new indicators...');
    
    const newIndicators = [
      'GDPCPIM', 'CCCI', 'NHSUSSPT', 'MORTGAGE30US', 'TB1YR',
      'LEICONF', 'CPILFENS', 'CPINSA', 'MEDLISPRI'
    ];
    
    try {
      for (const seriesId of newIndicators) {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count, 
                 MIN(period_date) as earliest_date,
                 MAX(period_date) as latest_date
          FROM economic_indicators_history 
          WHERE series_id = ${seriesId}
        `);
        
        const data = result.rows[0] as any;
        const count = parseInt(data.count) || 0;
        
        if (count > 0) {
          logger.info(`✅ ${seriesId}: ${count} records (${data.earliest_date} to ${data.latest_date})`);
        } else {
          logger.warn(`❌ ${seriesId}: No data found - needs historical backfill`);
        }
      }
      
    } catch (error) {
      logger.error('❌ Failed to check data availability:', String(error));
    }
  }
  
  /**
   * Run comprehensive implementation validation
   */
  async runImplementationValidation(): Promise<void> {
    logger.info('🚀 Running FRED Expansion Implementation Validation');
    
    const validation = await this.validateExpansion();
    
    if (!validation.expansionComplete) {
      logger.error('❌ Expansion incomplete - missing indicators in CURATED_SERIES');
      return;
    }
    
    await this.checkDataAvailability();
    
    // Update new indicators to get latest data
    await this.updateNewIndicators();
    
    // Re-check availability after updates
    await this.checkDataAvailability();
    
    logger.info('✅ FRED Expansion Implementation Complete');
    logger.info(`📊 System expanded from ~41 to ${41 + validation.newIndicators.length} indicators`);
  }
}