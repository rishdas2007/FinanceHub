import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger';

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
      
      const indicators: EconomicIndicatorData[] = result.rows.map((row: any) => {
        return {
          seriesId: row.series_id,
          metric: this.getIndicatorDisplayName(row.indicator),
          type: this.getIndicatorType(row.series_id),
          category: this.formatCategory(row.category),
          period_date: row.current_period,
          releaseDate: row.release_date,
          currentReading: parseFloat(row.current_value) || 0,
          priorReading: parseFloat(row.prior_value) || null,
          varianceVsPrior: parseFloat(row.variance_vs_prior) || null,
          zScore: parseFloat(row.simple_z_score) || null,
          deltaZScore: null, // Will be calculated later if needed
          frequency: row.frequency || 'Monthly',
          unit: row.unit || 'Unknown'
        };
      });

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