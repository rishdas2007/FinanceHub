import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingUp, TrendingDown, BarChart3, Zap } from "lucide-react";
import type { ConvergenceAnalysisResponse, ConvergenceSignal } from "../../../shared/convergence-types";

export function ConvergenceAnalysisDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("SPY");

  const { data: convergenceData, isLoading, error } = useQuery<ConvergenceAnalysisResponse>({
    queryKey: ['/api/convergence-analysis'],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time data
  });

  const { data: wsStatus } = useQuery({
    queryKey: ['/api/websocket-status'],
    refetchInterval: 10000, // Check WebSocket status every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="convergence-loading">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive" data-testid="convergence-error">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Analysis Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load convergence analysis. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!convergenceData) return null;

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'bollinger_squeeze':
        return <Zap className="h-4 w-4" />;
      case 'rsi_divergence':
        return <TrendingUp className="h-4 w-4" />;
      case 'ma_convergence':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'bullish':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'bearish':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const formatSignalType = (signalType: string) => {
    return signalType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6" data-testid="convergence-dashboard">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="total-signals-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Signals</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{convergenceData.active_alerts.length}</div>
            <p className="text-xs text-muted-foreground">
              High confidence alerts
            </p>
          </CardContent>
        </Card>

        <Card data-testid="success-rate-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {convergenceData.signal_quality_overview.avg_success_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Historical performance
            </p>
          </CardContent>
        </Card>

        <Card data-testid="squeeze-count-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Squeezes</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {convergenceData.squeeze_monitoring.symbols_in_squeeze.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Potential breakouts
            </p>
          </CardContent>
        </Card>

        <Card data-testid="websocket-status-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WebSocket Status</CardTitle>
            <div className={`h-2 w-2 rounded-full ${wsStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {wsStatus?.connected ? 'Connected' : 'Disconnected'}
            </div>
            <p className="text-xs text-muted-foreground">
              {wsStatus?.subscribedSymbols?.length || 0} symbols tracked
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="signals" className="space-y-4">
        <TabsList data-testid="convergence-tabs">
          <TabsTrigger value="signals">Active Signals</TabsTrigger>
          <TabsTrigger value="analysis">Symbol Analysis</TabsTrigger>
          <TabsTrigger value="squeeze">Squeeze Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="signals" className="space-y-4">
          <Card data-testid="active-signals-card">
            <CardHeader>
              <CardTitle>High Confidence Signals</CardTitle>
              <CardDescription>
                Convergence signals with 70%+ confidence scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {convergenceData.active_alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No high confidence signals currently active.
                </p>
              ) : (
                <div className="space-y-3">
                  {convergenceData.active_alerts.map((signal) => (
                    <div
                      key={signal.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`signal-${signal.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {getSignalIcon(signal.signal_type)}
                        <div>
                          <div className="font-medium">{signal.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatSignalType(signal.signal_type)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getDirectionColor(signal.direction)}>
                          {signal.direction}
                        </Badge>
                        <div className="text-right">
                          <div className="text-sm font-medium">{signal.confidence}%</div>
                          <div className="text-xs text-muted-foreground">confidence</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {convergenceData.analysis.map((symbolAnalysis) => (
              <Card key={symbolAnalysis.symbol} data-testid={`analysis-${symbolAnalysis.symbol}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {symbolAnalysis.symbol}
                    <Badge className={getDirectionColor(symbolAnalysis.overall_bias)}>
                      {symbolAnalysis.overall_bias}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Confidence: {symbolAnalysis.confidence_score}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-green-500">
                          {symbolAnalysis.signal_summary.bullish_signals}
                        </div>
                        <div className="text-muted-foreground">Bullish</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-red-500">
                          {symbolAnalysis.signal_summary.bearish_signals}
                        </div>
                        <div className="text-muted-foreground">Bearish</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">
                          {symbolAnalysis.signal_summary.total_signals}
                        </div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                    </div>
                    
                    {(symbolAnalysis as any).market_data && (
                      <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs">
                        <div className="flex justify-between">
                          <span>Price:</span>
                          <span className="font-mono">${(symbolAnalysis as any).market_data.price?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Change:</span>
                          <span className={`font-mono ${(symbolAnalysis as any).market_data.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(symbolAnalysis as any).market_data.changePercent?.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Updated:</span>
                          <span>{new Date((symbolAnalysis as any).market_data.lastUpdate).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {symbolAnalysis.bollinger_squeeze_status.active_squeezes.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-500/10 rounded text-sm">
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Zap className="h-3 w-3" />
                        Bollinger Squeeze Active
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="squeeze" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="squeeze-symbols-card">
              <CardHeader>
                <CardTitle>Symbols in Squeeze</CardTitle>
                <CardDescription>
                  Currently experiencing low volatility compression
                </CardDescription>
              </CardHeader>
              <CardContent>
                {convergenceData.squeeze_monitoring.symbols_in_squeeze.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active squeezes detected.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {convergenceData.squeeze_monitoring.symbols_in_squeeze.map((symbol) => (
                      <Badge key={symbol} variant="outline" className="bg-yellow-500/10">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="recent-breakouts-card">
              <CardHeader>
                <CardTitle>Recent Successful Breakouts</CardTitle>
                <CardDescription>
                  Past 30 days with positive returns
                </CardDescription>
              </CardHeader>
              <CardContent>
                {convergenceData.squeeze_monitoring.recent_successful_breakouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent successful breakouts.</p>
                ) : (
                  <div className="space-y-2">
                    {convergenceData.squeeze_monitoring.recent_successful_breakouts
                      .slice(0, 5)
                      .map((breakout) => (
                        <div key={breakout.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{breakout.symbol}</span>
                            <span className="text-muted-foreground ml-2">
                              {breakout.timeframe}
                            </span>
                          </div>
                          <div className={`font-medium ${
                            (breakout.return_7d || 0) > 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {breakout.return_7d ? `${(breakout.return_7d * 100).toFixed(1)}%` : 'N/A'}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}