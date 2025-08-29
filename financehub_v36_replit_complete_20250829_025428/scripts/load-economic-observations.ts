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

/**
 * Validates a CSV row for data quality
 */
function validateRow(row: CSVRow, rowIndex: number): string | null {
  // Check required fields
  if (!row.series_id || !row.period_end || !row.value_std) {
    return `Row ${rowIndex}: Missing required fields`;
  }

  // Validate numeric value
  const numericValue = parseFloat(row.value_std);
  if (isNaN(numericValue)) {
    return `Row ${rowIndex}: Invalid numeric value: ${row.value_std}`;
  }

  // Validate date format
  if (!row.period_end.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return `Row ${rowIndex}: Invalid date format: ${row.period_end}`;
  }

  return null; // Valid row
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
    const errorLog: string[] = [];
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      try {
        // Validate and transform batch
        const validatedBatch = [];
        
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const globalIndex = i + j;
          
          // Validate row
          const validationError = validateRow(row, globalIndex + 1);
          if (validationError) {
            errorLog.push(validationError);
            skipped++;
            continue;
          }

          // Map enum values
          const { freq, standardUnit, scaleHint, transformCode } = mapEnumValues(row);
          
          // Transform to database format
          const transformedRow = {
            seriesId: row.series_id,
            periodStart: row.period_start,
            periodEnd: row.period_end,
            freq,
            valueStd: parseFloat(row.value_std),
            standardUnit,
            aggMethod: row.agg_method || 'last',
            scaleHint,
            displayPrecision: parseInt(row.display_precision) || 2,
            transformCode
          };

          validatedBatch.push(transformedRow);
        }
        
        if (validatedBatch.length === 0) {
          logger.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: No valid records to insert`);
          continue;
        }

        // Batch insert with conflict resolution
        await db.insert(econSeriesObservation)
          .values(validatedBatch as any)
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
              displayPrecision: sql`EXCLUDED.display_precision`,
              scaleHint: sql`EXCLUDED.scale_hint`
            }
          });
        
        processed += validatedBatch.length;
        
        // Progress logging
        if (processed % 5000 === 0 || processed === records.length - skipped) {
          logger.info(`Progress: ${processed}/${records.length - skipped} processed (${skipped} skipped, ${errors} errors)`);
        }
        
      } catch (batchError) {
        logger.error(`Batch error at ${i}-${i + BATCH_SIZE}:`, batchError);
        errors += batch.length;
        errorLog.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
      }
    }
    
    // Log errors if any
    if (errorLog.length > 0) {
      logger.warn('Data loading errors found:', errorLog.slice(0, 10).join(', ')); // Log first 10 errors
      if (errorLog.length > 10) {
        logger.warn(`... and ${errorLog.length - 10} more errors`);
      }
    }
    
    const result = { processed, errors, skipped, totalRecords: records.length };
    logger.info('Data load complete with results:', result);
    return result;
    
  } catch (error) {
    logger.error('Failed to load economic observations:', error);
    throw error;
  }
}

/**
 * Validates the loaded data against expected patterns
 */
export async function validateLoadedData() {
  try {
    logger.info('Validating loaded economic data...');
    
    // Check total records
    const totalCount = await db.execute(sql`
      SELECT COUNT(*) as total_records 
      FROM econ_series_observation
    `);
    
    // Check unique series
    const uniqueSeries = await db.execute(sql`
      SELECT COUNT(DISTINCT series_id) as unique_series 
      FROM econ_series_observation
    `);
    
    // Check date range
    const dateRange = await db.execute(sql`
      SELECT 
        MIN(period_end) as earliest_date,
        MAX(period_end) as latest_date
      FROM econ_series_observation
    `);
    
    // Check critical series for z-score readiness
    const criticalSeries = ['CPIAUCSL', 'UNRATE', 'DFF', 'DGS10', 'ICSA', 'PAYEMS'];
    const seriesValidation = [];
    
    for (const seriesId of criticalSeries) {
      const seriesCount = await db.execute(sql`
        SELECT COUNT(*) as record_count
        FROM econ_series_observation
        WHERE series_id = ${seriesId}
          AND period_end >= CURRENT_DATE - INTERVAL '72 months'
      `);
      
      const recordCount = Number(seriesCount.rows[0]?.record_count || 0);
      const isReady = recordCount >= 60;
      seriesValidation.push({
        seriesId,
        recordCount,
        zScoreReady: isReady,
        status: isReady ? '✅' : '⚠️'
      });
    }
    
    const validation = {
      totalRecords: Number(totalCount.rows[0]?.total_records || 0),
      uniqueSeries: Number(uniqueSeries.rows[0]?.unique_series || 0),
      earliestDate: dateRange.rows[0]?.earliest_date,
      latestDate: dateRange.rows[0]?.latest_date,
      criticalSeriesValidation: seriesValidation
    };
    
    logger.info('Data validation complete with results:', validation);
    return validation;
    
  } catch (error) {
    logger.error('Data validation failed:', error);
    throw error;
  }
}

// Allow direct execution (ES module compatible)
if (process.argv[1]?.endsWith('load-economic-observations.ts')) {
  const csvFilePath = process.argv[2];
  if (!csvFilePath) {
    console.error('Usage: npx tsx load-economic-observations.ts <csv-file-path>');
    process.exit(1);
  }
  
  loadEconomicObservations(csvFilePath)
    .then(async (result) => {
      console.log('✅ Economic observations loading complete:', result);
      
      // Run validation
      const validation = await validateLoadedData();
      console.log('📊 Data validation results:', validation);
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Economic observations loading failed:', error);
      process.exit(1);
    });
}