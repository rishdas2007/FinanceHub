/**
 * Load Economic Series Definitions for Historical Data
 * Maps all 34 economic series from the CSV to the econSeriesDef table
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
    seriesId: 'AWHMAN',
    displayName: 'Average Weekly Hours of Production and Nonsupervisory Employees',
    category: 'Labor',
    typeTag: 'Leading' as const,
    nativeUnit: 'Hours',
    standardUnit: 'HOURS' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/AWHMAN'
  },
  {
    seriesId: 'CCSA',
    displayName: 'Continued Claims (Insured Unemployment)',
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
    sourceUrl: 'https://fred.stlouisfed.org/series/CCSA'
  },
  {
    seriesId: 'CIVPART',
    displayName: 'Labor Force Participation Rate',
    category: 'Labor',
    typeTag: 'Coincident' as const,
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
    seriesId: 'CPIAUCSL',
    displayName: 'Consumer Price Index for All Urban Consumers: All Items',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 1982-84=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const, // Key for YoY calculations!
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
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPILFESL'
  },
  {
    seriesId: 'CSUSHPINSA',
    displayName: 'S&P/Case-Shiller U.S. National Home Price Index',
    category: 'Growth',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index Jan 2000=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/CSUSHPINSA'
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
    seriesId: 'DGORDER',
    displayName: 'Manufacturers New Orders: Durable Goods',
    category: 'Growth',
    typeTag: 'Leading' as const,
    nativeUnit: 'Millions of Dollars',
    standardUnit: 'USD' as const,
    scaleHint: 'M' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGORDER'
  },
  {
    seriesId: 'DGS10',
    displayName: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity',
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
    displayName: 'Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity',
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
    seriesId: 'EMRATIO',
    displayName: 'Employment-Population Ratio',
    category: 'Labor',
    typeTag: 'Coincident' as const,
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
    seriesId: 'HOUST',
    displayName: 'Housing Starts: Total: New Privately Owned Housing Units Started',
    category: 'Growth',
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
    seriesId: 'INDPRO',
    displayName: 'Industrial Production: Total Index',
    category: 'Growth',
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
    seriesId: 'JTSHIL',
    displayName: 'Job Openings and Labor Turnover Survey: Hires: Total Nonfarm',
    category: 'Labor',
    typeTag: 'Leading' as const,
    nativeUnit: 'Thousands',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/JTSHIL'
  },
  {
    seriesId: 'JTSJOL',
    displayName: 'Job Openings and Labor Turnover Survey: Job Openings: Total Nonfarm',
    category: 'Labor',
    typeTag: 'Leading' as const,
    nativeUnit: 'Thousands',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/JTSJOL'
  },
  {
    seriesId: 'JTUQUR',
    displayName: 'Job Openings and Labor Turnover Survey: Quits: Total Nonfarm',
    category: 'Labor',
    typeTag: 'Coincident' as const,
    nativeUnit: 'Thousands',
    standardUnit: 'COUNT' as const,
    scaleHint: 'K' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/JTUQUR'
  },
  {
    seriesId: 'MORTGAGE30US',
    displayName: '30-Year Fixed Rate Mortgage Average in the United States',
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
    sourceUrl: 'https://fred.stlouisfed.org/series/MORTGAGE30US'
  },
  {
    seriesId: 'NEWORDER',
    displayName: 'Manufacturers New Orders: Nondefense Capital Goods Excluding Aircraft',
    category: 'Growth',
    typeTag: 'Leading' as const,
    nativeUnit: 'Millions of Dollars',
    standardUnit: 'USD' as const,
    scaleHint: 'M' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/NEWORDER'
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
    displayName: 'Personal Consumption Expenditures Excluding Food and Energy (Core PCE)',
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
    seriesId: 'PPIFIS',
    displayName: 'Producer Price Index by Commodity: Final Demand: Finished Goods',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 1982=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/PPIFIS'
  },
  {
    seriesId: 'RSXFS',
    displayName: 'Advance Retail Sales: Retail and Food Services',
    category: 'Consumer',
    typeTag: 'Coincident' as const,
    nativeUnit: 'Millions of Dollars',
    standardUnit: 'USD' as const,
    scaleHint: 'M' as const,
    displayPrecision: 0,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'SA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/RSXFS'
  },
  {
    seriesId: 'T10Y2Y',
    displayName: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity',
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
    seriesId: 'T10YIE',
    displayName: '10-Year Breakeven Inflation Rate',
    category: 'Inflation',
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
    sourceUrl: 'https://fred.stlouisfed.org/series/T10YIE'
  },
  {
    seriesId: 'UMCSENT',
    displayName: 'University of Michigan: Consumer Sentiment',
    category: 'Sentiment',
    typeTag: 'Leading' as const,
    nativeUnit: '1966:Q1=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/UMCSENT'
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
    seriesId: 'USRECQ',
    displayName: 'NBER based Recession Indicators for the United States',
    category: 'Growth',
    typeTag: 'Coincident' as const,
    nativeUnit: '+1 or 0',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 0,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/USRECQ'
  },
  {
    seriesId: 'VIXCLS',
    displayName: 'CBOE Volatility Index: VIX',
    category: 'Financial',
    typeTag: 'Leading' as const,
    nativeUnit: 'Index',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'LEVEL' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS'
  },
  {
    seriesId: 'WPSFD49207',
    displayName: 'Producer Price Index by Commodity: Final Demand: Finished Consumer Foods',
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
    sourceUrl: 'https://fred.stlouisfed.org/series/WPSFD49207'
  },
  {
    seriesId: 'WPSFD49502',
    displayName: 'Producer Price Index by Commodity: Final Demand: Energy',
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
    sourceUrl: 'https://fred.stlouisfed.org/series/WPSFD49502'
  },
  {
    seriesId: 'WPUFD49104',
    displayName: 'Producer Price Index by Commodity: Final Demand: Final Demand Less Foods and Energy',
    category: 'Inflation',
    typeTag: 'Lagging' as const,
    nativeUnit: 'Index 1982=100',
    standardUnit: 'INDEX_PT' as const,
    scaleHint: 'NONE' as const,
    displayPrecision: 1,
    defaultTransform: 'YOY' as const,
    alignPolicy: 'last',
    preferredWindowMonths: 60,
    seasonalAdj: 'NSA' as const,
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/WPUFD49104'
  }
];

export async function loadSeriesDefinitions() {
  try {
    logger.info('Loading economic series definitions...');
    
    let loaded = 0;
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
              scaleHint: def.scaleHint,
              displayPrecision: def.displayPrecision
            }
          });
        
        // Check if it was an insert or update
        if (result.rowCount && result.rowCount > 0) {
          loaded++;
        } else {
          updated++;
        }
        
      } catch (defError) {
        logger.error(`Failed to load definition for ${def.seriesId}:`, defError);
        throw defError;
      }
    }
    
    logger.info(`Successfully processed ${ECONOMIC_SERIES_DEFINITIONS.length} series definitions: ${loaded} loaded, ${updated} updated`);
    return { loaded, updated, total: ECONOMIC_SERIES_DEFINITIONS.length };
    
  } catch (error) {
    logger.error('Failed to load series definitions:', error);
    throw error;
  }
}

// Allow direct script execution
if (require.main === module) {
  loadSeriesDefinitions()
    .then((result) => {
      console.log(`✅ Series definitions loaded: ${result.loaded} new, ${result.updated} updated`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to load series definitions:', error);
      process.exit(1);
    });
}