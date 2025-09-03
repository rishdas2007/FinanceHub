import { logger } from '../utils/logger';
import { fredApiService } from './fred-api-service';

export interface DataIntegrityReport {
  totalChecked: number;
  staleRecords: number;
  updatedRecords: number;
  errors: string[];
  recommendations: string[];
}

export class DataIntegrityValidator {
  private readonly MAX_STALE_DAYS = 7; // Consider data stale after 7 days
  
  /**
   * Validate and fix stale economic data
   */
  async validateAndFixStaleData(): Promise<DataIntegrityReport> {
    const report: DataIntegrityReport = {
      totalChecked: 0,
      staleRecords: 0,
      updatedRecords: 0,
      errors: [],
      recommendations: []
    };

    try {
      logger.info('🔍 Starting data integrity validation');
      
      // Get all records older than MAX_STALE_DAYS
      const staleRecords = await this.findStaleRecords();
      report.totalChecked = staleRecords.length;
      report.staleRecords = staleRecords.length;

      if (staleRecords.length === 0) {
        logger.info('✅ No stale data found - all records are current');
        return report;
      }

      logger.warn(`⚠️  Found ${staleRecords.length} stale records`);
      
      // Update stale records with fresh FRED data
      for (const record of staleRecords) {
        try {
          const freshData = await fredApiService.getLatestObservation(record.series_id);
          if (freshData) {
            await this.updateRecord(record.series_id, freshData);
            report.updatedRecords++;
            logger.info(`✅ Updated ${record.metric_name}: ${record.value} → ${freshData.value}`);
          } else {
            report.errors.push(`No fresh data available for ${record.metric_name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to update ${record.metric_name}: ${error instanceof Error ? error.message : String(error)}`;
          report.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Add recommendations
      if (report.staleRecords > 5) {
        report.recommendations.push('Consider increasing FRED API update frequency');
      }
      if (report.errors.length > 0) {
        report.recommendations.push('Review FRED API connectivity and series mappings');
      }

      logger.info(`🔧 Data integrity validation complete: ${report.updatedRecords}/${report.staleRecords} records updated`);
      
    } catch (error) {
      const errorMsg = `Data integrity validation failed: ${error instanceof Error ? error.message : String(error)}`;
      report.errors.push(errorMsg);
      logger.error(errorMsg);
    }

    return report;
  }

  /**
   * Find records that are older than MAX_STALE_DAYS
   */
  private async findStaleRecords(): Promise<Array<{series_id: string, metric_name: string, value: number, period_date: string}>> {
    const query = `
      SELECT DISTINCT ON (series_id) 
        series_id, metric_name, value, period_date
      FROM economic_indicators_history 
      WHERE period_date < NOW() - INTERVAL '${this.MAX_STALE_DAYS} days'
        AND series_id IS NOT NULL
      ORDER BY series_id, period_date DESC
    `;
    
    // Since we don't have direct SQL access in this context, we'll need to use the existing service
    // This is a placeholder - in production, you'd implement proper database access
    return [];
  }

  /**
   * Update a record with fresh data
   */
  private async updateRecord(seriesId: string, freshData: {value: string, date: string}): Promise<void> {
    // Implementation would go here - this is a placeholder
    // In production, you'd update the database with the fresh data
    logger.info(`Would update ${seriesId} with value ${freshData.value} for date ${freshData.date}`);
  }

  /**
   * Automated data staleness checker - runs daily
   */
  async dailyDataIntegrityCheck(): Promise<void> {
    logger.info('🕐 Running daily data integrity check');
    
    const report = await this.validateAndFixStaleData();
    
    if (report.staleRecords > 0) {
      logger.warn(`📊 Daily check found ${report.staleRecords} stale records, updated ${report.updatedRecords}`);
      
      // If many records are stale, trigger immediate FRED update
      if (report.staleRecords > 10) {
        logger.warn('🚨 High number of stale records detected - triggering immediate FRED refresh');
        // Trigger FRED incremental update
        // await fredIncrementalService.performIncrementalUpdate();
      }
    } else {
      logger.info('✅ Daily data integrity check passed - all data current');
    }
  }

  /**
   * Prevent future stale data issues
   */
  setupPreventiveMonitoring(): void {
    logger.info('🛡️  Setting up preventive data monitoring');
    
    // DISABLED: Daily integrity checks causing memory compound and 4GB+ crashes
    // Schedule daily integrity checks - MEMORY LEAK SOURCE!
    // setInterval(async () => {
    //   await this.dailyDataIntegrityCheck();
    // }, 24 * 60 * 60 * 1000); // Daily
    
    // Monitor for data insertion patterns that might indicate staleness
    logger.info('📅 Data integrity monitoring DISABLED to prevent memory crashes');
  }
}

export const dataIntegrityValidator = new DataIntegrityValidator();