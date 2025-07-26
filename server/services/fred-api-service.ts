import { logger } from '../../shared/utils/logger';

export interface FREDIndicator {
  series_id: string;
  title: string;
  current_value: string;
  date: string;
  previous_value?: string;
  change?: number;
  change_percent?: number;
  units: string;
  frequency: string;
  last_updated: string;
  category: 'Leading' | 'Coincident' | 'Lagging';
}

export class FREDApiService {
  private readonly baseUrl = 'https://api.stlouisfed.org/fred';
  private readonly apiKey: string;

  // Comprehensive economic indicators with proper categorization
  private readonly keyIndicators = [
    // Inflation Indicators
    { series_id: 'CPIAUCSL', title: 'Consumer Price Index', category: 'Lagging' as const, units: 'Index' },
    { series_id: 'CPILFESL', title: 'Core CPI (Ex Food & Energy)', category: 'Lagging' as const, units: 'Index' },
    { series_id: 'PPIACO', title: 'Producer Price Index', category: 'Leading' as const, units: 'Index' },
    { series_id: 'PCEPI', title: 'PCE Price Index', category: 'Lagging' as const, units: 'Index' },
    
    // Growth & Production
    { series_id: 'A191RL1Q225SBEA', title: 'GDP Growth Rate', category: 'Coincident' as const, units: '%' },
    { series_id: 'INDPRO', title: 'Industrial Production Index', category: 'Coincident' as const, units: 'Index' },
    
    // Labor Market
    { series_id: 'UNRATE', title: 'Unemployment Rate', category: 'Lagging' as const, units: '%' },
    { series_id: 'PAYEMS', title: 'Nonfarm Payrolls', category: 'Coincident' as const, units: 'K' },
    { series_id: 'ICSA', title: 'Initial Jobless Claims', category: 'Leading' as const, units: 'K' },
    { series_id: 'CCSA', title: 'Continued Claims', category: 'Lagging' as const, units: 'K' },
    
    // Consumer & Retail
    { series_id: 'RSAFS', title: 'Retail Sales Total', category: 'Coincident' as const, units: 'Billions' },
    { series_id: 'RSXFS', title: 'Retail Sales (MoM Change)', category: 'Coincident' as const, units: '%' },
    { series_id: 'UMCSENT', title: 'Consumer Sentiment', category: 'Leading' as const, units: 'Index' },
    { series_id: 'CSCICP03USM665S', title: 'Consumer Confidence', category: 'Leading' as const, units: 'Index' },
    
    // Manufacturing & Orders
    { series_id: 'DGORDER', title: 'Durable Goods Orders', category: 'Leading' as const, units: 'Billions' },
    { series_id: 'NAPMIMFG', title: 'ISM Manufacturing PMI', category: 'Leading' as const, units: 'Index' },
    { series_id: 'PMICM', title: 'S&P Global US Manufacturing PMI', category: 'Leading' as const, units: 'Index' },
    
    // Housing Market
    { series_id: 'HOUST', title: 'Housing Starts', category: 'Leading' as const, units: 'K Units' },
    { series_id: 'HSN1F', title: 'New Home Sales', category: 'Leading' as const, units: 'K Units' },
    { series_id: 'EXHOSLUSM495S', title: 'Existing Home Sales', category: 'Coincident' as const, units: 'M Units' },
    { series_id: 'PERMIT', title: 'Building Permits', category: 'Leading' as const, units: 'K Units' },
    
    // Financial Markets
    { series_id: 'FEDFUNDS', title: 'Federal Funds Rate', category: 'Leading' as const, units: '%' },
    { series_id: 'DGS10', title: '10-Year Treasury Rate', category: 'Leading' as const, units: '%' },
    { series_id: 'T10Y2Y', title: 'Yield Curve (10Y-2Y)', category: 'Leading' as const, units: '%' },
    
    // Leading Indicators
    { series_id: 'USSLIND', title: 'US Leading Index', category: 'Leading' as const, units: 'Index' }
  ];

  constructor() {
    this.apiKey = process.env.FRED_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('FRED API key not provided. FRED service will not function.');
    }
  }

  /**
   * Fetch all key economic indicators from FRED
   */
  async getKeyEconomicIndicators(): Promise<FREDIndicator[]> {
    try {
      logger.info('🏛️ Fetching authentic economic data from Federal Reserve (FRED)...');
      
      const indicators: FREDIndicator[] = [];
      
      // Fetch data for each indicator
      for (const indicator of this.keyIndicators) {
        try {
          const data = await this.fetchSeriesData(indicator.series_id, 3);
          
          if (data && data.length > 0) {
            const current = data[0];
            const previous = data[1];
            
            // Calculate change if previous data exists
            let change: number | undefined;
            let changePercent: number | undefined;
            
            if (previous && current.value !== '.' && previous.value !== '.') {
              const currentVal = parseFloat(current.value);
              const previousVal = parseFloat(previous.value);
              
              if (!isNaN(currentVal) && !isNaN(previousVal)) {
                change = currentVal - previousVal;
                changePercent = ((currentVal - previousVal) / previousVal) * 100;
              }
            }
            
            indicators.push({
              series_id: indicator.series_id,
              title: indicator.title,
              current_value: this.formatValue(current.value, indicator.units),
              date: current.date,
              previous_value: previous ? this.formatValue(previous.value, indicator.units) : undefined,
              change,
              change_percent: changePercent,
              units: indicator.units,
              frequency: 'Monthly', // Most indicators are monthly
              last_updated: new Date().toISOString(),
              category: indicator.category
            });
          }
        } catch (error) {
          logger.error(`Failed to fetch ${indicator.series_id}:`, error);
          // Continue with other indicators
        }
      }
      
      logger.info(`✅ Successfully fetched ${indicators.length} authentic economic indicators from FRED`);
      return indicators;
      
    } catch (error) {
      logger.error('FRED API service error:', error);
      throw new Error('Failed to fetch economic data from Federal Reserve');
    }
  }

  /**
   * Fetch specific indicator by series ID
   */
  async getIndicator(seriesId: string, limit: number = 3): Promise<FREDIndicator | null> {
    try {
      const data = await this.fetchSeriesData(seriesId, limit);
      
      if (!data || data.length === 0) {
        return null;
      }
      
      const current = data[0];
      const previous = data[1];
      
      // Find indicator metadata
      const indicatorMeta = this.keyIndicators.find(ind => ind.series_id === seriesId);
      
      let change: number | undefined;
      let changePercent: number | undefined;
      
      if (previous && current.value !== '.' && previous.value !== '.') {
        const currentVal = parseFloat(current.value);
        const previousVal = parseFloat(previous.value);
        
        if (!isNaN(currentVal) && !isNaN(previousVal)) {
          change = currentVal - previousVal;
          changePercent = ((currentVal - previousVal) / previousVal) * 100;
        }
      }
      
      return {
        series_id: seriesId,
        title: indicatorMeta?.title || seriesId,
        current_value: this.formatValue(current.value, indicatorMeta?.units || ''),
        date: current.date,
        previous_value: previous ? this.formatValue(previous.value, indicatorMeta?.units || '') : undefined,
        change,
        change_percent: changePercent,
        units: indicatorMeta?.units || '',
        frequency: 'Monthly',
        last_updated: new Date().toISOString(),
        category: indicatorMeta?.category || 'Coincident'
      };
      
    } catch (error) {
      logger.error(`Failed to fetch indicator ${seriesId}:`, error);
      return null;
    }
  }

  /**
   * Fetch series observations from FRED API
   */
  private async fetchSeriesData(seriesId: string, limit: number = 3): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/series/observations?series_id=${seriesId}&api_key=${this.apiKey}&file_type=json&limit=${limit}&sort_order=desc`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`FRED API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error_code) {
        throw new Error(`FRED API error: ${data.error_message}`);
      }
      
      return data.observations || [];
      
    } catch (error) {
      logger.error(`FRED API request failed for series ${seriesId}:`, error);
      throw error;
    }
  }

  /**
   * Format values according to their units
   */
  private formatValue(value: string, units: string): string {
    if (value === '.' || value === '' || value === null) {
      return 'N/A';
    }
    
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return value;
    }
    
    // Format based on units
    switch (units) {
      case 'K':
        return `${Math.round(numValue)}K`;
      case 'K Units':
        return `${(numValue / 1000).toFixed(1)}K Units`;
      case 'M Units':
        return `${(numValue / 1000000).toFixed(2)}M Units`;
      case '%':
        return `${numValue.toFixed(1)}%`;
      case 'Billions':
        return `${(numValue / 1000).toFixed(1)}T`; // Convert to trillions for readability
      case 'Index':
        return numValue.toFixed(1);
      default:
        return numValue.toLocaleString();
    }
  }

  /**
   * Check if FRED API is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Test FRED API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }
      
      // Test with a simple series request
      const response = await fetch(`${this.baseUrl}/series/observations?series_id=UNRATE&api_key=${this.apiKey}&file_type=json&limit=1`);
      
      return response.ok;
    } catch (error) {
      logger.error('FRED API connection test failed:', error);
      return false;
    }
  }
}

export const fredApiService = new FREDApiService();