// Robust ETF Metrics Table component with enhanced error handling
// Uses the new API normalizers to handle different response shapes

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeETFMetrics, type ETFMetric } from '../lib/api-normalizers';

interface ETFMetricsTableRobustProps {
  className?: string;
}

export function ETFMetricsTableRobust({ className = '' }: ETFMetricsTableRobustProps) {
  const { 
    data: rawData, 
    isLoading, 
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/etf-metrics'],
    refetchInterval: 30000, // 30 seconds
  });

  // Normalize the ETF metrics response to ensure consistent array format
  const metrics = normalizeETFMetrics(rawData);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>ETF Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex space-x-4">
                <div className="w-16 h-4 bg-gray-700 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            ETF Metrics
            <button 
              onClick={() => refetch()}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4">
            <p className="text-red-400 mb-2">Unable to load ETF metrics</p>
            <p className="text-sm text-gray-400">
              {error instanceof Error ? error.message : 'Network error occurred'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>ETF Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-4 text-gray-400">
            <p>No ETF metrics available</p>
            <button 
              onClick={() => refetch()}
              className="mt-2 text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          ETF Metrics
          <Badge variant="outline" className="text-xs">
            {metrics.length} ETFs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((etf) => (
            <div 
              key={etf.symbol} 
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {etf.symbol}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-white">
                    {etf.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    ${etf.price.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`font-medium ${
                  etf.changePercent > 0 ? 'text-green-400' : 
                  etf.changePercent < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {etf.changePercent > 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
                </div>

                {/* Show additional metrics if available */}
                {(etf as any).weightedSignal && (
                  <Badge 
                    variant={
                      (etf as any).weightedSignal === 'BUY' ? 'default' :
                      (etf as any).weightedSignal === 'SELL' ? 'destructive' :
                      'secondary'
                    }
                    className="text-xs mt-1"
                  >
                    {(etf as any).weightedSignal}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Debug information in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-900/50 rounded text-xs">
            <div className="text-gray-400">
              Debug: Received {metrics.length} metrics from API
            </div>
            <div className="text-gray-500 truncate">
              Raw response keys: {rawData ? Object.keys(rawData).join(', ') : 'none'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}