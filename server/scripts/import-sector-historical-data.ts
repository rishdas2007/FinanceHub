import { db } from '../db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SectorETFRow {
  date: string;
  spy: number;
  xlk: number;
  xlv: number;
  xlf: number;
  xly: number;
  xli: number;
  xlc: number;
  xlp: number;
  xle: number;
  xlu: number;
  xlb: number;
  xlre: number;
}

async function importSectorHistoricalData() {
  console.log('🚀 Starting sector ETF historical data import...');
  
  try {
    // Read the CSV file
    const csvPath = path.join(__dirname, '../../attached_assets/SPDR_Sector_ETF_Historical_Data_3Years_1753146071323.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV lines
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    console.log(`📊 Found ${lines.length - 1} data rows with headers:`, headers);
    
    // Process each row and create records for each symbol
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      
      if (values.length < 12) {
        console.warn(`⚠️ Skipping incomplete row ${i}: ${values}`);
        skippedCount++;
        continue;
      }
      
      const date = values[0].trim();
      const symbols = ['SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'];
      
      // Insert a record for each symbol on this date
      for (let j = 0; j < symbols.length; j++) {
        const symbol = symbols[j];
        const price = parseFloat(values[j + 1]);
        
        if (isNaN(price)) {
          console.warn(`⚠️ Invalid price for ${symbol} on ${date}: ${values[j + 1]}`);
          continue;
        }
        
        try {
          await db.execute(`
            INSERT INTO historical_sector_etf_data (symbol, date, price)
            VALUES ($1, $2, $3)
            ON CONFLICT (symbol, date) DO UPDATE SET price = $3
          `, [symbol, date, price]);
          
          insertedCount++;
        } catch (error) {
          console.error(`❌ Error inserting ${symbol} data for ${date}:`, error.message);
          skippedCount++;
        }
      }
      
      if (i % 100 === 0) {
        console.log(`📈 Processed ${i} rows, inserted ${insertedCount} records`);
      }
    }
    
    console.log(`✅ Import completed: ${insertedCount} records inserted, ${skippedCount} skipped`);
    
    // Verify data
    const countResult = await db.execute('SELECT symbol, COUNT(*) as count FROM historical_sector_etf_data GROUP BY symbol ORDER BY symbol');
    console.log('📊 Records per symbol:', countResult.rows);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Run the import if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importSectorHistoricalData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

export { importSectorHistoricalData };