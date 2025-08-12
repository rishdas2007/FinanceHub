import React from 'react';
import { useBulkEtfMetrics } from '../hooks/useBulkEtfMetrics';
import { useDeferredInit } from '../hooks/useDeferredInit';
import { ETFTableVirtualized } from './ETFTableVirtualized';

export function ETFDashboard() {
  const { data: bulkData, isLoading, error } = useBulkEtfMetrics();

  // Defer non-critical initialization
  useDeferredInit(() => {
    console.log('🚀 ETF Dashboard initialized with bulk data endpoint');
    // Initialize performance monitoring here if needed
  }, 500);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Failed to load ETF data</h3>
        <p className="text-red-600 text-sm">{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const items = bulkData?.items || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            ETF Performance Overview
          </h2>
          <div className="text-sm text-gray-500">
            {items.length} ETFs • Updated {bulkData?.updatedAt ? new Date(bulkData.updatedAt).toLocaleTimeString() : 'now'}
          </div>
        </div>
        
        {items.length > 0 ? (
          <ETFTableVirtualized items={items} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No ETF data available
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-800 font-medium mb-2">Performance Optimization Active</h3>
        <p className="text-blue-700 text-sm">
          Using bulk endpoint with caching, ETag headers, and virtualized rendering for optimal performance.
          Data refreshes every 60 seconds with stale-while-revalidate caching.
        </p>
      </div>
    </div>
  );
}