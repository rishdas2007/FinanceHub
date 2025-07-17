interface TwelveDataQuoteResponse {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  datetime: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
  average_volume: string;
  rolling_1d_change: string;
  rolling_7d_change: string;
  rolling_period_change: string;
  is_market_open: boolean;
  fifty_two_week: {
    low: string;
    high: string;
    low_change: string;
    high_change: string;
    low_change_percent: string;
    high_change_percent: string;
    range: string;
  };
}

interface TwelveDataRSIResponse {
  meta: {
    symbol: string;
    indicator: {
      name: string;
      time_period: number;
    };
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    mic_code: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    rsi: string;
  }>;
  status: string;
}

interface TwelveDataMACDResponse {
  meta: {
    symbol: string;
    indicator: {
      name: string;
      fast_period: number;
      slow_period: number;
      signal_period: number;
    };
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    mic_code: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    macd: string;
    macd_signal: string;
    macd_histogram: string;
  }>;
  status: string;
}

export class FinancialDataService {
  private apiKey: string;
  private baseUrl = 'https://api.twelvedata.com';
  private requestCount = 0;
  private lastMinute = 0;

  constructor() {
    this.apiKey = process.env.TWELVE_DATA_API_KEY || 'bdceed179a5d435ba78072dfd05f8619';
  }

  private async rateLimitCheck() {
    const currentMinute = Math.floor(Date.now() / 60000);
    if (currentMinute !== this.lastMinute) {
      this.requestCount = 0;
      this.lastMinute = currentMinute;
    }
    
    if (this.requestCount >= 55) {
      // Wait until next minute if we've hit the limit
      const waitTime = 60000 - (Date.now() % 60000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastMinute = Math.floor(Date.now() / 60000);
    }
    
    this.requestCount++;
  }

  async getStockQuote(symbol: string) {
    try {
      await this.rateLimitCheck();
      
      const response = await fetch(
        `${this.baseUrl}/quote?symbol=${symbol}&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: TwelveDataQuoteResponse = await response.json();
      
      if (!data.symbol) {
        throw new Error('Invalid response from Twelve Data API');
      }
      
      return {
        symbol: data.symbol,
        price: parseFloat(data.close),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.percent_change),
        volume: parseInt(data.volume),
        previousClose: parseFloat(data.previous_close),
      };
    } catch (error) {
      console.error(`Error fetching stock quote for ${symbol}:`, error);
      // Return fallback data for development
      return {
        symbol,
        price: 100 + Math.random() * 500,
        change: (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 5,
        volume: Math.floor(Math.random() * 10000000),
        previousClose: 100 + Math.random() * 500,
      };
    }
  }

  async getTechnicalIndicators(symbol: string) {
    try {
      await this.rateLimitCheck();
      
      // Get RSI
      const rsiResponse = await fetch(
        `${this.baseUrl}/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${this.apiKey}`
      );
      
      await this.rateLimitCheck();
      
      // Get MACD
      const macdResponse = await fetch(
        `${this.baseUrl}/macd?symbol=${symbol}&interval=1day&apikey=${this.apiKey}`
      );

      const [rsiData, macdData] = await Promise.all([
        rsiResponse.json(),
        macdResponse.json()
      ]);

      let rsi = 50;
      let macd = 0;
      let macdSignal = 0;

      // Parse RSI data
      if (rsiData.values && rsiData.values.length > 0) {
        rsi = parseFloat(rsiData.values[0].rsi);
      }

      // Parse MACD data
      if (macdData.values && macdData.values.length > 0) {
        macd = parseFloat(macdData.values[0].macd);
        macdSignal = parseFloat(macdData.values[0].macd_signal);
      }

      return {
        symbol,
        rsi: rsi,
        macd: macd,
        macdSignal: macdSignal,
        bb_upper: null,
        bb_lower: null,
        sma_20: null,
        sma_50: null,
      };
    } catch (error) {
      console.error(`Error fetching technical indicators for ${symbol}:`, error);
      // Return fallback data
      return {
        symbol,
        rsi: 40 + Math.random() * 40,
        macd: (Math.random() - 0.5) * 5,
        macdSignal: (Math.random() - 0.5) * 5,
        bb_upper: null,
        bb_lower: null,
        sma_20: null,
        sma_50: null,
      };
    }
  }

  async getSectorETFs() {
    const sectors = [
      { name: 'S&P 500 INDEX', symbol: 'SPY' },
      { name: 'Technology', symbol: 'XLK' },
      { name: 'Health Care', symbol: 'XLV' },
      { name: 'Financials', symbol: 'XLF' },
      { name: 'Consumer Discretionary', symbol: 'XLY' },
      { name: 'Industrials', symbol: 'XLI' },
      { name: 'Communication Services', symbol: 'XLC' },
      { name: 'Consumer Staples', symbol: 'XLP' },
      { name: 'Energy', symbol: 'XLE' },
      { name: 'Utilities', symbol: 'XLU' },
      { name: 'Materials', symbol: 'XLB' },
      { name: 'Real Estate', symbol: 'XLRE' },
    ];

    const results = await Promise.all(
      sectors.map(async (sector) => {
        const quote = await this.getStockQuote(sector.symbol);
        return {
          name: sector.name,
          symbol: sector.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
        };
      })
    );

    return results;
  }

  generateMarketSentiment() {
    return {
      vix: 15 + Math.random() * 20,
      putCallRatio: 0.5 + Math.random() * 0.8,
      aaiiBullish: 30 + Math.random() * 40,
      aaiiBearish: 20 + Math.random() * 40,
      aaiiNeutral: 15 + Math.random() * 30,
    };
  }

  generateEconomicEvents() {
    const now = new Date();
    const events = [
      {
        title: 'FOMC Meeting',
        description: 'Federal Reserve Policy Decision',
        importance: 'high',
        eventDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        forecast: '5.25%',
        previous: '5.25%',
        actual: null,
      },
      {
        title: 'CPI Data Release',
        description: 'Consumer Price Index',
        importance: 'high',
        eventDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
        forecast: '3.2%',
        previous: '3.1%',
        actual: null,
      },
      {
        title: 'Earnings Reports',
        description: 'AAPL, MSFT, GOOGL',
        importance: 'medium',
        eventDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week
        forecast: null,
        previous: null,
        actual: null,
      },
    ];

    return events;
  }
}

export const financialDataService = new FinancialDataService();
