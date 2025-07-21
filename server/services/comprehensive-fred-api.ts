import fetch from 'node-fetch';

export interface FredEconomicIndicator {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  latestValue: string;
  latestDate: string;
  previousValue?: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  monthlyChange?: string;
  annualChange?: string;
}

export class ComprehensiveFredApiService {
  private static instance: ComprehensiveFredApiService;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.stlouisfed.org/fred';
  private cachedIndicators: FredEconomicIndicator[] = [];
  private lastCacheTime: Date | null = null;
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

  constructor() {
    this.apiKey = process.env.FRED_API_KEY || '8ee191f722494cd7a917d5a1ae67c42c';
    if (!this.apiKey) {
      throw new Error('FRED API key is required');
    }
  }

  static getInstance(): ComprehensiveFredApiService {
    if (!ComprehensiveFredApiService.instance) {
      ComprehensiveFredApiService.instance = new ComprehensiveFredApiService();
    }
    return ComprehensiveFredApiService.instance;
  }

  private isCacheValid(): boolean {
    if (!this.lastCacheTime || this.cachedIndicators.length === 0) {
      return false;
    }
    return Date.now() - this.lastCacheTime.getTime() < this.CACHE_DURATION;
  }

  private async makeRequest(endpoint: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('file_type', 'json');
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getSeriesData(seriesId: string, limit: number = 12): Promise<any[]> {
    try {
      const data = await this.makeRequest('series/observations', {
        series_id: seriesId,
        limit: limit.toString(),
        sort_order: 'desc'
      });

      return data.observations || [];
    } catch (error) {
      console.error(`Error fetching FRED series ${seriesId}:`, error);
      return [];
    }
  }

  async getComprehensiveEconomicIndicators(): Promise<FredEconomicIndicator[]> {
    console.log('📊 Fetching comprehensive FRED economic indicators (50+ indicators)...');
    
    // Check cache first
    if (this.isCacheValid()) {
      console.log('📋 Using cached FRED data');
      return this.cachedIndicators;
    }

    const allIndicators = [
      // ========== EMPLOYMENT (12 indicators) ==========
      { 
        seriesId: 'PAYEMS', title: 'Nonfarm Payrolls', units: 'Thousands of Persons',
        category: 'employment', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'UNRATE', title: 'Unemployment Rate', units: 'Percent',
        category: 'employment', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'ICSA', title: 'Initial Jobless Claims', units: 'Number',
        category: 'employment', importance: 'high' as const, frequency: 'Weekly'
      },
      { 
        seriesId: 'CCSA', title: 'Continuing Claims', units: 'Number',
        category: 'employment', importance: 'medium' as const, frequency: 'Weekly'
      },
      { 
        seriesId: 'JTSJOL', title: 'JOLTS Job Openings', units: 'Thousands',
        category: 'employment', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'JTSQUR', title: 'JOLTS Quit Rate', units: 'Percent',
        category: 'employment', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'CES0500000003', title: 'Average Hourly Earnings', units: 'Dollars per Hour',
        category: 'employment', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'EMRATIO', title: 'Employment Population Ratio', units: 'Percent',
        category: 'employment', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'CIVPART', title: 'Labor Force Participation Rate', units: 'Percent',
        category: 'employment', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'JTSHIR', title: 'JOLTS Hires Rate', units: 'Percent',
        category: 'employment', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'U6RATE', title: 'U-6 Unemployment Rate', units: 'Percent',
        category: 'employment', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'AWHMAN', title: 'Average Weekly Hours Manufacturing', units: 'Hours',
        category: 'employment', importance: 'low' as const, frequency: 'Monthly'
      },

      // ========== INFLATION (8 indicators) ==========
      { 
        seriesId: 'CPIAUCSL', title: 'Consumer Price Index', units: 'Index 1982-84=100',
        category: 'inflation', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'CPILFESL', title: 'Core CPI', units: 'Index 1982-84=100',
        category: 'inflation', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'PPIACO', title: 'Producer Price Index', units: 'Index 1982=100',
        category: 'inflation', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'PPIFCG', title: 'Core PPI', units: 'Index 1982=100',
        category: 'inflation', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'PCE', title: 'Personal Consumption Expenditures', units: 'Billions of Dollars',
        category: 'inflation', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'PCEPILFE', title: 'Core PCE Price Index', units: 'Index 2012=100',
        category: 'inflation', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'GASREGW', title: 'U.S. Regular Gasoline Prices', units: 'Dollars per Gallon',
        category: 'inflation', importance: 'medium' as const, frequency: 'Weekly'
      },
      { 
        seriesId: 'CUUS0000SA0L1E', title: 'CPI Energy', units: 'Index 1982-84=100',
        category: 'inflation', importance: 'medium' as const, frequency: 'Monthly'
      },

      // ========== CONSUMER SPENDING & RETAIL (8 indicators) ==========
      { 
        seriesId: 'RSAFS', title: 'Retail Sales', units: 'Millions of Dollars',
        category: 'consumer_spending', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'RSFSXMV', title: 'Retail Sales Ex Auto', units: 'Millions of Dollars',
        category: 'consumer_spending', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'DPSACBW027SBEA', title: 'Personal Consumption Expenditures', units: 'Billions of Dollars',
        category: 'consumer_spending', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'PSAVERT', title: 'Personal Saving Rate', units: 'Percent',
        category: 'consumer_spending', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'DSPIC96', title: 'Real Disposable Personal Income', units: 'Chained 2012 Dollars',
        category: 'consumer_spending', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'ACDGNO', title: 'Consumer Durable Goods New Orders', units: 'Millions of Dollars',
        category: 'consumer_spending', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'RSXFS', title: 'Retail Sales: Food Services', units: 'Millions of Dollars',
        category: 'consumer_spending', importance: 'low' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'ECOMSA', title: 'E-commerce Retail Sales', units: 'Millions of Dollars',
        category: 'consumer_spending', importance: 'medium' as const, frequency: 'Quarterly'
      },

      // ========== HOUSING (8 indicators) ==========
      { 
        seriesId: 'HOUST', title: 'Housing Starts', units: 'Thousands of Units',
        category: 'housing', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'PERMIT', title: 'Building Permits', units: 'Thousands of Units',
        category: 'housing', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'NHSUSSPT', title: 'New Home Sales', units: 'Thousands of Units',
        category: 'housing', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'EXHOSLUSM495S', title: 'Existing Home Sales', units: 'Thousands of Units',
        category: 'housing', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'CSUSHPISA', title: 'Case-Shiller Home Price Index', units: 'Index Jan 2000=100',
        category: 'housing', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'MORTGAGE30US', title: '30-Year Fixed Rate Mortgage', units: 'Percent',
        category: 'housing', importance: 'medium' as const, frequency: 'Weekly'
      },
      { 
        seriesId: 'MSACSR', title: 'Months Supply of Houses', units: 'Months',
        category: 'housing', importance: 'low' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'TTLCONS', title: 'Total Construction Spending', units: 'Millions of Dollars',
        category: 'housing', importance: 'medium' as const, frequency: 'Monthly'
      },

      // ========== MANUFACTURING & PRODUCTION (8 indicators) ==========
      { 
        seriesId: 'INDPRO', title: 'Industrial Production', units: 'Index 2017=100',
        category: 'manufacturing', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'TCU', title: 'Capacity Utilization', units: 'Percent',
        category: 'manufacturing', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'NEWORDER', title: 'New Orders for Durable Goods', units: 'Millions of Dollars',
        category: 'manufacturing', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'NAPMEI', title: 'Empire State Manufacturing Survey', units: 'Diffusion Index',
        category: 'manufacturing', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'NAPMPI', title: 'Philadelphia Fed Business Index', units: 'Diffusion Index',
        category: 'manufacturing', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'GACDISA066MSFRBCHI', title: 'Chicago Fed National Activity Index', units: 'Index',
        category: 'manufacturing', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'BUSLOANS', title: 'Commercial and Industrial Loans', units: 'Billions of Dollars',
        category: 'manufacturing', importance: 'low' as const, frequency: 'Weekly'
      },
      { 
        seriesId: 'INDDRO01USM665S', title: 'New Orders Manufacturing', units: 'Index 2015=100',
        category: 'manufacturing', importance: 'medium' as const, frequency: 'Monthly'
      },

      // ========== SENTIMENT & CONFIDENCE (6 indicators) ==========
      { 
        seriesId: 'UMCSENT', title: 'University of Michigan Consumer Sentiment', units: 'Index 1966Q1=100',
        category: 'sentiment', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'CSCICP03USM665S', title: 'Consumer Confidence Index', units: 'Index 1985=100',
        category: 'sentiment', importance: 'high' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'NASBPI', title: 'NFIB Small Business Optimism Index', units: 'Index',
        category: 'sentiment', importance: 'medium' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'INVEST', title: 'Business Investment', units: 'Billions of Dollars',
        category: 'sentiment', importance: 'medium' as const, frequency: 'Quarterly'
      },
      { 
        seriesId: 'UNAMEMP', title: 'Employment Expectations', units: 'Index',
        category: 'sentiment', importance: 'low' as const, frequency: 'Monthly'
      },
      { 
        seriesId: 'DEXUSEU', title: 'Dollar Euro Exchange Rate', units: 'US Dollars to One Euro',
        category: 'sentiment', importance: 'medium' as const, frequency: 'Daily'
      }
    ];

    console.log(`🚀 Fetching ${allIndicators.length} FRED indicators from official U.S. government data...`);

    const indicators: FredEconomicIndicator[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the API

    for (let i = 0; i < allIndicators.length; i += batchSize) {
      const batch = allIndicators.slice(i, i + batchSize);
      const batchPromises = batch.map(async (indicator) => {
        try {
          const observations = await this.getSeriesData(indicator.seriesId, 3);
          
          if (observations.length === 0) {
            return null;
          }

          const latest = observations[0];
          const previous = observations[1];
          
          // Calculate percentage changes where applicable
          let monthlyChange: string | undefined;
          let annualChange: string | undefined;
          
          if (previous && latest.value !== '.' && previous.value !== '.') {
            const latestVal = parseFloat(latest.value);
            const prevVal = parseFloat(previous.value);
            
            if (!isNaN(latestVal) && !isNaN(prevVal) && prevVal !== 0) {
              const change = ((latestVal - prevVal) / prevVal) * 100;
              monthlyChange = change.toFixed(2) + '%';
            }
          }

          // For annual change, use observation from 12 months ago if available
          if (observations.length >= 12) {
            const yearAgo = observations[11];
            if (yearAgo && latest.value !== '.' && yearAgo.value !== '.') {
              const latestVal = parseFloat(latest.value);
              const yearVal = parseFloat(yearAgo.value);
              
              if (!isNaN(latestVal) && !isNaN(yearVal) && yearVal !== 0) {
                const change = ((latestVal - yearVal) / yearVal) * 100;
                annualChange = change.toFixed(2) + '%';
              }
            }
          }

          return {
            seriesId: indicator.seriesId,
            title: indicator.title,
            units: indicator.units,
            frequency: indicator.frequency,
            category: indicator.category,
            importance: indicator.importance,
            latestValue: this.formatValue(latest.value, indicator.category),
            latestDate: latest.date,
            previousValue: previous ? this.formatValue(previous.value, indicator.category) : undefined,
            monthlyChange,
            annualChange
          };
        } catch (error) {
          console.error(`Error fetching ${indicator.seriesId}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      indicators.push(...batchResults.filter(Boolean) as FredEconomicIndicator[]);
      
      // Small delay between batches to be respectful to FRED API
      if (i + batchSize < allIndicators.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Cache the results
    this.cachedIndicators = indicators;
    this.lastCacheTime = new Date();

    console.log(`✅ Successfully fetched ${indicators.length} FRED economic indicators`);
    console.log(`📊 Categories: ${Array.from(new Set(indicators.map(i => i.category))).join(', ')}`);
    console.log(`🔥 High importance: ${indicators.filter(i => i.importance === 'high').length}`);
    
    return indicators;
  }

  private formatValue(value: string, category: string): string {
    if (value === '.' || !value) return 'N/A';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;

    // Format based on category and magnitude
    if (category === 'employment' && numValue > 1000) {
      return (numValue / 1000).toFixed(1) + 'K';
    }
    
    if (numValue > 1000000) {
      return (numValue / 1000000).toFixed(1) + 'M';
    }
    
    if (numValue > 1000) {
      return (numValue / 1000).toFixed(1) + 'K';
    }
    
    return numValue.toFixed(2);
  }

  async getIndicatorsByCategory(category: string): Promise<FredEconomicIndicator[]> {
    const allIndicators = await this.getComprehensiveEconomicIndicators();
    return allIndicators.filter(indicator => indicator.category === category);
  }

  async getHighImportanceIndicators(): Promise<FredEconomicIndicator[]> {
    const allIndicators = await this.getComprehensiveEconomicIndicators();
    return allIndicators.filter(indicator => indicator.importance === 'high');
  }

  clearCache(): void {
    this.cachedIndicators = [];
    this.lastCacheTime = null;
    console.log('🗑️ FRED API cache cleared');
  }
}

export const comprehensiveFredApiService = ComprehensiveFredApiService.getInstance();