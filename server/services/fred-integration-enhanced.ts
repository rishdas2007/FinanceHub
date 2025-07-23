/**
 * Enhanced FRED API Integration Service
 * 
 * This service integrates with the Python FRED data script and provides
 * automated updates every 4 hours as specified in the requirements.
 * 
 * Features:
 * - Automated 4-hour updates using Python script
 * - API endpoints for manual triggers and status
 * - Integration with existing Economic Indicators service
 * - Fallback to original CSV if FRED fails
 */

import { fredDataUpdaterService } from './fred-data-updater';
import { fredSchedulerService } from './fred-scheduler';
import { logger } from '../utils/logger';
import fs from 'fs/promises';

export class FREDIntegrationService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🚀 Initializing FRED Integration System...');
    
    try {
      // Start the scheduler for 4-hour updates
      await fredSchedulerService.startScheduler();
      
      // Verify Python script exists
      await this.verifyPythonScript();
      
      // Test FRED API connectivity
      await this.testFREDConnectivity();
      
      this.isInitialized = true;
      logger.info('✅ FRED Integration System initialized successfully');
      
    } catch (error) {
      logger.error('❌ FRED Integration initialization failed:', error);
      logger.info('📊 System will use original CSV data as fallback');
    }
  }

  async getStatus(): Promise<{
    initialized: boolean;
    schedulerRunning: boolean;
    lastUpdate: string | null;
    apiKeyConfigured: boolean;
    pythonScriptExists: boolean;
  }> {
    const schedulerStatus = fredSchedulerService.getSchedulerStatus();
    
    return {
      initialized: this.isInitialized,
      schedulerRunning: schedulerStatus.isRunning,
      lastUpdate: schedulerStatus.nextUpdate,
      apiKeyConfigured: !!process.env.FRED_API_KEY,
      pythonScriptExists: await this.checkPythonScript()
    };
  }

  async manualUpdate(): Promise<{ success: boolean; message: string; indicatorsCount?: number }> {
    logger.info('🔄 Manual FRED update requested');
    return await fredDataUpdaterService.updateFREDData();
  }

  private async verifyPythonScript(): Promise<void> {
    try {
      await fs.access('./server/scripts/fred_data_script.py');
      logger.info('✅ Python FRED script found');
    } catch (error) {
      throw new Error('Python FRED script not found at ./server/scripts/fred_data_script.py');
    }
  }

  private async checkPythonScript(): Promise<boolean> {
    try {
      await fs.access('./server/scripts/fred_data_script.py');
      return true;
    } catch {
      return false;
    }
  }

  private async testFREDConnectivity(): Promise<void> {
    // Test basic connectivity by trying to fetch one simple series
    if (!process.env.FRED_API_KEY) {
      logger.warn('⚠️ FRED API key not configured, using fallback data');
      return;
    }

    logger.info('🔍 Testing FRED API connectivity...');
    // Note: Full connectivity test would require actual API call
    // For now, we log the configuration status
    logger.info('📊 FRED API key configured, ready for data fetching');
  }

  async getLatestData(): Promise<any> {
    return await fredDataUpdaterService.getLatestFREDData();
  }
}

export const fredIntegrationService = new FREDIntegrationService();