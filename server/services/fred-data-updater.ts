import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { parse } from 'csv-parse/sync';

interface FREDIndicatorData {
  metric: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: string;
  frequency: string;
  dateOfRelease: string;
  current: number;
  forecast: number | null;
  vsForecast: number | null;
  prior: number;
  vsPrior: number;
  zScore: number;
  yoyChange: number;
  unit: string;
  nextRelease: string;
}

export class FREDDataUpdaterService {
  private readonly PYTHON_SCRIPT_PATH = './server/scripts/fred_data_script.py';
  private readonly DATA_PATH = './server/data/macroeconomic_indicators_dataset.csv';
  private readonly BACKUP_PATH = 'attached_assets/macroeconomic_indicators_dataset.csv';
  
  async updateFREDData(): Promise<{ success: boolean; message: string; indicatorsCount?: number }> {
    try {
      logger.info('🚀 Starting FRED data update...');
      
      // Execute the Python script
      const result = await this.executePythonScript();
      
      if (!result.success) {
        return { success: false, message: result.error || 'Python script execution failed' };
      }
      
      // Verify the CSV file was created/updated
      const csvExists = await this.verifyCsvFile();
      if (!csvExists) {
        return { success: false, message: 'CSV file was not created after script execution' };
      }
      
      // Parse and validate the CSV data
      const indicators = await this.parseCsvData();
      if (!indicators || indicators.length === 0) {
        return { success: false, message: 'No valid indicators found in generated CSV' };
      }
      
      logger.info(`✅ FRED data update completed: ${indicators.length} indicators processed`);
      
      return {
        success: true,
        message: `Successfully updated ${indicators.length} economic indicators from FRED API`,
        indicatorsCount: indicators.length
      };
      
    } catch (error) {
      logger.error('❌ FRED data update failed:', error);
      return {
        success: false,
        message: `FRED data update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private async executePythonScript(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const python = spawn('python3', [this.PYTHON_SCRIPT_PATH], {
        env: {
          ...process.env,
          FRED_API_KEY: process.env.FRED_API_KEY || '47754b00af9343542dd99533202f983a'
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code === 0) {
          logger.info('📊 Python script completed successfully');
          console.log('Python output:', stdout);
          resolve({ success: true });
        } else {
          logger.error(`❌ Python script failed with code ${code}`);
          console.error('Python stderr:', stderr);
          resolve({ success: false, error: `Process exited with code ${code}: ${stderr}` });
        }
      });
      
      python.on('error', (error) => {
        logger.error('❌ Failed to spawn Python process:', error);
        resolve({ success: false, error: `Failed to execute script: ${error.message}` });
      });
    });
  }
  
  private async verifyCsvFile(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.DATA_PATH);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      
      // File should be updated within the last 5 minutes
      return fileAge < 5 * 60 * 1000;
    } catch (error) {
      logger.warn(`⚠️ Could not verify CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  private async parseCsvData(): Promise<FREDIndicatorData[] | null> {
    try {
      const csvContent = await fs.readFile(this.DATA_PATH, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
        cast_date: false
      });
      
      const indicators: FREDIndicatorData[] = records.map((record: any) => ({
        metric: record['Metric'] || record.metric,
        type: record['Type'] || record.type,
        category: record['Category'] || record.category,
        frequency: record['Frequency'] || record.frequency,
        dateOfRelease: record['Date of Release'] || record.dateOfRelease,
        current: parseFloat(record['Current Reading'] || record.current) || 0,
        forecast: record['Forecast'] ? parseFloat(record['Forecast']) : null,
        vsForecast: record['Variance vs Forecast'] ? parseFloat(record['Variance vs Forecast']) : null,
        prior: parseFloat(record['Prior Reading'] || record.prior) || 0,
        vsPrior: parseFloat(record['Variance vs Prior'] || record.vsPrior) || 0,
        zScore: parseFloat(record['Z-Score (12M)'] || record.zScore) || 0,
        yoyChange: parseFloat(record['12-Month YoY Change'] || record.yoyChange) || 0,
        unit: record['Unit'] || record.unit || '',
        nextRelease: record['Next Release'] || record.nextRelease || 'TBD'
      }));
      
      logger.info(`📊 Parsed ${indicators.length} indicators from CSV`);
      return indicators;
      
    } catch (error) {
      logger.error('❌ Failed to parse CSV data:', error);
      return null;
    }
  }
  
  async getLatestFREDData(): Promise<FREDIndicatorData[] | null> {
    try {
      // Check if we have a recent CSV file
      const csvExists = await fs.access(this.DATA_PATH).then(() => true).catch(() => false);
      
      if (!csvExists) {
        logger.info('📊 No CSV file found, triggering FRED update...');
        const updateResult = await this.updateFREDData();
        if (!updateResult.success) {
          logger.error('❌ Failed to update FRED data:', updateResult.message);
          return null;
        }
      }
      
      return await this.parseCsvData();
    } catch (error) {
      logger.error('❌ Failed to get latest FRED data:', error);
      return null;
    }
  }
  
  async schedulePeriodicUpdates(): Promise<void> {
    // Update every 4 hours as specified
    const UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    
    logger.info('📅 Scheduling FRED data updates every 4 hours');
    
    // Initial update
    await this.updateFREDData();
    
    // Schedule recurring updates
    setInterval(async () => {
      logger.info('🕐 Scheduled FRED data update starting...');
      await this.updateFREDData();
    }, UPDATE_INTERVAL);
  }
}

export const fredDataUpdaterService = new FREDDataUpdaterService();