/**
 * Comprehensive CSV Historical Data Processor
 * Processes the complete economic indicators dataset to provide statistical depth
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Enhanced series mapping for all economic indicators
const SERIES_MAPPING: Record<string, { id: string, category: string, type: string }> = {
  "Manufacturers' New Orders": { id: "NEWORDER_HIST", category: "Growth", type: "Leading" },
  "Building Permits": { id: "PERMIT_HIST", category: "Growth", type: "Leading" },
  "Purchasing Managers Index (PMI)": { id: "NAPM_HIST", category: "Growth", type: "Leading" },
  "Stock Market Index (S&P 500)": { id: "SP500_HIST", category: "Growth", type: "Leading" },
  "Interest Rate Spread (10yr-2yr)": { id: "T10Y2Y_HIST", category: "Financial", type: "Leading" },
  "Industrial Production": { id: "INDPRO_HIST", category: "Growth", type: "Coincident" },
  "Personal Income (less transfer payments)": { id: "PINCOME_HIST", category: "Growth", type: "Coincident" }, 
  "Retail Sales": { id: "RSALES_HIST", category: "Consumer", type: "Coincident" },
  "Housing Starts": { id: "HOUST_HIST", category: "Growth", type: "Leading" },
  "Average Weekly Hours Worked in Manufacturing": { id: "AWHMAN_HIST", category: "Labor", type: "Leading" },
  "Average Initial Jobless Claims": { id: "ICSA_AVG_HIST", category: "Labor", type: "Leading" },
  "Personal Consumption Expenditures (PCE) Year-over-Year": { id: "PCEPI_HIST", category: "Inflation", type: "Lagging" },
  "Consumer Price Index (CPI) Year-over-Year": { id: "CPIAUCSL_HIST", category: "Inflation", type: "Lagging" },
  "Producer Price Index (PPI)": { id: "PPIFIS_HIST", category: "Inflation", type: "Lagging" },
  "Initial Jobless Claims": { id: "ICSA_HIST", category: "Labor", type: "Leading" },
  "Job Openings and Labor Turnover Survey (JOLTS)": { id: "JTSJOL_HIST", category: "Labor", type: "Leading" },
  "Payroll Employment": { id: "PAYEMS_HIST", category: "Labor", type: "Coincident" },
  "Manufacturing Employment": { id: "MANEMP_HIST", category: "Labor", type: "Coincident" },
  "Unemployment Rate": { id: "UNRATE_HIST", category: "Labor", type: "Lagging" },
  "Unemployment Duration (U-6 Unemployment Rate)": { id: "U6RATE_HIST", category: "Labor", type: "Lagging" },
  "Interest Rate Spread": { id: "T10Y2Y_SPREAD_HIST", category: "Financial", type: "Leading" },
  "Money Supply (M2)": { id: "M2SL_HIST", category: "Monetary Policy", type: "Leading" },
  "Federal Funds Rate": { id: "FEDFUNDS_HIST", category: "Monetary Policy", type: "Leading" },
  "Interest Rates (Short-Term)": { id: "TB3MS_HIST", category: "Financial", type: "Leading" }
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

function processComprehensiveCSV() {
  console.log('🔍 Processing comprehensive economic indicators CSV...');
  
  try {
    // Read and parse CSV
    const csvPath = '../attached_assets/economic_indicators_populated_with_real_data_1754761527436.csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true 
    });
    
    console.log(`📊 Found ${records.length} economic indicators`);
    
    const sqlStatements: string[] = [];
    let totalDataPoints = 0;
    let processedIndicators = 0;
    
    // Process each economic indicator
    for (const record of records) {
      const metric = record.Metric?.trim();
      if (!metric || metric === 'Metric') continue;
      
      const mapping = SERIES_MAPPING[metric];
      if (!mapping) {
        console.log(`⚠️ No mapping found for: ${metric}`);
        continue;
      }
      
      const category = record.Category?.trim() || mapping.category;
      const type = record.Type?.trim() || mapping.type;
      const frequency = record.Frequency?.trim() || 'Monthly';
      const unit = record.Unit?.trim() || 'Index';
      
      // Process all date columns (excluding metadata)
      const dateColumns = Object.keys(record).filter(key => 
        key.includes('/') && !['Metric', 'Category', 'Type', 'Frequency', 'Unit'].includes(key)
      );
      
      let indicatorDataPoints = 0;
      
      for (const dateCol of dateColumns) {
        const value = record[dateCol]?.toString().trim();
        if (!value || value === '' || value === 'N/A' || value === 'null') continue;
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) continue;
        
        const periodDate = parseCSVDate(dateCol);
        if (!periodDate) continue;
        
        // Create INSERT statement with UPSERT
        sqlStatements.push(`
INSERT INTO economic_indicators_current 
(series_id, metric, category, type, frequency, value_numeric, period_date, release_date, period_date_desc, release_date_desc, unit, is_latest) 
VALUES (
  '${mapping.id}',
  '${metric.replace(/'/g, "''")}',
  '${category}',
  '${type}',
  '${frequency}',
  ${numValue},
  '${periodDate}',
  '${periodDate}',
  '${periodDate}',
  '${periodDate}',
  '${unit.replace(/'/g, "''")}',
  FALSE
)
ON CONFLICT (series_id, period_date) DO UPDATE SET
  value_numeric = EXCLUDED.value_numeric,
  updated_at = NOW();`);
        
        indicatorDataPoints++;
        totalDataPoints++;
      }
      
      if (indicatorDataPoints > 0) {
        processedIndicators++;
        console.log(`✅ ${metric}: ${indicatorDataPoints} data points`);
      }
    }
    
    console.log(`\n📈 Processing Summary:`);
    console.log(`   • Processed Indicators: ${processedIndicators}`);
    console.log(`   • Total Data Points: ${totalDataPoints}`);
    console.log(`   • SQL Statements: ${sqlStatements.length}`);
    
    // Write comprehensive SQL file
    const sqlContent = `-- Comprehensive Economic Indicators Historical Data
-- Generated: ${new Date().toISOString()}
-- Total Data Points: ${totalDataPoints}
-- Processed Indicators: ${processedIndicators}

${sqlStatements.join('\n\n')}`;
    
    writeFileSync('../tmp/comprehensive_economic_data.sql', sqlContent);
    
    // Create processing summary
    const summary = `
Comprehensive Economic Data Processing Summary
=============================================
Date: ${new Date().toISOString()}
Total Indicators Processed: ${processedIndicators}
Total Historical Data Points: ${totalDataPoints}
Date Coverage: 2017-2025
SQL File: comprehensive_economic_data.sql

Series Processed:
${Object.entries(SERIES_MAPPING).map(([metric, mapping]) => 
  `${metric} -> ${mapping.id} (${mapping.category}/${mapping.type})`
).join('\n')}
`;
    
    writeFileSync('../tmp/comprehensive_processing_summary.txt', summary);
    
    return {
      processedIndicators,
      totalDataPoints,
      sqlStatements: sqlStatements.length,
      filePath: '../tmp/comprehensive_economic_data.sql'
    };
    
  } catch (error) {
    console.error('❌ Error processing comprehensive CSV:', error);
    throw error;
  }
}

// Execute comprehensive processing
processComprehensiveCSV()
  .then(result => {
    console.log('\n🎉 Comprehensive CSV Processing Complete!');
    console.log(`📊 Indicators: ${result.processedIndicators}`);
    console.log(`📈 Data Points: ${result.totalDataPoints}`);
    console.log(`💾 SQL File: ${result.filePath}`);
    console.log('\n🚀 Ready for database import!');
  })
  .catch(error => {
    console.error('💥 Processing failed:', error);
    process.exit(1);
  });