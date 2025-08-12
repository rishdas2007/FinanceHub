import { useQuery } from '@tanstack/react-query';

type EtfRow = Record<string, any>;

function normalizeEtfMetrics(json: any): EtfRow[] {
  // Accept multiple server shapes and unify to an array of rows
  const d = json?.data ?? json;

  if (Array.isArray(d)) return d as EtfRow[];
  if (Array.isArray(d?.rows)) return d.rows as EtfRow[];
  if (Array.isArray(d?.items)) return d.items as EtfRow[];

  // movers-style payload
  if (d && (Array.isArray(d.signals) || d.benchmark)) {
    const rows: EtfRow[] = [];
    if (d.benchmark && d.benchmark.symbol) rows.push(d.benchmark);
    if (Array.isArray(d.signals)) rows.push(...d.signals);
    return rows;
  }

  // older payloads
  if (Array.isArray(d?.data)) return d.data as EtfRow[];

  // legacy metrics field
  if (Array.isArray(json?.metrics)) return json.metrics as EtfRow[];

  return [];
}

export function useEtfMetrics() {
  return useQuery({
    queryKey: ['etf-metrics','60D'],
    queryFn: async () => {
      // Use the dashed route (since your log shows /api/etf-metrics). The alias above makes both valid.
      const res = await fetch('/api/etf-metrics?horizon=60D', { headers: { 'Accept': 'application/json' }});
      const json = await res.json();

      // Optional debug to surface shape in prod if empty
      const rows = normalizeEtfMetrics(json);
      if (!rows.length && json?.warning) console.info('[etf-metrics] warning:', json.warning, json);
      if (!rows.length && process.env.NODE_ENV !== 'production') console.warn('[etf-metrics] empty, keys=', Object.keys(json?.data ?? json));
      return rows;
    },
    staleTime: 60_000
  });
}