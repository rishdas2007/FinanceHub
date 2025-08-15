/**
 * Load Economic Observations from CSV
 * Processes 104,625 historical economic records from CSV file
 * Maps to econSeriesObservation table structure
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from '../server/db';
import { econSeriesObservation } from '../shared/economic-data-model';
import { logger } from '../shared/utils/logger';
import { sql } from 'drizzle-orm';

interface CSVRow {
  series_id: string;
  period_start: string;
  period_end: string;
  freq: string;
  value_std: string;
  standard_unit: string;
  agg_method: string;
  scale_hint: string;
  display_precision: string;
  transform_code: string;
  source: string;
}

const BATCH_SIZE = 1000; // Process in batches for performance

/**
 * Maps CSV string values to proper enum values
 */
function mapEnumValues(row: CSVRow) {
  // Map frequency
  const freq = row.freq === 'M' ? 'M' : row.freq === 'Q' ? 'Q' : 'W';
  
  // Map standard unit
  let standardUnit: 'PCT_DECIMAL' | 'USD' | 'COUNT' | 'INDEX_PT' | 'HOURS' | 'RATIO_DECIMAL';
  switch (row.standard_unit.toUpperCase()) {
    case 'PCT_DECIMAL':
    case 'PERCENT':
      standardUnit = 'PCT_DECIMAL';
      break;
    case 'USD':
    case 'DOLLARS':
      standardUnit = 'USD';
      break;
    case 'COUNT':
    case 'NUMBER':
      standardUnit = 'COUNT';
      break;
    case 'HOURS':
      standardUnit = 'HOURS';
      break;
    case 'RATIO_DECIMAL':
    case 'RATIO':
      standardUnit = 'RATIO_DECIMAL';
      break;
    default:
      standardUnit = 'INDEX_PT';
  }

  // Map scale hint
  let scaleHint: 'NONE' | 'K' | 'M' | 'B';
  switch (row.scale_hint.toUpperCase()) {
    case 'K':
      scaleHint = 'K';
      break;
    case 'M':
      scaleHint = 'M';
      break;
    case 'B':
      scaleHint = 'B';
      break;
    default:
      scaleHint = 'NONE';
  }

  // Map transform code
  let transformCode: 'LEVEL' | 'YOY' | 'MOM' | 'QOQ_ANN' | 'LOG_LEVEL' | 'LOG_DIFF_MOM' | 'LOG_DIFF_YOY';
  switch (row.transform_code.toUpperCase()) {
    case 'YOY':
      transformCode = 'YOY';
      break;
    case 'MOM':
      transformCode = 'MOM';
      break;
    case 'QOQ_ANN':
      transformCode = 'QOQ_ANN';
      break;
    case 'LOG_LEVEL':
      transformCode = 'LOG_LEVEL';
      break;
    case 'LOG_DIFF_MOM':
      transformCode = 'LOG_DIFF_MOM';
      break;
    case 'LOG_DIFF_YOY':
      transformCode = 'LOG_DIFF_YOY';
      break;
    default:
      transformCode = 'LEVEL';
  }

  return { freq, standardUnit, scaleHint, transformCode };
}

export async function loadEconomicObservations(csvFilePath: string) {
  try {
    logger.info('Starting economic observations data load...');
    
    // Read and parse CSV
    const csvContent = readFileSync(csvFilePath, 'utf-8');
    const records: CSVRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: false,
      trim: true
    });
    
    logger.info(`Parsed ${records.length} records from CSV`);
    
    // Process in batches
    let processed = 0;
    let errors = 0;
    let skipped = 0;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      try {
        const transformedBatch = batch
          .map(row => {
            try {
              // Skip invalid records
              if (!row.series_id || !row.period_end || !row.value_std) {
                skipped++;
                return null;
              }

              const valueStd = parseFloat(row.value_std);
              if (isNaN(valueStd)) {
                skipped++;
                return null;
              }

              const { freq, standardUnit, scaleHint, transformCode } = mapEnumValues(row);
              
              return {
                seriesId: row.series_id.trim(),
                periodStart: row.period_start.trim(),
                periodEnd: row.period_end.trim(),
                freq,
                valueStd,
                standardUnit,
                aggMethod: row.agg_method.trim() || 'last',
                scaleHint,
                displayPrecision: parseInt(row.display_precision) || 2,
                transformCode
              };
            } catch (rowError) {
              logger.warn(`Error processing row: ${JSON.stringify(row)}`, rowError);
              skipped++;
              return null;
            }
          })
          .filter(item => item !== null);
        
        if (transformedBatch.length === 0) {
          continue;
        }

        // Batch insert with conflict resolution
        await db.insert(econSeriesObservation)
          .values(transformedBatch)
          .onConflictDoUpdate({
            target: [
              econSeriesObservation.seriesId,
              econSeriesObservation.periodEnd,
              econSeriesObservation.transformCode
            ],
            set: {
              valueStd: sql`EXCLUDED.value_std`,
              standardUnit: sql`EXCLUDED.standard_unit`,
              aggMethod: sql`EXCLUDED.agg_method`,
              scaleHint: sql`EXCLUDED.scale_hint`,
              displayPrecision: sql`EXCLUDED.display_precision`
            }
          });
        
        processed += transformedBatch.length;
        
        if (processed % 5000 === 0 || i + BATCH_SIZE >= records.length) {
          logger.info(`Processed ${processed}/${records.length} records (${errors} errors, ${skipped} skipped)`);
        }
        
      } catch (batchError) {
        logger.error(`Batch error at ${i}-${i + BATCH_SIZE}:`, batchError);
        errors += batch.length;
      }
    }
    
    logger.info(`Data load complete: ${processed} processed, ${errors} errors, ${skipped} skipped`);
    return { processed, errors, skipped };
    
  } catch (error) {
    logger.error('Failed to load economic observations:', error);
    throw error;
  }
}

/**
 * Validate loaded data integrity
 */
export async function validateLoadedObservations() {
  try {
    logger.info('Running data validation checks...');

    // Check total records
    const totalCount = await db.execute(sql`
      SELECT COUNT(*) as total_records
      FROM econ_series_observation
    `);
    
    // Check unique series
    const seriesCount = await db.execute(sql`
      SELECT COUNT(DISTINCT series_id) as unique_series
      FROM econ_series_observation
    `);
    
    // Check date range
    const dateRange = await db.execute(sql`
      SELECT 
        MIN(period_end) as earliest_date,
        MAX(period_end) as latest_date,
        EXTRACT(YEAR FROM AGE(MAX(period_end), MIN(period_end))) as years_span
      FROM econ_series_observation
    `);

    // Check data by series
    const seriesBreakdown = await db.execute(sql`
      SELECT 
        series_id,
        COUNT(*) as record_count,
        MIN(period_end) as earliest,
        MAX(period_end) as latest
      FROM econ_series_observation
      GROUP BY series_id
      ORDER BY record_count DESC
      LIMIT 10
    `);

    const validation = {
      totalRecords: totalCount.rows[0].total_records,
      uniqueSeries: seriesCount.rows[0].unique_series,
      dateRange: dateRange.rows[0],
      topSeries: seriesBreakdown.rows
    };

    logger.info('Data validation results:', validation);
    return validation;

  } catch (error) {
    logger.error('Validation failed:', error);
    throw error;
  }
}

// Allow direct script execution
if (require.main === module) {
  const CSV_FILE_PATH = '/Users/rishabhdas/Downloads/Dashboard data/econ_series_observation_upload.csv';
  
  loadEconomicObservations(CSV_FILE_PATH)
    .then(async (result) => {
      console.log(`✅ Observations loaded: ${result.processed} processed, ${result.errors} errors, ${result.skipped} skipped`);
      
      // Run validation
      const validation = await validateLoadedObservations();
      console.log(`📊 Validation: ${validation.totalRecords} total records, ${validation.uniqueSeries} unique series`);
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to load observations:', error);
      process.exit(1);
    });
}