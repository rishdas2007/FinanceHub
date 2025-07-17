export interface StockData {
  id: number;
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume: number;
  timestamp: Date;
}

export interface MarketSentiment {
  id: number;
  vix: string;
  putCallRatio: string;
  aaiiBullish: string;
  aaiiBearish: string;
  aaiiNeutral: string;
  timestamp: Date;
}

export interface TechnicalIndicators {
  id: number;
  symbol: string;
  rsi: string | null;
  macd: string | null;
  macdSignal: string | null;
  bb_upper: string | null;
  bb_lower: string | null;
  sma_20: string | null;
  sma_50: string | null;
  timestamp: Date;
}

export interface AiAnalysis {
  id: number;
  marketConditions: string;
  technicalOutlook: string;
  riskAssessment: string;
  confidence: string;
  timestamp: Date;
}

export interface EconomicEvent {
  id: number;
  title: string;
  description: string;
  importance: string;
  eventDate: Date;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

export interface SectorData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface WebSocketMessage {
  type: 'initial_data' | 'price_update' | 'sentiment_update' | 'technical_update';
  data: any;
  timestamp: string;
}
