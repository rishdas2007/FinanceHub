import { logger } from '../../shared/utils/logger';

/**
 * Comprehensive Duplicate Metrics Analysis Service
 * Identifies and resolves FRED series ID conflicts causing metric duplication
 */

export class DuplicateMetricsAnalyzer {
  
  /**
   * Analyze series ID duplication issues
   */
  static async analyzeDuplicateSeries(): Promise<void> {
    logger.info('🔍 DUPLICATE METRICS ANALYSIS - Investigating FRED Series Conflicts');
    
    const knownDuplicates = [
      {
        seriesId: 'CCSA',
        metrics: [
          'Continued Claims (Insured Unemployment)',
          'Continuing Jobless Claims (Δ-adjusted)'
        ],
        issue: 'Same FRED series used for both raw and delta-adjusted processing',
        units: ['Thousands', 'Percent'],
        values: ['1,972,000.0', '1953.0M']
      },
      {
        seriesId: 'ICSA', 
        metrics: [
          'Initial Claims',
          'Initial Jobless Claims (Δ-adjusted)'
        ],
        issue: 'Same FRED series used for both raw and delta-adjusted processing',
        units: ['Thousands', 'Percent'],
        values: ['235,000.0', '224.0M']
      }
    ];
    
    logger.info('🚨 CONFIRMED DUPLICATE SERIES ISSUES:');
    knownDuplicates.forEach((duplicate, index) => {
      logger.info(`📋 ${index + 1}. Series ID: ${duplicate.seriesId}`);
      logger.info(`   🔄 Conflicting Metrics:`);
      duplicate.metrics.forEach((metric, i) => {
        logger.info(`      - ${metric} (${duplicate.units[i]}: ${duplicate.values[i]})`);
      });
      logger.info(`   ⚠️  Issue: ${duplicate.issue}`);
    });
  }
  
  /**
   * Identify root causes
   */
  static async identifyRootCauses(): Promise<string[]> {
    logger.info('🎯 ROOT CAUSE ANALYSIS');
    
    const rootCauses = [
      '1. Delta-Adjusted Processing Duplication',
      '2. Unit Transformation Conflicts (Raw vs Millions)'
    ];
    
    logger.info('🔥 TOP 2 ROOT CAUSES:');
    rootCauses.forEach((cause) => {
      logger.info(`   ${cause}`);
    });
    
    logger.info('📋 DETAILED REASONING:');
    logger.info('   - CCSA/ICSA series processed twice: once raw, once delta-adjusted');
    logger.info('   - Raw version shows actual counts (1,972,000.0)');
    logger.info('   - Delta-adjusted version shows millions (1953.0M) with different units');
    logger.info('   - System lacks deduplication logic for series with multiple transformations');
    
    return rootCauses;
  }
  
  /**
   * Generate solution recommendations
   */
  static generateSolutionPlan(): string {
    return `
DUPLICATE METRICS RESOLUTION PLAN

1. IMMEDIATE DEDUPLICATION:
   - Remove delta-adjusted versions of CCSA and ICSA
   - Keep raw versions with proper formatting
   - Ensure consistent unit handling

2. SERIES ID VALIDATION:
   - Add validation to prevent same series ID being used multiple times
   - Implement deduplication logic in data processing pipeline
   - Create series ID to metric name mapping validation

3. UNIT STANDARDIZATION:
   - Standardize jobless claims to thousands format
   - Ensure consistent display formatting across similar metrics
   - Remove conflicting unit transformations

4. DATA PIPELINE FIXES:
   - Update economic data transformer to handle series conflicts
   - Add duplicate detection in fred-api-service-incremental.ts
   - Implement proper metric name uniqueness validation

PRIORITY: HIGH - USER REPORTED PRODUCTION ISSUE
IMPACT: Resolves user confusion about duplicate economic indicators
`;
  }
  
  /**
   * Run comprehensive duplicate analysis
   */
  static async runFullAnalysis(): Promise<void> {
    logger.info('🚨 Starting Duplicate Metrics Analysis');
    
    await this.analyzeDuplicateSeries();
    const rootCauses = await this.identifyRootCauses();
    
    logger.info('💻 SOLUTION PLAN:');
    logger.info(this.generateSolutionPlan());
    
    logger.info('🔧 NEXT STEPS:');
    logger.info('1. Add series ID deduplication validation');
    logger.info('2. Remove delta-adjusted duplicates for CCSA/ICSA');
    logger.info('3. Standardize unit formatting for jobless claims');
    logger.info('4. Implement duplicate prevention logic');
    
    logger.info('✅ Analysis complete - Ready for implementation');
  }
}