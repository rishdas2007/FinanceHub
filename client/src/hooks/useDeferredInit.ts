import { useEffect, useRef } from 'react';

export function useDeferredInit(cb: () => void, delayMs = 0) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const run = () => {
      if (done.current) return;
      done.current = true;
      setTimeout(cb, delayMs);
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
      // Fallback to next tick
      setTimeout(run, 0);
    }
  }, [cb, delayMs]);
}