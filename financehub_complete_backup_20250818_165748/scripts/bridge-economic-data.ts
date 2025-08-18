#!/usr/bin/env tsx
// Bridge script to populate old economic tables with new comprehensive FRED data
// This ensures the economic health calculator can access the rich historical dataset

import { db } from '../server/db';
import { econSeriesObservation, econSeriesDef } from '../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

async function bridgeEconomicData() {
  console.log('🌉 Starting economic data bridge...');
  
  try {
    // Clear existing data to avoid conflicts
    console.log('🧹 Clearing old economic indicators...');
    await db.execute(sql`DELETE FROM economic_indicators_current WHERE series_id IN (
      SELECT DISTINCT series_id FROM econ_series_observation
    )`);
    
    // Map FRED series to dashboard metrics
    const metricMapping = {
      'UNRATE': 'Unemployment Rate',
      'PAYEMS': 'Nonfarm Payrolls', 
      'CPIAUCSL': 'Consumer Price Index',
      'CPILFESL': 'Core CPI',
      'PCEPI': 'PCE Price Index',
      'PCEPILFE': 'Core PCE Price Index',
      'DFF': 'Federal Funds Rate',
      'DGS10': '10-Year Treasury Yield',
      'DGS2': '2-Year Treasury Yield',
      'T10Y2Y': '10Y-2Y Treasury Spread',
      'T10Y3M': '10Y-3M Treasury Spread',
      'EMRATIO': 'Employment Population Ratio',
      'CIVPART': 'Labor Force Participation Rate',
      'ICSA': 'Initial Claims',
      'HOUST': 'Housing Starts',
      'PERMIT': 'Building Permits',
      'INDPRO': 'Industrial Production',
      'RSAFS': 'Retail Sales',
      'UMCSENT': 'Consumer Sentiment',
      'PPIACO': 'Producer Price Index'
    };

    console.log('📊 Processing economic indicators...');
    
    let processed = 0;
    for (const [seriesId, metric] of Object.entries(metricMapping)) {
      // Get the latest observation for this series
      const latestObs = await db
        .select({
          value: econSeriesObservation.valueStd,
          periodEnd: econSeriesObservation.periodEnd,
          seriesId: econSeriesObservation.seriesId
        })
        .from(econSeriesObservation)
        .where(eq(econSeriesObservation.seriesId, seriesId))
        .orderBy(desc(econSeriesObservation.periodEnd))
        .limit(1);
        
      if (latestObs.length > 0) {
        const obs = latestObs[0];
        
        // Get series metadata
        const seriesInfo = await db
          .select()
          .from(econSeriesDef)
          .where(eq(econSeriesDef.seriesId, seriesId))
          .limit(1);
          
        const category = seriesId.includes('DGS') || seriesId.includes('DFF') || seriesId.includes('T10Y') ? 'Monetary Policy' :
                        seriesId.includes('UNRATE') || seriesId.includes('PAYEMS') || seriesId.includes('EMRATIO') || seriesId.includes('CIVPART') || seriesId.includes('ICSA') ? 'Labor' :
                        seriesId.includes('CPI') || seriesId.includes('PCE') || seriesId.includes('PPI') ? 'Inflation' :
                        seriesId.includes('HOUST') || seriesId.includes('PERMIT') || seriesId.includes('INDPRO') || seriesId.includes('RSAFS') ? 'Growth' :
                        'Economic';
                        
        const type = seriesId.includes('ICSA') || seriesId.includes('PERMIT') || seriesId.includes('DFF') ? 'Leading' :
                    seriesId.includes('PAYEMS') || seriesId.includes('INDPRO') ? 'Coincident' : 
                    'Lagging';
                    
        const frequency = seriesId.includes('DGS') || seriesId.includes('DFF') || seriesId.includes('T10Y') ? 'daily' :
                         seriesId.includes('ICSA') ? 'weekly' : 'monthly';
                         
        const unit = seriesId.includes('PAYEMS') ? 'Thousands of Persons' :
                    seriesId.includes('UNRATE') || seriesId.includes('DGS') || seriesId.includes('DFF') || seriesId.includes('CPI') || seriesId.includes('PCE') || seriesId.includes('PPI') ? 'Percent' :
                    seriesId.includes('HOUST') || seriesId.includes('PERMIT') ? 'Thousands of Units' :
                    seriesId.includes('ICSA') ? 'Thousands' :
                    seriesId.includes('INDPRO') || seriesId.includes('EMRATIO') || seriesId.includes('CIVPART') ? 'Index' :
                    seriesId.includes('RSAFS') ? 'Millions of Dollars' :
                    seriesId.includes('UMCSENT') ? 'Index' : 'Value';

        // Insert into economic_indicators_current
        await db.execute(sql`
          INSERT INTO economic_indicators_current (
            series_id, metric, category, type, frequency, 
            value_numeric, period_date, release_date, 
            period_date_desc, release_date_desc, unit, is_latest, updated_at
          ) VALUES (
            ${seriesId}, ${metric}, ${category}, ${type}, ${frequency},
            ${obs.value}, ${obs.periodEnd}, ${obs.periodEnd},
            ${obs.periodEnd}, ${obs.periodEnd}, ${unit}, true, NOW()
          )
        `);
        
        processed++;
        console.log(`✅ ${metric} (${seriesId}): ${obs.value} as of ${obs.periodEnd}`);
      }
    }
    
    // Also populate historical_economic_data for trend analysis
    console.log('📈 Populating historical economic data...');
    
    await db.execute(sql`DELETE FROM historical_economic_data`);
    
    // Insert last 24 months of data for key indicators (using correct schema)
    await db.execute(sql`
      INSERT INTO historical_economic_data (
        series_id, indicator, value, category, frequency, 
        release_date, period_date, unit, created_at
      )
      SELECT 
        obs.series_id,
        CASE 
          WHEN obs.series_id = 'UNRATE' THEN 'Unemployment Rate'
          WHEN obs.series_id = 'CPIAUCSL' THEN 'Consumer Price Index'
          WHEN obs.series_id = 'DFF' THEN 'Federal Funds Rate'
          WHEN obs.series_id = 'PAYEMS' THEN 'Nonfarm Payrolls'
          WHEN obs.series_id = 'DGS10' THEN '10-Year Treasury Yield'
          WHEN obs.series_id = 'CPILFESL' THEN 'Core CPI'
          WHEN obs.series_id = 'EMRATIO' THEN 'Employment Population Ratio'
          ELSE obs.series_id
        END as indicator,
        obs.value_std,
        CASE 
          WHEN obs.series_id IN ('DGS10', 'DGS2', 'DFF') THEN 'Monetary Policy'
          WHEN obs.series_id IN ('UNRATE', 'PAYEMS', 'EMRATIO') THEN 'Labor'
          WHEN obs.series_id IN ('CPIAUCSL', 'CPILFESL') THEN 'Inflation'
          ELSE 'Economic'
        END as category,
        CASE 
          WHEN obs.series_id IN ('DGS10', 'DGS2', 'DFF') THEN 'daily'
          ELSE 'monthly'
        END as frequency,
        obs.period_end,
        obs.period_end,
        'Percent',
        NOW()
      FROM econ_series_observation obs
      WHERE obs.series_id IN ('UNRATE', 'CPIAUCSL', 'DFF', 'PAYEMS', 'DGS10', 'CPILFESL', 'EMRATIO')
        AND obs.period_end >= CURRENT_DATE - INTERVAL '24 months'
      ORDER BY obs.series_id, obs.period_end DESC
    `);
    
    // Verify the bridge worked
    const currentCount = await db.execute(sql`SELECT COUNT(*) as count FROM economic_indicators_current`);
    const historicalCount = await db.execute(sql`SELECT COUNT(*) as count FROM historical_economic_data`);
    
    console.log(`\n🎉 Economic data bridge completed successfully!`);
    console.log(`📊 Current indicators: ${(currentCount.rows[0] as any).count}`);
    console.log(`📈 Historical records: ${(historicalCount.rows[0] as any).count}`);
    console.log(`✅ Processed ${processed} economic indicators`);
    
    console.log('\n🔍 Sample bridged data:');
    const sample = await db.execute(sql`
      SELECT metric, value_numeric, period_date 
      FROM economic_indicators_current 
      WHERE series_id IN ('UNRATE', 'DFF', 'CPIAUCSL')
      ORDER BY metric
    `);
    
    sample.rows.forEach((row: any) => {
      console.log(`  • ${row.metric}: ${row.value_numeric} (${row.period_date})`);
    });
    
  } catch (error) {
    console.error('❌ Economic data bridge failed:', error);
    process.exit(1);
  }
}

bridgeEconomicData();