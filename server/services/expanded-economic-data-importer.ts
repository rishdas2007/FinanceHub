import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import fs from 'fs';
import path from 'path';

// Mapping CSV metric names to FRED series IDs and proper labels
const CSV_TO_FRED_MAPPING: Record<string, { series_id: string; label: string; category: string; type: string; display_unit: string }> = {
  // Consumer Spending / Growth
  'Consumer Durable Goods New Orders': { 
    series_id: 'NEWORDER', 
    label: 'Consumer Durable Goods New Orders', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'millions_dollars'
  },
  'E-commerce Retail Sales': { 
    series_id: 'ECRST', 
    label: 'E-commerce Retail Sales', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'millions_dollars'
  },
  'Personal Saving Rate': { 
    series_id: 'PSAVERT', 
    label: 'Personal Savings Rate', 
    category: 'Sentiment', 
    type: 'Lagging',
    display_unit: 'percent'
  },
  'Real Disposable Personal Income': { 
    series_id: 'DSPIC96', 
    label: 'Real Disposable Personal Income', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'chained_dollars'
  },
  'Retail Sales Ex Auto': { 
    series_id: 'MRTSSM44W72USN', 
    label: 'Retail Sales Ex-Auto', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'millions_dollars'
  },
  'Retail Sales: Food Services': { 
    series_id: 'RSFOODSERV', 
    label: 'Retail Sales: Food Services', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'millions_dollars'
  },

  // Employment / Labor
  'Average Hourly Earnings': { 
    series_id: 'CES0500000003', 
    label: 'Average Hourly Earnings', 
    category: 'Labor', 
    type: 'Lagging',
    display_unit: 'dollars_per_hour'
  },
  'Average Weekly Hours Manufacturing': { 
    series_id: 'AWHAETP', 
    label: 'Average Weekly Hours', 
    category: 'Labor', 
    type: 'Coincident',
    display_unit: 'hours'
  },
  'Continuing Claims': { 
    series_id: 'CCSA', 
    label: 'Continuing Jobless Claims', 
    category: 'Labor', 
    type: 'Lagging',
    display_unit: 'thousands'
  },
  'Employment Population Ratio': { 
    series_id: 'EMRATIO', 
    label: 'Employment Population Ratio', 
    category: 'Labor', 
    type: 'Coincident',
    display_unit: 'percent'
  },
  'Initial Jobless Claims': { 
    series_id: 'ICSA', 
    label: 'Initial Jobless Claims', 
    category: 'Labor', 
    type: 'Leading',
    display_unit: 'thousands'
  },
  'JOLTS Hires Rate': { 
    series_id: 'JTSHIR', 
    label: 'JOLTS Hires', 
    category: 'Labor', 
    type: 'Coincident',
    display_unit: 'thousands'
  },
  'Job Openings': { 
    series_id: 'JTSJOL', 
    label: 'JOLTS Job Openings', 
    category: 'Labor', 
    type: 'Leading',
    display_unit: 'thousands'
  },
  'JOLTS Quit Rate': { 
    series_id: 'JTSQUR', 
    label: 'JOLTS Quit Rate', 
    category: 'Labor', 
    type: 'Lagging',
    display_unit: 'percent'
  },
  'Labor Force Participation Rate': { 
    series_id: 'CIVPART', 
    label: 'Labor Force Participation Rate', 
    category: 'Labor', 
    type: 'Lagging',
    display_unit: 'percent'
  },
  'Nonfarm Payrolls': { 
    series_id: 'PAYEMS', 
    label: 'Nonfarm Payrolls', 
    category: 'Labor', 
    type: 'Coincident',
    display_unit: 'thousands'
  },
  'U-6 Unemployment Rate': { 
    series_id: 'U6RATE', 
    label: 'U-6 Unemployment Rate', 
    category: 'Labor', 
    type: 'Lagging',
    display_unit: 'percent'
  },
  'Unemployment Rate': { 
    series_id: 'UNRATE', 
    label: 'Unemployment Rate', 
    category: 'Labor', 
    type: 'Lagging',
    display_unit: 'percent'
  },

  // Housing / Growth
  '30-Year Fixed Mortgage Rate': { 
    series_id: 'MORTGAGE30US', 
    label: '30-Year Fixed Mortgage Rate', 
    category: 'Monetary Policy', 
    type: 'Leading',
    display_unit: 'percent'
  },
  'Building Permits': { 
    series_id: 'PERMIT', 
    label: 'Building Permits', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'thousands'
  },
  'Case-Shiller Home Price Index': { 
    series_id: 'CSUSHPINSA', 
    label: 'Case-Shiller Home Price Index', 
    category: 'Growth', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'Existing Home Sales': { 
    series_id: 'EXHOSLUSM495S', 
    label: 'Existing Home Sales', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'thousands'
  },
  'Housing Starts': { 
    series_id: 'HOUST', 
    label: 'Housing Starts', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'thousands'
  },
  'Months Supply of Houses': { 
    series_id: 'MSACSR', 
    label: 'Months Supply of Homes', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'months_supply'
  },
  'New Home Sales': { 
    series_id: 'HSN1F', 
    label: 'New Home Sales', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'thousands'
  },
  'Total Construction Spending': { 
    series_id: 'TTLCON', 
    label: 'Total Construction Spending', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'millions_dollars'
  },

  // Manufacturing / Growth
  'Capacity Utilization': { 
    series_id: 'CAPUTLG2211S', 
    label: 'Capacity Utilization (Mfg)', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'percent'
  },
  'Commercial and Industrial Loans': { 
    series_id: 'BUSLOANS', 
    label: 'Commercial & Industrial Loans', 
    category: 'Monetary Policy', 
    type: 'Coincident',
    display_unit: 'billions_dollars'
  },
  'Durable Goods Orders': { 
    series_id: 'DGORDER', 
    label: 'Durable Goods Orders', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'millions_dollars'
  },
  'Industrial Production': { 
    series_id: 'INDPRO', 
    label: 'Industrial Production', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'index'
  },
  'ISM Manufacturing PMI': { 
    series_id: 'NAPMIMFG', 
    label: 'ISM Manufacturing PMI', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'index'
  },
  'S&P Global Manufacturing PMI': { 
    series_id: 'PMICM', 
    label: 'S&P Global Mfg PMI', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'index'
  },

  // Inflation
  'Core CPI': { 
    series_id: 'CPILFESL', 
    label: 'Core CPI', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'Core PCE Price Index': { 
    series_id: 'PCEPILFE', 
    label: 'Core PCE Price Index', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'Core PPI': { 
    series_id: 'WPUSOP3000', 
    label: 'Core PPI', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'CPI All Items': { 
    series_id: 'CPIAUCSL', 
    label: 'CPI All Items', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'CPI Energy': { 
    series_id: 'CPIENGSL', 
    label: 'CPI Energy', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'PCE Price Index': { 
    series_id: 'PCEPI', 
    label: 'PCE Price Index', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'PPI All Commodities': { 
    series_id: 'PPIACO', 
    label: 'PPI All Commodities', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'index'
  },
  'US Regular Gasoline Price': { 
    series_id: 'GASREGCOVA', 
    label: 'US Regular Gasoline Price', 
    category: 'Inflation', 
    type: 'Lagging',
    display_unit: 'dollars_per_gallon'
  },

  // Other Growth Indicators
  'GDP Growth Rate': { 
    series_id: 'A191RL1Q225SBEA', 
    label: 'GDP Growth Rate (Annualized)', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'percent'
  },
  'Leading Economic Index': { 
    series_id: 'USSLIND', 
    label: 'US Leading Economic Index', 
    category: 'Growth', 
    type: 'Leading',
    display_unit: 'index'
  },
  'Retail Sales': { 
    series_id: 'RSAFS', 
    label: 'Retail Sales', 
    category: 'Growth', 
    type: 'Coincident',
    display_unit: 'millions_dollars'
  },

  // Monetary Policy
  'Federal Funds Rate': { 
    series_id: 'FEDFUNDS', 
    label: 'Federal Funds Rate', 
    category: 'Monetary Policy', 
    type: 'Coincident',
    display_unit: 'percent'
  },
  '10-Year Treasury': { 
    series_id: 'DGS10', 
    label: '10-Year Treasury Yield', 
    category: 'Monetary Policy', 
    type: 'Leading',
    display_unit: 'percent'
  },
  'Yield Curve': { 
    series_id: 'T10Y2Y', 
    label: 'Yield Curve (10yr-2yr)', 
    category: 'Monetary Policy', 
    type: 'Leading',
    display_unit: 'basis_points'
  },

  // Sentiment
  'Michigan Consumer Sentiment': { 
    series_id: 'UMCSENT', 
    label: 'Michigan Consumer Sentiment', 
    category: 'Sentiment', 
    type: 'Leading',
    display_unit: 'index'
  },
  'Consumer Confidence Index': { 
    series_id: 'CSCICP03USM665S', 
    label: 'Consumer Confidence Index', 
    category: 'Sentiment', 
    type: 'Leading',
    display_unit: 'index'
  }
};

interface CSVRow {
  metric: string;
  category: string;
  type: string;
  sort_text: string;
  frequency: string;
  value_numeric: number;
  period_date_desc: string;
  release_date_desc: string;
}

export class ExpandedEconomicDataImporter {
  
  async importCSVData(csvFilePath: string): Promise<void> {
    try {
      logger.info('📊 Starting import of expanded economic indicators data...');
      
      // Read CSV file
      const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      
      logger.info(`📊 Found ${lines.length - 1} data rows to process`);
      
      let processedRows = 0;
      let insertedRows = 0;
      
      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = this.parseCSVLine(line);
        if (values.length !== headers.length) continue;
        
        const row: CSVRow = {
          metric: values[0],
          category: values[1],
          type: values[2],
          sort_text: values[3],
          frequency: values[4],
          value_numeric: parseFloat(values[5]),
          period_date_desc: values[6],
          release_date_desc: values[7]
        };
        
        processedRows++;
        
        // Map to FRED series
        const mapping = CSV_TO_FRED_MAPPING[row.metric];
        if (!mapping) {
          logger.warn(`❌ No FRED mapping found for metric: ${row.metric}`);
          continue;
        }
        
        // Convert dates
        const periodDate = new Date(row.period_date_desc);
        const releaseDate = new Date(row.release_date_desc);
        
        if (isNaN(periodDate.getTime()) || isNaN(releaseDate.getTime())) {
          logger.warn(`❌ Invalid dates for ${row.metric}: ${row.period_date_desc} / ${row.release_date_desc}`);
          continue;
        }
        
        try {
          // Insert into database using sql method with placeholder syntax
          await db.execute(sql`
            INSERT INTO economic_indicators_history 
            (metric_name, series_id, type, category, unit, frequency, value, period_date, release_date, created_at, updated_at)
            VALUES (${mapping.label}, ${mapping.series_id}, ${mapping.type}, ${mapping.category}, ${mapping.display_unit}, ${row.frequency}, ${row.value_numeric}, ${periodDate.toISOString().split('T')[0]}, ${releaseDate.toISOString().split('T')[0]}, NOW(), NOW())
            ON CONFLICT (series_id, period_date) DO NOTHING
          `);
          
          insertedRows++;
          
          if (insertedRows % 50 === 0) {
            logger.info(`📊 Processed ${insertedRows} records...`);
          }
          
        } catch (insertError) {
          logger.warn(`❌ Failed to insert ${mapping.series_id} for ${row.period_date_desc}: ${insertError}`);
        }
      }
      
      logger.info(`✅ Import complete! Processed ${processedRows} rows, inserted ${insertedRows} records`);
      
      // Summary by category
      const summary = await this.getImportSummary();
      logger.info('📊 Import Summary by Category:');
      summary.forEach((cat: any) => {
        logger.info(`   ${cat.category}: ${cat.count} records`);
      });
      
    } catch (error) {
      logger.error('❌ Failed to import CSV data:', error);
      throw error;
    }
  }
  
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
  
  private async getImportSummary() {
    try {
      const result = await db.execute(`
        SELECT category, COUNT(*) as count 
        FROM economic_indicators_history 
        GROUP BY category 
        ORDER BY count DESC
      `);
      
      return result.rows.map((row: any) => ({
        category: row.category as string,
        count: parseInt(row.count as string)
      }));
    } catch (error) {
      logger.warn('Failed to get import summary:', error);
      return [];
    }
  }
}

export const expandedEconomicDataImporter = new ExpandedEconomicDataImporter();