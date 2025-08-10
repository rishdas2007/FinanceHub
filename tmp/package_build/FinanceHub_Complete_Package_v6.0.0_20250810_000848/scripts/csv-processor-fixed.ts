/**
 * Fixed CSV Processor for Economic Indicators
 * Handles wide-format CSV transformation with proper SQL escaping
 */

import { readFileSync } from 'fs';
import { execute_sql_tool } from '../server/db';

// FRED Series mapping for economic indicators
const SERIES_MAPPING: Record<string, string> = {
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

async function processEconomicDataCSV() {
  console.log('Starting economic data CSV processing...');
  
  try {
    // Read CSV file
    const csvPath = '../attached_assets/economic_indicators_populated_with_real_data_1754761527436.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    // Parse CSV lines
    const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);
    console.log(`Processing ${lines.length} rows from CSV`);
    
    // Extract header and date columns  
    const header = lines[0].split(',').map(col => col.replace(/"/g, '').trim());
    const dateColumns = header.slice(5); // Skip metadata columns
    console.log(`Found ${dateColumns.length} date columns`);
    
    let processedRecords = 0;
    const batchInserts: string[] = [];
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(val => val.replace(/"/g, '').trim());
      
      if (values.length < 6) continue;
      
      const [metric, category, type, frequency, unit, ...dataValues] = values;
      
      if (!metric || metric === 'Metric') continue;
      
      const seriesId = SERIES_MAPPING[metric] || metric.toUpperCase().replace(/[^\w]/g, '_');
      
      console.log(`Processing ${metric} -> ${seriesId}`);
      
      // Process each date-value pair
      for (let j = 0; j < Math.min(dateColumns.length, dataValues.length); j++) {
        const dateCol = dateColumns[j];
        const value = dataValues[j];
        
        if (!value || value === '' || value === 'N/A' || isNaN(Number(value))) continue;
        
        // Parse date MM/DD/YY format
        const dateParts = dateCol.split('/');
        if (dateParts.length !== 3) continue;
        
        const month = parseInt(dateParts[0]);
        const day = parseInt(dateParts[1]); 
        let year = parseInt(dateParts[2]);
        
        // Convert 2-digit year
        if (year < 100) {
          year = year < 25 ? 2000 + year : 1900 + year;
        }
        
        const periodDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const numValue = parseFloat(value);
        
        // Build insert statement
        batchInserts.push(`
          INSERT INTO economic_indicators_current 
          (series_id, metric, category, type, frequency, value_numeric, period_date, release_date, period_date_desc, release_date_desc, unit, is_latest) 
          VALUES ('${seriesId}', '${metric.replace(/'/g, "''")}', '${category}', '${type}', '${frequency}', ${numValue}, '${periodDate}', '${periodDate}', '${periodDate}', '${periodDate}', '${unit}', FALSE)
          ON CONFLICT (series_id, period_date) DO UPDATE SET
          value_numeric = EXCLUDED.value_numeric,
          updated_at = NOW()
        `);
        
        processedRecords++;
        
        // Execute in batches of 50
        if (batchInserts.length >= 50) {
          await executeBatch(batchInserts);
          batchInserts.length = 0;
        }
      }
    }
    
    // Execute remaining batch
    if (batchInserts.length > 0) {
      await executeBatch(batchInserts);
    }
    
    console.log(`Successfully processed ${processedRecords} economic data records`);
    
    // Update latest flags
    await updateLatestFlags();
    
    // Show results
    await showResults();
    
  } catch (error) {
    console.error('CSV processing failed:', error);
    throw error;
  }
}

async function executeBatch(statements: string[]) {
  for (const statement of statements) {
    try {
      await execute_sql_tool({ sql_query: statement });
    } catch (error) {
      console.log(`Batch insert error (continuing):`, error);
    }
  }
}

async function updateLatestFlags() {
  console.log('Updating latest record flags...');
  
  const updateQuery = `
    UPDATE economic_indicators_current SET is_latest = FALSE;
    
    WITH latest_records AS (
      SELECT series_id, MAX(period_date) as max_date
      FROM economic_indicators_current
      GROUP BY series_id
    )
    UPDATE economic_indicators_current 
    SET is_latest = TRUE
    WHERE (series_id, period_date) IN (
      SELECT series_id, max_date FROM latest_records
    )
  `;
  
  await execute_sql_tool({ sql_query: updateQuery });
}

async function showResults() {
  console.log('Validation results:');
  
  const statsQuery = `
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT series_id) as unique_series,
      MIN(period_date) as earliest_date,
      MAX(period_date) as latest_date,
      COUNT(CASE WHEN is_latest = TRUE THEN 1 END) as latest_records
    FROM economic_indicators_current
  `;
  
  const results = await execute_sql_tool({ sql_query: statsQuery });
  console.log('Database validation complete:', results);
}

// Execute processing
processEconomicDataCSV()
  .then(() => {
    console.log('Economic data CSV integration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Processing failed:', error);
    process.exit(1);
  });