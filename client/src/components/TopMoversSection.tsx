import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ETFData {
  symbol: string;
  sector: string;
  price: number;
  changePercent: number;
  change: number;
  volume?: number;
  momentum?: {
    signal: string;
    strength: number;
  };
}

interface EconomicIndicator {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  significance?: 'high' | 'medium' | 'low';
}

interface TopMoversData {
  success: boolean;
  etfMovers: {
    gainers: ETFData[];
    losers: ETFData[];
  };
  economicMovers: EconomicIndicator[];
  momentum: {
    bullish: number;
    bearish: number;
    trending: string[];
  };
}

export function TopMoversSection() {
  const { data: moversData, isLoading } = useQuery<TopMoversData>({
    queryKey: ['/api/top-movers'],
    refetchInterval: 60000, // Refresh every minute
    staleTime: 45000, // Consider data stale after 45 seconds
  });

  if (isLoading || !moversData?.success) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loading skeleton */}
        {[1, 2].map((i) => (
          <Card key={i} className="bg-financial-card border-financial-border">
            <CardHeader>
              <div className="h-6 bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-12 bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { etfMovers, economicMovers, momentum } = moversData;

  return (
    <div className="space-y-6">
      {/* Momentum Overview */}
      <div className="bg-gradient-to-r from-financial-card to-financial-gray border border-financial-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Market Momentum</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gain-green font-medium">{momentum.bullish}% Bullish</span>
              <span className="text-gray-400">•</span>
              <span className="text-loss-red font-medium">{momentum.bearish}% Bearish</span>
            </div>
          </div>
        </div>
        {momentum.trending.length > 0 && (
          <div className="mt-2 text-sm text-gray-300">
            <span className="text-blue-400">Trending:</span> {momentum.trending.join(', ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ETF Top Movers */}
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <TrendingUp className="h-5 w-5 text-gain-green" />
              <span>ETF Movers</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Biggest sector moves in the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Top Gainers */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gain-green flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                Top Gainers
              </h4>
              {etfMovers.gainers.slice(0, 3).map((etf) => (
                <div key={etf.symbol} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-white font-medium">{etf.symbol}</span>
                    <span className="text-xs text-gray-400">{etf.sector}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">${etf.price.toFixed(2)}</div>
                    <div className={cn(
                      "text-xs font-medium",
                      etf.changePercent >= 0 ? "text-gain-green" : "text-loss-red"
                    )}>
                      {etf.changePercent >= 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Losers */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-loss-red flex items-center">
                <TrendingDown className="h-4 w-4 mr-1" />
                Top Decliners
              </h4>
              {etfMovers.losers.slice(0, 3).map((etf) => (
                <div key={etf.symbol} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-white font-medium">{etf.symbol}</span>
                    <span className="text-xs text-gray-400">{etf.sector}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">${etf.price.toFixed(2)}</div>
                    <div className={cn(
                      "text-xs font-medium",
                      etf.changePercent >= 0 ? "text-gain-green" : "text-loss-red"
                    )}>
                      {etf.changePercent >= 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Economic Indicators Movers */}
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <Activity className="h-5 w-5 text-blue-400" />
              <span>Economic Movers</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Significant changes in key economic indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {economicMovers.slice(0, 6).map((indicator, index) => (
              <div key={index} className="p-3 bg-gray-800/50 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-white truncate">
                    {indicator.metric}
                  </div>
                  {indicator.significance && (
                    <div className={cn(
                      "text-xs px-2 py-1 rounded font-medium",
                      indicator.significance === 'high' ? "bg-red-900/50 text-red-300" : 
                      indicator.significance === 'medium' ? "bg-yellow-900/50 text-yellow-300" : 
                      "bg-blue-900/50 text-blue-300"
                    )}>
                      {indicator.significance.toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-gray-400 mb-1">Current</div>
                    <div className="text-white font-mono">
                      {typeof indicator.current === 'number' 
                        ? indicator.current.toFixed(indicator.current < 10 ? 1 : 0)
                        : indicator.current
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Z-Score</div>
                    <div className={cn(
                      "font-mono font-bold",
                      Math.abs(indicator.zScore) > 2 ? "text-red-400" :
                      Math.abs(indicator.zScore) > 1 ? "text-yellow-400" :
                      "text-blue-400"
                    )}>
                      {indicator.zScore > 0 ? '+' : ''}{indicator.zScore.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Δ Z-Score</div>
                    <div className={cn(
                      "font-mono text-xs",
                      indicator.deltaZScore && Math.abs(indicator.deltaZScore) > 1 ? "text-orange-400 font-bold" :
                      indicator.deltaZScore && Math.abs(indicator.deltaZScore) > 0.5 ? "text-yellow-400" :
                      "text-gray-400"
                    )}>
                      {indicator.deltaZScore !== undefined 
                        ? `${indicator.deltaZScore > 0 ? '+' : ''}${indicator.deltaZScore.toFixed(2)}`
                        : 'N/A'
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Previous</div>
                    <div className="text-gray-300 font-mono">
                      {typeof indicator.previous === 'number' 
                        ? indicator.previous.toFixed(indicator.previous < 10 ? 1 : 0)
                        : indicator.previous
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}