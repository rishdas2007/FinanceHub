import { getTwelveDataWebSocket, type MarketDataUpdate } from './twelve-data-websocket';
import { EventEmitter } from 'events';

interface RealTimeMarketData {
  [symbol: string]: {
    price: number;
    change: number;
    changePercent: number;
    volume?: number;
    lastUpdate: Date;
  };
}

export class RealTimeMarketService extends EventEmitter {
  private marketData: RealTimeMarketData = {};
  private ws = getTwelveDataWebSocket();
  private isInitialized = false;

  constructor() {
    super();
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.ws.on('connected', () => {
      console.log('✅ Real-time market service connected');
      this.emit('connected');
      
      // Subscribe to default symbols on connect
      this.subscribeToDefaultSymbols();
    });

    this.ws.on('disconnected', () => {
      console.log('❌ Real-time market service disconnected');
      this.emit('disconnected');
    });

    this.ws.on('marketData', (data: MarketDataUpdate) => {
      this.updateMarketData(data);
    });

    this.ws.on('error', (error: Error) => {
      console.error('Real-time market service error:', error);
      this.emit('error', error);
    });
  }

  private updateMarketData(data: MarketDataUpdate): void {
    this.marketData[data.symbol] = {
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      volume: data.volume,
      lastUpdate: data.timestamp
    };

    // Emit update event for specific symbol
    this.emit('update', data.symbol, this.marketData[data.symbol]);
    
    // Emit general market update
    this.emit('marketUpdate', {
      symbol: data.symbol,
      data: this.marketData[data.symbol]
    });
  }

  private subscribeToDefaultSymbols(): void {
    const defaultSymbols = [
      'SPY', 'QQQ', 'IWM', 'VIX',
      'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
    ];
    
    this.ws.subscribe(defaultSymbols);
  }

  initialize(): void {
    if (this.isInitialized) {
      console.log('Real-time market service already initialized');
      return;
    }

    console.log('🚀 Initializing real-time market service...');
    this.ws.connect();
    this.isInitialized = true;
  }

  subscribeToSymbol(symbol: string): void {
    this.ws.subscribe([symbol.toUpperCase()]);
  }

  subscribeToSymbols(symbols: string[]): void {
    this.ws.subscribe(symbols.map(s => s.toUpperCase()));
  }

  unsubscribeFromSymbol(symbol: string): void {
    this.ws.unsubscribe([symbol.toUpperCase()]);
    delete this.marketData[symbol.toUpperCase()];
  }

  getMarketData(symbol?: string): RealTimeMarketData | RealTimeMarketData[string] | undefined {
    if (symbol) {
      return this.marketData[symbol.toUpperCase()];
    }
    return this.marketData;
  }

  getLatestPrice(symbol: string): number | undefined {
    const data = this.marketData[symbol.toUpperCase()];
    return data?.price;
  }

  getConnectionStatus(): { connected: boolean; subscribedSymbols: string[]; dataCount: number } {
    const wsStatus = this.ws.getConnectionStatus();
    return {
      ...wsStatus,
      dataCount: Object.keys(this.marketData).length
    };
  }

  // Get historical comparison for convergence analysis
  getPriceMovement(symbol: string, timeframe: '1m' | '5m' | '15m' | '1h' = '5m'): {
    currentPrice: number;
    previousPrice?: number;
    priceChange?: number;
    percentChange?: number;
  } | null {
    const current = this.marketData[symbol.toUpperCase()];
    if (!current) return null;

    return {
      currentPrice: current.price,
      previousPrice: current.price - current.change,
      priceChange: current.change,
      percentChange: current.changePercent
    };
  }

  // Method for convergence analysis integration
  getMultiSymbolData(symbols: string[]): { [symbol: string]: RealTimeMarketData[string] } {
    const result: { [symbol: string]: RealTimeMarketData[string] } = {};
    
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      if (this.marketData[upperSymbol]) {
        result[upperSymbol] = this.marketData[upperSymbol];
      }
    });
    
    return result;
  }

  shutdown(): void {
    console.log('🔌 Shutting down real-time market service...');
    this.ws.disconnect();
    this.marketData = {};
    this.isInitialized = false;
  }
}

// Singleton instance
let marketServiceInstance: RealTimeMarketService | null = null;

export function getRealTimeMarketService(): RealTimeMarketService {
  if (!marketServiceInstance) {
    marketServiceInstance = new RealTimeMarketService();
  }
  return marketServiceInstance;
}