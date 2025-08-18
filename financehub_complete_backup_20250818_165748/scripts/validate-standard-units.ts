/**
 * Standard Unit Validation Script
 * Validates consistency between econ_series_observation.standard_unit and econ_series_def.standard_unit
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

interface ValidationResult {
  seriesId: string;
  definitionUnit: string;
  observationUnit: string;
  mismatch: boolean;
  observationCount: number;
}

async function validateStandardUnits(): Promise<ValidationResult[]> {
  console.log('🔍 === STANDARD UNIT VALIDATION ===');
  console.log('📊 Checking consistency between series definitions and observations...');
  console.log('');

  try {
    // Get series definitions and their observation units
    const validationData = await db.execute(sql`
      SELECT DISTINCT
        d.series_id,
        d.standard_unit as definition_unit,
        o.standard_unit as observation_unit,
        COUNT(o.series_id) OVER (PARTITION BY d.series_id) as observation_count
      FROM econ_series_def d
      LEFT JOIN econ_series_observation o ON d.series_id = o.series_id
      ORDER BY d.series_id
    `);

    const results: ValidationResult[] = [];
    
    validationData.rows.forEach(row => {
      const seriesId = row.series_id as string;
      const definitionUnit = row.definition_unit as string;
      const observationUnit = row.observation_unit as string || 'NULL';
      const observationCount = Number(row.observation_count) || 0;
      
      const mismatch = definitionUnit !== observationUnit;
      
      results.push({
        seriesId,
        definitionUnit,
        observationUnit,
        mismatch,
        observationCount
      });
    });

    return results;
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  }
}

async function generateValidationReport() {
  console.log('📋 Generating Standard Unit Validation Report...');
  
  try {
    const results = await validateStandardUnits();
    
    // Filter for issues
    const mismatches = results.filter(r => r.mismatch);
    const noObservations = results.filter(r => r.observationCount === 0);
    const consistent = results.filter(r => !r.mismatch && r.observationCount > 0);
    
    console.log('');
    console.log('📊 === VALIDATION SUMMARY ===');
    console.log(`Total series definitions: ${results.length}`);
    console.log(`Consistent units: ${consistent.length}`);
    console.log(`Unit mismatches: ${mismatches.length}`);
    console.log(`No observations: ${noObservations.length}`);
    console.log('');
    
    if (mismatches.length > 0) {
      console.log('❌ UNIT MISMATCHES FOUND:');
      console.log('Series ID        | Definition Unit | Observation Unit | Count');
      console.log('-----------------|-----------------|------------------|-------');
      
      mismatches.forEach(result => {
        console.log(`${result.seriesId.padEnd(16)} | ${result.definitionUnit.padEnd(15)} | ${result.observationUnit.padEnd(16)} | ${result.observationCount}`);
      });
      console.log('');
    }
    
    if (noObservations.length > 0) {
      console.log('⚠️  SERIES WITHOUT OBSERVATIONS:');
      noObservations.slice(0, 10).forEach(result => {
        console.log(`  - ${result.seriesId}: ${result.definitionUnit}`);
      });
      if (noObservations.length > 10) {
        console.log(`  ... and ${noObservations.length - 10} more`);
      }
      console.log('');
    }
    
    if (consistent.length > 0) {
      console.log('✅ CONSISTENT SERIES (sample):');
      consistent.slice(0, 5).forEach(result => {
        console.log(`  - ${result.seriesId}: ${result.definitionUnit} (${result.observationCount} observations)`);
      });
      if (consistent.length > 5) {
        console.log(`  ... and ${consistent.length - 5} more consistent series`);
      }
      console.log('');
    }
    
    // Generate recommendations
    console.log('💡 RECOMMENDATIONS:');
    
    if (mismatches.length > 0) {
      console.log('1. Fix unit mismatches:');
      console.log('   UPDATE econ_series_observation SET standard_unit = (');
      console.log('     SELECT standard_unit FROM econ_series_def');  
      console.log('     WHERE econ_series_def.series_id = econ_series_observation.series_id');
      console.log('   ) WHERE series_id IN (');
      mismatches.slice(0, 5).forEach((result, index) => {
        console.log(`     '${result.seriesId}'${index < 4 && index < mismatches.length - 1 ? ',' : ''}`);
      });
      console.log('   );');
      console.log('');
    }
    
    if (noObservations.length > 0) {
      console.log('2. Consider removing unused series definitions or adding observations');
      console.log('');
    }
    
    console.log('3. Add data quality checks to prevent future mismatches');
    console.log('4. Update economic data migration to validate units during loading');
    console.log('');
    
    // Standard unit analysis
    console.log('📊 STANDARD UNIT TYPES ANALYSIS:');
    const unitCounts = {};
    results.forEach(result => {
      const unit = result.definitionUnit;
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });
    
    Object.entries(unitCounts).forEach(([unit, count]) => {
      console.log(`  ${unit}: ${count} series`);
    });
    console.log('');
    
    return {
      total: results.length,
      consistent: consistent.length,
      mismatches: mismatches.length,
      noObservations: noObservations.length,
      success: mismatches.length === 0
    };
    
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    return {
      total: 0,
      consistent: 0,
      mismatches: 0,
      noObservations: 0,
      success: false
    };
  }
}

if (import.meta.main) {
  generateValidationReport()
    .then(summary => {
      console.log('🎯 VALIDATION COMPLETE');
      console.log(`Status: ${summary.success ? 'PASSED' : 'FAILED'}`);
      console.log(`Consistency Rate: ${summary.total > 0 ? Math.round((summary.consistent / summary.total) * 100) : 0}%`);
      
      process.exit(summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { validateStandardUnits, generateValidationReport };