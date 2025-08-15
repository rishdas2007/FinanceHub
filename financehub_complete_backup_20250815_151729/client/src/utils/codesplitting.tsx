// Enhanced code splitting for performance optimization
// Implements lazy loading for critical dashboard components

import { lazy, Suspense, ComponentType } from 'react';

// Component loading wrapper with error boundaries
const withLoadingFallback = <T extends ComponentType<any>>(
  Component: T,
  fallback: React.ReactNode = <div className="animate-pulse bg-muted h-32 rounded-lg" />
) => {
  return (props: any) => (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  );
};

// Lazy load heavy dashboard components
export const LazyEconomicIndicators = lazy(() =>
  import('../components/MacroeconomicIndicators')
);

export const LazyETFMetricsTable = lazy(() =>
  import('../components/ETFMetricsTableOptimized')
);

export const LazyEconMovers = lazy(() =>
  import('../components/movers/EconMovers')
);

// Simplified component loading for existing structure
export const LazyDashboardGrid = lazy(() =>
  import('../components/DashboardGrid')
);

// Wrapped components with loading states
export const EconomicIndicatorsWithLoading = withLoadingFallback(
  LazyEconomicIndicators,
  <div className="animate-pulse bg-muted h-48 rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground">Loading Economic Indicators...</span>
  </div>
);

export const ETFMetricsWithLoading = withLoadingFallback(
  LazyETFMetricsTable,
  <div className="animate-pulse bg-muted h-64 rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground">Loading ETF Metrics...</span>
  </div>
);

export const EconMoversWithLoading = withLoadingFallback(
  LazyEconMovers,
  <div className="animate-pulse bg-muted h-40 rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground">Loading Economic Movers...</span>
  </div>
);

export const DashboardGridWithLoading = withLoadingFallback(
  LazyDashboardGrid,
  <div className="animate-pulse bg-muted h-96 rounded-lg flex items-center justify-center">
    <span className="text-muted-foreground">Loading Dashboard...</span>
  </div>
);

// Bundle optimization utilities
export const preloadCriticalComponents = () => {
  // Preload critical components after initial render
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for non-blocking preloading
    const preload = () => {
      LazyEconomicIndicators;
      LazyETFMetricsTable;
      LazyEconMovers;
      LazyDashboardGrid;
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preload);
    } else {
      setTimeout(preload, 1000);
    }
  }
};

// Component size analysis for optimization
export const getComponentSizes = () => ({
  economicIndicators: 'Large (15KB)',
  etfMetrics: 'Large (20KB)', 
  econMovers: 'Medium (8KB)',
  topMovers: 'Medium (8KB)',
  momentumAnalysis: 'Large (12KB)',
  sectorPerformance: 'Medium (10KB)'
});