import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import { fnaiCalculator, FNAIData } from './fnai-calculator';
import { deltaZScoreCalculator } from './delta-zscore-calculator';

export interface EconomicIndicatorData {
  seriesId: string;
  metric: string;
  type: string;
  category: string;
  period_date: string;
  releaseDate?: string;
  currentReading: number;
  priorReading?: number;
  varianceVsPrior?: number;
  zScore?: number;
  deltaZScore?: number;
  fnai?: number;
  fnaiInterpretation?: string;
  frequency: string;
  unit: string;
}

export class HistoricalEconomicService {
  
  /**
   * Get comprehensive economic indicators using our 10-year historical dataset
   */
  async getComprehensiveIndicators(): Promise<EconomicIndicatorData[]> {
    try {
      logger.info('🔍 Fetching comprehensive economic indicators from historical data');
      
      // Use a simpler, working approach based on JOIN method  
      const query = sql`
        SELECT 
          h1.series_id,
          h1.indicator,
          h1.value as current_value,
          h1.period_date as current_period,
          h1.release_date,
          h1.unit,
          h1.frequency,
          h1.category,
          h2.value as prior_value,
          h2.period_date as prior_period,
          h1.value - h2.value as variance_vs_prior,
          -- Normalized z-score with unit harmonization
          CASE 
            -- Housing indicators: normalize to thousands
            WHEN h1.series_id IN ('HOUST', 'PERMIT') AND h2.value > 0 THEN
              CASE 
                WHEN h2.value < 10 THEN ((h1.value - (h2.value * 1000)) / (h2.value * 1000)) * 100
                ELSE ((h1.value - h2.value) / h2.value) * 100
              END
            -- Employment indicators: normalize large scale differences  
            WHEN h1.series_id = 'PAYEMS' AND h2.value > 0 THEN
              CASE 
                WHEN h2.value < 1000 THEN ((h1.value - (h2.value * 1000)) / (h2.value * 1000)) * 100
                ELSE ((h1.value - h2.value) / h2.value) * 100
              END
            -- Interest rates and percentages: direct percentage calculation
            WHEN h1.series_id IN ('FEDFUNDS', 'DGS10', 'T10Y2Y', 'MORTGAGE30US') AND h2.value > 0 THEN
              ((h1.value - h2.value) / h2.value) * 100
            -- Default calculation for other indicators
            WHEN h2.value > 0 THEN
              ((h1.value - h2.value) / h2.value) * 100 
            ELSE 0
          END as simple_z_score
        FROM historical_economic_data h1
        JOIN historical_economic_data h2 ON h1.series_id = h2.series_id
        WHERE h1.series_id IN (
          -- Priority 1: Core Economic Indicators  
          'ICSA', 'CCSA', 'PAYEMS', 'CES0500000003', 'GDPC1', 'JCXFE', 'UNRATE', 'FEDFUNDS',
          -- Priority 2: Inflation & Price Indicators
          'PCEPI', 'CPILFESL', 'CPIAUCSL', 'PCE', 'PPIFIS',
          -- Priority 3: Housing & Interest Rate Indicators  
          'T10Y2Y', 'DGS10', 'HOUST', 'MORTGAGE30US',
          -- Priority 4: Manufacturing & Confidence
          'INDPRO', 'UMCSENT', 'NAPM',
          -- Priority 5: Additional Key Indicators
          'TOTALSL', 'CFNAI', 'GASREGCOVW', 'PERMIT', 'U6RATE'
        )
          AND h1.period_date = (SELECT MAX(period_date) FROM historical_economic_data WHERE series_id = h1.series_id)
          AND h2.period_date = (SELECT MAX(period_date) FROM historical_economic_data 
                                WHERE series_id = h1.series_id AND period_date < h1.period_date)
        ORDER BY 
          CASE 
            WHEN h1.series_id IN ('PAYEMS', 'ICSA', 'CCSA', 'UNRATE', 'GDPC1', 'FEDFUNDS') THEN 1
            WHEN h1.series_id IN ('PCEPI', 'CPILFESL', 'CPIAUCSL', 'T10Y2Y', 'DGS10') THEN 2
            WHEN h1.series_id IN ('HOUST', 'UMCSENT', 'INDPRO', 'NAPM') THEN 3
            ELSE 4
          END,
          h1.series_id
      `;

      const result = await db.execute(query);
      
      // Get all series IDs for bulk delta Z-score calculation
      const seriesIds = result.rows.map(row => String(row.series_id));
      logger.info(`🔄 Calculating delta Z-scores for ${seriesIds.length} indicators`);
      
      // Calculate delta Z-scores for all indicators in parallel
      const deltaZScoreMap = await deltaZScoreCalculator.calculateBulkDeltaZScores(seriesIds);
      
      // Calculate FNAI and combine with delta Z-scores
      const indicatorsWithEnhancedAnalysis: EconomicIndicatorData[] = [];
      
      for (const row of result.rows) {
        const rowSeriesId = String(row.series_id);
        const frequency = String(row.frequency) || 'monthly';
        
        // Get historical data for FNAI calculation
        const historicalQuery = sql`
          SELECT value, period_date
          FROM historical_economic_data
          WHERE series_id = ${rowSeriesId}
          ORDER BY period_date DESC
          LIMIT 60
        `;
        
        const historicalResult = await db.execute(historicalQuery);
        const historicalData: FNAIData[] = historicalResult.rows.map((r: any) => ({
          value: parseFloat(String(r.value)),
          period_date: String(r.period_date)
        }));
        
        // Calculate FNAI
        const fnaiResult = fnaiCalculator.calculateFNAI(historicalData, frequency.toLowerCase());
        
        // Get delta Z-score data
        const deltaData = deltaZScoreMap.get(rowSeriesId);
        
        // Clean data extraction
        const currentValue = parseFloat(String(row.current_value)) || 0;
        const priorValue = row.prior_value ? parseFloat(String(row.prior_value)) : undefined;
        const rawVariance = row.variance_vs_prior ? parseFloat(String(row.variance_vs_prior)) : undefined;
        const calculatedZScore = row.simple_z_score ? parseFloat(String(row.simple_z_score)) : undefined;
        
        // Cap extreme Z-scores at reasonable levels (max ±25)
        const cappedZScore = calculatedZScore ? 
          Math.min(Math.abs(calculatedZScore), 25) * Math.sign(calculatedZScore) : 
          undefined;

        const indicator: EconomicIndicatorData = {
          seriesId: rowSeriesId,
          metric: this.getIndicatorDisplayName(String(row.indicator)),
          type: String(row.type) || 'Coincident', // Use database type field
          category: this.formatCategory(String(row.category)),
          period_date: String(row.current_period),
          releaseDate: String(row.release_date),
          currentReading: currentValue,
          priorReading: priorValue,
          varianceVsPrior: rawVariance,
          zScore: cappedZScore,
          deltaZScore: deltaData?.deltaZScore,
          fnai: fnaiResult.fnai,
          fnaiInterpretation: fnaiResult.interpretation,
          frequency: frequency,
          unit: String(row.unit) || 'Unknown'
        };
        
        indicatorsWithEnhancedAnalysis.push(indicator);
      }

      const indicators = indicatorsWithEnhancedAnalysis;

      logger.info(`✅ Retrieved ${indicators.length} comprehensive economic indicators`);
      
      // Log sample of indicators with non-zero prior readings
      const withPriors = indicators.filter(i => i.priorReading !== null && i.priorReading !== 0);
      logger.info(`📊 Found ${withPriors.length} indicators with valid prior readings`);
      
      withPriors.slice(0, 3).forEach(indicator => {
        logger.info(`📈 ${indicator.seriesId}: Current=${indicator.currentReading}, Prior=${indicator.priorReading}, Variance=${indicator.varianceVsPrior}`);
      });

      return indicators;
      
    } catch (error) {
      logger.error('❌ Failed to get comprehensive economic indicators:', String(error));
      return [];
    }
  }
  
  /**
   * Get clean display name for indicators
   */
  private getIndicatorDisplayName(rawName: string): string {
    const nameMap: Record<string, string> = {
      'Initial Jobless Claims': 'Initial Jobless Claims',
      'Continuing Claims': 'Continuing Claims',
      'Total Nonfarm Payrolls': 'Nonfarm Payrolls',
      'Average Hourly Earnings of All Employees': 'Average Hourly Earnings',
      'Real Gross Domestic Product': 'GDP Growth Rate',
      'Core Personal Consumption Expenditures': 'Core PCE Inflation',
      'Personal Consumption Expenditures': 'Personal Consumption',
      'GDP Growth Rate': 'GDP Growth Rate',
      'CPI Year-over-Year': 'CPI Inflation',
      'Core CPI Year-over-Year': 'Core CPI Inflation', 
      'PCE Price Index YoY': 'PCE Price Index',
      'Manufacturing PMI': 'Manufacturing PMI',
      'Unemployment Rate': 'Unemployment Rate',
      'Federal Funds Rate': 'Federal Funds Rate',
      '10-Year Treasury Yield': '10-Year Treasury',
      'Yield Curve (10yr-2yr)': 'Yield Curve',
      'Housing Starts': 'Housing Starts',
      'Michigan Consumer Sentiment': 'Consumer Sentiment',
      'Building Permits': 'Building Permits',
      'Producer Price Index: Final Demand': 'PPI Final Demand',
      '30-Year Fixed Rate Mortgage Average': '30-Year Mortgage Rate',
      'US Regular All Formulations Gas Price': 'Gasoline Prices',
      'US / Euro Foreign Exchange Rate': 'USD/EUR Exchange Rate',
      'Chicago Fed National Activity Index': 'Chicago Fed Activity Index',
      'Total Consumer Credit Outstanding': 'Consumer Credit Outstanding',
      'All Employees: Manufacturing': 'Manufacturing Employment',
      'Average Weekly Hours of Production Employees: Manufacturing': 'Manufacturing Hours',
      'Job Openings and Labor Turnover Survey: Quits': 'JOLTS Quits Rate',
      'Total Business: Inventories to Sales Ratio': 'Inventories/Sales Ratio',
      'Manufacturers New Orders: Durable Goods': 'Durable Goods Orders',
      'Industrial Production Index': 'Industrial Production'
    };
    
    return nameMap[rawName] || rawName;
  }
  
  /**
   * Get indicator type for classification
   */
  private getIndicatorType(seriesId: string): string {
    // This method now returns the database type field value
    // The type classification is handled in the database update
    return 'Coincident'; // Will be overridden by database value
  }
  
  /**
   * Format category for display
   */
  private formatCategory(category: string): string {
    if (!category) return 'Economic';
    
    const categoryMap: Record<string, string> = {
      'Labor Market': 'Labor',
      'Economic Output': 'Growth',
      'Price Level': 'Inflation',
      'Consumer Spending': 'Consumption',
      'Housing Market': 'Housing',
      'Manufacturing': 'Manufacturing',
      'Financial': 'Financial',
      'International': 'Global'
    };
    
    return categoryMap[category] || category;
  }
}

export const historicalEconomicService = new HistoricalEconomicService();