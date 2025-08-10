import { useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  navigationTiming?: PerformanceNavigationTiming;
  paintTiming?: PerformancePaintTiming[];
  resourceTiming?: PerformanceResourceTiming[];
  customMetrics?: Record<string, number>;
}

interface CustomTiming {
  name: string;
  startTime: number;
  endTime?: number;
}

export function usePerformanceMonitoring() {
  const customTimings = useRef<Map<string, CustomTiming>>(new Map());

  // Start a custom performance measurement
  const startMeasurement = useCallback((name: string) => {
    const startTime = performance.now();
    customTimings.current.set(name, { name, startTime });
    performance.mark(`${name}-start`);
  }, []);

  // End a custom performance measurement
  const endMeasurement = useCallback((name: string) => {
    const endTime = performance.now();
    const timing = customTimings.current.get(name);
    
    if (timing) {
      timing.endTime = endTime;
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      // Send measurement to analytics
      sendPerformanceData({
        type: 'custom',
        name,
        duration: endTime - timing.startTime,
        timestamp: Date.now()
      });
    }
  }, []);

  // Measure component render time
  const measureComponentRender = useCallback((componentName: string) => {
    return {
      start: () => startMeasurement(`component-${componentName}`),
      end: () => endMeasurement(`component-${componentName}`)
    };
  }, [startMeasurement, endMeasurement]);

  // Measure API call performance
  const measureAPICall = useCallback(async <T>(
    name: string, 
    apiCall: () => Promise<T>
  ): Promise<T> => {
    startMeasurement(`api-${name}`);
    
    try {
      const result = await apiCall();
      endMeasurement(`api-${name}`);
      return result;
    } catch (error) {
      endMeasurement(`api-${name}`);
      
      // Log API error
      sendPerformanceData({
        type: 'api-error',
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      
      throw error;
    }
  }, [startMeasurement, endMeasurement]);

  // Collect and send performance metrics
  const collectMetrics = useCallback(() => {
    const metrics: PerformanceMetrics = {};

    // Navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      metrics.navigationTiming = navigation;
    }

    // Paint timing
    const paintEntries = performance.getEntriesByType('paint') as PerformancePaintTiming[];
    if (paintEntries.length > 0) {
      metrics.paintTiming = paintEntries;
    }

    // Resource timing (limit to last 50 entries to avoid memory issues)
    const resourceEntries = performance.getEntriesByType('resource')
      .slice(-50) as PerformanceResourceTiming[];
    if (resourceEntries.length > 0) {
      metrics.resourceTiming = resourceEntries;
    }

    // Custom metrics
    const customMetrics: Record<string, number> = {};
    performance.getEntriesByType('measure').forEach(entry => {
      customMetrics[entry.name] = entry.duration;
    });
    
    if (Object.keys(customMetrics).length > 0) {
      metrics.customMetrics = customMetrics;
    }

    // Send to analytics
    sendPerformanceData({
      type: 'full-metrics',
      metrics,
      timestamp: Date.now(),
      url: window.location.href
    });

    return metrics;
  }, []);

  // Monitor Core Web Vitals
  useEffect(() => {
    // Largest Contentful Paint (LCP)
    const observeLCP = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      sendPerformanceData({
        type: 'core-web-vital',
        name: 'LCP',
        value: lastEntry.startTime,
        timestamp: Date.now()
      });
    });
    
    try {
      observeLCP.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // LCP not supported in this browser
    }

    // First Input Delay (FID)
    const observeFID = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach(entry => {
        sendPerformanceData({
          type: 'core-web-vital',
          name: 'FID',
          value: entry.processingStart - entry.startTime,
          timestamp: Date.now()
        });
      });
    });
    
    try {
      observeFID.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // FID not supported in this browser
    }

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const observeCLS = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach(entry => {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      });
      
      sendPerformanceData({
        type: 'core-web-vital',
        name: 'CLS',
        value: clsValue,
        timestamp: Date.now()
      });
    });
    
    try {
      observeCLS.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // CLS not supported in this browser
    }

    // Cleanup observers
    return () => {
      observeLCP.disconnect();
      observeFID.disconnect();
      observeCLS.disconnect();
    };
  }, []);

  // Send metrics on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      collectMetrics();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [collectMetrics]);

  return {
    startMeasurement,
    endMeasurement,
    measureComponentRender,
    measureAPICall,
    collectMetrics
  };
}

// Send performance data to analytics endpoint
async function sendPerformanceData(data: any) {
  try {
    // Use sendBeacon for reliability during page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/monitoring/performance', JSON.stringify(data));
    } else {
      // Fallback to fetch
      await fetch('/api/monitoring/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        keepalive: true
      });
    }
  } catch (error) {
    // Fail silently to avoid affecting user experience
    console.warn('Failed to send performance data:', error);
  }
}

// HOC for automatic component performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceMonitoredComponent(props: P) {
    const { measureComponentRender } = usePerformanceMonitoring();
    
    useEffect(() => {
      const measurement = measureComponentRender(componentName);
      measurement.start();
      
      return () => {
        measurement.end();
      };
    }, [measureComponentRender]);

    return <WrappedComponent {...props} />;
  };
}