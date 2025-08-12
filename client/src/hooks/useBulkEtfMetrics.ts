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
      const response = await fetch('/api/v2/etf-metrics?bulk=true', { 
        headers: { 'Accept': 'application/json' } 
      });
      
      // Handle 304 Not Modified - keep previous data by throwing special error
      if (response.status === 304) {
        throw new Error('NOT_MODIFIED');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 304, but retry 502 with exponential backoff
      if (error?.message === 'NOT_MODIFIED') return false;
      if (error?.message?.includes('502')) return failureCount < 2;
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 60_000, // 1 minute - aligned with server cache
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Prevent unnecessary refetches on component mount
  });
}