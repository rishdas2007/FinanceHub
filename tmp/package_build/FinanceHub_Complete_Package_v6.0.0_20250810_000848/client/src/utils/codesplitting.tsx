import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Loading component for lazy-loaded routes
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <span className="text-gray-600 dark:text-gray-300">Loading...</span>
      </div>
    </div>
  );
}

// Error fallback for failed lazy loading
function LazyLoadErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="text-red-500 text-lg">Failed to load component</div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// Higher-order function to create lazy-loaded components with error boundaries
export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  componentName: string
): LazyExoticComponent<T> {
  const LazyComponent = lazy(async () => {
    try {
      // Add artificial delay in development to test loading states
      if (process.env.NODE_ENV === 'development') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const module = await importFunc();
      
      // Performance tracking
      if (typeof window !== 'undefined' && window.performance) {
        performance.mark(`lazy-${componentName}-loaded`);
      }
      
      return module;
    } catch (error) {
      console.error(`Failed to load lazy component ${componentName}:`, error);
      throw error;
    }
  });

  // Add display name for debugging
  LazyComponent.displayName = `Lazy(${componentName})`;
  
  return LazyComponent;
}

// Wrapper component that adds error boundary and loading state
export function LazyWrapper({ 
  children, 
  loading = <LoadingFallback />,
  errorFallback = <LazyLoadErrorFallback />
}: {
  children: React.ReactNode;
  loading?: React.ReactNode;
  errorFallback?: React.ReactNode;
}) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <React.Suspense fallback={loading}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

// Preload utility for eager loading on user interaction
export function preloadComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  return () => {
    // Start loading the component
    const componentPromise = importFunc();
    
    // Don't await - fire and forget
    componentPromise.catch(error => {
      console.warn('Failed to preload component:', error);
    });
    
    return componentPromise;
  };
}

// Lazy-loaded route components
export const LazyDashboard = createLazyComponent(
  () => import('../pages/Dashboard'),
  'Dashboard'
);

export const LazyMomentumAnalysis = createLazyComponent(
  () => import('../components/market/MomentumAnalysis'),
  'MomentumAnalysis'
);

export const LazySectorTracker = createLazyComponent(
  () => import('../components/market/SectorTracker'),
  'SectorTracker'
);

// Preloader functions
export const preloadDashboard = preloadComponent(() => import('../pages/Dashboard'));
export const preloadMomentumAnalysis = preloadComponent(() => import('../components/market/MomentumAnalysis'));
export const preloadSectorTracker = preloadComponent(() => import('../components/market/SectorTracker'));

// Route-based code splitting configuration
export const routeConfig = {
  '/': {
    component: LazyDashboard,
    preload: preloadDashboard,
    prefetch: true // Prefetch on idle
  },
  '/momentum': {
    component: LazyMomentumAnalysis,
    preload: preloadMomentumAnalysis,
    prefetch: false
  },
  '/sectors': {
    component: LazySectorTracker,
    preload: preloadSectorTracker,
    prefetch: false
  }
};

// Intersection Observer for prefetching on link hover/visibility
export function setupPrefetching() {
  // Prefetch on link hover
  document.addEventListener('mouseover', (event) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a[href]') as HTMLAnchorElement;
    
    if (link && link.href) {
      const pathname = new URL(link.href).pathname;
      const config = routeConfig[pathname as keyof typeof routeConfig];
      
      if (config && config.preload) {
        config.preload();
      }
    }
  });

  // Prefetch critical routes on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      Object.entries(routeConfig).forEach(([path, config]) => {
        if (config.prefetch && config.preload) {
          config.preload();
        }
      });
    });
  }
}