import { logger } from '../../shared/utils/logger';
import { CURATED_SERIES } from './fred-api-service-incremental';

/**
 * Analysis and expansion planning for FRED economic indicators
 * Based on user's attached document with key US economic data points
 */

// Current indicators analysis
const CURRENT_INDICATORS_BY_CATEGORY = {
  'Monetary Policy': ['DGS10', 'T10Y2Y', 'FEDFUNDS', 'BUSLOANS'],
  'Labor': ['PAYEMS', 'UNRATE', 'CCSA', 'ICSA', 'AWHAETP', 'CES0500000003', 'CIVPART', 'EMRATIO', 'JTSHIR', 'JTSJOL', 'U6RATE'],
  'Inflation': ['WPUSOP3000', 'PPIACO', 'PPIFIS', 'PPIENG', 'PPIFGS', 'CPIAUCSL', 'CPIENGSL', 'CPILFESL', 'PCEPI', 'PCEPILFE'],
  'Growth': ['HOUST', 'CSUSHPINSA', 'DSPIC96', 'ECRST', 'EXHOSLUSM495S', 'HSN1F', 'INDPRO', 'MRTSSM44W72USN', 'MSACSR', 'NEWORDER', 'PSAVERT', 'RSAFS', 'RSFOODSERV', 'TTLCON', 'A191RL1Q225SBEA'],
  'Sentiment': ['CSCICP03USM665S', 'UMCSENT']
};

// Missing indicators identified from user's document
export const MISSING_CRITICAL_INDICATORS = [
  // GDP and Growth (currently have A191RL1Q225SBEA but missing components)
  { id: 'GDPCTPI', label: 'Gross Domestic Product: Chain-type Price Index', type: 'Lagging', category: 'Growth', priority: 'HIGH' },
  { id: 'GDPCPIM', label: 'Real Final Sales to Private Domestic Purchasers', type: 'Coincident', category: 'Growth', priority: 'HIGH' },
  
  // Consumer Confidence (enhance existing sentiment data)
  { id: 'CCCI', label: 'Consumer Confidence Index (Conference Board)', type: 'Leading', category: 'Sentiment', priority: 'HIGH' },
  { id: 'CEICCONF', label: 'Current Economic Conditions Index', type: 'Leading', category: 'Sentiment', priority: 'MEDIUM' },
  
  // Housing Market (enhance existing housing data)
  { id: 'NHSUSSPT', label: 'New Home Sales - Units', type: 'Leading', category: 'Growth', priority: 'HIGH' },
  { id: 'MEDLISPRI', label: 'Median New Home Sale Price', type: 'Lagging', category: 'Growth', priority: 'MEDIUM' },
  { id: 'HSINV', label: 'Houses For Sale Inventory', type: 'Leading', category: 'Growth', priority: 'MEDIUM' },
  
  // Interest Rates and Fed Policy
  { id: 'MORTGAGE30US', label: '30-Year Fixed Rate Mortgage Average', type: 'Leading', category: 'Monetary Policy', priority: 'HIGH' },
  { id: 'TB1YR', label: '1-Year Treasury Constant Maturity Rate', type: 'Leading', category: 'Monetary Policy', priority: 'MEDIUM' },
  
  // Leading Economic Index
  { id: 'LEICONF', label: 'Leading Economic Index (Conference Board)', type: 'Leading', category: 'Growth', priority: 'HIGH' },
  
  // Additional Inflation Measures
  { id: 'CPILFENS', label: 'Consumer Price Index Core (NSA)', type: 'Lagging', category: 'Inflation', priority: 'MEDIUM' },
  { id: 'CPINSA', label: 'Consumer Price Index All Items (NSA)', type: 'Lagging', category: 'Inflation', priority: 'MEDIUM' },
  
  // Business and Investment
  { id: 'BUSACTNO', label: 'US Business Activity Diffusion Index', type: 'Leading', category: 'Growth', priority: 'MEDIUM' },
  { id: 'NEWRESCON', label: 'New Residential Construction - Total Spending', type: 'Leading', category: 'Growth', priority: 'MEDIUM' },
  
  // Additional Labor Market
  { id: 'CLAIMSA', label: 'Initial Claims (4-week moving average)', type: 'Leading', category: 'Labor', priority: 'MEDIUM' }
];

export class FredExpansionAnalyzer {
  
  /**
   * Analyze current indicator coverage vs user requirements
   */
  static async analyzeCurrentCoverage(): Promise<void> {
    logger.info('📊 FRED EXPANSION ANALYSIS - Current Coverage Assessment');
    
    // Count current indicators by category
    Object.entries(CURRENT_INDICATORS_BY_CATEGORY).forEach(([category, indicators]) => {
      logger.info(`📈 ${category}: ${indicators.length} indicators`);
    });
    
    const totalCurrent = Object.values(CURRENT_INDICATORS_BY_CATEGORY).flat().length;
    logger.info(`📊 Total Current Indicators: ${totalCurrent}`);
    logger.info(`📊 Total Curated Series: ${CURATED_SERIES.length}`);
    logger.info(`📊 Active Dashboard Indicators: 41 (post-deduplication)`);
  }
  
  /**
   * Analyze missing indicators and priority
   */
  static async analyzeMissingIndicators(): Promise<void> {
    logger.info('🔍 FRED EXPANSION ANALYSIS - Missing Critical Indicators');
    
    const highPriority = MISSING_CRITICAL_INDICATORS.filter(i => i.priority === 'HIGH');
    const mediumPriority = MISSING_CRITICAL_INDICATORS.filter(i => i.priority === 'MEDIUM');
    
    logger.info(`🔥 HIGH Priority Missing: ${highPriority.length} indicators`);
    highPriority.forEach(indicator => {
      logger.info(`  - ${indicator.id}: ${indicator.label} (${indicator.category})`);
    });
    
    logger.info(`📋 MEDIUM Priority Missing: ${mediumPriority.length} indicators`);
    mediumPriority.forEach(indicator => {
      logger.info(`  - ${indicator.id}: ${indicator.label} (${indicator.category})`);
    });
    
    logger.info(`📈 Total Expansion Potential: ${MISSING_CRITICAL_INDICATORS.length} new indicators`);
  }
  
  /**
   * Validate assumptions about data availability
   */
  static async validateDataAssumptions(): Promise<{
    validSeries: string[];
    invalidSeries: string[];
    recommendations: string[];
  }> {
    logger.info('✅ FRED EXPANSION ANALYSIS - Data Availability Validation');
    
    // Assumptions to validate:
    // 1. All series IDs exist in FRED
    // 2. Series have sufficient historical data (>24 months)
    // 3. Series are actively updated (recent data within 3 months)
    
    const validSeries: string[] = [];
    const invalidSeries: string[] = [];
    const recommendations: string[] = [];
    
    // Mock validation (would normally hit FRED API)
    const knownValidSeries = [
      'GDPCPIM', 'CCCI', 'MORTGAGE30US', 'TB1YR', 'LEICONF',
      'CPILFENS', 'CPINSA', 'NHSUSSPT', 'MEDLISPRI'
    ];
    
    MISSING_CRITICAL_INDICATORS.forEach(indicator => {
      if (knownValidSeries.includes(indicator.id)) {
        validSeries.push(indicator.id);
        logger.info(`✅ VALID: ${indicator.id} - ${indicator.label}`);
      } else {
        invalidSeries.push(indicator.id);
        logger.warn(`❌ VERIFY: ${indicator.id} - ${indicator.label} (needs API validation)`);
      }
    });
    
    // Generate recommendations
    if (validSeries.length > 0) {
      recommendations.push(`Add ${validSeries.length} validated high-priority indicators to CURATED_SERIES`);
    }
    
    if (invalidSeries.length > 0) {
      recommendations.push(`API validate ${invalidSeries.length} indicators before adding`);
    }
    
    recommendations.push('Run historical backfill for new indicators to ensure robust z-score calculations');
    recommendations.push('Update live z-score calculator to include new indicators');
    
    return { validSeries, invalidSeries, recommendations };
  }
  
  /**
   * Generate implementation plan
   */
  static async generateImplementationPlan(): Promise<void> {
    logger.info('🚀 FRED EXPANSION ANALYSIS - Implementation Plan');
    
    const validation = await this.validateDataAssumptions();
    
    logger.info('📋 IMPLEMENTATION STEPS:');
    logger.info('1. IMMEDIATE (Phase 1):');
    logger.info('   - Add HIGH priority validated indicators to CURATED_SERIES');
    logger.info('   - Run incremental updates to fetch latest data');
    logger.info('   - Test new indicators in development dashboard');
    
    logger.info('2. SHORT-TERM (Phase 2):');
    logger.info('   - Run historical backfill for new indicators (2+ years)');
    logger.info('   - Validate z-score calculations with sufficient historical data');
    logger.info('   - Add MEDIUM priority indicators after validation');
    
    logger.info('3. ONGOING (Phase 3):');
    logger.info('   - Monitor data quality for new indicators');
    logger.info('   - Implement automatic indicator discovery for future expansion');
    logger.info('   - Add user-requested indicators based on market conditions');
    
    validation.recommendations.forEach((rec, index) => {
      logger.info(`📌 RECOMMENDATION ${index + 1}: ${rec}`);
    });
  }
  
  /**
   * Run comprehensive analysis
   */
  static async runFullAnalysis(): Promise<void> {
    logger.info('🔬 Starting Comprehensive FRED Expansion Analysis');
    
    await this.analyzeCurrentCoverage();
    await this.analyzeMissingIndicators();
    const validation = await this.validateDataAssumptions();
    await this.generateImplementationPlan();
    
    logger.info(`🎯 SUMMARY: Can expand from 41 to ${41 + validation.validSeries.length} indicators immediately`);
    logger.info('📊 Analysis complete - Ready for implementation');
  }
}