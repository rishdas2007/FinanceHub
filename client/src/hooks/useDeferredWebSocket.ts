import { useEffect, useRef } from 'react';

/**
 * Defers WebSocket connection until after initial render to improve LCP
 */
export function useDeferredWebSocket(url: string, delay = 2000) {
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<number | NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Use requestIdleCallback if available, fallback to setTimeout
    const scheduler = (window as any).requestIdleCallback || setTimeout;
    
    timeoutRef.current = scheduler(() => {
      try {
        wsRef.current = new WebSocket(url);
        console.log('🔗 WebSocket connected after idle period');
      } catch (error) {
        console.warn('WebSocket connection failed:', error);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        if ((window as any).cancelIdleCallback) {
          (window as any).cancelIdleCallback(timeoutRef.current);
        } else {
          clearTimeout(timeoutRef.current as NodeJS.Timeout);
        }
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, delay]);

  return wsRef.current;
}