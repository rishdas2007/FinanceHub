import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Zap, AlertTriangle } from "lucide-react";

interface ConvergenceData {
  analysis: Array<{
    symbol: string;
    confidence_score: number;
    overall_bias: string;
    market_data?: {
      price: number;
      changePercent: number;
    };
  }>;
  squeeze_monitoring: {
    symbols_in_squeeze: string[];
    potential_breakouts: string[];
    recent_successful_breakouts: string[];
  };
}

interface BreakoutSymbol {
  symbol: string;
  reason: string;
  description: string;
  confidence: number;
  bias: string;
  price?: number;
  change?: number;
}

export function BreakoutAnalysis() {
  const { data: convergenceData, isLoading } = useQuery<ConvergenceData>({
    queryKey: ['/api/convergence-analysis'],
    refetchInterval: 30000,
  });

  if (isLoading || !convergenceData) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-400" />
              Breakout Analysis
            </h2>
          </div>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Process symbols for squeeze and breakout analysis
  const getSymbolsInSqueeze = (): BreakoutSymbol[] => {
    const squeezeSymbols = convergenceData.squeeze_monitoring.symbols_in_squeeze;
    return squeezeSymbols.map(symbol => {
      const analysis = convergenceData.analysis.find(a => a.symbol === symbol);
      return {
        symbol,
        reason: "Bollinger Band Squeeze",
        description: "Low volatility compression indicating potential explosive move",
        confidence: analysis?.confidence_score || 0,
        bias: analysis?.overall_bias || "neutral",
        price: analysis?.market_data?.price,
        change: analysis?.market_data?.changePercent
      };
    });
  };

  const getRecentBreakouts = (): BreakoutSymbol[] => {
    const breakoutSymbols = convergenceData.squeeze_monitoring.recent_successful_breakouts;
    return breakoutSymbols.map(symbol => {
      const analysis = convergenceData.analysis.find(a => a.symbol === symbol);
      return {
        symbol,
        reason: "Successful Breakout",
        description: "Recently broke out of consolidation with strong momentum",
        confidence: analysis?.confidence_score || 0,
        bias: analysis?.overall_bias || "neutral",
        price: analysis?.market_data?.price,
        change: analysis?.market_data?.changePercent
      };
    });
  };

  const getPotentialBreakouts = (): BreakoutSymbol[] => {
    const potentialSymbols = convergenceData.squeeze_monitoring.potential_breakouts;
    return potentialSymbols.map(symbol => {
      const analysis = convergenceData.analysis.find(a => a.symbol === symbol);
      return {
        symbol,
        reason: "High Probability Setup",
        description: "Strong convergence signals indicating imminent directional move",
        confidence: analysis?.confidence_score || 0,
        bias: analysis?.overall_bias || "neutral",
        price: analysis?.market_data?.price,
        change: analysis?.market_data?.changePercent
      };
    });
  };

  const symbolsInSqueeze = getSymbolsInSqueeze();
  const recentBreakouts = getRecentBreakouts();
  const potentialBreakouts = getPotentialBreakouts();

  const getBiasIcon = (bias: string) => {
    switch (bias) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getBiasColor = (bias: string) => {
    switch (bias) {
      case 'bullish':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'bearish':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    }
  };

  const SymbolCard = ({ symbol }: { symbol: BreakoutSymbol }) => (
    <div className="bg-slate-800 rounded p-3 border border-slate-600">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">{symbol.symbol}</span>
          {getBiasIcon(symbol.bias)}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            symbol.bias === 'bullish' ? 'bg-green-900/50 text-green-400' :
            symbol.bias === 'bearish' ? 'bg-red-900/50 text-red-400' :
            'bg-yellow-900/50 text-yellow-400'
          }`}>
            {symbol.bias}
          </span>
        </div>
        {symbol.price && (
          <div className="text-right text-sm">
            <div className="font-mono text-slate-300">${symbol.price.toFixed(2)}</div>
            <div className={`text-xs ${symbol.change && symbol.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {symbol.change?.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
      <div className="text-sm text-slate-400 mb-1">
        <span className="text-blue-400 font-medium">{symbol.reason}:</span> {symbol.description}
      </div>
      <div className="text-xs text-slate-500">
        Confidence: {symbol.confidence}%
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700" data-testid="breakout-analysis-card">
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-400" />
          Breakout Analysis
        </h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Symbols in Squeeze */}
          <div>
            <h3 className="text-sm font-medium text-blue-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              Symbols in Squeeze
            </h3>
            
            <div className="space-y-4">
              <div className="text-slate-400 text-sm">
                Currently experiencing low volatility compression.
              </div>
              
              {symbolsInSqueeze.length === 0 ? (
                <div className="text-sm text-slate-400 italic">
                  No active squeezes detected.
                </div>
              ) : (
                <div className="space-y-3">
                  {symbolsInSqueeze.map((symbol, index) => (
                    <div key={`squeeze-${index}`} className="flex items-center justify-between">
                      <div className="text-slate-300 font-medium">{symbol.symbol}:</div>
                      <div className="text-right">
                        <div className="text-slate-400 text-sm">{symbol.reason}</div>
                        <div className="text-xs text-slate-500">{symbol.confidence}% confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Recent Successful Breakouts */}
          <div>
            <h3 className="text-sm font-medium text-blue-400 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              Recent Successful Breakouts
            </h3>
            
            <div className="space-y-4">
              <div className="text-slate-400 text-sm">
                Past 30 days with positive returns.
              </div>
              
              {recentBreakouts.length === 0 ? (
                <div className="text-sm text-slate-400 italic">
                  No recent successful breakouts.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBreakouts.map((symbol, index) => (
                    <div key={`breakout-${index}`} className="flex items-center justify-between">
                      <div className="text-slate-300 font-medium">{symbol.symbol}:</div>
                      <div className="text-right">
                        <div className="text-slate-400 text-sm">{symbol.reason}</div>
                        <div className="text-xs text-slate-500">{symbol.confidence}% confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* High Probability Setups - Full Width */}
        {potentialBreakouts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-700">
            <h3 className="text-sm font-medium text-blue-400 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-400" />
              High Probability Setups
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {potentialBreakouts.map((symbol, index) => (
                <div key={`potential-${index}`} className="flex items-center justify-between">
                  <div className="text-slate-300 font-medium">{symbol.symbol}:</div>
                  <div className="text-right">
                    <div className="text-slate-400 text-sm">{symbol.reason}</div>
                    <div className="text-xs text-slate-500">{symbol.confidence}% confidence</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Methodology Footer */}
        <div className="mt-8 pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 space-y-1">
            <p><strong className="text-slate-400">Bollinger Band Squeeze:</strong> Identifies periods of low volatility where Bollinger Bands contract, often preceding significant price movements.</p>
            <p><strong className="text-slate-400">Successful Breakouts:</strong> Symbols that recently broke out of consolidation patterns with sustained momentum and volume confirmation.</p>
            <p><strong className="text-slate-400">High Probability Setups:</strong> Symbols with convergence analysis confidence scores above 70%, indicating strong technical signal alignment.</p>
            <p><strong className="text-slate-400">Real-time Data:</strong> Analysis updates every 30 seconds using live market data from Twelve Data WebSocket feed during market hours.</p>
          </div>
        </div>
      </div>
    </div>
  );
}