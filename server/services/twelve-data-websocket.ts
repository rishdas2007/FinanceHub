import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface TwelveDataMessage {
  event: string;
  symbol?: string;
  price?: number;
  day_change?: number;
  day_change_percent?: number;
  timestamp?: number;
  volume?: number;
  [key: string]: any;
}

interface MarketDataUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: Date;
}

export class TwelveDataWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscribedSymbols = new Set<string>();
  private isConnected = false;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${this.apiKey}`;
    console.log('📡 Connecting to Twelve Data WebSocket...');

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ Connected to Twelve Data WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: TwelveDataMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`🔌 WebSocket disconnected: ${code} - ${reason.toString()}`);
      this.isConnected = false;
      this.stopHeartbeat();
      this.emit('disconnected');
      
      if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', error);
    });
  }

  private handleMessage(message: TwelveDataMessage): void {
    switch (message.event) {
      case 'subscribe-status':
        console.log(`📊 Subscription status for ${message.symbol}: ${message.status}`);
        break;
      
      case 'price':
        if (message.symbol && message.price !== undefined) {
          const marketData: MarketDataUpdate = {
            symbol: message.symbol,
            price: message.price,
            change: message.day_change || 0,
            changePercent: message.day_change_percent || 0,
            volume: message.volume,
            timestamp: new Date(message.timestamp ? message.timestamp * 1000 : Date.now())
          };
          
          console.log(`📈 Real-time update: ${message.symbol} - $${message.price} (${message.day_change_percent?.toFixed(2)}%)`);
          this.emit('marketData', marketData);
        }
        break;
      
      case 'heartbeat':
        console.log('💓 Heartbeat received');
        break;
      
      default:
        console.log('📨 Unknown message type:', message.event);
    }
  }

  subscribe(symbols: string[]): void {
    if (!this.isConnected || !this.ws) {
      console.log('⏳ WebSocket not connected, queuing subscription...');
      this.once('connected', () => this.subscribe(symbols));
      return;
    }

    symbols.forEach(symbol => {
      if (!this.subscribedSymbols.has(symbol)) {
        const subscribeMessage = {
          action: 'subscribe',
          params: {
            symbols: symbol
          }
        };

        this.ws!.send(JSON.stringify(subscribeMessage));
        this.subscribedSymbols.add(symbol);
        console.log(`📡 Subscribed to ${symbol}`);
      }
    });
  }

  unsubscribe(symbols: string[]): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    symbols.forEach(symbol => {
      if (this.subscribedSymbols.has(symbol)) {
        const unsubscribeMessage = {
          action: 'unsubscribe',
          params: {
            symbols: symbol
          }
        };

        this.ws!.send(JSON.stringify(unsubscribeMessage));
        this.subscribedSymbols.delete(symbol);
        console.log(`📡 Unsubscribed from ${symbol}`);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'heartbeat' }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.subscribedSymbols.clear();
  }

  getConnectionStatus(): { connected: boolean; subscribedSymbols: string[] } {
    return {
      connected: this.isConnected,
      subscribedSymbols: Array.from(this.subscribedSymbols)
    };
  }
}

// Singleton instance
let wsInstance: TwelveDataWebSocket | null = null;

export function getTwelveDataWebSocket(): TwelveDataWebSocket {
  if (!wsInstance) {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      throw new Error('TWELVE_DATA_API_KEY environment variable is required');
    }
    wsInstance = new TwelveDataWebSocket(apiKey);
  }
  return wsInstance;
}

export type { MarketDataUpdate };