import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { logger } from '../../shared/utils/logger';

/**
 * Data Integrity Fixer Service
 * Fixes mixed unit type issues in economic indicators database
 */
export class DataIntegrityFixer {
  
  /**
   * Fix mixed unit issues for specific problematic series
   */
  async fixMixedUnitIssues(): Promise<void> {
    logger.info('🔧 Starting comprehensive data integrity fixes for mixed unit issues');
    
    try {
      // Fix CCSA (Continuing Claims) - Convert incorrectly labeled "Percent" to "thousands"
      await this.fixContinuingClaims();
      
      // Fix ICSA (Initial Claims) - Convert incorrectly labeled "Percent" to "thousands"  
      await this.fixInitialClaims();
      
      // Fix CPI series - Standardize to "percent" for YoY calculations
      await this.fixCPISeries();
      
      logger.info('✅ Data integrity fixes completed successfully');
      
    } catch (error) {
      logger.error('❌ Failed to fix data integrity issues:', String(error));
      throw error;
    }
  }
  
  /**
   * Fix CCSA Continuing Claims mixed units
   */
  private async fixContinuingClaims(): Promise<void> {
    logger.info('🔧 Fixing CCSA Continuing Claims mixed unit issues');
    
    // Recent entries labeled as "Percent" are actually raw numbers that should be "thousands"
    // Convert values > 100000 from raw numbers to thousands format
    const result = await db.execute(sql`
      UPDATE economic_indicators_history 
      SET 
        unit = 'thousands',
        value = value / 1000
      WHERE series_id = 'CCSA' 
        AND unit = 'Percent' 
        AND value > 100000
    `);
    
    logger.info(`🔧 Fixed ${(result as any).rowCount || 0} CCSA records with incorrect Percent labeling`);
  }
  
  /**
   * Fix ICSA Initial Claims mixed units
   */
  private async fixInitialClaims(): Promise<void> {
    logger.info('🔧 Fixing ICSA Initial Claims mixed unit issues');
    
    // Recent entries labeled as "Percent" are actually raw numbers that should be "thousands"
    // Convert values > 100000 from raw numbers to thousands format
    const result = await db.execute(sql`
      UPDATE economic_indicators_history 
      SET 
        unit = 'thousands',
        value = value / 1000
      WHERE series_id = 'ICSA' 
        AND unit = 'Percent' 
        AND value > 100000
    `);
    
    logger.info(`🔧 Fixed ${(result as any).rowCount || 0} ICSA records with incorrect Percent labeling`);
  }
  
  /**
   * Fix CPI series mixed index/percent units
   */
  private async fixCPISeries(): Promise<void> {
    logger.info('🔧 Fixing CPI series mixed index/percent units');
    
    // For CPIAUCSL and CPILFESL, we want to keep YoY percent calculations
    // Values < 10 are likely YoY percentages, values > 100 are index values
    // Keep only the YoY percentage entries and remove index entries to avoid confusion
    
    const cpiSeries = ['CPIAUCSL', 'CPILFESL'];
    
    for (const seriesId of cpiSeries) {
      // Delete index entries (values > 100) to avoid mixed unit confusion
      const deleteResult = await db.execute(sql`
        DELETE FROM economic_indicators_history 
        WHERE series_id = ${seriesId} 
          AND unit = 'index' 
          AND value > 10
      `);
      
      // Ensure remaining YoY percentage entries have correct unit label
      const updateResult = await db.execute(sql`
        UPDATE economic_indicators_history 
        SET unit = 'percent'
        WHERE series_id = ${seriesId} 
          AND value <= 10
          AND value >= -5
      `);
      
      logger.info(`🔧 Fixed ${seriesId}: deleted ${(deleteResult as any).rowCount || 0} index entries, updated ${(updateResult as any).rowCount || 0} percent entries`);
    }
  }
  
  /**
   * Validate data integrity after fixes
   */
  async validateDataIntegrity(): Promise<boolean> {
    logger.info('🔍 Validating data integrity after fixes');
    
    try {
      // Check for remaining mixed unit issues
      const mixedUnitCheck = await db.execute(sql`
        SELECT series_id, COUNT(DISTINCT unit) as unit_count
        FROM economic_indicators_history 
        WHERE series_id IN ('CCSA', 'ICSA', 'CPIAUCSL', 'CPILFESL')
        GROUP BY series_id 
        HAVING COUNT(DISTINCT unit) > 1
      `);
      
      if (mixedUnitCheck.rows.length > 0) {
        logger.warn(`⚠️  Still found ${mixedUnitCheck.rows.length} series with mixed units`);
        return false;
      }
      
      logger.info('✅ Data integrity validation passed - no mixed unit issues found');
      return true;
      
    } catch (error) {
      logger.error('❌ Data integrity validation failed:', String(error));
      return false;
    }
  }
}

export const dataIntegrityFixer = new DataIntegrityFixer();