import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3, Activity, Clock, Target } from 'lucide-react';

interface EconomicRegime {
  regimeType: 'EXPANSION' | 'PEAK' | 'CONTRACTION' | 'TROUGH';
  confidenceScore: number;
  regimeStartDate: string;
  regimeDurationMonths: number;
  contributingIndicators: {
    indicator: string;
    currentValue: number;
    trendDirection: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    regimeContribution: number;
  }[];
  transitionProbabilities: {
    toExpansion: number;
    toPeak: number;
    toContraction: number;
    toTrough: number;
  };
  historicalContext: {
    averageRegimeDuration: number;
    similarRegimeCount: number;
    lastTransitionDate: string | null;
  };
}

interface RegimeHistory {
  date: string;
  regime: string;
  confidence: number;
}

export function EconomicRegimeIndicator() {
  const [regime, setRegime] = useState<EconomicRegime | null>(null);
  const [history, setHistory] = useState<RegimeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegimeData();
  }, []);

  const fetchRegimeData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [regimeResponse, historyResponse] = await Promise.all([
        fetch('/api/economic-regime/current-regime'),
        fetch('/api/economic-regime/regime-history?months=12')
      ]);

      if (!regimeResponse.ok || !historyResponse.ok) {
        throw new Error('Failed to fetch regime data');
      }

      const regimeData = await regimeResponse.json();
      const historyData = await historyResponse.json();

      setRegime(regimeData.regime);
      setHistory(historyData.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load regime data');
      console.error('Regime data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRegimeColor = (regimeType: string): string => {
    switch (regimeType) {
      case 'EXPANSION': return 'bg-green-600 text-white border-green-500';
      case 'PEAK': return 'bg-yellow-600 text-white border-yellow-500';
      case 'CONTRACTION': return 'bg-red-600 text-white border-red-500';
      case 'TROUGH': return 'bg-blue-600 text-white border-blue-500';
      default: return 'bg-gray-600 text-white border-gray-500';
    }
  };

  const getRegimeIcon = (regimeType: string) => {
    switch (regimeType) {
      case 'EXPANSION': return <TrendingUp className="w-5 h-5" />;
      case 'PEAK': return <Activity className="w-5 h-5" />;
      case 'CONTRACTION': return <TrendingDown className="w-5 h-5" />;
      case 'TROUGH': return <BarChart3 className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getTransitionColor = (probability: number): string => {
    if (probability > 0.4) return 'text-red-400';
    if (probability > 0.2) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getMostLikelyTransition = (probabilities: EconomicRegime['transitionProbabilities']) => {
    const transitions = [
      { regime: 'EXPANSION', probability: probabilities.toExpansion },
      { regime: 'PEAK', probability: probabilities.toPeak },
      { regime: 'CONTRACTION', probability: probabilities.toContraction },
      { regime: 'TROUGH', probability: probabilities.toTrough }
    ];

    return transitions
      .filter(t => t.regime !== regime?.regimeType)
      .sort((a, b) => b.probability - a.probability)[0];
  };

  if (loading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <Activity className="w-5 h-5 animate-pulse" />
            <span>Loading economic regime analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !regime) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-400">
            <Activity className="w-5 h-5" />
            <span>{error || 'Failed to load regime data'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const mostLikelyTransition = getMostLikelyTransition(regime.transitionProbabilities);

  return (
    <div className="space-y-6">
      {/* Current Regime Card */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Economic Regime Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Regime Badge */}
            <div className="space-y-4">
              <div className={`p-6 rounded-lg border-2 ${getRegimeColor(regime.regimeType)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getRegimeIcon(regime.regimeType)}
                    <h3 className="text-2xl font-bold">{regime.regimeType}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{regime.confidenceScore.toFixed(0)}%</div>
                    <div className="text-sm opacity-90">Confidence</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
                  <div>
                    <div className="flex items-center space-x-1 text-sm opacity-90">
                      <Clock className="w-3 h-3" />
                      <span>Duration</span>
                    </div>
                    <div className="font-semibold">{regime.regimeDurationMonths} months</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-90">Average</div>
                    <div className="font-semibold">{regime.historicalContext.averageRegimeDuration} months</div>
                  </div>
                </div>
              </div>

              {/* Transition Probability */}
              {mostLikelyTransition && (
                <div className="bg-financial-gray p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Most Likely Transition</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-white">
                      Entering {mostLikelyTransition.regime} phase
                    </span>
                    <span className={`font-bold ${getTransitionColor(mostLikelyTransition.probability)}`}>
                      {(mostLikelyTransition.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Contributing Indicators */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-white">Key Contributing Indicators</h4>
              <div className="space-y-3">
                {regime.contributingIndicators.slice(0, 5).map((indicator, index) => (
                  <div key={index} className="bg-financial-gray p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate pr-2">
                        {indicator.indicator}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          indicator.trendDirection === 'POSITIVE' 
                            ? 'bg-green-900/50 text-green-400' 
                            : indicator.trendDirection === 'NEGATIVE'
                            ? 'bg-red-900/50 text-red-400'
                            : 'bg-gray-900/50 text-gray-400'
                        }`}>
                          {indicator.trendDirection}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Current: {indicator.currentValue.toFixed(1)}
                      </span>
                      <span className="text-xs text-blue-400">
                        Contribution: {indicator.regimeContribution.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regime Timeline */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Regime Timeline (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {history.map((entry, index) => {
              const date = new Date(entry.date);
              const monthName = date.toLocaleDateString('en-US', { month: 'short' });
              
              return (
                <div key={index} className="text-center">
                  <div 
                    className={`w-full h-12 rounded-lg border ${getRegimeColor(entry.regime)} flex items-center justify-center mb-1`}
                    title={`${monthName}: ${entry.regime} (${entry.confidence}% confidence)`}
                  >
                    <span className="text-xs font-bold">
                      {entry.regime.charAt(0)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{monthName}</div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-600 rounded"></div>
              <span className="text-gray-400">Expansion</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-600 rounded"></div>
              <span className="text-gray-400">Peak</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-600 rounded"></div>
              <span className="text-gray-400">Contraction</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span className="text-gray-400">Trough</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}