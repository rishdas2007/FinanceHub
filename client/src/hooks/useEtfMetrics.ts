import { useQuery } from '@tanstack/react-query';
import { normalizeEtfMetrics } from '../adapters/etfMetricsAdapter';

// DEPRECATED: This hook has been replaced by useBulkEtfMetrics for performance
// Redirecting to bulk endpoint to maintain compatibility
export function useEtfMetrics(horizon = '60D') {
  console.warn('⚠️ useEtfMetrics is deprecated. Use useBulkEtfMetrics for better performance.');
  
  return useQuery({
    queryKey: ['etf-metrics-legacy', horizon],
    queryFn: async () => {
      // Use bulk endpoint instead of legacy per-row calls
      const res = await fetch('/api/v2/etf-metrics?bulk=true', {
        headers: { 'Accept': 'application/json' }
      });
      
      if (res.status === 304) {
        throw new Error('NOT_MODIFIED');
      }
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const json = await res.json();
      
      // Transform bulk response to match legacy format
      const rows = json.items || [];
      const meta = {
        count: rows.length,
        horizon,
        updatedAt: json.updatedAt,
        version: json.version || 1
      };

      return { rows, meta };
    },
    retry: (failureCount, error: any) => {
      return error?.message !== 'NOT_MODIFIED' && failureCount < 1;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}