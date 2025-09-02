import fetch from 'node-fetch';

export class ParseBotService {
  private readonly apiKey: string;
  private readonly scraperId: string = '9e0957e9-ef56-4279-957a-bd4dc871bad2';
  private readonly baseUrl: string = 'https://api.parse.bot/scraper';

  constructor() {
    this.apiKey = process.env.PARSE_BOT_API_KEY!;
    if (!this.apiKey) {
      throw new Error('PARSE_BOT_API_KEY environment variable is required');
    }
  }

  async fetchFiveDayChanges(): Promise<FiveDayChangeData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.scraperId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Parse.bot API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ParseBotResponse;
      
      if (data.status !== 'success') {
        throw new Error('Parse.bot API returned unsuccessful status');
      }

      return data.data;
    } catch (error) {
      console.error('Failed to fetch 5-day changes from parse.bot:', error);
      throw error;
    }
  }

  // Map parse.bot symbols to our ETF symbols
  mapSymbol(parseBotSymbol: string): string {
    // S&P 500 Index (^GSPC) maps to SPY ETF
    if (parseBotSymbol === '^GSPC') {
      return 'SPY';
    }
    // All other symbols should match directly
    return parseBotSymbol;
  }
}

interface ParseBotResponse {
  data: FiveDayChangeData[];
  scraper_id: string;
  status: string;
}

export interface FiveDayChangeData {
  company_name: string;
  symbol: string;
  total_pct_change: string;
}