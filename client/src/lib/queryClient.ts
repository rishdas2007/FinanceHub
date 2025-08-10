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

// Universal response unwrapping and validation
function validateAndUnwrap(response: any, url: string) {
  // Log response shape for debugging
  console.log(`📊 Response from ${url}:`, {
    isWrapped: !!response?.success && !!response?.data,
    hasData: !!response?.data,
    isArray: Array.isArray(response),
    keys: typeof response === 'object' ? Object.keys(response) : []
  });

  // Universal unwrapping: array → itself; otherwise prefer known keys
  const unwrapped =
    Array.isArray(response) ? response :
    response?.data ?? response?.metrics ?? response?.results ?? response?.items ?? response?.rows ?? null;

  // If we successfully unwrapped, return that
  if (unwrapped !== null) {
    return unwrapped;
  }

  // Fallbacks for named endpoints that return named objects
  if (url.includes('/api/market-status')) {
    return response?.status ?? response;
  }
  if (url.includes('/api/top-movers')) {
    return response?.etfMovers ?? response?.movers ?? response;
  }
  if (url.includes('/api/etf-metrics')) {
    // CRITICAL FIX: Always return an array, never null
    const metrics = response?.data ?? response?.metrics;
    return Array.isArray(metrics) ? metrics : [];
  }
  if (url.includes('/api/macroeconomic-indicators')) {
    const indicators = response?.indicators ?? response?.data;
    return Array.isArray(indicators) ? indicators : [];
  }
  if (url.includes('/api/economic-health')) {
    return response;
  }

  // Last resort: return original json so components can still inspect
  return response;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const json = await res.json();
    
    // FIX 1: Add error logging for debugging and unwrap response
    console.log(`🔍 API Response for ${url}:`, { hasData: !!json?.data, keys: Object.keys(json || {}) });
    return validateAndUnwrap(json, url);
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
