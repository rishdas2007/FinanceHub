import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp } from 'lucide-react';

interface ETFTechnicalMetric {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number | null;
  rsi: number | null;
  macd: number | null;
  bollingerPercB: number | null;
  sma50: number | null;
  sma200: number | null;
  zScore: number | null;
  rsiZScore: number | null;
  macdZScore: number | null;
  bbZScore: number | null;
  signal: 'BUY' | 'SELL' | 'HOLD';
  lastUpdated: string;
  source: string;
}

interface ETFMetricsResponse {
  success: boolean;
  data: ETFTechnicalMetric[];
  source: string;
  timestamp: string;
}

const formatValue = (value: number | null, decimals: number = 2): string => {
  if (value === null || value === undefined) return 'N/A';
  return value.toFixed(decimals);
};

const formatPercentage = (value: number | null): string => {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
};

const formatMAGap = (sma50: number | null, sma200: number | null): string => {
  if (!sma50 || !sma200) return 'N/A';
  const gap = ((sma50 - sma200) / sma200) * 100;
  return `${gap.toFixed(2)}%`;
};

const getZScoreColor = (zScore: number | null): string => {
  if (zScore === null || zScore === undefined) return 'text-gray-400';
  if (zScore >= 2) return 'text-red-400'; // Overbought
  if (zScore >= 1) return 'text-orange-400'; // Slightly high
  if (zScore <= -2) return 'text-green-400'; // Oversold
  if (zScore <= -1) return 'text-blue-400'; // Slightly low
  return 'text-yellow-400'; // Neutral
};

const getSignalColor = (signal: string): string => {
  switch (signal) {
    case 'BUY': return 'text-green-400';
    case 'SELL': return 'text-red-400';
    default: return 'text-yellow-400';
  }
};

const getSignalVariant = (signal: string): "default" | "destructive" | "secondary" | "outline" => {
  switch (signal) {
    case 'BUY': return 'default';
    case 'SELL': return 'destructive';
    default: return 'secondary';
  }
};

const getChangeColor = (changePercent: number): string => {
  if (changePercent > 0) return 'text-gain-green';
  if (changePercent < 0) return 'text-loss-red';
  return 'text-gray-400';
};

export function ETFTechnicalMetricsTable() {
  const { 
    data: rawData, 
    isLoading, 
    error,
    refetch
  } = useQuery<ETFMetricsResponse>({
    queryKey: ['/api/etf/robust'],
    refetchInterval: 30000, // 30 seconds
  });

  // Extract data from the response structure
  const metrics = rawData?.data || [];
  const lastUpdated = rawData?.timestamp;

  if (isLoading) {
    return (
      <Card className="bg-gray-900/95 backdrop-blur border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-blue-400 animate-pulse" />
            ETF Technical Metrics
            <span className="text-sm text-blue-400">Loading...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="animate-pulse grid grid-cols-7 gap-4">
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900/95 backdrop-blur border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-400" />
              ETF Technical Metrics
            </div>
            <button 
              onClick={() => refetch()}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-red-400 mb-2">Unable to load ETF technical metrics</p>
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
      <Card className="bg-gray-900/95 backdrop-blur border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-yellow-400" />
            ETF Technical Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-400">
            <p>No ETF technical metrics available</p>
            <button 
              onClick={() => refetch()}
              className="mt-3 text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Count signals for summary
  const signalCounts = metrics.reduce((acc, etf) => {
    acc[etf.signal] = (acc[etf.signal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="bg-gray-900/95 backdrop-blur border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            ETF Technical Metrics
            {lastUpdated && (
              <span className="text-xs text-gray-400 font-normal">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">
              Signals: {signalCounts.BUY || 0} BUY, {signalCounts.SELL || 0} SELL, {signalCounts.HOLD || 0} HOLD
            </span>
            <Badge variant="outline" className="text-xs">
              Total: {metrics.length} ETFs
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-300">
                <th className="text-left py-3 px-2 font-medium">Symbol</th>
                <th className="text-right py-3 px-2 font-medium">Z-Score</th>
                <th className="text-center py-3 px-2 font-medium">Signal</th>
                <th className="text-right py-3 px-2 font-medium">RSI</th>
                <th className="text-right py-3 px-2 font-medium">MACD</th>
                <th className="text-right py-3 px-2 font-medium">%B</th>
                <th className="text-right py-3 px-2 font-medium">MA Gap</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((etf) => (
                <tr 
                  key={etf.symbol} 
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  {/* Symbol Column */}
                  <td className="py-3 px-2">
                    <div>
                      <div className="font-semibold text-white">{etf.symbol}</div>
                      <div className={`text-xs ${getChangeColor(etf.changePercent)}`}>
                        {etf.changePercent > 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </td>
                  
                  {/* Z-Score Column */}
                  <td className="py-3 px-2 text-right">
                    <div className={`font-semibold ${getZScoreColor(etf.zScore)}`}>
                      {formatValue(etf.zScore, 4)}
                    </div>
                    {etf.zScore && (
                      <div className="text-xs text-gray-500">
                        Z: {formatValue(etf.zScore, 2)}
                      </div>
                    )}
                  </td>
                  
                  {/* Signal Column */}
                  <td className="py-3 px-2 text-center">
                    <Badge 
                      variant={getSignalVariant(etf.signal)}
                      className="text-xs px-2 py-1"
                    >
                      {etf.signal}
                    </Badge>
                  </td>
                  
                  {/* RSI Column */}
                  <td className="py-3 px-2 text-right">
                    <div className="text-white">{formatValue(etf.rsi, 1)}</div>
                    {etf.rsiZScore && (
                      <div className="text-xs text-gray-500">
                        Z: {formatValue(etf.rsiZScore, 2)}
                      </div>
                    )}
                  </td>
                  
                  {/* MACD Column */}
                  <td className="py-3 px-2 text-right">
                    <div className={`${etf.macd && etf.macd > 0 ? 'text-green-400' : etf.macd && etf.macd < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {formatValue(etf.macd, 3)}
                    </div>
                    {etf.macdZScore && (
                      <div className="text-xs text-gray-500">
                        Z: {formatValue(etf.macdZScore, 2)}
                      </div>
                    )}
                  </td>
                  
                  {/* %B Column */}
                  <td className="py-3 px-2 text-right">
                    <div className={`${
                      etf.bollingerPercB && etf.bollingerPercB > 0.8 ? 'text-red-400' : 
                      etf.bollingerPercB && etf.bollingerPercB < 0.2 ? 'text-green-400' : 
                      'text-gray-400'
                    }`}>
                      {formatPercentage(etf.bollingerPercB)}
                    </div>
                    {etf.bbZScore && (
                      <div className="text-xs text-gray-500">
                        Z: {formatValue(etf.bbZScore, 2)}
                      </div>
                    )}
                  </td>
                  
                  {/* MA Gap Column */}
                  <td className="py-3 px-2 text-right">
                    <div className={`${
                      etf.sma50 && etf.sma200 && etf.sma50 > etf.sma200 ? 'text-green-400' : 
                      etf.sma50 && etf.sma200 && etf.sma50 < etf.sma200 ? 'text-red-400' : 
                      'text-gray-400'
                    }`}>
                      {formatMAGap(etf.sma50, etf.sma200)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {etf.sma50 && etf.sma200 ? 
                        (etf.sma50 > etf.sma200 ? 'Bull' : 'Bear') : 
                        'N/A'
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Source and Performance Info */}
        <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
          <div>
            Data source: {rawData?.source || 'Unknown'} • 
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}
          </div>
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </CardContent>
    </Card>
  );
}