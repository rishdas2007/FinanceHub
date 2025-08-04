import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface CorrelationData {
  indicator1: string;
  indicator2: string;
  correlation: number;
  significance: number;
  sampleSize: number;
  timeframe: string;
}

interface LeadingCorrelation {
  leadingIndicator: string;
  targetIndicator: string;
  correlation: number;
  leadMonths: number;
  significance: number;
}

interface CorrelationBreakdown {
  indicatorPair: string;
  historicalCorrelation: number;
  currentCorrelation: number;
  breakdownDate: string;
  severityScore: number;
}

export function CorrelationMatrix() {
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [leadingCorrelations, setLeadingCorrelations] = useState<LeadingCorrelation[]>([]);
  const [breakdowns, setBreakdowns] = useState<CorrelationBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCorrelationData();
  }, []);

  const fetchCorrelationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch key economic indicators correlation matrix
      const keyIndicators = [
        'GDP Growth Rate',
        'Unemployment Rate', 
        'Consumer Price Index',
        'Federal Funds Rate',
        'Nonfarm Payrolls',
        'Consumer Confidence'
      ];

      const [correlationRes, leadingRes, breakdownRes] = await Promise.all([
        fetch(`/api/economic/correlation-matrix?indicators=${keyIndicators.join(',')}&timeframe=12m`),
        fetch('/api/economic/leading-correlations/GDP Growth Rate'),
        fetch('/api/economic/correlation-breakdowns')
      ]);

      if (!correlationRes.ok || !leadingRes.ok || !breakdownRes.ok) {
        throw new Error('Failed to fetch correlation data');
      }

      const correlationData = await correlationRes.json();
      const leadingData = await leadingRes.json();
      const breakdownData = await breakdownRes.json();

      setCorrelations(correlationData.correlations || []);
      setLeadingCorrelations(leadingData.leadingCorrelations || []);
      setBreakdowns(breakdownData.breakdowns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load correlation data');
      console.error('Correlation data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCorrelationColor = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs > 0.7) return 'text-red-400'; // Strong correlation
    if (abs > 0.5) return 'text-yellow-400'; // Moderate correlation
    if (abs > 0.3) return 'text-blue-400'; // Weak correlation
    return 'text-gray-400'; // Very weak correlation
  };

  const getCorrelationBadge = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs > 0.7) return 'destructive'; 
    if (abs > 0.5) return 'secondary';
    return 'outline';
  };

  const formatCorrelation = (value: number): string => {
    return (value >= 0 ? '+' : '') + value.toFixed(3);
  };

  if (loading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-gray-400">Loading correlation analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cross-Indicator Correlations */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 text-lg font-medium">
            Cross-Indicator Correlations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {correlations.slice(0, 8).map((corr, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-200 truncate" title={`${corr.indicator1} ↔ ${corr.indicator2}`}>
                    {corr.indicator1.split(' ')[0]} ↔ {corr.indicator2.split(' ')[0]}
                  </div>
                  <Badge variant={getCorrelationBadge(corr.correlation)} className="text-xs">
                    {Math.abs(corr.correlation) > 0.7 ? 'Strong' : 
                     Math.abs(corr.correlation) > 0.5 ? 'Moderate' : 'Weak'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${getCorrelationColor(corr.correlation)}`}>
                    {formatCorrelation(corr.correlation)}
                  </span>
                  <div className="text-xs text-gray-400">
                    n={corr.sampleSize}, p={corr.significance.toFixed(3)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leading Indicators */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 text-lg font-medium">
            Leading Economic Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leadingCorrelations.slice(0, 5).map((leading, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {leading.correlation > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-200">
                      {leading.leadingIndicator}
                    </div>
                    <div className="text-xs text-gray-400">
                      Leads GDP by {leading.leadMonths} month{leading.leadMonths !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getCorrelationColor(leading.correlation)}`}>
                    {formatCorrelation(leading.correlation)}
                  </div>
                  <div className="text-xs text-gray-400">
                    p={leading.significance.toFixed(3)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Correlation Breakdowns */}
      {breakdowns.length > 0 && (
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="text-red-400 text-lg font-medium flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Correlation Breakdowns</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breakdowns.map((breakdown, index) => (
                <div key={index} className="border border-red-900/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-200">
                      {breakdown.indicatorPair}
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Breakdown
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-gray-400">Historical</div>
                      <div className="text-blue-400 font-medium">
                        {formatCorrelation(breakdown.historicalCorrelation)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Current</div>
                      <div className="text-red-400 font-medium">
                        {formatCorrelation(breakdown.currentCorrelation)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Severity: {breakdown.severityScore.toFixed(2)} | 
                    Detected: {new Date(breakdown.breakdownDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}