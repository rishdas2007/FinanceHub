// Accepts all server shapes and returns a flat array of row objects.
export type EtfRow = Record<string, any>;

export function normalizeEtfMetrics(json: any): { rows: EtfRow[]; meta?: any } {
  const root = json?.data ?? json;

  // Common shapes
  if (Array.isArray(root)) return { rows: root, meta: json?.meta };
  if (Array.isArray(root?.rows)) return { rows: root.rows, meta: root.meta };
  if (Array.isArray(root?.items)) return { rows: root.items, meta: root.meta };

  // Movers-style: { benchmark, signals: [...] }
  if (root && (Array.isArray(root.signals) || root.benchmark)) {
    const rows: EtfRow[] = [];
    if (root.benchmark?.symbol) rows.push(root.benchmark);
    if (Array.isArray(root.signals)) rows.push(...root.signals);
    return { rows, meta: root.meta };
  }

  // Legacy: { data: [...] }
  if (Array.isArray(root?.data)) return { rows: root.data, meta: root.meta };

  return { rows: [] };
}