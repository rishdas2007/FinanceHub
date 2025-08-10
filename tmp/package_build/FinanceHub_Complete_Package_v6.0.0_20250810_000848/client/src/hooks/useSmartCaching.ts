import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

/**
 * WEEK 4: SMART CACHING HOOK
 * Intelligent client-side caching with adaptive TTL and preloading
 */

export interface SmartCacheConfig {
  baseStaleTime: number;
  volatilityMultiplier: number;
  marketHoursMultiplier: number;
  errorRetryMultiplier: number;
  preloadOnHover: boolean;
  backgroundRefresh: boolean;
}

export interface CacheMetrics {
  hitRate: number;
  averageLoadTime: number;
  stalenessRate: number;
  errorRate: number;
}

export type DataType = 'market' | 'economic' | 'technical' | 'ai' | 'historical';

const DEFAULT_CONFIGS: Record<DataType, SmartCacheConfig> = {
  market: {
    baseStaleTime: 30 * 1000, // 30 seconds
    volatilityMultiplier: 0.5,
    marketHoursMultiplier: 0.7,
    errorRetryMultiplier: 2.0,
    preloadOnHover: true,
    backgroundRefresh: true
  },
  economic: {
    baseStaleTime: 10 * 60 * 1000, // 10 minutes
    volatilityMultiplier: 0.2,
    marketHoursMultiplier: 1.0,
    errorRetryMultiplier: 1.5,
    preloadOnHover: false,
    backgroundRefresh: true
  },
  technical: {
    baseStaleTime: 2 * 60 * 1000, // 2 minutes
    volatilityMultiplier: 0.4,
    marketHoursMultiplier: 0.8,
    errorRetryMultiplier: 1.8,
    preloadOnHover: true,
    backgroundRefresh: true
  },
  ai: {
    baseStaleTime: 5 * 60 * 1000, // 5 minutes
    volatilityMultiplier: 0.1,
    marketHoursMultiplier: 0.9,
    errorRetryMultiplier: 3.0,
    preloadOnHover: false,
    backgroundRefresh: false
  },
  historical: {
    baseStaleTime: 30 * 60 * 1000, // 30 minutes
    volatilityMultiplier: 0.05,
    marketHoursMultiplier: 1.0,
    errorRetryMultiplier: 1.2,
    preloadOnHover: false,
    backgroundRefresh: false
  }
};

/**
 * Smart caching hook with adaptive TTL and intelligent preloading
 */
export function useSmartCaching<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  dataType: DataType,
  options?: {
    customConfig?: Partial<SmartCacheConfig>;
    marketVolatility?: number;
    dependencies?: string[];
  }
) {
  const queryClient = useQueryClient();
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics>({
    hitRate: 0,
    averageLoadTime: 0,
    stalenessRate: 0,
    errorRate: 0
  });

  const config = {
    ...DEFAULT_CONFIGS[dataType],
    ...options?.customConfig
  };

  // Calculate smart stale time based on market conditions
  const calculateStaleTime = useCallback(() => {
    const marketVolatility = options?.marketVolatility ?? 0.3;
    const isMarketHours = isCurrentlyMarketHours();
    
    let staleTime = config.baseStaleTime;
    
    // Adjust for market volatility (higher volatility = shorter cache)
    staleTime *= (1 - marketVolatility * config.volatilityMultiplier);
    
    // Adjust for market hours
    if (isMarketHours) {
      staleTime *= config.marketHoursMultiplier;
    }
    
    return Math.max(5000, staleTime); // Minimum 5 seconds
  }, [config, options?.marketVolatility]);

  // Enhanced query with metrics tracking
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const startTime = Date.now();
      try {
        const result = await queryFn();
        const loadTime = Date.now() - startTime;
        
        // Update metrics
        updateMetrics({
          loadTime,
          wasError: false,
          wasCacheHit: loadTime < 50 // Assume cache hit if very fast
        });
        
        return result;
      } catch (error) {
        updateMetrics({
          loadTime: Date.now() - startTime,
          wasError: true,
          wasCacheHit: false
        });
        throw error;
      }
    },
    staleTime: calculateStaleTime(),
    gcTime: calculateStaleTime() * 2,
    refetchInterval: config.backgroundRefresh ? calculateStaleTime() * 1.5 : false,
    refetchOnWindowFocus: dataType === 'market' || dataType === 'technical',
    retry: (failureCount) => {
      const maxRetries = dataType === 'ai' ? 1 : 3;
      return failureCount < maxRetries;
    },
    retryDelay: (attemptIndex) => {
      return Math.min(1000 * Math.pow(2, attemptIndex) * config.errorRetryMultiplier, 30000);
    }
  });

  // Update cache metrics
  const updateMetrics = useCallback((update: {
    loadTime: number;
    wasError: boolean;
    wasCacheHit: boolean;
  }) => {
    setCacheMetrics(prev => {
      const totalRequests = (prev.hitRate * 100) + (prev.stalenessRate * 100) + 1;
      const cacheHits = prev.hitRate * 100 + (update.wasCacheHit ? 1 : 0);
      const errors = prev.errorRate * 100 + (update.wasError ? 1 : 0);
      
      return {
        hitRate: cacheHits / totalRequests,
        averageLoadTime: (prev.averageLoadTime + update.loadTime) / 2,
        stalenessRate: prev.stalenessRate, // Would need server timestamp to calculate
        errorRate: errors / totalRequests
      };
    });
  }, []);

  // Preload related data based on dependencies
  const preloadDependencies = useCallback(async () => {
    if (!options?.dependencies?.length) return;
    
    for (const depKey of options.dependencies) {
      const existingData = queryClient.getQueryData([depKey]);
      if (!existingData) {
        // Preload in background without blocking
        queryClient.prefetchQuery({
          queryKey: [depKey],
          queryFn: () => fetch(`/api/${depKey}`).then(r => r.json()),
          staleTime: calculateStaleTime()
        });
      }
    }
  }, [options?.dependencies, queryClient, calculateStaleTime]);

  // Preload on hover (for interactive components)
  const handlePreloadHover = useCallback(() => {
    if (config.preloadOnHover && !query.data && !query.isLoading) {
      query.refetch();
    }
  }, [config.preloadOnHover, query]);

  // Background refresh when data becomes stale
  useEffect(() => {
    if (!config.backgroundRefresh) return;
    
    const interval = setInterval(() => {
      const queryState = queryClient.getQueryState(queryKey);
      if (queryState?.isStale && !queryState.isFetching) {
        query.refetch();
      }
    }, calculateStaleTime());

    return () => clearInterval(interval);
  }, [config.backgroundRefresh, queryClient, queryKey, query, calculateStaleTime]);

  // Preload dependencies when main query succeeds
  useEffect(() => {
    if (query.isSuccess && options?.dependencies?.length) {
      preloadDependencies();
    }
  }, [query.isSuccess, preloadDependencies, options?.dependencies]);

  return {
    ...query,
    cacheMetrics,
    smartStaleTime: calculateStaleTime(),
    preloadOnHover: handlePreloadHover,
    invalidateCache: () => queryClient.invalidateQueries({ queryKey }),
    prefetchData: () => queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: calculateStaleTime()
    })
  };
}

/**
 * Hook for managing multiple related queries with coordinated caching
 */
export function useCoordinatedCaching<T extends Record<string, any>>(
  queries: Array<{
    key: string[];
    fn: () => Promise<any>;
    type: DataType;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>,
  options?: {
    loadSequentially?: boolean;
    failFast?: boolean;
  }
) {
  const queryClient = useQueryClient();
  const [loadingState, setLoadingState] = useState<{
    stage: number;
    completed: string[];
    failed: string[];
  }>({
    stage: 0,
    completed: [],
    failed: []
  });

  // Sort queries by priority
  const sortedQueries = queries.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Execute queries with coordination
  const executeQueries = useCallback(async () => {
    if (options?.loadSequentially) {
      // Load one by one for critical dependencies
      for (const [index, query] of sortedQueries.entries()) {
        setLoadingState(prev => ({ ...prev, stage: index }));
        
        try {
          await queryClient.fetchQuery({
            queryKey: query.key,
            queryFn: query.fn,
            staleTime: DEFAULT_CONFIGS[query.type].baseStaleTime
          });
          
          setLoadingState(prev => ({
            ...prev,
            completed: [...prev.completed, query.key.join('-')]
          }));
        } catch (error) {
          setLoadingState(prev => ({
            ...prev,
            failed: [...prev.failed, query.key.join('-')]
          }));
          
          if (options?.failFast && query.priority === 'critical') {
            throw error;
          }
        }
      }
    } else {
      // Load in parallel with priority-based batching
      const criticalQueries = sortedQueries.filter(q => q.priority === 'critical');
      const otherQueries = sortedQueries.filter(q => q.priority !== 'critical');
      
      // Load critical queries first
      if (criticalQueries.length > 0) {
        await Promise.allSettled(
          criticalQueries.map(query =>
            queryClient.fetchQuery({
              queryKey: query.key,
              queryFn: query.fn,
              staleTime: DEFAULT_CONFIGS[query.type].baseStaleTime
            })
          )
        );
      }
      
      // Then load other queries in parallel
      if (otherQueries.length > 0) {
        await Promise.allSettled(
          otherQueries.map(query =>
            queryClient.fetchQuery({
              queryKey: query.key,
              queryFn: query.fn,
              staleTime: DEFAULT_CONFIGS[query.type].baseStaleTime
            })
          )
        );
      }
    }
  }, [sortedQueries, queryClient, options]);

  return {
    executeQueries,
    loadingState,
    isLoading: loadingState.stage < queries.length,
    progress: (loadingState.completed.length / queries.length) * 100
  };
}

/**
 * Utility functions
 */
function isCurrentlyMarketHours(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getUTCHours();
  
  // Market is closed on weekends
  if (day === 0 || day === 6) return false;
  
  // EST market hours: 9:30 AM - 4:00 PM (14:30 - 21:00 UTC)
  return hour >= 14 && hour < 21;
}

/**
 * Cache optimization recommendations
 */
export function useCacheOptimizationRecommendations(metrics: CacheMetrics) {
  return {
    recommendations: [
      ...(metrics.hitRate < 0.7 ? ['Consider increasing stale time for better cache hits'] : []),
      ...(metrics.averageLoadTime > 1000 ? ['Optimize query functions or add more granular caching'] : []),
      ...(metrics.errorRate > 0.1 ? ['Implement better error handling and retry logic'] : []),
      ...(metrics.stalenessRate > 0.3 ? ['Consider more frequent background refreshes'] : [])
    ],
    performanceScore: Math.round(
      metrics.hitRate * 40 + 
      (metrics.averageLoadTime < 500 ? 30 : 15) +
      (1 - metrics.errorRate) * 20 +
      (1 - metrics.stalenessRate) * 10
    )
  };
}