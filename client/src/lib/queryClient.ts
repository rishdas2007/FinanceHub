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

  // Skip universal unwrapping for ETF metrics - return full response object
  if (url.includes('/api/etf-metrics')) {
    return response;
  }
  
  // Universal unwrapping for other endpoints: array → itself; otherwise prefer known keys
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
const DEFAULT_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  
  try {
    const res = await fetch(url, { 
      ...options, 
      credentials: "include",
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    
    // Log response for debugging
    console.log(`🔍 API Response for ${url}:`, { hasData: !!json?.data, keys: Object.keys(json || {}) });
    
    return validateAndUnwrap(json, url);
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏰ Request timeout for ${url} after ${DEFAULT_TIMEOUT}ms`);
      // Return fail-safe default based on endpoint
      if (url.includes('/api/market-status')) {
        return { isOpen: null, label: 'Unknown', status: 'timeout' };
      }
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
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
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30 seconds instead of Infinity
      retry: 1, // Retry once instead of never
    },
    mutations: {
      retry: false,
    },
  },
});
