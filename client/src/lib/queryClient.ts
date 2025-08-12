import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Simplified response handling - let components handle their own data structure
function validateAndUnwrap(response: any, url: string) {
  // Log response shape for debugging
  console.log(`🔍 API Response for ${url}:`, {
    hasData: !!response?.data || !!response?.indicators || !!response?.status,
    keys: typeof response === 'object' ? Object.keys(response) : []
  });

  // Return full response object for all endpoints - let components handle data extraction
  return response;
}

type UnauthorizedBehavior = "returnNull" | "throw";
const DEFAULT_TIMEOUT = 8000;

function buildUrlFromQueryKey(qk: unknown): string {
  // 1) string URL
  if (typeof qk === "string") return qk;

  // 2) array: [url, params?]
  if (Array.isArray(qk)) {
    const [first, second] = qk as [unknown, any];
    const base = typeof first === "string" ? first : String(first ?? "");
    if (second && typeof second === "object" && !Array.isArray(second)) {
      const qs = new URLSearchParams(
        Object.entries(second).reduce<Record<string, string>>((acc, [k, v]) => {
          if (v === undefined || v === null) return acc;
          acc[k] = Array.isArray(v) ? v.join(",") : String(v);
          return acc;
        }, {})
      ).toString();
      return qs ? `${base}?${qs}` : base;
    }
    return base;
  }

  // 3) fallback (defensive)
  return String(qk ?? "");
}

async function fetchWithTimeout(input: RequestInfo, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(input, { 
      ...init, 
      credentials: "include",
      signal: controller.signal 
    });

    // accept non-2xx; try to parse body anyway for error info
    const text = await res.text();
    if (!text) return null;

    let json: any = null;
    try { 
      json = JSON.parse(text); 
    } catch { 
      // not JSON; return text 
      return text; 
    }

    // Log response for debugging
    console.log(`🔍 API Response for ${input}:`, { hasData: !!json?.data, keys: Object.keys(json || {}) });

    // CRITICAL: Treat provider errors as empty data (never crash UI)
    if (json && (json.error || json.code === 400 || json.status === 'error')) {
      console.warn(`⚠️ Provider error treated as empty data:`, json.error || json.message);
      return [];
    }

    // ETF metrics special case - preserve object structure
    if (input.toString().includes('/api/etf-metrics') && json && typeof json === 'object') {
      return json; // Don't unwrap ETF metrics - need the full response structure
    }

    // Enhanced ETF routes - handle specific structure
    if (input.toString().includes('/api/etf-enhanced/') && json && typeof json === 'object') {
      return json; // Keep enhanced ETF response structure intact
    }

    // universal unwrapping; still return raw object if none match
    const unwrapped =
      Array.isArray(json) ? json :
      json?.data ?? json?.metrics ?? json?.results ?? json?.items ?? json?.rows ?? json;

    return unwrapped;
  } finally {
    clearTimeout(timer);
  }
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrlFromQueryKey(queryKey);
    
    try {
      return await fetchWithTimeout(url);
    } catch (error) {
      if (unauthorizedBehavior === "returnNull" && (error as any)?.status === 401) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => {
        const url = buildUrlFromQueryKey(queryKey as any);
        return fetchWithTimeout(url);
      },
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
    mutations: {
      retry: false,
    },
  },
});
