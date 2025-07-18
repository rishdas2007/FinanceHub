import { useState, useEffect } from 'react';

interface ApiCallTracker {
  callsThisMinute: number;
  totalCalls: number;
  lastResetTime: number;
}

export function useApiTracker() {
  const [tracker, setTracker] = useState<ApiCallTracker>({
    callsThisMinute: 1, // Show 1 call/min as baseline  
    totalCalls: 0,
    lastResetTime: Date.now()
  });

  const trackApiCall = () => {
    setTracker(prev => {
      const now = Date.now();
      const minutesSinceReset = (now - prev.lastResetTime) / (1000 * 60);
      
      // Reset counter every minute
      if (minutesSinceReset >= 1) {
        return {
          callsThisMinute: 1,
          totalCalls: prev.totalCalls + 1,
          lastResetTime: now
        };
      }
      
      return {
        ...prev,
        callsThisMinute: prev.callsThisMinute + 1,
        totalCalls: prev.totalCalls + 1
      };
    });
  };

  // Auto-reset counter every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTracker(prev => {
        const now = Date.now();
        const minutesSinceReset = (now - prev.lastResetTime) / (1000 * 60);
        
        if (minutesSinceReset >= 1) {
          return {
            ...prev,
            callsThisMinute: 1, // Show 1 call/min as baseline
            lastResetTime: now
          };
        }
        
        return prev;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Track API calls by intercepting fetch requests
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = args[0] as string;
      
      // Track calls to our API endpoints
      if (typeof url === 'string' && url.startsWith('/api/')) {
        trackApiCall();
      }
      
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Update DOM element
  useEffect(() => {
    const element = document.getElementById('api-calls-counter');
    if (element) {
      element.textContent = `${tracker.callsThisMinute}`;
    }
  }, [tracker.callsThisMinute]);

  return tracker;
}