import fetch from 'node-fetch';

export interface FredDataPoint {
  date: string;
  value: string;
}

export interface FredEconomicIndicator {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  latestValue: string;
  latestDate: string;
  previousValue?: string;
}

export class FredApiService {
  private static instance: FredApiService;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.stlouisfed.org/fred';

  constructor() {
    this.apiKey = process.env.FRED_API_KEY || '8ee191f722494cd7a917d5a1ae67c42c';
    if (!this.apiKey) {
      throw new Error('FRED API key is required');
    }
  }

  static getInstance(): FredApiService {
    if (!FredApiService.instance) {
      FredApiService.instance = new FredApiService();
    }
    return FredApiService.instance;
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

  async getSeriesData(seriesId: string, limit: number = 2): Promise<FredDataPoint[]> {
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

  async getLatestEconomicIndicators(): Promise<FredEconomicIndicator[]> {
    const indicators = [
      // Core Economic Indicators
      { seriesId: 'CPIAUCSL', title: 'Consumer Price Index', units: 'Index 1982-84=100' },
      { seriesId: 'CPILFESL', title: 'Core CPI', units: 'Index 1982-84=100' },
      { seriesId: 'PPIACO', title: 'Producer Price Index', units: 'Index 1982=100' },
      { seriesId: 'PPIFCG', title: 'Core PPI', units: 'Index 1982=100' },
      
      // Employment Data
      { seriesId: 'UNRATE', title: 'Unemployment Rate', units: 'Percent' },
      { seriesId: 'PAYEMS', title: 'Nonfarm Payrolls', units: 'Thousands of Persons' },
      { seriesId: 'ICSA', title: 'Initial Jobless Claims', units: 'Number' },
      { seriesId: 'JTSJOL', title: 'JOLTS Job Openings', units: 'Thousands' },
      
      // Retail and Manufacturing
      { seriesId: 'RSAFS', title: 'Retail Sales', units: 'Millions of Dollars' },
      { seriesId: 'INDPRO', title: 'Industrial Production Index', units: 'Index 2017=100' },
      { seriesId: 'NAPM', title: 'ISM Manufacturing PMI', units: 'Index' },
      
      // Housing Data
      { seriesId: 'HOUST', title: 'Housing Starts', units: 'Thousands of Units' },
      { seriesId: 'NHSUSSPT', title: 'New Home Sales', units: 'Thousands of Units' },
      { seriesId: 'NAHB', title: 'NAHB Housing Market Index', units: 'Index' },
      
      // Regional Fed Surveys
      { seriesId: 'NAPMEI', title: 'Empire State Manufacturing Survey', units: 'Diffusion Index' },
      { seriesId: 'NAPMPI', title: 'Philadelphia Fed Business Index', units: 'Diffusion Index' }
    ];

    const results: FredEconomicIndicator[] = [];

    for (const indicator of indicators) {
      try {
        const data = await this.getSeriesData(indicator.seriesId, 2);
        if (data.length > 0) {
          const latest = data[0];
          const previous = data.length > 1 ? data[1] : undefined;
          
          results.push({
            seriesId: indicator.seriesId,
            title: indicator.title,
            units: indicator.units,
            frequency: 'Monthly', // Most FRED series are monthly
            latestValue: latest.value,
            latestDate: latest.date,
            previousValue: previous?.value
          });
        }
      } catch (error) {
        console.error(`Failed to fetch ${indicator.title}:`, error);
      }
    }

    return results;
  }

  async updateEconomicEvent(eventTitle: string): Promise<{ actual: string | null; impact: string | null }> {
    try {
      const titleLower = eventTitle.toLowerCase();
      let seriesId: string | null = null;
      let valueTransform: (value: string, previous?: string) => string = (v) => v;

      // Map event titles to FRED series IDs
      if (titleLower.includes('consumer price index') || titleLower.includes('cpi')) {
        if (titleLower.includes('core')) {
          seriesId = 'CPILFESL';
        } else {
          seriesId = 'CPIAUCSL';
        }
        valueTransform = (current, previous) => {
          if (previous) {
            const pct = ((parseFloat(current) - parseFloat(previous)) / parseFloat(previous) * 100);
            return `${pct.toFixed(1)}%`;
          }
          return current;
        };
      } else if (titleLower.includes('producer price index') || titleLower.includes('ppi')) {
        if (titleLower.includes('core')) {
          seriesId = 'PPIFCG';
        } else {
          seriesId = 'PPIACO';
        }
        valueTransform = (current, previous) => {
          if (previous) {
            const pct = ((parseFloat(current) - parseFloat(previous)) / parseFloat(previous) * 100);
            return `${pct.toFixed(1)}%`;
          }
          return current;
        };
      } else if (titleLower.includes('retail sales')) {
        seriesId = 'RSAFS';
        valueTransform = (current, previous) => {
          if (previous) {
            const pct = ((parseFloat(current) - parseFloat(previous)) / parseFloat(previous) * 100);
            return `${pct.toFixed(1)}%`;
          }
          return current;
        };
      } else if (titleLower.includes('industrial production')) {
        seriesId = 'INDPRO';
        valueTransform = (current, previous) => {
          if (previous) {
            const pct = ((parseFloat(current) - parseFloat(previous)) / parseFloat(previous) * 100);
            return `${pct.toFixed(1)}%`;
          }
          return current;
        };
      } else if (titleLower.includes('housing starts')) {
        seriesId = 'HOUST';
        valueTransform = (current) => {
          const millions = parseFloat(current) / 1000;
          return `${millions.toFixed(2)}M`;
        };
      } else if (titleLower.includes('jobless claims') || titleLower.includes('initial claims')) {
        seriesId = 'ICSA';
        valueTransform = (current) => {
          const thousands = Math.round(parseFloat(current));
          return `${thousands.toLocaleString()}`;
        };
      } else if (titleLower.includes('jolts') || titleLower.includes('job openings')) {
        seriesId = 'JTSJOL';
        valueTransform = (current) => {
          const millions = parseFloat(current) / 1000;
          return `${millions.toFixed(2)}M`;
        };
      } else if (titleLower.includes('empire state')) {
        seriesId = 'NAPMEI';
      } else if (titleLower.includes('philadelphia fed')) {
        seriesId = 'NAPMPI';
      } else if (titleLower.includes('new home sales') || titleLower.includes('new residential sales')) {
        seriesId = 'NHSUSSPT';
        valueTransform = (current) => {
          const thousands = Math.round(parseFloat(current));
          return `${thousands}K`;
        };
      }

      if (!seriesId) {
        console.log(`No FRED mapping found for event: ${eventTitle}`);
        return { actual: null, impact: null };
      }

      const data = await this.getSeriesData(seriesId, 2);
      if (data.length === 0) {
        return { actual: null, impact: null };
      }

      const latest = data[0];
      const previous = data.length > 1 ? data[1] : undefined;
      const actual = valueTransform(latest.value, previous?.value);

      // Calculate impact based on data trend
      let impact = 'neutral';
      if (previous) {
        const current = parseFloat(latest.value);
        const prev = parseFloat(previous.value);
        const change = ((current - prev) / prev) * 100;
        
        if (Math.abs(change) < 0.1) {
          impact = 'neutral';
        } else if (change > 0.5) {
          impact = 'very_positive';
        } else if (change > 0.1) {
          impact = 'positive';
        } else if (change < -0.5) {
          impact = 'negative';
        } else {
          impact = 'slightly_negative';
        }
      }

      console.log(`✅ FRED update for ${eventTitle}: ${actual} (${impact})`);
      return { actual, impact };
    } catch (error) {
      console.error(`Error updating event ${eventTitle} with FRED data:`, error);
      return { actual: null, impact: null };
    }
  }
}

export const fredApiService = FredApiService.getInstance();