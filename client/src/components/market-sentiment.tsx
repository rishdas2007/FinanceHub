import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketSentiment } from "@/types/financial";

export function MarketSentimentComponent() {
  const { data: sentiment, isLoading } = useQuery<MarketSentiment>({
    queryKey: ['/api/sentiment'],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 90000, // Data is fresh for 90 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-gray border-financial-border lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Market Sentiment Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-financial-card p-4 rounded-lg text-center animate-pulse">
                <div className="h-8 bg-gray-600 rounded mb-2"></div>
                <div className="h-4 bg-gray-600 rounded mb-1"></div>
                <div className="h-3 bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-gray border-financial-border lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Market Sentiment Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-financial-card p-4 rounded-lg text-center">
            <div className="text-warning-yellow text-2xl font-bold">
              {sentiment ? parseFloat(sentiment.vix).toFixed(1) : '--'}
            </div>
            <div className="text-sm text-gray-400">VIX</div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>Fear Index</span>
              {sentiment && (sentiment as any).vixChange && (
                <span className={`${parseFloat((sentiment as any).vixChange) >= 0 ? 'text-loss-red' : 'text-gain-green'}`}>
                  ({parseFloat((sentiment as any).vixChange) >= 0 ? '+' : ''}{parseFloat((sentiment as any).vixChange).toFixed(1)})
                </span>
              )}
            </div>
          </div>
          <div className="bg-financial-card p-4 rounded-lg text-center">
            <div className="text-white text-2xl font-bold">
              {sentiment ? parseFloat(sentiment.putCallRatio).toFixed(2) : '--'}
            </div>
            <div className="text-sm text-gray-400">Put/Call Ratio</div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>Options Flow</span>
              {sentiment && (sentiment as any).putCallChange && (
                <span className={`${parseFloat((sentiment as any).putCallChange) >= 0 ? 'text-loss-red' : 'text-gain-green'}`}>
                  ({parseFloat((sentiment as any).putCallChange) >= 0 ? '+' : ''}{parseFloat((sentiment as any).putCallChange).toFixed(2)})
                </span>
              )}
            </div>
          </div>
          <div className="bg-financial-card p-4 rounded-lg text-center">
            <div className="text-gain-green text-2xl font-bold">
              {sentiment ? `${parseFloat(sentiment.aaiiBullish).toFixed(1)}%` : '--'}
            </div>
            <div className="text-sm text-gray-400">AAII Bullish</div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>Weekly Survey</span>
              {sentiment && (sentiment as any).aaiiBullishChange && (
                <span className={`${parseFloat((sentiment as any).aaiiBullishChange) >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>
                  ({parseFloat((sentiment as any).aaiiBullishChange) >= 0 ? '+' : ''}{parseFloat((sentiment as any).aaiiBullishChange).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="bg-financial-card p-4 rounded-lg text-center">
            <div className="text-loss-red text-2xl font-bold">
              {sentiment ? `${parseFloat(sentiment.aaiiBearish).toFixed(1)}%` : '--'}
            </div>
            <div className="text-sm text-gray-400">AAII Bearish</div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
              <span>Weekly Survey</span>
              {sentiment && (sentiment as any).aaiiBearishChange && (
                <span className={`${parseFloat((sentiment as any).aaiiBearishChange) >= 0 ? 'text-loss-red' : 'text-gain-green'}`}>
                  ({parseFloat((sentiment as any).aaiiBearishChange) >= 0 ? '+' : ''}{parseFloat((sentiment as any).aaiiBearishChange).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
