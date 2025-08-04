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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Breakout Analysis
          </CardTitle>
          <CardDescription>Loading breakout signals...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
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
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{symbol.symbol}</span>
          {getBiasIcon(symbol.bias)}
          <Badge className={getBiasColor(symbol.bias)}>
            {symbol.bias}
          </Badge>
        </div>
        {symbol.price && (
          <div className="text-right text-sm">
            <div className="font-mono">${symbol.price.toFixed(2)}</div>
            <div className={`text-xs ${symbol.change && symbol.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {symbol.change?.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
      <div className="text-sm text-slate-300 mb-1">
        <span className="font-medium text-yellow-400">{symbol.reason}:</span> {symbol.description}
      </div>
      <div className="text-xs text-slate-400">
        Confidence: {symbol.confidence}%
      </div>
    </div>
  );

  return (
    <Card data-testid="breakout-analysis-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Breakout Analysis
        </CardTitle>
        <CardDescription>
          Real-time squeeze detection and breakout monitoring across all tracked symbols
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Symbols in Squeeze */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Symbols in Squeeze
              <Badge variant="outline" className="text-xs">
                {symbolsInSqueeze.length}
              </Badge>
            </h4>
            <div className="space-y-3">
              {symbolsInSqueeze.length === 0 ? (
                <div className="text-sm text-slate-400 italic p-3 bg-slate-800/30 rounded border border-dashed border-slate-600">
                  No active squeezes detected.
                </div>
              ) : (
                symbolsInSqueeze.map((symbol, index) => (
                  <SymbolCard key={`squeeze-${index}`} symbol={symbol} />
                ))
              )}
            </div>
          </div>

          {/* Recent Successful Breakouts */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Recent Successful Breakouts
              <Badge variant="outline" className="text-xs">
                {recentBreakouts.length}
              </Badge>
            </h4>
            <div className="space-y-3">
              {recentBreakouts.length === 0 ? (
                <div className="text-sm text-slate-400 italic p-3 bg-slate-800/30 rounded border border-dashed border-slate-600">
                  No recent successful breakouts.
                </div>
              ) : (
                recentBreakouts.map((symbol, index) => (
                  <SymbolCard key={`breakout-${index}`} symbol={symbol} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Potential Breakouts */}
        {potentialBreakouts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              High Probability Setups
              <Badge variant="outline" className="text-xs">
                {potentialBreakouts.length}
              </Badge>
            </h4>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {potentialBreakouts.map((symbol, index) => (
                <SymbolCard key={`potential-${index}`} symbol={symbol} />
              ))}
            </div>
          </div>
        )}

        {/* Methodology Footnote */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <h5 className="text-xs font-semibold text-slate-300 mb-2">Methodology</h5>
          <div className="text-xs text-slate-400 space-y-1">
            <p><strong>Bollinger Band Squeeze:</strong> Identifies periods of low volatility where Bollinger Bands contract, often preceding significant price movements.</p>
            <p><strong>Successful Breakouts:</strong> Symbols that recently broke out of consolidation patterns with sustained momentum and volume confirmation.</p>
            <p><strong>High Probability Setups:</strong> Symbols with convergence analysis confidence scores above 70%, indicating strong technical signal alignment.</p>
            <p><strong>Real-time Data:</strong> Analysis updates every 30 seconds using live market data from Twelve Data WebSocket feed during market hours.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}