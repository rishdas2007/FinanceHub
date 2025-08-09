import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';
import { fnaiCalculator, FNAIData } from './fnai-calculator';

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
          -- Simple z-score based on percentage change
          CASE 
            WHEN h2.value > 0 THEN
              ((h1.value - h2.value) / h2.value) * 100 
            ELSE 0
          END as simple_z_score
        FROM historical_economic_data h1
        JOIN historical_economic_data h2 ON h1.series_id = h2.series_id
        WHERE h1.series_id IN ('ICSA', 'CCSA', 'PAYEMS', 'CES0500000003', 'GDPC1', 'JCXFE', 'PCE', 'PPIFIS', 'INDPRO', 'TOTALSL', 'CFNAI', 'MORTGAGE30US', 'GASREGCOVW')
          AND h1.period_date = (SELECT MAX(period_date) FROM historical_economic_data WHERE series_id = h1.series_id)
          AND h2.period_date = (SELECT MAX(period_date) FROM historical_economic_data 
                                WHERE series_id = h1.series_id AND period_date < h1.period_date)
        ORDER BY 
          CASE 
            WHEN h1.series_id IN ('ICSA', 'CCSA', 'PAYEMS', 'CES0500000003', 'GDPC1', 'JCXFE') THEN 1
            WHEN h1.series_id IN ('PCE', 'PPIFIS', 'INDPRO') THEN 2
            ELSE 3
          END,
          h1.series_id
      `;

      const result = await db.execute(query);
      
      // Calculate FNAI for each indicator
      const indicatorsWithFNAI: EconomicIndicatorData[] = [];
      
      for (const row of result.rows) {
        const seriesId = row.series_id;
        const frequency = row.frequency || 'Monthly';
        
        // Get historical data for FNAI calculation
        const historicalQuery = sql`
          SELECT value, period_date
          FROM historical_economic_data
          WHERE series_id = ${seriesId}
          ORDER BY period_date DESC
          LIMIT 60
        `;
        
        const historicalResult = await db.execute(historicalQuery);
        const historicalData: FNAIData[] = historicalResult.rows.map((r: any) => ({
          value: parseFloat(String(r.value)),
          period_date: String(r.period_date)
        }));
        
        // Calculate FNAI
        const fnaiResult = fnaiCalculator.calculateFNAI(historicalData, frequency);
        
        const indicator: EconomicIndicatorData = {
          seriesId: String(row.series_id),
          metric: this.getIndicatorDisplayName(String(row.indicator)),
          type: this.getIndicatorType(String(row.series_id)),
          category: this.formatCategory(String(row.category)),
          period_date: String(row.current_period),
          releaseDate: String(row.release_date),
          currentReading: parseFloat(String(row.current_value)) || 0,
          priorReading: row.prior_value ? parseFloat(String(row.prior_value)) : undefined,
          varianceVsPrior: row.variance_vs_prior ? parseFloat(String(row.variance_vs_prior)) : undefined,
          zScore: row.simple_z_score ? parseFloat(String(row.simple_z_score)) : undefined,
          fnai: fnaiResult.fnai,
          fnaiInterpretation: fnaiResult.interpretation,
          frequency: String(row.frequency) || 'Monthly',
          unit: String(row.unit) || 'Unknown'
        };
        
        indicatorsWithFNAI.push(indicator);
      }

      const indicators = indicatorsWithFNAI;

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
    const typeMap: Record<string, string> = {
      'ICSA': 'Labor',
      'CCSA': 'Labor', 
      'PAYEMS': 'Labor',
      'CES0500000003': 'Labor',
      'AWHMAN': 'Labor',
      'MANEMP': 'Labor',
      'JTSQUL': 'Labor',
      'GDPC1': 'Growth',
      'INDPRO': 'Growth',
      'CFNAI': 'Growth',
      'JCXFE': 'Inflation',
      'PCE': 'Consumption',
      'PPIFIS': 'Inflation',
      'TOTALSL': 'Credit',
      'MORTGAGE30US': 'Housing',
      'GASREGCOVW': 'Energy',
      'DEXUSEU': 'Currency',
      'ISRATIO': 'Business',
      'DGORDER': 'Manufacturing'
    };
    
    return typeMap[seriesId] || 'Economic';
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