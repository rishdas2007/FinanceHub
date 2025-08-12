import { useQuery } from '@tanstack/react-query';
import { normalizeEtfMetrics } from '../adapters/etfMetricsAdapter';

export function useEtfMetrics(horizon = '60D') {
  return useQuery({
    queryKey: ['etf-metrics', horizon],
    queryFn: async () => {
      // dash route works in prod; alias exists for both
      const res = await fetch(`/api/etf-metrics?horizon=${encodeURIComponent(horizon)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json();
      const { rows, meta } = normalizeEtfMetrics(json);

      // tiny prod-safe debug
      if (!rows.length && (json?.warning || json?.data?.warning)) {
        console.info('[etf-metrics] empty with warning:', json?.warning ?? json?.data?.warning);
      }
      return { rows, meta };
    },
    staleTime: 60_000,
  });
}