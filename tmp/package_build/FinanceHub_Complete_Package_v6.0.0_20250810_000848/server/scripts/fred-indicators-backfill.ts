#!/usr/bin/env tsx
/**
 * Comprehensive FRED Economic Indicators Backfill System
 * Populates economic_indicators_current table with essential FRED data
 */

import { logger } from '../utils/logger';
import { db } from '../db';
import { economicIndicatorsCurrent } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface FredIndicatorConfig {
  seriesId: string;
  metric: string;
  category: string;
  type: string;
  frequency: string;
  unit: string;
}

class FredIndicatorsBackfillService {
  private readonly FRED_API_KEY = process.env.FRED_API_KEY;
  private readonly FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
  
  // Core economic indicators we need for the dashboard
  private readonly CORE_INDICATORS: FredIndicatorConfig[] = [
    // Growth Indicators
    { seriesId: 'GDP', metric: 'GDP Growth Rate', category: 'Growth', type: 'Lagging', frequency: 'quarterly', unit: 'Percent' },
    { seriesId: 'PAYEMS', metric: 'Nonfarm Payrolls', category: 'Labor', type: 'Coincident', frequency: 'monthly', unit: 'Thousands of Persons' },
    { seriesId: 'HOUST', metric: 'Housing Starts', category: 'Growth', type: 'Leading', frequency: 'monthly', unit: 'Thousands of Units' },
    
    // Inflation Indicators
    { seriesId: 'CPIAUCSL', metric: 'CPI All Items', category: 'Inflation', type: 'Lagging', frequency: 'monthly', unit: 'Index' },
    { seriesId: 'CPILFESL', metric: 'Core CPI', category: 'Inflation', type: 'Lagging', frequency: 'monthly', unit: 'Index' },
    { seriesId: 'PCEPI', metric: 'PCE Price Index', category: 'Inflation', type: 'Lagging', frequency: 'monthly', unit: 'Index' },
    { seriesId: 'PCEPILFE', metric: 'Core PCE Price Index', category: 'Inflation', type: 'Lagging', frequency: 'monthly', unit: 'Index' },
    
    // Labor Market
    { seriesId: 'UNRATE', metric: 'Unemployment Rate', category: 'Labor', type: 'Lagging', frequency: 'monthly', unit: 'Percent' },
    { seriesId: 'AWHAETP', metric: 'Average Weekly Hours', category: 'Labor', type: 'Leading', frequency: 'monthly', unit: 'Hours' },
    { seriesId: 'AHETPI', metric: 'Average Hourly Earnings', category: 'Labor', type: 'Coincident', frequency: 'monthly', unit: 'Dollars' },
    
    // Financial Markets
    { seriesId: 'DGS10', metric: '10-Year Treasury Yield', category: 'Financial', type: 'Leading', frequency: 'daily', unit: 'Percent' },
    { seriesId: 'FEDFUNDS', metric: 'Federal Funds Rate', category: 'Monetary Policy', type: 'Leading', frequency: 'monthly', unit: 'Percent' },
    
    // Consumer Indicators
    { seriesId: 'RSXFS', metric: 'Retail Sales', category: 'Consumer', type: 'Coincident', frequency: 'monthly', unit: 'Millions of Dollars' },
    { seriesId: 'UMCSENT', metric: 'Consumer Sentiment', category: 'Consumer', type: 'Leading', frequency: 'monthly', unit: 'Index' }
  ];

  /**
   * Execute comprehensive FRED indicators backfill
   */
  async executeBackfill(): Promise<{
    success: boolean;
    processed: number;
    stored: number;
    errors: string[];
    summary: Record<string, any>;
  }> {
    if (!this.FRED_API_KEY) {
      throw new Error('FRED_API_KEY is required for backfill operation');
    }

    logger.info('🔄 Starting comprehensive FRED indicators backfill');
    
    let processed = 0;
    let stored = 0;
    const errors: string[] = [];
    const results: Record<string, any> = {};

    for (const indicator of this.CORE_INDICATORS) {
      try {
        logger.info(`📊 Processing ${indicator.metric} (${indicator.seriesId})`);
        
        const latestData = await this.fetchLatestFredData(indicator.seriesId);
        
        if (latestData && latestData.observations && latestData.observations.length > 0) {
          const observation = latestData.observations[latestData.observations.length - 1];
          
          if (observation.value && observation.value !== '.') {
            // Store in database
            await this.storeIndicatorData(indicator, observation);
            stored++;
            
            results[indicator.seriesId] = {
              metric: indicator.metric,
              value: parseFloat(observation.value),
              date: observation.date,
              status: 'stored'
            };
            
            logger.info(`✅ Stored ${indicator.metric}: ${observation.value} (${observation.date})`);
          } else {
            logger.warn(`⚠️ No valid data for ${indicator.metric}`);
            results[indicator.seriesId] = { metric: indicator.metric, status: 'no_data' };
          }
        } else {
          logger.warn(`⚠️ Failed to fetch ${indicator.metric}`);
          errors.push(`Failed to fetch ${indicator.metric}`);
          results[indicator.seriesId] = { metric: indicator.metric, status: 'fetch_failed' };
        }
        
        processed++;
        
        // Rate limiting - FRED allows 120 calls per minute
        await this.sleep(600); // 500ms between calls = 120/min max
        
      } catch (error) {
        logger.error(`❌ Error processing ${indicator.metric}:`, error);
        errors.push(`${indicator.metric}: ${(error as Error).message}`);
        results[indicator.seriesId] = { 
          metric: indicator.metric, 
          status: 'error', 
          error: (error as Error).message 
        };
      }
    }

    const summary = {
      totalIndicators: this.CORE_INDICATORS.length,
      processed,
      stored,
      errorCount: errors.length,
      successRate: Math.round((stored / processed) * 100),
      results
    };

    logger.info('🎯 FRED indicators backfill completed');
    logger.info(`📊 Success rate: ${summary.successRate}% (${stored}/${processed})`);

    return {
      success: stored > 0,
      processed,
      stored,
      errors,
      summary
    };
  }

  /**
   * Fetch latest data from FRED API
   */
  private async fetchLatestFredData(seriesId: string): Promise<any> {
    const url = `${this.FRED_BASE_URL}?series_id=${seriesId}&api_key=${this.FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Store indicator data in database
   */
  private async storeIndicatorData(config: FredIndicatorConfig, observation: any): Promise<void> {
    // Check if record already exists
    const existing = await db
      .select()
      .from(economicIndicatorsCurrent)
      .where(eq(economicIndicatorsCurrent.seriesId, config.seriesId))
      .limit(1);

    const indicatorData = {
      seriesId: config.seriesId,
      metric: config.metric,
      category: config.category,
      type: config.type,
      frequency: config.frequency,
      valueNumeric: parseFloat(observation.value).toString(),
      periodDateDesc: observation.date,
      releaseDateDesc: observation.date,
      periodDate: new Date(observation.date),
      releaseDate: new Date(observation.date),
      unit: config.unit,
      isLatest: true,
      updatedAt: new Date()
    };

    if (existing.length > 0) {
      // Update existing
      await db
        .update(economicIndicatorsCurrent)
        .set(indicatorData)
        .where(eq(economicIndicatorsCurrent.seriesId, config.seriesId));
    } else {
      // Insert new
      await db.insert(economicIndicatorsCurrent).values(indicatorData);
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current indicators status
   */
  async getIndicatorsStatus(): Promise<{
    totalIndicators: number;
    populatedIndicators: number;
    latestUpdate: Date | null;
    coverage: string;
  }> {
    const result = await db
      .select()
      .from(economicIndicatorsCurrent);

    const totalConfigured = this.CORE_INDICATORS.length;
    const totalPopulated = result.length;
    const latestUpdate = result.length > 0 ? result[0].updatedAt : null;
    
    return {
      totalIndicators: totalConfigured,
      populatedIndicators: totalPopulated,
      latestUpdate,
      coverage: `${Math.round((totalPopulated / totalConfigured) * 100)}%`
    };
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const backfillService = new FredIndicatorsBackfillService();
  
  backfillService.executeBackfill()
    .then(result => {
      console.log('\n🎯 FRED Indicators Backfill Results:');
      console.log('=====================================');
      console.log(`✅ Success: ${result.success}`);
      console.log(`📊 Processed: ${result.processed}`);
      console.log(`💾 Stored: ${result.stored}`);
      console.log(`❌ Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      console.log('\nResults by Indicator:');
      Object.entries(result.summary.results).forEach(([seriesId, data]: [string, any]) => {
        console.log(`  ${seriesId}: ${data.metric} - ${data.status}`);
        if (data.value !== undefined) {
          console.log(`    Value: ${data.value} (${data.date})`);
        }
      });
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('💥 FRED backfill failed:', error);
      process.exit(1);
    });
}

export { FredIndicatorsBackfillService };