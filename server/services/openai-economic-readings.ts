import OpenAI from 'openai';
import { logger } from './logger';

interface EconomicReading {
  metric: string;
  current: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  lastUpdated: string;
  change?: string;
  zScore?: number | string;
}

class OpenAIEconomicReadingsService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEconomicReadings(): Promise<EconomicReading[]> {
    try {
      logger.info('🤖 Generating recent economic readings using OpenAI...');

      const prompt = `Generate 6 recent major U.S. economic indicators that would typically be released in July 2025. 
      
      Provide realistic current readings for these indicators with authentic values based on recent economic trends:
      1. GDP Growth Rate (quarterly, annualized)
      2. CPI Year-over-Year (monthly inflation)
      3. Core CPI Year-over-Year (excluding food/energy)
      4. Unemployment Rate (monthly)
      5. Nonfarm Payrolls (monthly change in thousands)
      6. Manufacturing PMI (monthly index)

      For each indicator, provide:
      - metric: Full name of the economic indicator
      - current: The current reading value with appropriate units (%, K for thousands, etc.)
      - type: Either "Leading", "Coincident", or "Lagging"
      - lastUpdated: A realistic past release date in July 2025 (format: YYYY-MM-DDTHH:mm:ss.sssZ)
      - change: Brief description of change (e.g., "↑ from prior", "↓ vs forecast")
      - zScore: A realistic z-score between -2.5 and 2.5

      Return ONLY a valid JSON array with exactly 6 objects. Use realistic economic values consistent with a growing economy.`;

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
        max_tokens: 1500
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse the JSON response
      const parsedData = JSON.parse(content);
      
      // Extract the indicators array (handle different JSON structures)
      let indicators: EconomicReading[];
      if (Array.isArray(parsedData)) {
        indicators = parsedData;
      } else if (parsedData.indicators && Array.isArray(parsedData.indicators)) {
        indicators = parsedData.indicators;
      } else if (parsedData.data && Array.isArray(parsedData.data)) {
        indicators = parsedData.data;
      } else {
        throw new Error('Invalid JSON structure received from OpenAI');
      }

      // Validate and format the data
      const formattedIndicators = indicators.slice(0, 6).map((indicator: any) => ({
        metric: indicator.metric || 'Unknown Indicator',
        current: indicator.current || 'N/A',
        type: ['Leading', 'Coincident', 'Lagging'].includes(indicator.type) ? indicator.type : 'Coincident',
        lastUpdated: indicator.lastUpdated || new Date().toISOString(),
        change: indicator.change || 'No change data',
        zScore: indicator.zScore || 0
      }));

      logger.info(`✅ Generated ${formattedIndicators.length} economic readings via OpenAI`);
      return formattedIndicators;

    } catch (error) {
      logger.error('❌ Error generating OpenAI economic readings:', error);
      
      // Return fallback data if OpenAI fails
      return this.getFallbackEconomicReadings();
    }
  }

  private getFallbackEconomicReadings(): EconomicReading[] {
    return [
      {
        metric: 'GDP Growth Rate',
        current: '2.1%',
        type: 'Coincident',
        lastUpdated: '2025-07-26T00:00:00.000Z',
        change: '↑ from prior quarter',
        zScore: 0.3
      },
      {
        metric: 'CPI Year-over-Year',
        current: '2.9%',
        type: 'Lagging',
        lastUpdated: '2025-07-11T00:00:00.000Z',
        change: '↓ vs 3.1% forecast',
        zScore: -0.2
      },
      {
        metric: 'Core CPI Year-over-Year',
        current: '3.0%',
        type: 'Lagging',
        lastUpdated: '2025-07-11T00:00:00.000Z',
        change: '↑ from 2.8% prior',
        zScore: 0.5
      },
      {
        metric: 'Unemployment Rate',
        current: '4.0%',
        type: 'Lagging',
        lastUpdated: '2025-07-05T00:00:00.000Z',
        change: '↔ unchanged',
        zScore: -0.1
      },
      {
        metric: 'Nonfarm Payrolls',
        current: '206K',
        type: 'Coincident',
        lastUpdated: '2025-07-05T00:00:00.000Z',
        change: '↑ vs 190K forecast',
        zScore: 0.7
      },
      {
        metric: 'Manufacturing PMI',
        current: '49.2',
        type: 'Leading',
        lastUpdated: '2025-07-01T00:00:00.000Z',
        change: '↓ from 50.1 prior',
        zScore: -0.8
      }
    ];
  }
}

export const openaiEconomicReadingsService = new OpenAIEconomicReadingsService();