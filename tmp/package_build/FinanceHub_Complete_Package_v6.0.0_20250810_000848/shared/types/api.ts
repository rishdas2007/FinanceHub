/**
 * Centralized API type definitions
 * Consolidates request/response interfaces across services
 */

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface MarketDataResponse {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: string;
}

export interface TechnicalIndicatorResponse {
  symbol: string;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  timestamp: string;
}

export interface SectorDataResponse {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  oneDayChange: number;
  fiveDayChange: number;
  oneMonthChange: number;
}

export interface EconomicEventResponse {
  id: string;
  title: string;
  description: string;
  date: string;
  importance: 'low' | 'medium' | 'high';
  forecast?: string;
  actual?: string;
  previous?: string;
  impact?: 'positive' | 'negative' | 'neutral';
}