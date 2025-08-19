import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Clean ETF data interface
interface ETFTechnicalData {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  
  // Technical indicators
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  bollingerPercB: number | null;
  
  // Z-scores for signals
  zScore: number | null;
  rsiZScore: number | null;
  macdZScore: number | null;
  bbZScore: number | null;
  signal: 'BUY' | 'SELL' | 'HOLD';
  
  // Moving averages
  sma20: number | null;
  sma50: number | null;
  maGap: number | null;
  
  lastUpdated: string;
}

interface ETFTechnicalResponse {
  success: boolean;
  data: ETFTechnicalData[];
  timestamp: string;
  source: string;
}

// Format helpers
const formatPrice = (price: number | null): string => {
  if (price === null || isNaN(price)) return 'N/A';
  return `$${price.toFixed(2)}`;
};

const formatPercent = (value: number | null): string => {
  if (value === null || isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
};

const formatZScore = (zscore: number | null): string => {
  if (zscore === null || isNaN(zscore)) return 'N/A';
  return zscore.toFixed(4);
};

const formatTechnical = (value: number | null): string => {
  if (value === null || isNaN(value)) return 'N/A';
  return value.toFixed(2);
};

// Signal badge component
const SignalBadge = ({ signal }: { signal: string }) => {
  const colors = {
    BUY: 'bg-green-600 text-white',
    SELL: 'bg-red-600 text-white',
    HOLD: 'bg-yellow-600 text-black'
  };
  
  return (
    <Badge className={colors[signal as keyof typeof colors] || colors.HOLD}>
      {signal}
    </Badge>
  );
};

// Z-Score color coding
const getZScoreColor = (zscore: number | null): string => {
  if (zscore === null) return 'text-gray-400';
  if (zscore > 2) return 'text-red-400';
  if (zscore > 1) return 'text-orange-400';
  if (zscore < -2) return 'text-green-400';
  if (zscore < -1) return 'text-blue-400';
  return 'text-gray-300';
};

export const ETFTechnicalMetricsClean = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, refetch } = useQuery<ETFTechnicalResponse>({
    queryKey: ['/api/etf/robust', refreshKey],
    queryFn: () => fetch('/api/etf/robust').then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            ETF Technical Metrics - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Failed to load ETF data: {error.message}</p>
          <Button onClick={handleRefresh} className="mt-2" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            ETF Technical Metrics
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Recently'}
            </span>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <LoadingSkeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-300">Symbol</th>
                    <th className="text-right py-2 text-gray-300">Z-Score</th>
                    <th className="text-center py-2 text-gray-300">Signal</th>
                    <th className="text-right py-2 text-gray-300">RSI</th>
                    <th className="text-right py-2 text-gray-300">MACD</th>
                    <th className="text-right py-2 text-gray-300">%B</th>
                    <th className="text-right py-2 text-gray-300">MA Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data?.map((etf) => (
                    <tr key={etf.symbol} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="py-3">
                        <div>
                          <div className="font-medium text-white">{etf.symbol}</div>
                          <div className={`text-xs ${etf.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {etf.changePercent >= 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
                          </div>
                        </div>
                      </td>
                      
                      <td className="text-right py-3">
                        <div className={`font-mono ${getZScoreColor(etf.zScore)}`}>
                          {formatZScore(etf.zScore)}
                        </div>
                      </td>
                      
                      <td className="text-center py-3">
                        <SignalBadge signal={etf.signal} />
                      </td>
                      
                      <td className="text-right py-3">
                        <div className="text-gray-300">
                          {formatTechnical(etf.rsi)}
                          {etf.rsi && (
                            <div className={`text-xs ${getZScoreColor(etf.rsiZScore)}`}>
                              Z: {formatZScore(etf.rsiZScore)}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="text-right py-3">
                        <div className="text-gray-300">
                          {formatTechnical(etf.macd)}
                          {etf.macd && (
                            <div className={`text-xs ${getZScoreColor(etf.macdZScore)}`}>
                              Z: {formatZScore(etf.macdZScore)}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="text-right py-3">
                        <div className="text-gray-300">
                          {etf.bollingerPercB ? formatPercent(etf.bollingerPercB * 100) : 'N/A'}
                          {etf.bollingerPercB && (
                            <div className={`text-xs ${getZScoreColor(etf.bbZScore)}`}>
                              Z: {formatZScore(etf.bbZScore)}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="text-right py-3">
                        <div className="text-gray-300">
                          {formatPercent(etf.maGap)}
                          <div className="text-xs text-gray-500">
                            Z: N/A
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
              <span>
                Signals: {data?.data?.filter(etf => etf.signal === 'BUY').length || 0} BUY, {' '}
                {data?.data?.filter(etf => etf.signal === 'SELL').length || 0} SELL, {' '}
                {data?.data?.filter(etf => etf.signal === 'HOLD').length || 0} HOLD
              </span>
              <span>Total: {data?.data?.length || 0} ETFs</span>
            </div>
            
            {data?.source && (
              <div className="mt-2 text-xs text-gray-500">
                Data source: {data.source}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ETFTechnicalMetricsClean;