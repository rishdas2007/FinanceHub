import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

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
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    }),
    staleTime: 60 * 1000, // 1 minute (align with server cache)
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes (reduced from frequent refreshes)
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  // Memoize sorted and processed metrics
  const processedMetrics = useMemo(() => {
    if (!data?.data) return [];
    
    return data.data.map(metric => ({
      ...metric,
      compositeZScore: metric.compositeZ || 0,
      maGap: metric.ma?.gapPct ? `${(metric.ma.gapPct * 100).toFixed(2)}%` : null,
      maGapNumeric: metric.ma?.gapPct ? metric.ma.gapPct * 100 : 0,
      rsi: metric.components?.rsi14 || null,
      signalColor: 
        metric.signal === 'BUY' ? 'text-green-400' :
        metric.signal === 'SELL' ? 'text-red-400' : 
        'text-yellow-400',
      signalBgColor:
        metric.signal === 'BUY' ? 'bg-green-900/20 border-green-700' :
        metric.signal === 'SELL' ? 'bg-red-900/20 border-red-700' : 
        'bg-yellow-900/20 border-yellow-700'
    }))
    .sort((a, b) => Math.abs(b.compositeZScore || 0) - Math.abs(a.compositeZScore || 0));
  }, [data?.data]);

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
                      Math.abs(metric.compositeZScore || 0) >= 1.5 ? 'text-red-400 font-bold' :
                      Math.abs(metric.compositeZScore || 0) >= 0.75 ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}>
                      {metric.compositeZScore ? metric.compositeZScore.toFixed(4) : 'N/A'}
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
                      (metric.rsi || 0) >= 70 ? 'text-red-400' :
                      (metric.rsi || 0) <= 30 ? 'text-green-400' :
                      'text-gray-300'
                    }`}>
                      {metric.rsi ? metric.rsi.toFixed(1) : 'N/A'}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`macd-${metric.symbol}`}>
                    <div className={`font-mono text-xs ${
                      (metric.components?.macdZ || 0) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {metric.components?.macdZ ? metric.components.macdZ.toFixed(3) : 'N/A'}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`bollinger-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      (metric.components?.bbPctB || 0) >= 0.8 ? 'text-red-400' :
                      (metric.components?.bbPctB || 0) <= 0.2 ? 'text-green-400' :
                      'text-gray-300'
                    }`}>
                      {metric.components?.bbPctB ? (metric.components.bbPctB * 100).toFixed(1) + '%' : 'N/A'}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`ma-gap-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      (metric.maGapNumeric || 0) >= 2 ? 'text-green-400' :
                      (metric.maGapNumeric || 0) <= -2 ? 'text-red-400' :
                      'text-gray-300'
                    }`}>
                      {metric.maGap || 'N/A'}
                    </div>
                  </td>
                  
                  <td className="p-3 text-center" data-testid={`price-change-${metric.symbol}`}>
                    <div className={`font-mono text-sm ${
                      (metric.pctChange || 0) > 0 ? 'text-green-400' : 
                      (metric.pctChange || 0) < 0 ? 'text-red-400' : 
                      'text-gray-300'
                    }`}>
                      {metric.pctChange ? 
                        `${(metric.pctChange || 0) > 0 ? '+' : ''}${(metric.pctChange * 100).toFixed(2)}%` : 
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

export default ETFMetricsTableOptimized;