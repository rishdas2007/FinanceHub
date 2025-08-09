#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

// Use direct SQL import approach since TypeScript modules need compilation
import { Client } from 'pg';

const CSV_FILE_PATH = './attached_assets/economic_indicators_history_1754716986196.csv';

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

console.log('🚀 Starting Historical Economic Data Import...');
console.log(`📊 Processing file: ${CSV_FILE_PATH}`);

async function importHistoricalData() {
  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database');

    // Check if file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
      process.exit(1);
    }

    // Parse CSV data
    const records = [];
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    
    return new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, async (err, data) => {
        if (err) {
          console.error('❌ CSV parsing error:', err);
          reject(err);
          return;
        }

        console.log(`📈 Parsed ${data.length} records from CSV`);
        
        // Process records in batches for better performance
        const BATCH_SIZE = 100;
        let insertedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
          const batch = data.slice(i, i + BATCH_SIZE);
          const insertBatch = [];

          for (const record of batch) {
            try {
              // Validate required fields
              if (!record.series_id || !record.value || !record.period_date) {
                console.warn(`⚠️ Skipping record with missing data:`, {
                  series_id: record.series_id,
                  value: record.value,
                  period_date: record.period_date
                });
                skippedCount++;
                continue;
              }

              // Parse date fields
              const periodDate = new Date(record.period_date);
              if (isNaN(periodDate.getTime())) {
                console.warn(`⚠️ Invalid period_date: ${record.period_date}`);
                skippedCount++;
                continue;
              }

              // Prepare record for database insertion
              const dbRecord = {
                series_id: record.series_id,
                indicator: record.metric_name || record.series_id,
                value: parseFloat(record.value),
                category: record.category || 'Unknown',
                frequency: record.frequency || 'Unknown',
                release_date: record.release_date ? new Date(record.release_date) : new Date(),
                period_date: periodDate,
                unit: record.unit || 'Unknown'
              };

              // Validate numeric value
              if (isNaN(dbRecord.value)) {
                console.warn(`⚠️ Invalid numeric value: ${record.value} for ${record.series_id}`);
                skippedCount++;
                continue;
              }

              insertBatch.push(dbRecord);
            } catch (error) {
              console.error(`❌ Error processing record:`, error);
              skippedCount++;
            }
          }

          // Insert batch into database
          if (insertBatch.length > 0) {
            try {
              // Build SQL INSERT query
              const values = insertBatch.map((record, idx) => {
                const baseIdx = idx * 8;
                return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8})`;
              }).join(', ');
              
              const query = `
                INSERT INTO historical_economic_data 
                (series_id, indicator, value, category, frequency, release_date, period_date, unit) 
                VALUES ${values}
              `;
              
              const params = insertBatch.flatMap(record => [
                record.series_id,
                record.indicator,
                record.value,
                record.category,
                record.frequency,
                record.release_date,
                record.period_date,
                record.unit
              ]);
              
              await client.query(query, params);
              insertedCount += insertBatch.length;
              
              const progress = ((i + BATCH_SIZE) / data.length * 100).toFixed(1);
              console.log(`📊 Progress: ${progress}% - Inserted batch of ${insertBatch.length} records (Total: ${insertedCount})`);
            } catch (insertError) {
              console.error(`❌ Database insertion error for batch:`, insertError);
              
              // Try individual inserts for this batch to identify problematic records
              for (const record of insertBatch) {
                try {
                  const query = `
                    INSERT INTO historical_economic_data 
                    (series_id, indicator, value, category, frequency, release_date, period_date, unit) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                  `;
                  await client.query(query, [
                    record.series_id,
                    record.indicator,
                    record.value,
                    record.category,
                    record.frequency,
                    record.release_date,
                    record.period_date,
                    record.unit
                  ]);
                  insertedCount++;
                } catch (individualError) {
                  console.error(`❌ Failed to insert individual record:`, {
                    series_id: record.series_id,
                    period_date: record.period_date,
                    error: individualError.message
                  });
                  skippedCount++;
                }
              }
            }
          }
        }

        console.log('\n✅ Import Summary:');
        console.log(`📊 Total records processed: ${data.length}`);
        console.log(`✅ Successfully inserted: ${insertedCount}`);
        console.log(`⚠️ Skipped due to errors: ${skippedCount}`);
        console.log(`🎯 Success rate: ${(insertedCount / data.length * 100).toFixed(1)}%`);

        // Show breakdown by indicator
        const indicatorCounts = {};
        data.forEach(record => {
          if (record.series_id) {
            indicatorCounts[record.series_id] = (indicatorCounts[record.series_id] || 0) + 1;
          }
        });

        console.log('\n📈 Records by Indicator:');
        Object.entries(indicatorCounts).forEach(([indicator, count]) => {
          console.log(`  ${indicator}: ${count} observations`);
        });

        resolve({
          processed: data.length,
          inserted: insertedCount,
          skipped: skippedCount,
          indicators: Object.keys(indicatorCounts).length
        });
      });
    });

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Execute import
importHistoricalData()
  .then((result) => {
    console.log('\n🎉 Historical Economic Data Import Completed Successfully!');
    console.log(`📊 Final Stats: ${result.inserted} records from ${result.indicators} indicators`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Import process failed:', error);
    process.exit(1);
  });