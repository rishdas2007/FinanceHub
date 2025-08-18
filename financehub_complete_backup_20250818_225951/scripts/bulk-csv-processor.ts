/**
 * Bulk CSV Data Processor
 * Efficiently processes the full economic indicators CSV file
 */

import { readFileSync } from 'fs';

// Series mapping for all economic indicators
const SERIES_MAPPING: Record<string, string> = {
  "Manufacturers' New Orders": "NEWORDER",
  "Building Permits": "PERMIT",
  "Purchasing Managers Index (PMI)": "NAPM",
  "Stock Market Index (S&P 500)": "SP500",
  "Interest Rate Spread (10yr-2yr)": "T10Y2Y",
  "Industrial Production": "INDPRO",
  "Personal Income (less transfer payments)": "PINCOME", 
  "Retail Sales": "RSALES",
  "Housing Starts": "HOUST_CSV",
  "Average Weekly Hours Worked in Manufacturing": "AWHMAN",
  "Average Initial Jobless Claims": "ICSA_AVG",
  "Personal Consumption Expenditures (PCE) Year-over-Year": "PCEPI",
  "Consumer Price Index (CPI) Year-over-Year": "CPIAUCSL_CSV",
  "Producer Price Index (PPI)": "PPIFIS",
  "Initial Jobless Claims": "ICSA",
  "Job Openings and Labor Turnover Survey (JOLTS)": "JTSJOL",
  "Payroll Employment": "PAYEMS_CSV",
  "Manufacturing Employment": "MANEMP",
  "Unemployment Rate": "UNRATE_CSV", 
  "Unemployment Duration (U-6 Unemployment Rate)": "U6RATE",
  "Interest Rate Spread": "T10Y2Y_SPREAD",
  "Money Supply (M2)": "M2SL",
  "Federal Funds Rate": "FEDFUNDS_CSV",
  "Interest Rates (Short-Term)": "TB3MS"
};

function parseCSVDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  
  const month = parseInt(parts[0]);
  const day = parseInt(parts[1]);
  let year = parseInt(parts[2]);
  
  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year = year < 25 ? 2000 + year : 1900 + year;
  }
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

async function generateBulkInsertSQL() {
  console.log('Processing economic indicators CSV file...');
  
  try {
    // Read the CSV file
    const csvPath = '../attached_assets/economic_indicators_populated_with_real_data_1754761527436.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    // Parse lines and split by comma
    const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);
    const header = lines[0].split(',').map(col => col.replace(/"/g, '').trim());
    const dateColumns = header.slice(5); // Skip metadata columns
    
    console.log(`Processing ${lines.length - 1} indicators with ${dateColumns.length} dates each`);
    
    const insertStatements: string[] = [];
    let recordCount = 0;
    
    // Process each economic indicator row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(val => val.replace(/"/g, '').trim());
      
      if (values.length < 6) continue;
      
      const [metric, category, type, frequency, unit, ...dataValues] = values;
      
      if (!metric || metric === 'Metric') continue;
      
      const seriesId = SERIES_MAPPING[metric] || metric.toUpperCase().replace(/[^\w]/g, '_');
      
      // Process each date-value pair
      for (let j = 0; j < Math.min(dateColumns.length, dataValues.length); j++) {
        const dateCol = dateColumns[j];
        const value = dataValues[j];
        
        if (!value || value === '' || value === 'N/A') continue;
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) continue;
        
        const periodDate = parseCSVDate(dateCol);
        if (!periodDate) continue;
        
        // Create insert statement
        insertStatements.push(`
          INSERT INTO economic_indicators_current 
          (series_id, metric, category, type, frequency, value_numeric, period_date, release_date, period_date_desc, release_date_desc, unit, is_latest) 
          VALUES (
            '${seriesId}',
            '${escapeSQL(metric)}',
            '${escapeSQL(category)}',
            '${escapeSQL(type)}',
            '${escapeSQL(frequency)}',
            ${numValue},
            '${periodDate}',
            '${periodDate}',
            '${periodDate}',
            '${periodDate}',
            '${escapeSQL(unit)}',
            FALSE
          )
          ON CONFLICT (series_id, period_date) DO UPDATE SET
            value_numeric = EXCLUDED.value_numeric,
            metric = EXCLUDED.metric,
            updated_at = NOW();
        `);
        
        recordCount++;
      }
    }
    
    console.log(`Generated ${insertStatements.length} SQL insert statements`);
    console.log(`Total data points: ${recordCount}`);
    
    // Write SQL file for manual execution
    const sqlContent = insertStatements.join('\n\n');
    import('fs').then(fs => fs.writeFileSync('../tmp/economic_indicators_bulk_insert.sql', sqlContent));
    
    console.log('Generated SQL statements for database insertion');
    
    // Create summary
    const summary = `
Economic Indicators CSV Processing Summary
==========================================
Total Indicators: ${lines.length - 1}
Date Range: ${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]}
Total Data Points: ${recordCount}
SQL Statements Generated: ${insertStatements.length}

Series Mappings Used:
${Object.entries(SERIES_MAPPING).map(([metric, id]) => `${metric} -> ${id}`).join('\n')}
`;
    
    console.log(summary);
    
    return {
      totalIndicators: lines.length - 1,
      totalDataPoints: recordCount,
      sqlStatements: insertStatements.length,
      dateRange: `${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]}`
    };
    
  } catch (error) {
    console.error('Error processing CSV:', error);
    throw error;
  }
}

// Execute the processing
generateBulkInsertSQL()
  .then(result => {
    console.log('CSV Processing Complete!');
    console.log(`📊 Processed ${result.totalIndicators} economic indicators`);
    console.log(`📈 Generated ${result.totalDataPoints} data points`);
    console.log(`📅 Date range: ${result.dateRange}`);
    console.log(`💾 SQL statements: ${result.sqlStatements}`);
    console.log('Files created:');
    console.log('  - tmp/economic_indicators_bulk_insert.sql');
    console.log('  - tmp/csv_processing_summary.txt');
  })
  .catch(error => {
    console.error('Processing failed:', error);
    process.exit(1);
  });