/**
 * CSV Economic Data Transformer
 * Converts wide-format CSV to normalized database format
 */

import { readFileSync } from 'fs';
import { db } from '../server/db';

interface CSVRow {
  Metric: string;
  Category: string;
  Type: string;
  frequency: string;
  units: string;
  [key: string]: string; // Date columns
}

interface NormalizedData {
  series_id: string;
  metric: string;
  category: string;
  type: string;
  frequency: string;
  value_numeric: number;
  period_date: Date;
  release_date: Date;
  period_date_desc: string;
  release_date_desc: string;
  unit: string;
  is_latest: boolean;
}

// FRED Series ID mapping based on existing database patterns
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

export class CSVDataTransformer {
  
  /**
   * Parse date from MM/DD/YY format to Date object
   */
  private parseDate(dateStr: string): Date {
    // Handle formats like "1/31/17", "12/31/17", etc.
    const parts = dateStr.split('/');
    let month = parseInt(parts[0]);
    let day = parseInt(parts[1]);
    let year = parseInt(parts[2]);
    
    // Convert 2-digit year to 4-digit (assuming 2000s)
    if (year < 100) {
      year = year < 25 ? 2000 + year : 1900 + year;
    }
    
    return new Date(year, month - 1, day);
  }

  /**
   * Transform CSV data to normalized format
   */
  async transformCSVData(csvPath: string): Promise<NormalizedData[]> {
    console.log('📊 Starting CSV data transformation...');
    
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records: CSVRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    const normalizedData: NormalizedData[] = [];
    
    for (const row of records) {
      const metric = row.Metric;
      const seriesId = FRED_SERIES_MAPPING[metric] || metric.toUpperCase().replace(/\s+/g, '_');
      
      console.log(`🔄 Processing ${metric} (${seriesId})...`);
      
      // Process each date column
      const dateColumns = Object.keys(row).filter(key => 
        key !== 'Metric' && key !== 'Category' && key !== 'Type' && 
        key !== 'frequency' && key !== 'units'
      );
      
      for (const dateCol of dateColumns) {
        const valueStr = row[dateCol];
        
        // Skip empty or invalid values
        if (!valueStr || valueStr.trim() === '' || valueStr === 'N/A') continue;
        
        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;
        
        const periodDate = this.parseDate(dateCol);
        const releaseDate = new Date(periodDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Assume 1 week delay
        
        normalizedData.push({
          series_id: seriesId,
          metric: metric,
          category: row.Category,
          type: row.Type,
          frequency: row.frequency,
          value_numeric: value,
          period_date: periodDate,
          release_date: releaseDate,
          period_date_desc: periodDate.toISOString().split('T')[0],
          release_date_desc: releaseDate.toISOString().split('T')[0],
          unit: row.units,
          is_latest: false // Will be updated later
        });
      }
    }
    
    console.log(`✅ Transformation complete: ${normalizedData.length} records processed`);
    return normalizedData;
  }

  /**
   * Upload data to database with UPSERT logic
   */
  async uploadToDatabase(data: NormalizedData[]): Promise<void> {
    console.log('💾 Starting database upload...');
    
    try {
      // Create backup of existing data
      console.log('📋 Creating backup of existing economic indicators...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS economic_indicators_current_backup AS 
        SELECT * FROM economic_indicators_current;
      `);
      
      let insertedCount = 0;
      let updatedCount = 0;
      
      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            // Check if record already exists
            const existing = await db.execute(`
              SELECT id FROM economic_indicators_current 
              WHERE series_id = ? AND period_date = ?
            `, [record.series_id, record.period_date.toISOString()]);
            
            if (existing.rows && existing.rows.length > 0) {
              // Update existing record
              await db.execute(`
                UPDATE economic_indicators_current SET
                  metric = ?, category = ?, type = ?, frequency = ?,
                  value_numeric = ?, unit = ?, updated_at = NOW()
                WHERE series_id = ? AND period_date = ?
              `, [
                record.metric, record.category, record.type, record.frequency,
                record.value_numeric, record.unit, record.series_id, 
                record.period_date.toISOString()
              ]);
              updatedCount++;
            } else {
              // Insert new record
              await db.execute(`
                INSERT INTO economic_indicators_current 
                (series_id, metric, category, type, frequency, value_numeric, 
                 period_date, release_date, period_date_desc, release_date_desc, 
                 unit, is_latest, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
              `, [
                record.series_id, record.metric, record.category, record.type,
                record.frequency, record.value_numeric, record.period_date.toISOString(),
                record.release_date.toISOString(), record.period_date_desc,
                record.release_date_desc, record.unit, record.is_latest
              ]);
              insertedCount++;
            }
          } catch (error) {
            console.error(`❌ Error processing record for ${record.series_id}:`, error);
          }
        }
        
        console.log(`📊 Processed batch ${Math.ceil((i + batchSize) / batchSize)} of ${Math.ceil(data.length / batchSize)}`);
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
      
      console.log(`✅ Database upload complete:`);
      console.log(`   📈 Inserted: ${insertedCount} new records`);
      console.log(`   🔄 Updated: ${updatedCount} existing records`);
      console.log(`   📊 Total processed: ${insertedCount + updatedCount} records`);
      
    } catch (error) {
      console.error('❌ Database upload failed:', error);
      // Restore backup if needed
      console.log('🔄 Attempting to restore backup...');
      await db.execute(`
        DROP TABLE IF EXISTS economic_indicators_current;
        ALTER TABLE economic_indicators_current_backup RENAME TO economic_indicators_current;
      `);
      throw error;
    }
  }

  /**
   * Validate uploaded data
   */
  async validateUpload(): Promise<void> {
    console.log('✅ Validating uploaded data...');
    
    const stats = await db.execute(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT series_id) as unique_series,
        MIN(period_date) as earliest_date,
        MAX(period_date) as latest_date,
        COUNT(CASE WHEN is_latest = TRUE THEN 1 END) as latest_records
      FROM economic_indicators_current
    `);
    
    console.log('📊 Upload validation results:');
    if (stats.rows && stats.rows.length > 0) {
      const row = stats.rows[0] as any;
      console.log(`   Total records: ${row.total_records}`);
      console.log(`   Unique series: ${row.unique_series}`);
      console.log(`   Date range: ${row.earliest_date} to ${row.latest_date}`);
      console.log(`   Latest records: ${row.latest_records}`);
    }
  }
}

// Main execution function
export async function processCSVUpload(csvPath: string): Promise<void> {
  const transformer = new CSVDataTransformer();
  
  try {
    // Transform CSV data
    const normalizedData = await transformer.transformCSVData(csvPath);
    
    // Upload to database
    await transformer.uploadToDatabase(normalizedData);
    
    // Validate results
    await transformer.validateUpload();
    
    console.log('🎯 CSV data integration completed successfully!');
    
  } catch (error) {
    console.error('❌ CSV processing failed:', error);
    throw error;
  }
}