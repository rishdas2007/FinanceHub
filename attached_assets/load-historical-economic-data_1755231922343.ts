/**
 * Historical Economic Data Loading Orchestration Script
 * Coordinates the complete 5-phase data loading process
 * Loads 104,625 historical economic records into 3-layer model
 */

import { loadSeriesDefinitions } from './load-economic-series-definitions';
import { loadEconomicObservations, validateLoadedObservations } from './load-economic-observations';
import { logger } from '../shared/utils/logger';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import path from 'path';

const CSV_FILE_PATH = '/Users/rishabhdas/Downloads/Dashboard data/econ_series_observation_upload.csv';

/**
 * Pre-flight checks before starting data load
 */
async function preFlightChecks() {
  console.log('🔍 Running pre-flight checks...');
  
  try {
    // Check if CSV file exists
    const fs = await import('fs');
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found at: ${CSV_FILE_PATH}`);
    }
    
    const stats = fs.statSync(CSV_FILE_PATH);
    console.log(`📄 CSV file found: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Test database connection
    await db.execute(sql`SELECT 1 as connection_test`);
    console.log('✅ Database connection verified');
    
    // Check if tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('econ_series_def', 'econ_series_observation')
    `);
    
    const tableNames = tables.rows.map(row => row.table_name);
    console.log(`📋 Database tables found: ${tableNames.join(', ')}`);
    
    if (!tableNames.includes('econ_series_def') || !tableNames.includes('econ_series_observation')) {
      console.warn('⚠️ Some required tables missing. Run database migrations first.');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Pre-flight check failed:', error);
    return false;
  }
}

/**
 * Generate comprehensive data validation report
 */
async function generateDataValidationReport() {
  console.log('📊 Generating comprehensive data validation report...');
  
  try {
    // Series definitions coverage
    const defCount = await db.execute(sql`
      SELECT COUNT(*) as total_definitions
      FROM econ_series_def
    `);
    
    // Observations coverage
    const obsStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_observations,
        COUNT(DISTINCT series_id) as unique_series,
        MIN(period_end) as earliest_date,
        MAX(period_end) as latest_date,
        EXTRACT(YEAR FROM AGE(MAX(period_end), MIN(period_end))) as years_span
      FROM econ_series_observation
    `);
    
    // Data quality metrics
    const qualityCheck = await db.execute(sql`
      SELECT 
        series_id,
        COUNT(*) as record_count,
        MIN(period_end) as earliest,
        MAX(period_end) as latest,
        CASE 
          WHEN COUNT(*) >= 60 THEN 'Z-Score Ready'
          WHEN COUNT(*) >= 24 THEN 'Sufficient'
          ELSE 'Insufficient'
        END as quality_status
      FROM econ_series_observation
      GROUP BY series_id
      ORDER BY record_count DESC
    `);
    
    // Critical indicators check
    const criticalSeries = ['CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'UNRATE', 'DFF', 'DGS10', 'PAYEMS'];
    const criticalCheck = await db.execute(sql`
      SELECT 
        series_id,
        COUNT(*) as records,
        MAX(period_end) as latest_data
      FROM econ_series_observation
      WHERE series_id = ANY(${criticalSeries})
      GROUP BY series_id
      ORDER BY series_id
    `);
    
    const report = {
      timestamp: new Date().toISOString(),
      definitions: defCount.rows[0],
      observations: obsStats.rows[0],
      qualityBreakdown: qualityCheck.rows,
      criticalIndicators: criticalCheck.rows
    };
    
    console.log('\n📋 === DATA VALIDATION REPORT ===');
    console.log(`📊 Series Definitions: ${report.definitions.total_definitions}`);
    console.log(`📈 Total Observations: ${report.observations.total_observations}`);
    console.log(`🎯 Unique Series: ${report.observations.unique_series}`);
    console.log(`📅 Date Range: ${report.observations.earliest_date} to ${report.observations.latest_date}`);
    console.log(`⏱️ Years Coverage: ${report.observations.years_span} years`);
    
    console.log('\n🎯 Critical Indicators Status:');
    report.criticalIndicators.forEach(indicator => {
      const status = indicator.records >= 60 ? '✅' : indicator.records >= 24 ? '⚠️' : '❌';
      console.log(`  ${status} ${indicator.series_id}: ${indicator.records} records (latest: ${indicator.latest_data})`);
    });
    
    console.log('\n📊 Quality Summary:');
    const qualityCounts = report.qualityBreakdown.reduce((acc, series) => {
      acc[series.quality_status] = (acc[series.quality_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(qualityCounts).forEach(([status, count]) => {
      const emoji = status === 'Z-Score Ready' ? '✅' : status === 'Sufficient' ? '⚠️' : '❌';
      console.log(`  ${emoji} ${status}: ${count} series`);
    });
    
    return report;
    
  } catch (error) {
    logger.error('Failed to generate validation report:', error);
    throw error;
  }
}

/**
 * Calculate expected vs actual data loading metrics
 */
function calculateLoadingMetrics(definitionsResult: any, observationsResult: any) {
  const expectedSeries = 34; // From CSV analysis
  const expectedObservations = 104625; // From CSV analysis
  
  const definitionsSuccess = (definitionsResult.total / expectedSeries) * 100;
  const observationsSuccess = (observationsResult.processed / expectedObservations) * 100;
  
  return {
    definitions: {
      expected: expectedSeries,
      actual: definitionsResult.total,
      successRate: definitionsSuccess.toFixed(1) + '%'
    },
    observations: {
      expected: expectedObservations,
      actual: observationsResult.processed,
      successRate: observationsSuccess.toFixed(1) + '%',
      errors: observationsResult.errors,
      skipped: observationsResult.skipped
    }
  };
}

/**
 * Main orchestration function
 */
async function main() {
  const startTime = Date.now();
  
  try {
    console.log('🚀 === HISTORICAL ECONOMIC DATA LOADING PROCESS ===');
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`📁 CSV Source: ${CSV_FILE_PATH}`);
    console.log(`📊 Expected: 34 series, 104,625 observations\n`);
    
    // Phase 1: Pre-flight checks
    console.log('🔍 Phase 1: Pre-flight Validation');
    const preFlightOk = await preFlightChecks();
    if (!preFlightOk) {
      throw new Error('Pre-flight checks failed. Cannot proceed with data loading.');
    }
    console.log('✅ Pre-flight checks passed\n');
    
    // Phase 2: Load series definitions
    console.log('📊 Phase 2: Loading Economic Series Definitions');
    const definitionsResult = await loadSeriesDefinitions();
    console.log(`✅ Series definitions loaded: ${definitionsResult.loaded} new, ${definitionsResult.updated} updated\n`);
    
    // Phase 3: Load observations data
    console.log('📈 Phase 3: Loading Economic Observations Data');
    const observationsResult = await loadEconomicObservations(CSV_FILE_PATH);
    console.log(`✅ Observations loaded: ${observationsResult.processed} processed, ${observationsResult.errors} errors, ${observationsResult.skipped} skipped\n`);
    
    // Phase 4: Data validation
    console.log('🔍 Phase 4: Data Validation and Integrity Checks');
    const validationResult = await validateLoadedObservations();
    const fullReport = await generateDataValidationReport();
    console.log('✅ Data validation completed\n');
    
    // Phase 5: Summary and metrics
    console.log('📋 Phase 5: Loading Summary and Metrics');
    const metrics = calculateLoadingMetrics(definitionsResult, observationsResult);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n🎉 === LOADING PROCESS COMPLETED ===');
    console.log(`⏱️ Total Duration: ${duration} seconds`);
    console.log(`📊 Series Definitions: ${metrics.definitions.actual}/${metrics.definitions.expected} (${metrics.definitions.successRate})`);
    console.log(`📈 Observations: ${metrics.observations.actual}/${metrics.observations.expected} (${metrics.observations.successRate})`);
    
    if (metrics.observations.errors > 0) {
      console.log(`⚠️ Errors encountered: ${metrics.observations.errors} records failed`);
    }
    
    if (metrics.observations.skipped > 0) {
      console.log(`📋 Skipped records: ${metrics.observations.skipped} (invalid data)`);
    }
    
    // Success criteria check
    const observationsSuccessRate = parseFloat(metrics.observations.successRate.replace('%', ''));
    if (observationsSuccessRate >= 95) {
      console.log('\n✅ DATA LOADING SUCCESS: >95% success rate achieved');
    } else if (observationsSuccessRate >= 85) {
      console.log('\n⚠️ DATA LOADING PARTIAL SUCCESS: 85-95% success rate');
    } else {
      console.log('\n❌ DATA LOADING NEEDS REVIEW: <85% success rate');
    }
    
    console.log('\n🚀 Ready for Economic Indicators Dashboard Integration!');
    console.log('📋 Next Steps:');
    console.log('  1. Update YoY transformer to use new econSeriesObservation data');
    console.log('  2. Update z-score calculations to leverage 60+ months of history');
    console.log('  3. Test /api/macroeconomic-indicators endpoint');
    console.log('  4. Verify dashboard shows proper YoY percentages');
    
  } catch (error) {
    console.error('\n💥 LOADING PROCESS FAILED:', error);
    logger.error('Historical data loading process failed:', error);
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n⚠️ Process interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Process terminated');
  process.exit(1);
});

// Execute main process
if (require.main === module) {
  main();
}