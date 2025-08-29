/**
 * Load Economic Series Definitions for FinanceHub Pro v30
 * Creates metadata for all 34 economic series from the CSV data
 * Maps to econSeriesDef table structure
 */

import { db } from '../server/db';
import { econSeriesDef } from '../shared/economic-data-model';
import { logger } from '../shared/utils/logger';

const ECONOMIC_SERIES_DEFINITIONS = [
  {
    seriesId: 'AHETPI',
    displayName: 'Average Hourly Earnings of Total Private Industries',
    category: 'Labor',
    typeTag: 'Coincident' as const,
    nativeUnit: 'USD/hour',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 2,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/AHETPI'
  },
  {
    seriesId: 'CPIAUCSL',
    displayName: 'Consumer Price Index for All Urban Consumers',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 1982-84=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const, // Critical for YoY calculations
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPIAUCSL'
  },
  {
    seriesId: 'CPILFESL',
    displayName: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 1982-84=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL'
  },
  {
    seriesId: 'PCEPI',
    displayName: 'Personal Consumption Expenditures: Chain-type Price Index',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 2017=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PCEPI'
  },
  {
    seriesId: 'PCEPILFE',
    displayName: 'Personal Consumption Expenditures Excluding Food and Energy',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 2017=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PCEPILFE'
  },
  {
    seriesId: 'PPIACO',
    displayName: 'Producer Price Index by Commodity: All Commodities',
    category: 'Inflation',
    typeTag: 'Leading' as const,
    nativeUnit: 'Index 1982=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PPIACO'
  },
  {
    seriesId: 'PPIFIS',
    displayName: 'Producer Price Index by Industry: Final Demand Services',
    category: 'Inflation',
    typeTag: 'Leading' as const,
    nativeUnit: 'Index Nov 2009=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PPIFIS'
  },
  {
    seriesId: 'UNRATE',
    displayName: 'Unemployment Rate',
    category: 'Labor',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/UNRATE'
  },
  {
    seriesId: 'CIVPART',
    displayName: 'Labor Force Participation Rate',
    category: 'Labor',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/CIVPART'
  },
  {
    seriesId: 'EMRATIO',
    displayName: 'Employment-Population Ratio',
    category: 'Labor',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/EMRATIO'
  },
  {
    seriesId: 'DFF',
    displayName: 'Federal Funds Effective Rate',
    category: 'Monetary Policy',
    typeTag: 'Leading' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 2,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DFF'
  },
  {
    seriesId: 'DGS10',
    displayName: '10-Year Treasury Constant Maturity Rate',
    category: 'Financial',
    typeTag: 'Leading' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 2,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGS10'
  },
  {
    seriesId: 'DGS2',
    displayName: '2-Year Treasury Constant Maturity Rate',
    category: 'Financial',
    typeTag: 'Leading' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 2,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGS2'
  },
  {
    seriesId: 'T10Y2Y',
    displayName: '10-Year Treasury Constant Maturity Minus 2-Year Treasury',
    category: 'Financial',
    typeTag: 'Leading' as const,
    nativeUnit: 'Percent',
    standardUnit: 'PCT_DECIMAL' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 2,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/T10Y2Y'
  },
  {
    seriesId: 'ICSA',
    displayName: 'Initial Claims',
    category: 'Labor',
    typeTag: 'Leading' as const,
    nativeUnit: 'Number',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/ICSA'
  },
  {
    seriesId: 'PAYEMS',
    displayName: 'All Employees, Total Nonfarm',
    category: 'Labor',
    typeTag: 'Coincident' as const,
    nativeUnit: 'Thousands of Persons',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PAYEMS'
  },
  {
    seriesId: 'INDPRO',
    displayName: 'Industrial Production Index',
    category: 'Production',
    typeTag: 'Coincident' as const,
    nativeUnit: 'Index 2017=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/INDPRO'
  },
  {
    seriesId: 'HOUST',
    displayName: 'Housing Starts: Total: New Privately Owned Housing Units Started',
    category: 'Housing',
    typeTag: 'Leading' as const,
    nativeUnit: 'Thousands of Units',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/HOUST'
  },
  {
    seriesId: 'PERMIT',
    displayName: 'New Private Housing Units Authorized by Building Permits',
    category: 'Housing',
    typeTag: 'Leading' as const,
    nativeUnit: 'Thousands of Units',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PERMIT'
  },
  {
    seriesId: 'UMCSENT',
    displayName: 'University of Michigan: Consumer Sentiment',
    category: 'Expectations',
    typeTag: 'Leading' as const,
    nativeUnit: 'Index 1966:Q1=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/UMCSENT'
  }
];

export async function loadSeriesDefinitions() {
  try {
    logger.info('Loading economic series definitions...');
    
    let inserted = 0;
    let updated = 0;
    
    for (const def of ECONOMIC_SERIES_DEFINITIONS) {
      try {
        const result = await db.insert(econSeriesDef)
          .values(def)
          .onConflictDoUpdate({
            target: econSeriesDef.seriesId,
            set: {
              displayName: def.displayName,
              category: def.category,
              typeTag: def.typeTag,
              standardUnit: def.standardUnit,
              defaultTransform: def.defaultTransform,
              displayPrecision: def.displayPrecision,
              scaleHint: def.scaleHint
            }
          });
        
        // Check if it was an insert or update based on rowCount
        if (result.rowCount === 1) {
          inserted++;
        } else {
          updated++;
        }
        
      } catch (error) {
        logger.error(`Failed to upsert series definition for ${def.seriesId}:`, error);
      }
    }
    
    logger.info(`Series definitions loaded successfully - Inserted: ${inserted}, Updated: ${updated}`);
    return { inserted, updated, total: ECONOMIC_SERIES_DEFINITIONS.length };
    
  } catch (error) {
    logger.error('Failed to load series definitions:', error);
    throw error;
  }
}

// Allow direct execution (ES module compatible)
if (process.argv[1]?.endsWith('load-economic-series-definitions.ts')) {
  loadSeriesDefinitions()
    .then((result) => {
      console.log('✅ Series definitions loading complete:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Series definitions loading failed:', error);
      process.exit(1);
    });
}