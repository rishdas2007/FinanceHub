import { logger } from '../../shared/utils/logger';

export interface FREDIndicator {
  series_id: string;
  title: string;
  current_value: string;
  date: string;
  previous_value?: string;
  previous_raw_value?: number;
  change?: number;
  change_percent?: number;
  units: string;
  frequency: string;
  last_updated: string;
  category: 'Inflation' | 'Growth' | 'Labor' | 'Sentiment' | 'Monetary Policy';
  type: 'Leading' | 'Coincident' | 'Lagging';
}

export class FREDApiService {
  private readonly baseUrl = 'https://api.stlouisfed.org/fred';
  private readonly apiKey: string;

  // COMPLETE 46+ ECONOMIC INDICATORS WITH FULL FRED API INTEGRATION
  private readonly keyIndicators = [
    // Growth Indicators (18)
    { series_id: 'A191RL1Q225SBEA', title: 'GDP Growth Rate', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'percent' },
    { series_id: 'RSAFS', title: 'Retail Sales', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'millions_dollars' },
    { series_id: 'MRTSSM44W72USN', title: 'Retail Sales Ex-Auto', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'millions_dollars' },
    { series_id: 'RSFSDP', title: 'Retail Sales: Food Services', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'millions_dollars' },
    { series_id: 'INDPRO', title: 'Industrial Production YoY', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'index_yoy' },
    { series_id: 'CAPUTLG2211S', title: 'Capacity Utilization (Mfg)', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'percent' },
    { series_id: 'PI', title: 'Personal Income', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'billions_dollars' },
    { series_id: 'PCE', title: 'Personal Spending', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'billions_dollars' },
    { series_id: 'DGORDER', title: 'Durable Goods Orders', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'millions_dollars' },
    { series_id: 'NEWORDER', title: 'Consumer Durable Goods New Orders', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'millions_dollars' },
    { series_id: 'AMTMNO', title: 'Factory Orders', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'millions_dollars' },
    { series_id: 'BUSINV', title: 'Business Inventories', category: 'Growth' as const, type: 'Lagging' as const, display_unit: 'millions_dollars' },
    { series_id: 'USSLIND', title: 'Leading Economic Index', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'index' },
    { series_id: 'DSPIC96', title: 'Real Disposable Personal Income', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'chained_dollars' },
    { series_id: 'ECRST', title: 'E-commerce Retail Sales', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'millions_dollars' },
    { series_id: 'TTLCON', title: 'Total Construction Spending', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'millions_dollars' },
    { series_id: 'NAPMIMFG', title: 'Manufacturing PMI', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'index' },
    { series_id: 'NAPMNOI', title: 'ISM Services PMI', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'index' },

    // Housing & Real Estate (8)
    { series_id: 'HOUST', title: 'Housing Starts', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'thousands' },
    { series_id: 'PERMIT', title: 'Building Permits', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'thousands' },
    { series_id: 'EXHOSLUSM495S', title: 'Existing Home Sales', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'thousands' },
    { series_id: 'HSN1F', title: 'New Home Sales', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'thousands' },
    { series_id: 'PHSI', title: 'Pending Home Sales', category: 'Growth' as const, type: 'Leading' as const, display_unit: 'index' },
    { series_id: 'CSUSHPINSA', title: 'Home Price Index', category: 'Growth' as const, type: 'Lagging' as const, display_unit: 'index' },
    { series_id: 'MSACSR', title: 'Months Supply of Homes', category: 'Growth' as const, type: 'Coincident' as const, display_unit: 'months_supply' },

    // Inflation Indicators (8)
    { series_id: 'CPIAUCSL', title: 'CPI', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'index' },
    { series_id: 'CPILFESL', title: 'Core CPI', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'index' },
    { series_id: 'PPIACO', title: 'PPI All Commodities', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'index' },
    { series_id: 'WPUSOP3000', title: 'Core PPI', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'index' },
    { series_id: 'PCEPI', title: 'PCE Price Index YoY', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'percent' },
    { series_id: 'PCEPILFE', title: 'Core PCE Price Index', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'index' },
    { series_id: 'CPIENGSL', title: 'CPI Energy', category: 'Inflation' as const, type: 'Leading' as const, display_unit: 'index' },
    { series_id: 'GASREGCOVA', title: 'Personal Savings Rate', category: 'Inflation' as const, type: 'Lagging' as const, display_unit: 'percent' },

    // Labor Market Indicators (13)
    { series_id: 'UNRATE', title: 'Unemployment Rate', category: 'Labor' as const, type: 'Lagging' as const, display_unit: 'percent' },
    { series_id: 'PAYEMS', title: 'Nonfarm Payrolls', category: 'Labor' as const, type: 'Coincident' as const, display_unit: 'thousands' },
    { series_id: 'ICSA', title: 'Initial Jobless Claims', category: 'Labor' as const, type: 'Leading' as const, display_unit: 'thousands' },
    { series_id: 'CCSA', title: 'Continuing Jobless Claims', category: 'Labor' as const, type: 'Lagging' as const, display_unit: 'thousands' },
    { series_id: 'CES0500000003', title: 'Average Hourly Earnings', category: 'Labor' as const, type: 'Lagging' as const, display_unit: 'dollars_per_hour' },
    { series_id: 'AWHAETP', title: 'Average Weekly Hours', category: 'Labor' as const, type: 'Coincident' as const, display_unit: 'hours' },
    { series_id: 'CIVPART', title: 'Labor Force Participation Rate', category: 'Labor' as const, type: 'Lagging' as const, display_unit: 'percent' },
    { series_id: 'JTSJOL', title: 'Job Openings (JOLTS)', category: 'Labor' as const, type: 'Leading' as const, display_unit: 'thousands' },
    { series_id: 'JTSHIR', title: 'JOLTS Hires', category: 'Labor' as const, type: 'Coincident' as const, display_unit: 'thousands' },
    { series_id: 'JTSQUR', title: 'Quits Rate', category: 'Labor' as const, type: 'Leading' as const, display_unit: 'percent' },
    { series_id: 'U6RATE', title: 'U-6 Unemployment Rate', category: 'Labor' as const, type: 'Lagging' as const, display_unit: 'percent' },

    // Monetary Policy (5)
    { series_id: 'FEDFUNDS', title: 'Federal Funds Rate', category: 'Monetary Policy' as const, type: 'Coincident' as const, display_unit: 'percent' },
    { series_id: 'DGS10', title: '10-Year Treasury Yield', category: 'Monetary Policy' as const, type: 'Leading' as const, display_unit: 'percent' },
    { series_id: 'T10Y2Y', title: 'Yield Curve (10yr-2yr)', category: 'Monetary Policy' as const, type: 'Leading' as const, display_unit: 'basis_points' },
    { series_id: 'MORTGAGE30US', title: '30-Year Fixed Mortgage Rate', category: 'Monetary Policy' as const, type: 'Leading' as const, display_unit: 'percent' },
    { series_id: 'BUSLOANS', title: 'Commercial & Industrial Loans', category: 'Monetary Policy' as const, type: 'Coincident' as const, display_unit: 'billions_dollars' },

    // Sentiment (2)
    { series_id: 'UMCSENT', title: 'Michigan Consumer Sentiment', category: 'Sentiment' as const, type: 'Leading' as const, display_unit: 'index' },
    { series_id: 'CSCICP03USM665S', title: 'Consumer Confidence Index', category: 'Sentiment' as const, type: 'Leading' as const, display_unit: 'index' },
    { series_id: 'PSAVERT', title: 'Personal Savings Rate', category: 'Sentiment' as const, type: 'Lagging' as const, display_unit: 'percent' }
  ];

  constructor() {
    this.apiKey = process.env.FRED_API_KEY || 'afa2c5a53a8116fe3a6c6fb339101ca1';
    if (!this.apiKey) {
      logger.warn('FRED API key not provided. FRED service will not function.');
    }
  }

  /**
   * Get latest observation for a specific FRED series
   */
  async getLatestObservation(seriesId: string): Promise<{value: string, date: string} | null> {
    try {
      const url = `${this.baseUrl}/series/observations?series_id=${seriesId}&api_key=${this.apiKey}&file_type=json&limit=1&sort_order=desc`;
      const response = await fetch(url);
      
      if (!response.ok) {
        logger.error(`FRED API error for ${seriesId}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      if (data.observations && data.observations.length > 0) {
        const latest = data.observations[0];
        return {
          value: latest.value,
          date: latest.date
        };
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to fetch latest observation for ${seriesId}:`, error);
      return null;
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
          // For YoY calculations, we need at least 13 months of data (current + 12 months ago)
          const limit = (indicator.title.includes('(YoY)') || indicator.display_unit === 'index_yoy') ? 15 : 3;
          const data = await this.fetchSeriesData(indicator.series_id, limit);
          
          if (data && data.length > 0) {
            const current = data[0];
            const previous = data[1];
            
            // For YoY calculations, find data from 12 months ago
            let yearAgo = null;
            if (indicator.title.includes('(YoY)') && data.length >= 13) {
              // Find data from approximately 12 months ago
              yearAgo = data[12]; // 12 months ago
              logger.debug(`YoY calculation for ${indicator.title}: Current=${current.value} (${current.date}), YearAgo=${yearAgo.value} (${yearAgo.date})`);
            }
            
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
            
            // Calculate proper values based on display_unit
            const currentVal = parseFloat(current.value);
            const previousVal = previous ? parseFloat(previous.value) : undefined;
            
            let formattedCurrent: string;
            let formattedPrevious: string;
            let vsPrior: string;
            
            // Handle YoY calculations for specific indicators that need it
            if (indicator.title.includes('(YoY)')) {
              if (yearAgo && yearAgo.value !== '.' && current.value !== '.') {
                const currentVal = parseFloat(current.value);
                const yearAgoVal = parseFloat(yearAgo.value);
                
                if (!isNaN(currentVal) && !isNaN(yearAgoVal) && yearAgoVal !== 0) {
                  // Calculate proper YoY percentage change
                  const yoyChange = ((currentVal - yearAgoVal) / yearAgoVal) * 100;
                  formattedCurrent = `${yoyChange.toFixed(1)}%`;
                  
                  // Calculate previous period YoY if possible
                  if (previous && data[13] && previous.value !== '.' && data[13].value !== '.') {
                    const prevVal = parseFloat(previous.value);
                    const prevYearAgoVal = parseFloat(data[13].value);
                    if (!isNaN(prevVal) && !isNaN(prevYearAgoVal) && prevYearAgoVal !== 0) {
                      const prevYoyChange = ((prevVal - prevYearAgoVal) / prevYearAgoVal) * 100;
                      formattedPrevious = `${prevYoyChange.toFixed(1)}%`;
                      vsPrior = `${(yoyChange - prevYoyChange > 0 ? '+' : '')}${(yoyChange - prevYoyChange).toFixed(1)}%`;
                    } else {
                      formattedPrevious = 'N/A';
                      vsPrior = `${yoyChange.toFixed(1)}%`;
                    }
                  } else {
                    formattedPrevious = 'N/A';
                    vsPrior = `${yoyChange.toFixed(1)}%`;
                  }
                } else {
                  formattedCurrent = '0.0%';
                  formattedPrevious = 'N/A';
                  vsPrior = '0%';
                }
              } else {
                formattedCurrent = 'N/A';
                formattedPrevious = 'N/A';
                vsPrior = 'N/A';
              }
            } else {
              // Format based on display_unit
              switch (indicator.display_unit) {
                case 'percent':
                  formattedCurrent = `${currentVal.toFixed(1)}%`;
                  formattedPrevious = previousVal ? `${previousVal.toFixed(1)}%` : 'N/A';
                  vsPrior = previousVal ? `${(currentVal - previousVal > 0 ? '+' : '')}${(currentVal - previousVal).toFixed(1)}%` : '0%';
                  break;
                case 'thousands':
                  // Handle large numbers in thousands - convert to appropriate units
                  if (currentVal >= 1000000) {
                    // Values in millions (like 3930000 -> 3.93M)
                    formattedCurrent = `${(currentVal / 1000000).toFixed(2)}M`;
                    formattedPrevious = previousVal ? `${(previousVal / 1000000).toFixed(2)}M` : 'N/A';
                    vsPrior = previousVal ? `${((currentVal - previousVal) / 1000000 > 0 ? '+' : '')}${((currentVal - previousVal) / 1000000).toFixed(2)}M` : '0M';
                  } else if (currentVal >= 1000) {
                    // Values in thousands (like 1321 -> 1321K or 1.32M)
                    if (currentVal >= 10000) {
                      formattedCurrent = `${(currentVal / 1000).toFixed(0)}K`;
                      formattedPrevious = previousVal ? `${(previousVal / 1000).toFixed(0)}K` : 'N/A';
                      vsPrior = previousVal ? `${((currentVal - previousVal) / 1000 > 0 ? '+' : '')}${((currentVal - previousVal) / 1000).toFixed(0)}K` : '0K';
                    } else {
                      formattedCurrent = `${currentVal.toFixed(0)}K`;
                      formattedPrevious = previousVal ? `${previousVal.toFixed(0)}K` : 'N/A';
                      vsPrior = previousVal ? `${(currentVal - previousVal > 0 ? '+' : '')}${(currentVal - previousVal).toFixed(0)}K` : '0K';
                    }
                  } else {
                    formattedCurrent = `${currentVal.toFixed(0)}K`;
                    formattedPrevious = previousVal ? `${previousVal.toFixed(0)}K` : 'N/A';
                    vsPrior = previousVal ? `${(currentVal - previousVal > 0 ? '+' : '')}${(currentVal - previousVal).toFixed(0)}K` : '0K';
                  }
                  break;
                case 'millions_dollars':
                  // Convert millions to billions for display (311848 millions -> 311.8B)
                  formattedCurrent = `${(currentVal / 1000).toFixed(1)}B`;
                  formattedPrevious = previousVal ? `${(previousVal / 1000).toFixed(1)}B` : 'N/A';
                  vsPrior = previousVal ? `${((currentVal - previousVal) / 1000 > 0 ? '+' : '')}${((currentVal - previousVal) / 1000).toFixed(1)}B` : '0B';
                  break;
                case 'index':
                  formattedCurrent = currentVal.toFixed(1);
                  formattedPrevious = previousVal ? previousVal.toFixed(1) : 'N/A';
                  vsPrior = previousVal ? `${(currentVal - previousVal > 0 ? '+' : '')}${(currentVal - previousVal).toFixed(1)}` : '0';
                  break;
                case 'index_yoy':
                  // Calculate YoY for index values - need 12+ months of data
                  if (data.length >= 13) {
                    const yearAgoData = data[12]; // Approximately 12 months ago
                    if (yearAgoData && yearAgoData.value !== '.' && current.value !== '.') {
                      const currentVal = parseFloat(current.value);
                      const yearAgoVal = parseFloat(yearAgoData.value);
                      
                      if (!isNaN(currentVal) && !isNaN(yearAgoVal) && yearAgoVal !== 0) {
                        const yoyChange = ((currentVal - yearAgoVal) / yearAgoVal) * 100;
                        formattedCurrent = `${yoyChange.toFixed(2)}%`;
                        
                        // Calculate previous period YoY if possible
                        if (previous && data[13] && previous.value !== '.' && data[13].value !== '.') {
                          const prevVal = parseFloat(previous.value);
                          const prevYearAgoVal = parseFloat(data[13].value);
                          if (!isNaN(prevVal) && !isNaN(prevYearAgoVal) && prevYearAgoVal !== 0) {
                            const prevYoyChange = ((prevVal - prevYearAgoVal) / prevYearAgoVal) * 100;
                            formattedPrevious = `${prevYoyChange.toFixed(2)}%`;
                            vsPrior = `${(yoyChange - prevYoyChange > 0 ? '+' : '')}${(yoyChange - prevYoyChange).toFixed(2)}%`;
                          } else {
                            formattedPrevious = 'N/A';
                            vsPrior = `${yoyChange.toFixed(2)}%`;
                          }
                        } else {
                          formattedPrevious = 'N/A';
                          vsPrior = `${yoyChange.toFixed(2)}%`;
                        }
                      } else {
                        formattedCurrent = '0.00%';
                        formattedPrevious = 'N/A';
                        vsPrior = '0.00%';
                      }
                    } else {
                      formattedCurrent = 'N/A';
                      formattedPrevious = 'N/A';
                      vsPrior = 'N/A';
                    }
                  } else {
                    // Not enough data for YoY calculation
                    formattedCurrent = 'N/A';
                    formattedPrevious = 'N/A';
                    vsPrior = 'N/A';
                  }
                  break;
                case 'basis_points':
                  // Format basis points without any suffix for clean display
                  if (currentVal < 0) {
                    formattedCurrent = `(${Math.abs(currentVal).toFixed(1)})`;
                  } else {
                    formattedCurrent = `${currentVal.toFixed(1)}`;
                  }
                  
                  if (previousVal !== undefined && previousVal !== null) {
                    if (previousVal < 0) {
                      formattedPrevious = `(${Math.abs(previousVal).toFixed(1)})`;
                    } else {
                      formattedPrevious = `${previousVal.toFixed(1)}`;
                    }
                    
                    const variance = currentVal - previousVal;
                    if (variance < 0) {
                      vsPrior = `(${Math.abs(variance).toFixed(1)})`;
                    } else {
                      vsPrior = `${variance.toFixed(1)}`;
                    }
                  } else {
                    formattedPrevious = 'N/A';
                    vsPrior = '0';
                  }
                  break;
                default:
                  formattedCurrent = currentVal.toFixed(2);
                  formattedPrevious = previousVal ? previousVal.toFixed(2) : 'N/A';
                  vsPrior = previousVal ? `${(currentVal - previousVal > 0 ? '+' : '')}${(currentVal - previousVal).toFixed(2)}` : '0';
              }
            }

            indicators.push({
              series_id: indicator.series_id,
              title: indicator.title,
              current_value: formattedCurrent,
              date: current.date,
              previous_value: formattedPrevious,
              previous_raw_value: previousVal,
              change,
              change_percent: changePercent,
              units: formattedCurrent.includes('%') ? '%' : (formattedCurrent.includes('K') ? 'K' : (formattedCurrent.includes('$') ? '$' : (indicator.display_unit === 'basis_points' ? '' : ''))),
              frequency: 'Monthly',
              last_updated: new Date().toISOString(),
              category: indicator.category,
              type: indicator.type
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
        current_value: current.value,
        date: current.date,
        previous_value: previous ? previous.value : undefined,
        change,
        change_percent: changePercent,
        units: indicatorMeta?.display_unit || '',
        frequency: 'Monthly',
        last_updated: new Date().toISOString(),
        category: indicatorMeta?.category || 'Growth',
        type: indicatorMeta?.type || 'Coincident'
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