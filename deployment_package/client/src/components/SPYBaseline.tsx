import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SPYData {
  ticker: 'SPY';
  price: number;
  change: number;
  changePercent: number;
  rsi: number;
  zScore: number;
  annualReturn: number;
  sharpeRatio: number;
  momentum: string;
  signal: string;
}

export function SPYBaseline() {
  const { data: spyData, isLoading, error } = useQuery<SPYData>({
    queryKey: ['/api/unified/spy-baseline'],
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,    // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white text-lg">SPY Baseline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-600 rounded w-3/4"></div>
            <div className="h-4 bg-gray-600 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !spyData) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white text-lg">SPY Baseline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">SPY data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = spyData.changePercent >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>SPY Baseline</span>
          </div>
          <Badge variant={isPositive ? "default" : "destructive"} className="text-sm">
            {spyData.ticker}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Price and Change */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-white">
              ${spyData.price.toFixed(2)}
            </div>
            <div className={`flex items-center space-x-1 text-sm ${
              isPositive ? 'text-gain-green' : 'text-loss-red'
            }`}>
              <TrendIcon className="h-4 w-4" />
              <span>{isPositive ? '+' : ''}{spyData.changePercent.toFixed(1)}%</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Change</div>
            <div className={`text-lg font-semibold ${
              isPositive ? 'text-gain-green' : 'text-loss-red'
            }`}>
              {isPositive ? '+' : ''}${spyData.change.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-600">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">RSI:</span>
              <Badge variant={
                spyData.rsi > 70 ? 'destructive' : 
                spyData.rsi < 30 ? 'default' : 'secondary'
              }>
                {spyData.rsi.toFixed(1)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Z-Score:</span>
              <span className="text-sm font-medium text-white">
                {spyData.zScore.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Annual Return:</span>
              <span className={`text-sm font-medium ${
                spyData.annualReturn >= 0 ? 'text-gain-green' : 'text-loss-red'
              }`}>
                {spyData.annualReturn.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Sharpe Ratio:</span>
              <span className="text-sm font-medium text-white">
                {spyData.sharpeRatio.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Signal */}
        <div className="pt-2 border-t border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Signal:</span>
            <Badge variant={
              spyData.momentum === 'Bullish' ? 'default' : 
              spyData.momentum === 'Bearish' ? 'destructive' : 'secondary'
            }>
              {spyData.momentum}
            </Badge>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {spyData.signal}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}