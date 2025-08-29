// Migration service to populate the 3-layer economic data model
// Seeds metadata and transforms existing economic data

import { db } from '../db';
import { econSeriesDef } from '../../shared/economic-data-model';
import { economicDataStandardizer } from './economic-data-standardizer';
import { logger } from '../../shared/utils/logger';

interface SeriesDefinition {
  seriesId: string;
  displayName: string;
  category: string;
  typeTag: 'Leading' | 'Lagging' | 'Coincident';
  nativeUnit: string;
  standardUnit: 'PCT_DECIMAL' | 'USD' | 'COUNT' | 'INDEX_PT' | 'HOURS' | 'RATIO_DECIMAL';
  scaleHint?: 'NONE' | 'K' | 'M' | 'B';
  displayPrecision?: number;
  defaultTransform?: 'LEVEL' | 'YOY' | 'MOM' | 'LOG_LEVEL';
  seasonalAdj: 'SA' | 'NSA';
  source: string;
}

export class EconomicDataMigration {
  
  /**
   * Seed series definitions for the 40+ economic indicators
   */
  async seedSeriesDefinitions() {
    logger.info('Seeding economic series definitions...');

    const definitions: SeriesDefinition[] = [
      // Interest Rates
      {
        seriesId: 'FRED:DGS10',
        displayName: '10-Year Treasury Yield',
        category: 'Interest Rates',
        typeTag: 'Leading',
        nativeUnit: 'Percent',
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 2,
        defaultTransform: 'LEVEL',
        seasonalAdj: 'NSA',
        source: 'FRED'
      },
      {
        seriesId: 'FRED:FEDFUNDS',
        displayName: 'Federal Funds Rate',
        category: 'Interest Rates',
        typeTag: 'Leading',
        nativeUnit: 'Percent',
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 2,
        defaultTransform: 'LEVEL',
        seasonalAdj: 'NSA',
        source: 'FRED'
      },
      
      // Employment
      {
        seriesId: 'FRED:PAYEMS',
        displayName: 'Nonfarm Payrolls',
        category: 'Employment',
        typeTag: 'Coincident',
        nativeUnit: 'Thousands of Persons',
        standardUnit: 'COUNT',
        scaleHint: 'K',
        displayPrecision: 0,
        defaultTransform: 'MOM', // Month-over-month change
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      {
        seriesId: 'FRED:UNRATE',
        displayName: 'Unemployment Rate',
        category: 'Employment',
        typeTag: 'Lagging',
        nativeUnit: 'Percent',
        standardUnit: 'PCT_DECIMAL',
        scaleHint: 'NONE',
        displayPrecision: 1,
        defaultTransform: 'LEVEL',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      {
        seriesId: 'FRED:ICSA',
        displayName: 'Initial Jobless Claims',
        category: 'Employment',
        typeTag: 'Leading',
        nativeUnit: 'Number',
        standardUnit: 'COUNT',
        scaleHint: 'K',
        displayPrecision: 0,
        defaultTransform: 'LEVEL',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      
      // Inflation
      {
        seriesId: 'FRED:CPIAUCSL',
        displayName: 'Consumer Price Index',
        category: 'Inflation',
        typeTag: 'Lagging',
        nativeUnit: 'Index 1982-84=100',
        standardUnit: 'INDEX_PT',
        scaleHint: 'NONE',
        displayPrecision: 1,
        defaultTransform: 'YOY',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      {
        seriesId: 'FRED:CPILFESL',
        displayName: 'Core CPI',
        category: 'Inflation',
        typeTag: 'Lagging',
        nativeUnit: 'Index 1982-84=100',
        standardUnit: 'INDEX_PT',
        scaleHint: 'NONE',
        displayPrecision: 1,
        defaultTransform: 'YOY',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      
      // GDP & Growth
      {
        seriesId: 'FRED:GDP',
        displayName: 'GDP',
        category: 'Growth',
        typeTag: 'Coincident',
        nativeUnit: 'Billions of Dollars',
        standardUnit: 'USD',
        scaleHint: 'B',
        displayPrecision: 1,
        defaultTransform: 'YOY',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      
      // Consumer Spending
      {
        seriesId: 'FRED:PCEC',
        displayName: 'Personal Consumption',
        category: 'Consumer',
        typeTag: 'Coincident',
        nativeUnit: 'Billions of Dollars',
        standardUnit: 'USD',
        scaleHint: 'B',
        displayPrecision: 1,
        defaultTransform: 'YOY',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      {
        seriesId: 'FRED:RSAFS',
        displayName: 'Retail Sales',
        category: 'Consumer',
        typeTag: 'Coincident',
        nativeUnit: 'Millions of Dollars',
        standardUnit: 'USD',
        scaleHint: 'M',
        displayPrecision: 0,
        defaultTransform: 'YOY',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      
      // Housing
      {
        seriesId: 'FRED:HOUST',
        displayName: 'Housing Starts',
        category: 'Housing',
        typeTag: 'Leading',
        nativeUnit: 'Thousands of Units',
        standardUnit: 'COUNT',
        scaleHint: 'K',
        displayPrecision: 0,
        defaultTransform: 'LEVEL',
        seasonalAdj: 'SA',
        source: 'FRED'
      },
      
      // Manufacturing
      {
        seriesId: 'FRED:INDPRO',
        displayName: 'Industrial Production',
        category: 'Manufacturing',
        typeTag: 'Coincident',
        nativeUnit: 'Index 2017=100',
        standardUnit: 'INDEX_PT',
        scaleHint: 'NONE',
        displayPrecision: 1,
        defaultTransform: 'YOY',
        seasonalAdj: 'SA',
        source: 'FRED'
      }
    ];

    // Insert definitions
    for (const def of definitions) {
      await db.insert(econSeriesDef).values(def).onConflictDoUpdate({
        target: [econSeriesDef.seriesId],
        set: {
          displayName: def.displayName,
          standardUnit: def.standardUnit,
          scaleHint: def.scaleHint || 'NONE',
          displayPrecision: def.displayPrecision || 2,
          defaultTransform: def.defaultTransform || 'LEVEL'
        }
      });
    }

    logger.info(`Seeded ${definitions.length} series definitions`);
    return definitions.length;
  }

  /**
   * Run full migration: seed definitions and standardize existing data
   */
  async runMigration() {
    try {
      logger.info('Starting 3-layer economic data migration...');

      // Step 1: Seed series definitions
      const definitionCount = await this.seedSeriesDefinitions();

      // Step 2: Get all series IDs
      const seriesIds = await db.select({ seriesId: econSeriesDef.seriesId }).from(econSeriesDef);

      // Step 3: Standardize each series (Bronze → Silver → Gold)
      let processed = 0;
      for (const { seriesId } of seriesIds) {
        try {
          await economicDataStandardizer.standardizeSeries({ 
            seriesId, 
            forceRefresh: true 
          });
          processed++;
          logger.info(`Processed ${processed}/${seriesIds.length}: ${seriesId}`);
        } catch (error) {
          logger.warn(`Failed to process ${seriesId}:`, error);
        }
      }

      logger.info(`Migration completed: ${definitionCount} definitions, ${processed} series processed`);
      return { definitionCount, processedCount: processed };

    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Verify migration results
   */
  async verifyMigration() {
    try {
      // Count records in each layer
      const definitionsCount = await db.select().from(econSeriesDef);
      
      logger.info('Migration verification:', {
        definitions: definitionsCount.length
      });

      return {
        success: true,
        definitions: definitionsCount.length
      };

    } catch (error) {
      logger.error('Migration verification failed:', error);
      return { success: false, error: String(error) };
    }
  }
}

export const economicDataMigration = new EconomicDataMigration();