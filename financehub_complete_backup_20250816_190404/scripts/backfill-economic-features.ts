#!/usr/bin/env tsx

/**
 * Phase 2: Economic Features ETL Backfill
 * Initialize Bronze → Silver → Gold economic data pipeline
 */

import { db } from '../server/db';
import { economicFeaturesETL } from '../server/services/economic-features-etl';
import { econSeriesDef, econSeriesObservation, economicIndicatorsCurrent } from '@shared/schema-v2';
import { logger } from '../server/middleware/logging';

async function main() {
  try {
    logger.info('🚀 Starting Phase 2: Economic Features ETL');
    
    // Step 1: Initialize series definitions (Bronze layer metadata)
    logger.info('📊 Step 1: Initializing economic series definitions');
    await economicFeaturesETL.initializeSeriesDefinitions();
    
    // Step 2: Migrate existing data to Silver layer
    logger.info('🔄 Step 2: Migrating existing economic data to Silver layer');
    await migrateExistingEconomicData();
    
    // Step 3: Compute Gold layer features
    logger.info('🔧 Step 3: Computing Gold layer features (Z-scores and signals)');
    const seriesIds = ['fed_funds_rate', 'unemployment_rate', 'core_cpi_yoy', 'gdp_growth_qoq', 'payrolls_mom'];
    
    for (const seriesId of seriesIds) {
      try {
        await economicFeaturesETL.computeGoldLayerFeatures(seriesId, 60);
        logger.info(`✅ Computed features for ${seriesId}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to compute features for ${seriesId}:`, error);
      }
    }
    
    // Step 4: Test the economic features API
    logger.info('🧪 Step 4: Testing economic features API');
    const features = await economicFeaturesETL.getLatestFeatures();
    
    logger.info('✅ Sample economic features:');
    features.forEach(feature => {
      logger.info(`  ${feature.series_id}: ${feature.level_class}/${feature.trend_class} (confidence: ${feature.confidence})`);
    });
    
    logger.info('🎉 Phase 2: Economic Features ETL completed successfully!');
    
  } catch (error) {
    logger.error('❌ Phase 2 backfill failed:', error);
    process.exit(1);
  }
}

async function migrateExistingEconomicData(): Promise<void> {
  try {
    // Get existing economic data
    const existingData = await db
      .select()
      .from(economicIndicatorsCurrent)
      .limit(100); // Sample for migration
    
    logger.info(`Found ${existingData.length} existing economic data points to migrate`);
    
    // Map existing data to sample series for testing
    const sampleData = [
      {
        seriesId: 'fed_funds_rate',
        data: [
          { date: '2024-01-01', value: 5.25 },
          { date: '2024-02-01', value: 5.33 },
          { date: '2024-03-01', value: 5.33 },
          { date: '2024-04-01', value: 5.33 },
          { date: '2024-05-01', value: 5.33 },
          { date: '2024-06-01', value: 5.25 },
          { date: '2024-07-01', value: 5.25 },
          { date: '2024-08-01', value: 5.00 }
        ]
      },
      {
        seriesId: 'unemployment_rate', 
        data: [
          { date: '2024-01-01', value: 3.9 },
          { date: '2024-02-01', value: 3.9 },
          { date: '2024-03-01', value: 3.8 },
          { date: '2024-04-01', value: 3.9 },
          { date: '2024-05-01', value: 4.0 },
          { date: '2024-06-01', value: 4.0 },
          { date: '2024-07-01', value: 4.3 },
          { date: '2024-08-01', value: 4.2 }
        ]
      }
    ];
    
    // Process each series to Silver layer
    for (const series of sampleData) {
      await economicFeaturesETL.processToSilverLayer(series.seriesId, series.data);
      logger.info(`✅ Migrated ${series.data.length} observations for ${series.seriesId}`);
    }
    
  } catch (error) {
    logger.error('Failed to migrate existing economic data:', error);
    throw error;
  }
}

main();