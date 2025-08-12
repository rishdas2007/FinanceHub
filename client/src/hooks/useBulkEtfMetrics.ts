import { useQuery } from '@tanstack/react-query';

interface EtfMetricsResponse {
  updatedAt: string;
  items: Array<{
    symbol: string;
    name: string;
    last_price: number;
    pct_change_1d: number;
    perf_5d?: number;
    perf_1m?: number;
    volume?: number;
    rsi?: number;
    macd?: number;
    bb_percent_b?: number;
    sma_50?: number;
    sma_200?: number;
    ema_21?: number;
    mini_trend_30d: number[];
  }>;
}

export function useBulkEtfMetrics() {
  return useQuery({
    queryKey: ['etf-metrics-bulk'],
    queryFn: async (): Promise<EtfMetricsResponse> => {
      console.log('📡 Fetching ETF bulk data from /api/v2/etf-metrics?bulk=true');
      
      const response = await fetch('/api/v2/etf-metrics?bulk=true', { 
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        } 
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Handle 304 Not Modified - keep previous data by throwing special error
      if (response.status === 304) {
        throw new Error('NOT_MODIFIED');
      }
      
      if (!response.ok) {
        console.error('❌ ETF bulk request failed:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ ETF bulk data received:', data.items?.length, 'items');
      return data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 304 or 502 (we use fallback data for 502)
      if (error?.message === 'NOT_MODIFIED') return false;
      if (error?.message?.includes('502')) return false; // Use fallback data immediately
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 60_000, // 1 minute - aligned with server cache
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Prevent unnecessary refetches on component mount
  });
}