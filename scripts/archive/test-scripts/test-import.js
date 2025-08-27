// Test script to run the expanded economic data import
const { expandedEconomicDataImporter } = require('./server/services/expanded-economic-data-importer.ts');
const path = require('path');

async function runImport() {
  try {
    console.log('🚀 Starting expanded economic data import test...');
    
    const csvFilePath = path.join(process.cwd(), 'attached_assets', 'economic_indicators_data_jan2024_jun2025_1753652769450.csv');
    console.log('📂 CSV file path:', csvFilePath);
    
    await expandedEconomicDataImporter.importCSVData(csvFilePath);
    
    console.log('✅ Import completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

runImport();