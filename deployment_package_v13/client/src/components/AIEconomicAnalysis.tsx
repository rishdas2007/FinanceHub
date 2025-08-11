import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';

interface EconomicIndicator {
  metric: string;
  category: string;
  type: string;
  currentReading: string;
  priorReading: string;
  varianceVsPrior: string;
  zScore?: number;
  deltaZScore?: number;
}

interface EconomicDataResponse {
  statisticalData: {
    [category: string]: any;
  };
  aiAnalysis: string;
}

interface MacroeconomicResponse {
  indicators: EconomicIndicator[];
}

export function AIEconomicAnalysis() {
  // Fetch macroeconomic indicators data instead of AI analysis
  const {
    data: macroData,
    isLoading,
    error,
    refetch
  } = useQuery<MacroeconomicResponse>({
    queryKey: ['/api/macroeconomic-indicators'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleRefresh = () => {
    refetch();
  };

  // Generate positive and negative signals summary based on real data
  const generateSignalsSummary = () => {
    if (!macroData?.indicators) {
      return { positive: [], negative: [], neutral: [] };
    }

    const positive: string[] = [];
    const negative: string[] = [];
    const neutral: string[] = [];

    // Categorize indicators by their z-scores
    macroData.indicators.forEach(indicator => {
      const zScore = indicator.zScore || 0;
      const metric = indicator.metric;
      
      if (zScore > 1.5) {
        if (metric.toLowerCase().includes('unemployment')) {
          // Lower unemployment is positive, but shows up as negative z-score due to delta adjustment
          if (zScore < 0) {
            positive.push(`${metric}: Exceptionally low unemployment indicates strong labor market`);
          } else {
            negative.push(`${metric}: Rising unemployment concerns (${zScore.toFixed(1)}σ above normal)`);
          }
        } else {
          positive.push(`${metric}: Strong performance (${zScore.toFixed(1)}σ above historical average)`);
        }
      } else if (zScore < -1.5) {
        if (metric.toLowerCase().includes('unemployment')) {
          positive.push(`${metric}: Low unemployment signals labor market strength (${Math.abs(zScore).toFixed(1)}σ below average)`);
        } else {
          negative.push(`${metric}: Weak performance (${Math.abs(zScore).toFixed(1)}σ below historical average)`);
        }
      } else if (Math.abs(zScore) > 0.5) {
        neutral.push(`${metric}: Moderate deviation from historical trends (${zScore.toFixed(1)}σ)`);
      }
    });

    // Add category-specific insights
    const categories = ['Growth', 'Labor', 'Inflation', 'Monetary Policy'];
    categories.forEach(category => {
      const categoryIndicators = macroData.indicators.filter(ind => ind.category === category);
      const avgZScore = categoryIndicators.reduce((sum, ind) => sum + (ind.zScore || 0), 0) / categoryIndicators.length;
      
      if (avgZScore > 1) {
        positive.push(`${category} sector showing broad-based strength across indicators`);
      } else if (avgZScore < -1) {
        negative.push(`${category} sector showing concerning weakness across indicators`);
      }
    });

    return { positive: positive.slice(0, 5), negative: negative.slice(0, 5), neutral: neutral.slice(0, 3) };
  };

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <span>AI Economic Analysis</span>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load economic indicators. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-blue-400" />
            <span>Economic Analysis</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Data-driven analysis of current economic conditions
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={isLoading}
          variant="default" 
          size="sm"
          className="bg-black text-white border-black hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-gray-300">Loading economic indicators...</span>
            </div>
          </CardContent>
        </Card>
      ) : macroData ? (
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="text-white text-lg">Economic Signals Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const signals = generateSignalsSummary();
              return (
                <div className="space-y-6">
                  {/* Positive Signals */}
                  {signals.positive.length > 0 && (
                    <div>
                      <div className="flex items-center space-x-2 mb-3">
                        <TrendingUp className="h-5 w-5 text-gain-green" />
                        <h3 className="text-lg font-semibold text-gain-green">Positive Economic Signals</h3>
                      </div>
                      <ul className="space-y-2">
                        {signals.positive.map((signal, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-gain-green mt-1">•</span>
                            <span className="text-gray-300">{signal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Negative Signals */}
                  {signals.negative.length > 0 && (
                    <div>
                      <div className="flex items-center space-x-2 mb-3">
                        <TrendingDown className="h-5 w-5 text-loss-red" />
                        <h3 className="text-lg font-semibold text-loss-red">Areas of Concern</h3>
                      </div>
                      <ul className="space-y-2">
                        {signals.negative.map((signal, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-loss-red mt-1">•</span>
                            <span className="text-gray-300">{signal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Neutral/Mixed Signals */}
                  {signals.neutral.length > 0 && (
                    <div>
                      <div className="flex items-center space-x-2 mb-3">
                        <MessageSquare className="h-5 w-5 text-yellow-400" />
                        <h3 className="text-lg font-semibold text-yellow-400">Mixed Signals</h3>
                      </div>
                      <ul className="space-y-2">
                        {signals.neutral.map((signal, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            <span className="text-gray-300">{signal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summary Statistics */}
                  <div className="pt-4 border-t border-financial-border">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gain-green">{signals.positive.length}</div>
                        <div className="text-sm text-gray-400">Positive Signals</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-loss-red">{signals.negative.length}</div>
                        <div className="text-sm text-gray-400">Concerns</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-400">{signals.neutral.length}</div>
                        <div className="text-sm text-gray-400">Mixed</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <p className="text-gray-400 text-center">No economic indicators available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}