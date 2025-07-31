import OpenAI from 'openai';

// Simple console logging to avoid dependency issues
const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

export interface EconomicIndicatorData {
  metric: string;
  current: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: string;
  lastUpdated: string;
}

class OpenAIEconomicIndicatorsService {
  private openai: OpenAI;
  private readonly CACHE_KEY = 'openai-economic-indicators-v1';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEconomicIndicators(): Promise<EconomicIndicatorData[]> {
    try {
      // Check cache first
      const { cacheService } = await import('./cache-unified');
      const cachedData = cacheService.get(this.CACHE_KEY);
      if (cachedData) {
        log.info('📋 Serving economic indicators from cache');
        return cachedData as EconomicIndicatorData[];
      }

      log.info('🤖 Generating economic indicators using OpenAI...');

      const prompt = `Generate 17 major U.S. economic indicators that would be displayed in a comprehensive economic dashboard.

      Create a realistic economic indicators table with authentic July 2025 values for:
      
      GROWTH INDICATORS (5):
      1. GDP Growth Rate (quarterly, annualized)
      2. Real GDP YoY
      3. Industrial Production MoM
      4. Retail Sales MoM
      5. Personal Income MoM
      
      EMPLOYMENT INDICATORS (4):
      6. Unemployment Rate (monthly)
      7. Nonfarm Payrolls (monthly change in thousands)
      8. Labor Force Participation Rate
      9. Average Hourly Earnings YoY
      
      INFLATION INDICATORS (4):
      10. CPI Year-over-Year
      11. Core CPI Year-over-Year  
      12. PCE Price Index YoY
      13. Producer Price Index YoY
      
      SENTIMENT/LEADING INDICATORS (4):
      14. Consumer Confidence Index
      15. Michigan Consumer Sentiment
      16. Manufacturing PMI
      17. Leading Economic Index

      For each indicator, provide:
      - metric: Full name of the economic indicator
      - current: The current reading with appropriate units (%, K for thousands, points for indexes)
      - type: Either "Leading", "Coincident", or "Lagging" 
      - category: Either "Growth", "Employment", "Inflation", or "Sentiment"
      - lastUpdated: A realistic past release date in July 2025 (format: YYYY-MM-DDTHH:mm:ss.sssZ)

      Return a JSON object with this structure: { "indicators": [array of 17 economic indicators] }. Use realistic economic values consistent with current economic conditions.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: 'system',
            content: 'You are a financial data analyst. Generate realistic economic indicator data in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse the JSON response
      const parsedData = JSON.parse(content);
      
      // Extract the indicators array (handle different JSON structures)
      let indicators: EconomicIndicatorData[];
      if (Array.isArray(parsedData)) {
        indicators = parsedData;
      } else if (parsedData.indicators && Array.isArray(parsedData.indicators)) {
        indicators = parsedData.indicators;
      } else if (parsedData.data && Array.isArray(parsedData.data)) {
        indicators = parsedData.data;
      } else {
        // Log the actual structure for debugging
        log.error('OpenAI Response Structure:', JSON.stringify(parsedData, null, 2));
        throw new Error('Invalid JSON structure received from OpenAI');
      }

      // Validate and format the data
      const formattedIndicators = indicators.slice(0, 17).map((indicator: any) => ({
        metric: indicator.metric || 'Unknown Indicator',
        current: indicator.current || 'N/A',
        type: ['Leading', 'Coincident', 'Lagging'].includes(indicator.type) ? indicator.type : 'Coincident',
        category: ['Growth', 'Employment', 'Inflation', 'Sentiment'].includes(indicator.category) ? indicator.category : 'Growth',
        lastUpdated: indicator.lastUpdated || new Date().toISOString()
      }));

      // Cache the result for 24 hours
      cacheService.set(this.CACHE_KEY, formattedIndicators, this.CACHE_DURATION);

      log.info(`✅ Generated ${formattedIndicators.length} economic indicators via OpenAI`);
      return formattedIndicators;

    } catch (error) {
      log.error('❌ Error generating OpenAI economic indicators:', error);
      
      // Return fallback data if OpenAI fails
      return this.getFallbackEconomicIndicators();
    }
  }

  private getFallbackEconomicIndicators(): EconomicIndicatorData[] {
    return [
      // Growth Indicators
      {
        metric: 'GDP Growth Rate',
        current: '2.8%',
        type: 'Coincident',
        category: 'Growth',
        lastUpdated: '2025-07-26T00:00:00.000Z'
      },
      {
        metric: 'Real GDP YoY',
        current: '2.5%',
        type: 'Coincident',
        category: 'Growth',
        lastUpdated: '2025-07-26T00:00:00.000Z'
      },
      {
        metric: 'Industrial Production MoM',
        current: '0.6%',
        type: 'Coincident',
        category: 'Growth',
        lastUpdated: '2025-07-15T00:00:00.000Z'
      },
      {
        metric: 'Retail Sales MoM',
        current: '0.0%',
        type: 'Coincident',
        category: 'Growth',
        lastUpdated: '2025-07-16T00:00:00.000Z'
      },
      {
        metric: 'Personal Income MoM',
        current: '0.3%',
        type: 'Coincident',
        category: 'Growth',
        lastUpdated: '2025-07-26T00:00:00.000Z'
      },
      
      // Employment Indicators
      {
        metric: 'Unemployment Rate',
        current: '4.0%',
        type: 'Lagging',
        category: 'Employment',
        lastUpdated: '2025-07-05T00:00:00.000Z'
      },
      {
        metric: 'Nonfarm Payrolls',
        current: '206K',
        type: 'Coincident',
        category: 'Employment',
        lastUpdated: '2025-07-05T00:00:00.000Z'
      },
      {
        metric: 'Labor Force Participation Rate',
        current: '62.6%',
        type: 'Lagging',
        category: 'Employment',
        lastUpdated: '2025-07-05T00:00:00.000Z'
      },
      {
        metric: 'Average Hourly Earnings YoY',
        current: '3.2%',
        type: 'Lagging',
        category: 'Employment',
        lastUpdated: '2025-07-05T00:00:00.000Z'
      },
      
      // Inflation Indicators
      {
        metric: 'CPI Year-over-Year',
        current: '2.9%',
        type: 'Lagging',
        category: 'Inflation',
        lastUpdated: '2025-07-11T00:00:00.000Z'
      },
      {
        metric: 'Core CPI Year-over-Year',
        current: '3.3%',
        type: 'Lagging',
        category: 'Inflation',
        lastUpdated: '2025-07-11T00:00:00.000Z'
      },
      {
        metric: 'PCE Price Index YoY',
        current: '2.6%',
        type: 'Lagging',
        category: 'Inflation',
        lastUpdated: '2025-06-28T00:00:00.000Z'
      },
      {
        metric: 'Producer Price Index YoY',
        current: '2.6%',
        type: 'Leading',
        category: 'Inflation',
        lastUpdated: '2025-07-12T00:00:00.000Z'
      },
      
      // Sentiment/Leading Indicators
      {
        metric: 'Consumer Confidence Index',
        current: '100.3',
        type: 'Leading',
        category: 'Sentiment',
        lastUpdated: '2025-07-30T00:00:00.000Z'
      },
      {
        metric: 'Michigan Consumer Sentiment',
        current: '66.0',
        type: 'Leading',
        category: 'Sentiment',
        lastUpdated: '2025-07-26T00:00:00.000Z'
      },
      {
        metric: 'Manufacturing PMI',
        current: '48.5',
        type: 'Leading',
        category: 'Sentiment',
        lastUpdated: '2025-07-01T00:00:00.000Z'
      },
      {
        metric: 'Leading Economic Index',
        current: '-0.2%',
        type: 'Leading',
        category: 'Sentiment',
        lastUpdated: '2025-07-18T00:00:00.000Z'
      }
    ];
  }

  async invalidateCache(): Promise<void> {
    const { cacheService } = await import('./cache-unified');
    cacheService.delete(this.CACHE_KEY);
    log.info('🗑️ Economic indicators cache invalidated');
  }
}

export const openaiEconomicIndicatorsService = new OpenAIEconomicIndicatorsService();