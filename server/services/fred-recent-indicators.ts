import axios from 'axios';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface FREDObservation {
  date: string;
  value: string;
  realtime_start: string;
  realtime_end: string;
}

interface FREDSeriesResponse {
  observations: FREDObservation[];
}

interface FREDSeriesInfo {
  id: string;
  title: string;
  units: string;
  frequency: string;
  seasonal_adjustment: string;
}

interface EconomicIndicator {
  series_id: string;
  title: string;
  latest: number;
  latest_date: string;
  prior: number | null;
  prior_date: string | null;
  units: string;
  change: number | null;
  change_percent: number | null;
}

export class FREDRecentIndicatorsService {
  private readonly fredApiKey: string;
  private readonly baseUrl = 'https://api.stlouisfed.org';
  
  // Curated series for comprehensive economic indicator display
  private readonly CURATED_SERIES = [
    "CPIAUCSL",           // Consumer Price Index
    "CPILFESL",           // Core CPI  
    "PPIACO",             // Producer Price Index
    "A191RL1Q225SBEA",    // GDP Growth Rate
    "ICSA",               // Initial Claims
    "CCSA",               // Continued Claims
    "UNRATE",             // Unemployment Rate
    "PAYEMS",             // Nonfarm Payrolls
    "RSAFS",              // Retail Sales
    "DGORDER",            // Durable Goods Orders
    "INDPRO",             // Industrial Production
    "UMCSENT",            // Consumer Sentiment
    "HOUST",              // Housing Starts
    "HSN1F",              // New Home Sales
    "EXHOSLUSM495S",      // Existing Home Sales
    "PCEPI",              // PCE Price Index YoY
    "NAPMIMFG",           // Manufacturing PMI
    "PMICM",              // S&P Global Manufacturing PMI
    "FEDFUNDS",           // Federal Funds Rate
    "DGS10",              // 10-Year Treasury Yield
    "T10Y2Y",             // Yield Curve (10yr-2yr)
    "CSCICP03USM665S",    // Consumer Confidence Index
    "RSXFS",              // Retail Sales MoM
    "PERMIT",             // Building Permits
    "USSLIND"             // Leading Economic Index
  ];

  constructor() {
    // Use the working API key provided by user
    this.fredApiKey = '47754b00af9343542dd99533202f983a';
    console.log('FRED API Key being used:', this.fredApiKey.substring(0, 8) + '...');
  }

  // Step 1: Get Curated Series IDs (replaces most recently updated approach)
  async getCuratedFREDSeries(limit: number = 6): Promise<string[]> {
    // Return first 'limit' series from comprehensive curated list of 25 indicators
    return this.CURATED_SERIES.slice(0, limit);
  }

  // Step 2: Get Series Metadata (Title, Units)
  async getSeriesMetadata(seriesId: string): Promise<FREDSeriesInfo | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/fred/series`, {
        params: {
          series_id: seriesId,
          api_key: this.fredApiKey,
          file_type: 'json'
        }
      });

      const seriesInfo = response.data?.seriess || [];
      return seriesInfo[0] || null;
    } catch (error) {
      console.error(`Error fetching metadata for ${seriesId}:`, error);
      return null;
    }
  }

  // Step 3: Get Recent Observations
  async getRecentObservations(seriesId: string): Promise<EconomicIndicator | null> {
    try {
      const [observationsResponse, metadata] = await Promise.all([
        axios.get(`${this.baseUrl}/fred/series/observations`, {
          params: {
            series_id: seriesId,
            api_key: this.fredApiKey,
            file_type: 'json',
            sort_order: 'desc',
            limit: 2
          }
        }),
        this.getSeriesMetadata(seriesId)
      ]);

      const observations = observationsResponse.data?.observations || [];
      
      if (observations.length === 0 || !metadata) {
        return null;
      }

      const latest = observations[0];
      const prior = observations[1] || null;

      const latestValue = parseFloat(latest.value);
      const priorValue = prior ? parseFloat(prior.value) : null;

      let change: number | null = null;
      let changePercent: number | null = null;

      if (priorValue !== null && !isNaN(latestValue) && !isNaN(priorValue)) {
        change = latestValue - priorValue;
        changePercent = (change / priorValue) * 100;
      }

      return {
        series_id: seriesId,
        title: metadata.title,
        latest: latestValue,
        latest_date: latest.date,
        prior: priorValue,
        prior_date: prior?.date || null,
        units: metadata.units,
        change,
        change_percent: changePercent
      };
    } catch (error) {
      console.error(`Error fetching observations for ${seriesId}:`, error);
      return null;
    }
  }

  // Step 4: Build GPT Prompt
  private generateGPTPrompt(economicData: EconomicIndicator[]): string {
    let prompt = "You are a macroeconomic analyst. Analyze the following 6 most recently updated U.S. economic indicators from the Federal Reserve Economic Data (FRED):\n\n";
    
    economicData.forEach((indicator, index) => {
      const changeText = indicator.change !== null ? 
        `(Change: ${indicator.change > 0 ? '+' : ''}${indicator.change.toFixed(2)} ${indicator.units})` : '';
      
      prompt += `${index + 1}. ${indicator.title} (${indicator.series_id}): ${indicator.latest} ${indicator.units} on ${indicator.latest_date}`;
      
      if (indicator.prior !== null) {
        prompt += ` (Previous: ${indicator.prior} on ${indicator.prior_date}) ${changeText}`;
      }
      
      prompt += '\n';
    });

    prompt += "\nProvide a concise analysis in exactly 6 bullet points, each focusing on one indicator. Format each as: '• Indicator Name: Brief analysis with economic implications'. Keep each bullet under 25 words and focus on what the latest reading means for the economy.";
    
    return prompt;
  }

  // Step 5: GPT Analysis
  private async analyzeWithOpenAI(prompt: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: 'system',
            content: 'You are a professional macroeconomic analyst focusing on recent Federal Reserve economic data. Provide clear, concise analysis suitable for financial professionals.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      return response.choices[0].message.content || 'Analysis unavailable';
    } catch (error) {
      console.error('Error generating OpenAI analysis:', error);
      return 'Economic analysis temporarily unavailable. The indicators show recent Federal Reserve data updates.';
    }
  }

  // Main Pipeline
  async getRecentEconomicReadings(): Promise<{ indicators: EconomicIndicator[], analysis: string }> {
    try {
      console.log('🏦 Fetching curated economic indicators from FRED...');
      
      // Get 6 curated series instead of most recently updated
      const seriesIds = await this.getCuratedFREDSeries(6);
      
      if (seriesIds.length === 0) {
        throw new Error('No curated FRED series found');
      }

      console.log(`📊 Processing ${seriesIds.length} curated FRED series:`, seriesIds);

      // Get detailed data for each series
      const economicDataPromises = seriesIds.map((id: string) => this.getRecentObservations(id));
      const economicDataResults = await Promise.all(economicDataPromises);
      
      // Filter out null results
      const validEconomicData = economicDataResults.filter((data: EconomicIndicator | null): data is EconomicIndicator => data !== null);

      if (validEconomicData.length === 0) {
        throw new Error('No valid economic data retrieved');
      }

      console.log(`✅ Successfully processed ${validEconomicData.length} economic indicators`);

      // Generate GPT analysis
      const prompt = this.generateGPTPrompt(validEconomicData);
      console.log('🤖 Generating AI analysis of recent FRED data...');
      
      const analysis = await this.analyzeWithOpenAI(prompt);

      return {
        indicators: validEconomicData,
        analysis
      };

    } catch (error) {
      console.error('Error in getRecentEconomicReadings:', error);
      
      // Return fallback with error message
      return {
        indicators: [],
        analysis: 'Recent economic readings temporarily unavailable. Please check FRED API connectivity.'
      };
    }
  }
}

export const fredRecentIndicatorsService = new FREDRecentIndicatorsService();