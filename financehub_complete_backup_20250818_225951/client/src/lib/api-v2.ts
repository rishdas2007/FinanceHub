// V2 API Client with typed contracts
import { 
  ApiResponse, 
  MarketStatus, 
  ETFMetrics, 
  StockHistory, 
  EconomicIndicator, 
  HealthCheck,
  TopMovers 
} from '@shared/types/api-contracts';

const API_BASE = '/api/v2';

class ApiV2Client {
  
  private async request<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  }
  
  // Market Status
  async getMarketStatus(): Promise<ApiResponse<MarketStatus>> {
    return this.request<MarketStatus>('/market-status');
  }
  
  // ETF Metrics (reads from feature store)
  async getETFMetrics(symbols?: string[]): Promise<ApiResponse<{ metrics: ETFMetrics[]; count: number; pipelineVersion: string; dataSource: string }>> {
    const params = symbols ? `?symbols=${symbols.join(',')}` : '';
    return this.request(`/etf-metrics${params}`);
  }
  
  // Stock History
  async getStockHistory(symbol: string, window: string = '30D'): Promise<ApiResponse<StockHistory>> {
    return this.request<StockHistory>(`/stocks/${symbol}/history?window=${window}`);
  }
  
  // Sparkline
  async getSparkline(symbol: string, days: number = 30): Promise<ApiResponse<{ symbol: string; days: number; points: any[]; fallback: boolean }>> {
    return this.request(`/sparkline?symbol=${symbol}&days=${days}`);
  }
  
  // Health Check
  async getHealth(): Promise<ApiResponse<HealthCheck>> {
    return this.request<HealthCheck>('/health');
  }
}

export const apiV2Client = new ApiV2Client();

// Helper function to check if response has fallback data
export function hasFallbackData<T>(response: ApiResponse<T>): boolean {
  return Boolean(response.warning || (response.data as any)?.fallback);
}

// Helper function to get data quality indicator
export function getDataQuality<T>(response: ApiResponse<T>): 'high' | 'medium' | 'low' {
  if (response.source === 'db' && !hasFallbackData(response)) {
    return 'high';
  }
  if (response.source === 'cache') {
    return 'medium';
  }
  return 'low';
}