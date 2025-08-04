import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, Target, Signal } from 'lucide-react';

interface ConvergenceSignal {
  id: string;
  symbol: string;
  signal_type: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  strength: number;
  detected_at: string;
  metadata: {
    rsi_value?: number;
    macd?: number;
    signal?: number;
    histogram?: number;
  };
}

interface SymbolAnalysis {
  symbol: string;
  timestamp: string;
  convergence_signals: ConvergenceSignal[];
  signal_summary: {
    total_signals: number;
    bullish_signals: number;
    bearish_signals: number;
    average_confidence: number;
    highest_confidence_signal: ConvergenceSignal | null;
  };
  overall_bias: 'bullish' | 'bearish' | 'neutral';
  confidence_score: number;
  market_data: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    lastUpdate: string;
  } | null;
}

interface ConvergenceAnalysisData {
  analysis: SymbolAnalysis[];
  signal_quality_overview: {
    total_tracked_signals: number;
    avg_success_rate: number;
    best_performing_signal_type: string;
    recent_performance_trend: string;
  };
  active_alerts: any[];
}

export function ConvergenceAnalysis() {
  const [data, setData] = useState<ConvergenceAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConvergenceAnalysis = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/convergence-analysis?symbols=SPY,QQQ,IWM');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error fetching convergence analysis:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch convergence analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchConvergenceAnalysis();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchConvergenceAnalysis, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getBiasIcon = (bias: string) => {
    switch (bias) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getBiasColor = (bias: string) => {
    switch (bias) {
      case 'bullish':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'bearish':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getSignalTypeLabel = (signalType: string) => {
    const labels: { [key: string]: string } = {
      'rsi_oversold': 'RSI Oversold',
      'rsi_overbought': 'RSI Overbought',
      'macd_bullish_crossover': 'MACD Bullish',
      'macd_bearish_crossover': 'MACD Bearish'
    };
    return labels[signalType] || signalType;
  };

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <Signal className="h-5 w-5" />
            Convergence Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <Signal className="h-5 w-5" />
            Convergence Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-4">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card className="bg-slate-900/50 border-slate-700" data-testid="convergence-analysis-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Signal className="h-5 w-5" />
          Multi-Timeframe Convergence Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Signal Quality Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Total Signals</div>
              <div className="text-lg font-bold text-slate-100">
                {data.signal_quality_overview.total_tracked_signals}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Success Rate</div>
              <div className="text-lg font-bold text-green-400">
                {data.signal_quality_overview.avg_success_rate}%
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Best Signal</div>
              <div className="text-sm font-semibold text-slate-100">
                {data.signal_quality_overview.best_performing_signal_type}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Trend</div>
              <div className="text-sm font-semibold text-blue-400 capitalize">
                {data.signal_quality_overview.recent_performance_trend}
              </div>
            </div>
          </div>

          {/* Symbol Analysis */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Symbol Analysis</h3>
            {data.analysis.map((symbol) => (
              <div key={symbol.symbol} className="bg-slate-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-100">{symbol.symbol}</span>
                    {symbol.market_data && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-300">${symbol.market_data.price.toFixed(2)}</span>
                        <span className={`${symbol.market_data.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({symbol.market_data.changePercent >= 0 ? '+' : ''}{symbol.market_data.changePercent.toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getBiasColor(symbol.overall_bias)}>
                      {getBiasIcon(symbol.overall_bias)}
                      <span className="ml-1 capitalize">{symbol.overall_bias}</span>
                    </Badge>
                    <div className="text-sm text-slate-400">
                      {symbol.confidence_score}% confidence
                    </div>
                  </div>
                </div>

                {/* Signals */}
                {symbol.convergence_signals.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-300">Active Signals:</div>
                    {symbol.convergence_signals.map((signal) => (
                      <div key={signal.id} className="bg-slate-700/50 rounded px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className={`h-4 w-4 ${
                              signal.direction === 'bullish' ? 'text-green-400' : 
                              signal.direction === 'bearish' ? 'text-red-400' : 'text-gray-400'
                            }`} />
                            <span className="text-sm font-medium text-slate-200">
                              {getSignalTypeLabel(signal.signal_type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{signal.confidence}% confidence</span>
                            <span>Strength: {(signal.strength * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        {signal.metadata && (
                          <div className="mt-1 text-xs text-slate-500">
                            {signal.metadata.rsi_value && (
                              <span>RSI: {signal.metadata.rsi_value.toFixed(1)} </span>
                            )}
                            {signal.metadata.macd && signal.metadata.signal && (
                              <span>MACD: {signal.metadata.macd.toFixed(2)} vs {signal.metadata.signal.toFixed(2)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">No active signals</div>
                )}

                {/* Signal Summary */}
                <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Total: </span>
                    <span className="text-slate-200">{symbol.signal_summary.total_signals}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Bullish: </span>
                    <span className="text-green-400">{symbol.signal_summary.bullish_signals}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Bearish: </span>
                    <span className="text-red-400">{symbol.signal_summary.bearish_signals}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Alerts */}
          {data.active_alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-100">Active Alerts</h3>
              {data.active_alerts.map((alert, index) => (
                <div key={index} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-yellow-400">{alert.symbol}</span>
                    <Badge className="bg-yellow-500/20 text-yellow-400">
                      {alert.confidence}% confidence
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    {alert.signal_type} - {alert.direction}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}