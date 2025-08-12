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
    queryFn: async (): Promise<EtfMetricsResponse | null> => {
      const response = await fetch('/api/v2/etf-metrics?bulk=true', { 
        headers: { 'Accept': 'application/json' } 
      });
      
      if (response.status === 304) {
        return null; // cache still valid
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    staleTime: 60_000, // 1 minute - aligned with server cache
    retry: 1,
    refetchOnWindowFocus: false,
  });
}