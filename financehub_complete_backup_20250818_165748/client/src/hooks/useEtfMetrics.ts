import { useQuery } from '@tanstack/react-query';
import { normalizeEtfMetrics } from '../adapters/etfMetricsAdapter';
import { fetchJsonWith304 } from '../lib/fetchJson';

export function useEtfMetrics(horizon = '60D') {
  return useQuery({
    queryKey: ['etf-metrics', horizon],
    queryFn: async () => {
      // Use enhanced fetch to handle 304 Not Modified responses
      const json = await fetchJsonWith304(`/api/etf-metrics?horizon=${encodeURIComponent(horizon)}`);
      const { rows, meta } = normalizeEtfMetrics(json);

      // tiny prod-safe debug
      if (!rows.length && (json?.warning || json?.data?.warning)) {
        console.info('[etf-metrics] empty with warning:', json?.warning ?? json?.data?.warning);
      }
      return { rows, meta };
    },
    staleTime: 60_000, // Consider data fresh for 1 minute (aligned with server cache)
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes (reduced from 5 for performance)  
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    placeholderData: (previousData) => previousData, // Keep previous data when getting 304 (v5 replacement for keepPreviousData)
    retry: (count, err: any) => !(err?.__notModified) && count < 2, // Don't retry 304s
  });
}