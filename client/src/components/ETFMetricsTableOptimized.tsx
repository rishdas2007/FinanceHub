import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';

// Utility functions for safe number formatting
const safeToFixed = (value: number | null | undefined, digits: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return Number(value).toFixed(digits);
};

const safePercent = (value: number | null | undefined, digits: number = 1): string => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${Number(value * 100).toFixed(digits)}%`;
};

const safeComparison = (value: number | null | undefined, defaultValue: number = 0): number => {
  return value ?? defaultValue;
};

interface ETFMetric {
  symbol: string;
  price: number;
  pctChange: number;
  compositeZ: number | null;
  signal: string;
  components: {
    macdZ: number | null;
    rsi14: number | null;
    bbPctB: number | null;
    maGapPct: number | null;
    mom5dZ: number | null;
  };
  ma: {
    ma50: number | null;
    ma200: number | null;
    gapPct: number | null;
  };
  atr14: number | null;
  volume?: number;
  lastUpdated?: string;
}

interface ETFMetricsResponse {
  success: boolean;
  data: ETFMetric[];
  timestamp: string;
}

const ETFMetricsTableOptimized = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, refetch } = useQuery<ETFMetricsResponse>({
    queryKey: ['/api/etf-enhanced/metrics', refreshKey],
    queryFn: () => fetch('/api/etf-enhanced/metrics').then(res => {
      console.log('🔍 ETF API Response Status:', res.status, res.statusText);
      if (!res.ok) {
        console.error('🚨 ETF API Error Response:', res.status);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    }).then(data => {
      console.log('🔍 ETF API Raw Data:', {
        success: data?.success,
        dataType: typeof data?.data,
        dataLength: data?.data?.length,
        firstMetric: data?.data?.[0],
        dataKeys: Object.keys(data || {})
      });
      return data;
    }).catch(error => {
      console.error('🚨 ETF API Fetch Error:', error);
      throw error;
    }),
    staleTime: 60 * 1000, // 1 minute (align with server cache)
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes (reduced from frequent refreshes)
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  // Debug logging for data analysis
  useEffect(() => {
    if (data && !isLoading) {
      console.log('📊 ETF Data Analysis:', {
        hasData: !!data,
        dataShape: Object.keys(data || {}),
        metricsCount: data?.data?.length || 0,
        sampleMetric: data?.data?.[0] ? Object.keys(data.data[0]) : 'none',
        nullFields: data?.data?.[0] ?
          Object.entries(data.data[0])
            .filter(([, value]) => value === null || value === undefined)
            .map(([key]) => key) : []
      });
    }
  }, [data, isLoading]);

  // Memoize sorted and processed metrics with comprehensive validation
  const processedMetrics = useMemo(() => {
    console.log('🔍 Raw API data:', { data, hasData: !!data?.data });

    // Handle different API response structures
    const metricsArray = data?.data || [];
    console.log('🔍 Metrics array:', { type: typeof metricsArray, length: metricsArray?.length, first: metricsArray?.[0] });

    if (!Array.isArray(metricsArray)) {
      console.warn('🚨 Metrics is not an array:', metricsArray);
      return [];
    }

    const processed = metricsArray.map(metric => {
      // Validate each metric has required fields
      if (!metric || typeof metric !== 'object') {
        console.warn('🚨 Invalid metric object:', metric);
        return null;
      }

      if (!metric.symbol) {
        console.warn('🚨 Metric missing symbol:', metric);
        return null;
      }

      console.log(`🔍 ${metric.symbol} Z-Score debug:`, {
        compositeZ: metric.compositeZ,
        macdZ: metric.components?.macdZ,
        allNumericFields: Object.entries(metric).filter(([k,v]) => typeof v === 'number')
      });

      return {
        ...metric,
        // Map API field names to frontend expectations with comprehensive fallbacks
        symbol: metric.symbol,
        compositeZScore: metric.compositeZ || null,
        rsi: metric.components?.rsi14 || null,
        macdZ: metric.components?.macdZ || null,
        bbPctB: metric.components?.bbPctB || null,
        pctChangeFormatted: metric.pctChange || null,
        signal: (() => {
          const zScore = metric.compositeZ || 0;
          return zScore >= 0.75 ? 'SELL' : zScore <= -0.75 ? 'BUY' : 'HOLD';
        })(),
        maGap: (metric.ma?.gapPct ? safePercent(metric.ma.gapPct, 2) : null),
        maGapNumeric: metric.ma?.gapPct ? metric.ma.gapPct * 100 : 0,
        signalColor: 
          metric.signal === 'BUY' ? 'text-green-400' :
          metric.signal === 'SELL' ? 'text-red-400' : 
          'text-yellow-400',
        signalBgColor:
          metric.signal === 'BUY' ? 'bg-green-900/20 border-green-700' :
          metric.signal === 'SELL' ? 'bg-red-900/20 border-red-700' : 
          'bg-yellow-900/20 border-yellow-700'
      };
    })
    .filter((metric): metric is NonNullable<typeof metric> => metric !== null); // Remove null entries with type guard

    console.log('🔍 Processed metrics:', processed.length, 'items');

    // Sort by symbol alphabetically 
    return processed.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [data]);

  if (isLoading) {
    return <LoadingSkeleton variant="table" rows={8} className="min-h-[400px]" />;
  }

  if (error) {
    return (
      <Card className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <h3 className="text-lg font-semibold text-white">ETF Metrics Error</h3>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="border-blue-600 text-blue-400 hover:bg-blue-600/10">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <p className="text-red-400 mt-2">
          {error instanceof Error ? error.message : 'Failed to load ETF metrics data'}
        </p>
      </Card>
    );
  }

  if (!data?.success || !processedMetrics.length) {
    return (
      <Card className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6">
        <div className="text-center">
          <p className="text-gray-400">No ETF metrics data available</p>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
            Refresh Data
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700" data-testid="etf-metrics-table">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          ETF Technical Metrics
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Updated: {new Date(data.timestamp).toLocaleTimeString()}
          </span>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="border-blue-600 text-blue-400 hover:bg-blue-600/10">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-3 text-gray-300 font-medium">Symbol</th>
                <th className="text-center p-3 text-gray-300 font-medium">Z-Score</th>
                <th className="text-center p-3 text-gray-300 font-medium">Signal</th>
                <th className="text-center p-3 text-gray-300 font-medium">RSI</th>
                <th className="text-center p-3 text-gray-300 font-medium">MACD</th>
                <th className="text-center p-3 text-gray-300 font-medium">%B</th>
                <th className="text-center p-3 text-gray-300 font-medium">MA Gap</th>
                <th className="text-center p-3 text-gray-300 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {processedMetrics.map((metric) => (
                <tr 
                  key={metric.symbol} 
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                  data-testid={`etf-row-${metric.symbol}`}
                >
                  <td className="p-3">
                    <div className="font-medium text-white">{metric.symbol}</div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`zscore-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      Math.abs(safeComparison(metric.compositeZScore)) >= 1.5 ? 'text-red-400 font-bold' :
                      Math.abs(safeComparison(metric.compositeZScore)) >= 0.75 ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}>
                      {safeToFixed(metric.compositeZScore, 4)}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`signal-${metric.symbol}`}>
                    <Badge 
                      className={`font-medium px-3 py-1 ${metric.signalBgColor} ${metric.signalColor}`}
                    >
                      {metric.signal === 'BUY' && <TrendingUp className="h-3 w-3 mr-1" />}
                      {metric.signal === 'SELL' && <TrendingDown className="h-3 w-3 mr-1" />}
                      {metric.signal === 'HOLD' && <Minus className="h-3 w-3 mr-1" />}
                      {metric.signal}
                    </Badge>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`rsi-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      safeComparison(metric.rsi) >= 70 ? 'text-red-400' :
                      safeComparison(metric.rsi) <= 30 ? 'text-green-400' :
                      'text-gray-300'
                    }`}>
                      {safeToFixed(metric.rsi, 1)}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`macd-${metric.symbol}`}>
                    <div className={`font-mono text-xs ${
                      safeComparison(metric.macdZ) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {safeToFixed(metric.macdZ, 3)}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`bollinger-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      safeComparison(metric.bbPctB) >= 0.8 ? 'text-red-400' :
                      safeComparison(metric.bbPctB) <= 0.2 ? 'text-green-400' :
                      'text-gray-300'
                    }`}>
                      {safePercent(metric.bbPctB, 1)}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`ma-gap-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      safeComparison(metric.maGapNumeric) >= 2 ? 'text-green-400' :
                      safeComparison(metric.maGapNumeric) <= -2 ? 'text-red-400' :
                      'text-gray-300'
                    }`}>
                      {metric.maGap || 'N/A'}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`price-change-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      safeComparison(metric.pctChangeFormatted) > 0 ? 'text-green-400' : 
                      safeComparison(metric.pctChangeFormatted) < 0 ? 'text-red-400' : 
                      'text-gray-300'
                    }`}>
                      {metric.pctChangeFormatted !== null ? 
                        `${safeComparison(metric.pctChangeFormatted) > 0 ? '+' : ''}${safePercent(metric.pctChangeFormatted, 2)}` : 
                        'N/A'
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-gray-700 bg-gray-800/30">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>
              Signals: {processedMetrics.filter(m => m.signal === 'BUY').length} BUY, {' '}
              {processedMetrics.filter(m => m.signal === 'SELL').length} SELL, {' '}
              {processedMetrics.filter(m => m.signal === 'HOLD').length} HOLD
            </span>
            <span>Total: {processedMetrics.length} ETFs</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Error Boundary Component
function ETFErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <Card className="bg-gray-900/95 backdrop-blur rounded-lg border border-red-500 p-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <h3 className="text-red-400 font-semibold">ETF Metrics Error</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          {error.message || 'Failed to load ETF metrics data'}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={resetErrorBoundary} variant="outline" size="sm" className="border-red-600 text-red-400 hover:bg-red-600/10">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
        <details className="mt-4 text-left">
          <summary className="text-xs text-gray-500 cursor-pointer">Technical Details</summary>
          <pre className="text-xs text-gray-600 mt-2 p-2 bg-gray-800 rounded overflow-auto">
            {error.stack}
          </pre>
        </details>
      </div>
    </Card>
  );
}

// Wrapped component with error boundary
export default function ETFMetricsTableOptimizedWrapper() {
  return (
    <ErrorBoundary 
      FallbackComponent={ETFErrorFallback}
      onError={(error, errorInfo) => {
        console.error('🚨 ETF Metrics Component Error:', error, errorInfo);
      }}
    >
      <ETFMetricsTableOptimized />
    </ErrorBoundary>
  );
}