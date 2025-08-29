// Economic Data Backfill Service
// Processes CSV files for Bronze → Silver → Gold data model

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from '../db';
import { 
  econSeriesDef, 
  econSeriesObservation,
  type InsertEconSeriesDef,
  type EconSeriesObservation 
} from '@shared/economic-data-model';
import { eq, and } from 'drizzle-orm';

interface SeriesDefRow {
  series_id: string;
  display_name: string;
  category: string;
  type_tag: string;
  native_unit: string;
  standard_unit: string;
  scale_hint: string;
  display_precision: string;
  default_transform: string;
  align_policy: string;
  preferred_window_months: string;
  seasonal_adj: string;
  source: string;
  source_url: string;
}

interface ObservationRow {
  series_id: string;
  period_start: string;
  period_end: string;
  freq: string;
  value_std: string;
  standard_unit: string;
  agg_method: string;
  scale_hint: string;
  display_precision: string;
  transform_code: string;
  source: string;
}

export class EconomicDataBackfillService {
  
  async processCsvFiles(definitionsPath: string, observationsPath: string) {
    console.log('🔄 Starting economic data backfill process...');
    
    try {
      // Step 1: Load and process series definitions
      console.log('📋 Loading series definitions...');
      const defResults = await this.loadSeriesDefinitions(definitionsPath);
      
      // Step 2: Load and process observations
      console.log('📊 Loading observations...');
      const obsResults = await this.loadObservations(observationsPath);
      
      return {
        success: true,
        definitionsLoaded: defResults.loaded,
        definitionsSkipped: defResults.skipped,
        observationsLoaded: obsResults.loaded,
        observationsSkipped: obsResults.skipped,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Backfill process failed:', error);
      throw error;
    }
  }
  
  private async loadSeriesDefinitions(filePath: string) {
    const csvContent = readFileSync(filePath, 'utf-8');
    const rows: SeriesDefRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`📋 Processing ${rows.length} series definitions...`);
    
    let loaded = 0;
    let skipped = 0;
    
    for (const row of rows) {
      try {
        // Check if series already exists
        const existing = await db
          .select()
          .from(econSeriesDef)
          .where(eq(econSeriesDef.seriesId, row.series_id))
          .limit(1);
          
        if (existing.length > 0) {
          console.log(`⏭️ Series ${row.series_id} already exists, skipping`);
          skipped++;
          continue;
        }
        
        // Transform and insert
        const seriesDef: InsertEconSeriesDef = {
          seriesId: row.series_id,
          displayName: row.display_name || row.series_id,
          category: row.category || 'Economic',
          typeTag: (row.type_tag as any) || 'Leading',
          nativeUnit: row.native_unit || 'INDEX_PT',
          standardUnit: (row.standard_unit as any) || 'INDEX_PT',
          scaleHint: (row.scale_hint as any) || 'NONE',
          displayPrecision: parseInt(row.display_precision) || 1,
          defaultTransform: (row.default_transform as any) || 'LEVEL',
          alignPolicy: row.align_policy || 'last',
          preferredWindowMonths: parseInt(row.preferred_window_months) || 60,
          seasonalAdj: (row.seasonal_adj as any) || 'SA',
          source: row.source || 'FRED',
          sourceUrl: row.source_url || null
        };
        
        await db.insert(econSeriesDef).values(seriesDef);
        loaded++;
        
        if (loaded % 10 === 0) {
          console.log(`📋 Loaded ${loaded}/${rows.length} definitions...`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to load definition for ${row.series_id}:`, error);
        skipped++;
      }
    }
    
    console.log(`✅ Series definitions: ${loaded} loaded, ${skipped} skipped`);
    return { loaded, skipped };
  }
  
  private async loadObservations(filePath: string) {
    const csvContent = readFileSync(filePath, 'utf-8');
    const rows: ObservationRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`📊 Processing ${rows.length} observations...`);
    
    let loaded = 0;
    let skipped = 0;
    const batchSize = 1000;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const observations: Partial<EconSeriesObservation>[] = [];
      
      for (const row of batch) {
        try {
          // Validate required fields
          if (!row.series_id || !row.period_end || !row.value_std) {
            skipped++;
            continue;
          }
          
          // Skip duplicate check since we handle conflicts in SQL
          
          // Transform and prepare for insert
          const observation = {
            seriesId: row.series_id,
            periodStart: new Date(row.period_start).toISOString().split('T')[0],
            periodEnd: new Date(row.period_end).toISOString().split('T')[0],
            freq: (row.freq as any) || 'M',
            valueStd: parseFloat(row.value_std),
            standardUnit: (row.standard_unit as any) || 'INDEX_PT',
            aggMethod: row.agg_method || 'last',
            scaleHint: (row.scale_hint as any) || 'NONE',
            displayPrecision: parseInt(row.display_precision) || 1,
            transformCode: (row.transform_code as any) || 'LEVEL'
          };
          
          observations.push(observation);
          
        } catch (error) {
          console.error(`❌ Failed to process observation for ${row.series_id}:`, error);
          skipped++;
        }
      }
      
      // Batch insert with simple conflict handling
      if (observations.length > 0) {
        try {
          await db.insert(econSeriesObservation).values(observations as any[]).onConflictDoNothing();
          loaded += observations.length;
          console.log(`📊 Loaded batch ${Math.floor(i/batchSize) + 1}: ${observations.length} observations (${loaded}/${rows.length} total)`);
        } catch (error) {
          console.error(`❌ Failed to insert batch:`, error);
          skipped += observations.length;
        }
      }
    }
    
    console.log(`✅ Observations: ${loaded} loaded, ${skipped} skipped`);
    return { loaded, skipped };
  }
  
  async validateBackfill() {
    console.log('🔍 Validating backfill results...');
    
    // Count series definitions
    const defCount = await db
      .select({ count: econSeriesDef.seriesId })
      .from(econSeriesDef);
      
    // Count observations by series
    const obsStats = await db.execute(`
      SELECT 
        series_id,
        COUNT(*) as obs_count,
        MIN(period_end) as earliest_date,
        MAX(period_end) as latest_date,
        COUNT(DISTINCT transform_code) as transform_count
      FROM econ_series_observation 
      GROUP BY series_id 
      ORDER BY obs_count DESC
      LIMIT 10
    `);
    
    console.log(`📋 Total series definitions: ${defCount.length}`);
    console.log('📊 Top series by observation count:');
    
    for (const row of obsStats.rows || []) {
      console.log(`  ${row.series_id}: ${row.obs_count} obs (${row.earliest_date} to ${row.latest_date})`);
    }
    
    return {
      seriesCount: defCount.length,
      topSeriesStats: obsStats.rows || []
    };
  }
}

export const economicDataBackfillService = new EconomicDataBackfillService();