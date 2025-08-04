import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
    symbols_in_squeeze: number;
    potential_breakouts: string[];
    average_squeeze_duration: number;
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
  const { data: convergenceData, isLoading, error } = useQuery<ConvergenceData>({
    queryKey: ['/api/convergence-analysis'],
    refetchInterval: 30000,
    staleTime: 15000,
    gcTime: 60000,
  });

  // Memoize processed data to prevent unnecessary recalculations
  const potentialBreakouts = useMemo(() => {
    if (!convergenceData) return [];

    const potentialSymbols = convergenceData.squeeze_monitoring.potential_breakouts || [];
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
  }, [convergenceData]);

  // Show error state
  if (error) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            Breakout Analysis
          </h2>
        </div>
        <div className="p-6">
          <div className="text-red-400 text-sm">
            Unable to load convergence data. Please try again.
          </div>
        </div>
      </div>
    );
  }

  // Show loading state only on initial load
  if (isLoading && !convergenceData) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            Breakout Analysis
          </h2>
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
        {isLoading && convergenceData && (
          <div className="text-xs text-blue-400 flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
            Updating...
          </div>
        )}
      </div>
      
      <div className="p-6">
        {/* High Probability Setups */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            High Probability Setups ({potentialBreakouts.length})
          </h3>
          {potentialBreakouts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {potentialBreakouts.slice(0, 9).map((symbol, index) => (
                <SymbolCard key={`${symbol.symbol}-${index}`} symbol={symbol} />
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm italic">
              No high probability setups identified at this time
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {potentialBreakouts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">{potentialBreakouts.length}</div>
                <div className="text-xs text-slate-400">Active Signals</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {potentialBreakouts.filter(s => s.bias === 'bullish').length}
                </div>
                <div className="text-xs text-slate-400">Bullish Bias</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">
                  {potentialBreakouts.filter(s => s.bias === 'bearish').length}
                </div>
                <div className="text-xs text-slate-400">Bearish Bias</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}