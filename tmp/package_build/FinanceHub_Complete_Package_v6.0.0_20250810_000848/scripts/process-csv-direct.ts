/**
 * Direct CSV Processing Script
 * Processes the economic indicators CSV file and uploads to database
 */

import { readFileSync } from 'fs';
import { db } from '../server/db';

// FRED Series ID mapping
const FRED_SERIES_MAPPING: { [key: string]: string } = {
  "Manufacturers' New Orders": "NEWORDER",
  "Building Permits": "PERMIT", 
  "Purchasing Managers Index (PMI)": "NAPM",
  "Stock Market Index (S&P 500)": "SP500",
  "Interest Rate Spread (10yr-2yr)": "T10Y2Y",
  "Industrial Production": "INDPRO",
  "Personal Income (less transfer payments)": "PINCOME",
  "Retail Sales": "RSALES",
  "Housing Starts": "HOUST",
  "Average Weekly Hours Worked in Manufacturing": "AWHMAN",
  "Average Initial Jobless Claims": "ICSA",
  "Personal Consumption Expenditures (PCE) Year-over-Year": "PCEPI",
  "Consumer Price Index (CPI) Year-over-Year": "CPIAUCSL",
  "Producer Price Index (PPI)": "PPIFIS",
  "Initial Jobless Claims": "ICSA",
  "Job Openings and Labor Turnover Survey (JOLTS)": "JTSJOL",
  "Payroll Employment": "PAYEMS",
  "Manufacturing Employment": "MANEMP",
  "Unemployment Rate": "UNRATE",
  "Unemployment Duration (U-6 Unemployment Rate)": "U6RATE",
  "Interest Rate Spread": "T10Y2Y",
  "Money Supply (M2)": "M2SL",
  "Federal Funds Rate": "FEDFUNDS",
  "Interest Rates (Short-Term)": "TB3MS"
};

async function processCSVData() {
  console.log('🚀 Starting direct CSV processing...');
  
  try {
    // Read and parse CSV manually (simple approach)
    const csvPath = '../attached_assets/economic_indicators_populated_with_real_data_1754761527436.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // Parse header to get date columns
    const header = lines[0].split(',');
    console.log(`📊 Found ${header.length} columns in CSV`);
    
    const dateColumns = header.slice(5); // Skip first 5 columns (Metric, Category, Type, frequency, units)
    console.log(`📅 Processing ${dateColumns.length} date columns`);
    
    let totalInserts = 0;
    let totalUpdates = 0;
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      
      if (values.length < 5) continue; // Skip incomplete rows
      
      const metric = values[0]?.trim().replace(/"/g, '');
      const category = values[1]?.trim().replace(/"/g, '');
      const type = values[2]?.trim().replace(/"/g, '');
      const frequency = values[3]?.trim().replace(/"/g, '');
      const unit = values[4]?.trim().replace(/"/g, '');
      
      if (!metric || metric === 'Metric') continue;
      
      const seriesId = FRED_SERIES_MAPPING[metric] || metric.toUpperCase().replace(/\s+/g, '_').replace(/[()]/g, '');
      
      console.log(`🔄 Processing ${metric} (${seriesId})`);
      
      // Process each date value
      for (let dateIdx = 0; dateIdx < dateColumns.length && dateIdx + 5 < values.length; dateIdx++) {
        const dateCol = dateColumns[dateIdx]?.trim().replace(/"/g, '');
        const valueStr = values[dateIdx + 5]?.trim().replace(/"/g, '');
        
        if (!dateCol || !valueStr || valueStr === '' || valueStr === 'N/A') continue;
        
        const numericValue = parseFloat(valueStr);
        if (isNaN(numericValue)) continue;
        
        // Parse date (MM/DD/YY format)
        try {
          const dateParts = dateCol.split('/');
          if (dateParts.length !== 3) continue;
          
          let month = parseInt(dateParts[0]);
          let day = parseInt(dateParts[1]);
          let year = parseInt(dateParts[2]);
          
          // Convert 2-digit year to 4-digit
          if (year < 100) {
            year = year < 25 ? 2000 + year : 1900 + year;
          }
          
          const periodDate = new Date(year, month - 1, day);
          const releaseDate = new Date(periodDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          // Check if record exists
          const existing = await db.execute(`
            SELECT id FROM economic_indicators_current 
            WHERE series_id = ? AND period_date = ?
          `, [seriesId, periodDate.toISOString().split('T')[0]]);
          
          if (existing.rows && existing.rows.length > 0) {
            // Update existing
            await db.execute(`
              UPDATE economic_indicators_current SET
                metric = ?, category = ?, type = ?, frequency = ?,
                value_numeric = ?, unit = ?, updated_at = NOW()
              WHERE series_id = ? AND period_date = ?
            `, [
              metric, category, type, frequency, numericValue, unit,
              seriesId, periodDate.toISOString().split('T')[0]
            ]);
            totalUpdates++;
          } else {
            // Insert new
            await db.execute(`
              INSERT INTO economic_indicators_current 
              (series_id, metric, category, type, frequency, value_numeric, 
               period_date, release_date, period_date_desc, release_date_desc, 
               unit, is_latest, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
            `, [
              seriesId, metric, category, type, frequency, numericValue,
              periodDate.toISOString().split('T')[0],
              releaseDate.toISOString().split('T')[0],
              periodDate.toISOString().split('T')[0],
              releaseDate.toISOString().split('T')[0],
              unit
            ]);
            totalInserts++;
          }
        } catch (dateError) {
          console.log(`⚠️ Date parsing error for ${dateCol}:`, dateError);
          continue;
        }
      }
    }
    
    // Update is_latest flags
    console.log('🔄 Updating latest record flags...');
    await db.execute(`
      UPDATE economic_indicators_current SET is_latest = FALSE;
      
      UPDATE economic_indicators_current SET is_latest = TRUE
      WHERE (series_id, period_date) IN (
        SELECT series_id, MAX(period_date)
        FROM economic_indicators_current
        GROUP BY series_id
      );
    `);
    
    console.log('✅ CSV processing completed successfully!');
    console.log(`📈 Inserted: ${totalInserts} new records`);
    console.log(`🔄 Updated: ${totalUpdates} existing records`);
    console.log(`📊 Total processed: ${totalInserts + totalUpdates} records`);
    
    // Validation
    const stats = await db.execute(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT series_id) as unique_series,
        MIN(period_date) as earliest_date,
        MAX(period_date) as latest_date
      FROM economic_indicators_current
    `);
    
    if (stats.rows && stats.rows.length > 0) {
      const row = stats.rows[0] as any;
      console.log('📊 Database validation:');
      console.log(`   Total records: ${row.total_records}`);
      console.log(`   Unique series: ${row.unique_series}`);
      console.log(`   Date range: ${row.earliest_date} to ${row.latest_date}`);
    }
    
  } catch (error) {
    console.error('❌ CSV processing failed:', error);
    throw error;
  }
}

// Execute the processing
processCSVData().then(() => {
  console.log('🎯 Economic data CSV integration completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Processing failed:', error);
  process.exit(1);
});