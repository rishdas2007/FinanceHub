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

// Add response shape validation
function validateAndUnwrap(response: any, url: string) {
  // Log response shape for debugging
  console.log(`📊 Response from ${url}:`, {
    isWrapped: !!response?.success && !!response?.data,
    hasData: !!response?.data,
    isArray: Array.isArray(response),
    keys: typeof response === 'object' ? Object.keys(response) : []
  });

  // Unwrap if it's a success wrapper
  if (response?.success === true && response?.data !== undefined) {
    return response.data;
  }

  // Handle metrics wrapper (for ETF endpoints)
  if (response?.metrics) {
    return response.metrics;
  }

  // Return as-is if already unwrapped
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
