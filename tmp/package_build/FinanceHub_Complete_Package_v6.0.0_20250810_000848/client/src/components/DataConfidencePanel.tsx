import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Clock, BarChart3, Target } from 'lucide-react';

interface DataConfidence {
  indicator: string;
  confidenceScore: number;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  lastUpdated: string;
  dataFreshness: number;
  sourcesCount: number;
  validationsPassed: number;
  totalValidations: number;
  anomalyScore: number;
  reliabilityIndex: number;
}

interface HistoricalContext {
  indicator: string;
  currentValue: number;
  historicalPercentile: number;
  twelveMonthAverage: number;
  volatilityMeasure: number;
  trenDirection: 'UPWARD' | 'DOWNWARD' | 'SIDEWAYS';
  cyclicalPosition: 'PEAK' | 'TROUGH' | 'EXPANSION' | 'CONTRACTION';
  seasonalAdjustment: number;
  contextualRanking: 'EXTREMELY_HIGH' | 'HIGH' | 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE' | 'LOW' | 'EXTREMELY_LOW';
}

interface ComprehensiveAnalysis {
  indicator: string;
  confidence: DataConfidence;
  context: HistoricalContext;
  overallScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function DataConfidencePanel() {
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDataConfidenceAnalysis();
  }, []);

  const fetchDataConfidenceAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // Key economic indicators for analysis
      const keyIndicators = [
        'GDP Growth Rate',
        'Unemployment Rate', 
        'Consumer Price Index',
        'Federal Funds Rate',
        'Nonfarm Payrolls',
        'Consumer Confidence',
        'Housing Starts',
        'Initial Jobless Claims'
      ];

      const response = await fetch(`/api/confidence/comprehensive-analysis?indicators=${keyIndicators.join(',')}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch comprehensive analysis');
      }

      const data = await response.json();
      setAnalysis(data.analysis || []);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data confidence analysis');
      console.error('Data confidence fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-400 bg-green-900/20';
    if (score >= 0.6) return 'text-yellow-400 bg-yellow-900/20';
    return 'text-red-400 bg-red-900/20';
  };

  const getQualityBadgeColor = (quality: string): string => {
    switch (quality) {
      case 'HIGH': return 'bg-green-600 text-white';
      case 'MEDIUM': return 'bg-yellow-600 text-white';
      case 'LOW': return 'bg-red-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'UPWARD': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'DOWNWARD': return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
      default: return <BarChart3 className="w-4 h-4 text-gray-400" />;
    }
  };

  const getContextualRankingColor = (ranking: string): string => {
    switch (ranking) {
      case 'EXTREMELY_HIGH': return 'text-red-400';
      case 'HIGH': return 'text-orange-400';
      case 'ABOVE_AVERAGE': return 'text-yellow-400';
      case 'AVERAGE': return 'text-gray-400';
      case 'BELOW_AVERAGE': return 'text-blue-400';
      case 'LOW': return 'text-green-400';
      case 'EXTREMELY_LOW': return 'text-emerald-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <Shield className="w-5 h-5 animate-pulse" />
            <span>Loading data confidence analysis...</span>
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
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feature Status Banner */}
      <Card className="bg-purple-900/20 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 text-purple-400 text-sm">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <span>Priority 2 Analytics: Data confidence scoring and historical context analysis active</span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {summary && (
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Data Quality Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {(summary.averageConfidence * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">Avg Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {summary.highQualityCount}
                </div>
                <div className="text-sm text-gray-400">High Quality</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">
                  {summary.lowQualityCount}
                </div>
                <div className="text-sm text-gray-400">Low Quality</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {summary.totalIndicators}
                </div>
                <div className="text-sm text-gray-400">Total Indicators</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Data Confidence & Historical Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.map((item, index) => (
              <div key={index} className="border border-financial-border rounded-lg p-4 bg-financial-gray/30">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white">{item.indicator}</h4>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getQualityBadgeColor(item.confidence?.dataQuality || 'LOW')}`}>
                        {item.confidence?.dataQuality || 'LOW'} QUALITY
                      </span>
                      <span className="text-sm text-gray-400">
                        Risk: {item.riskLevel}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-2 rounded-lg font-bold ${getConfidenceColor(item.overallScore)}`}>
                    {(item.overallScore * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Data Confidence Metrics */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-gray-300 flex items-center">
                      <Shield className="w-4 h-4 mr-1" />
                      Data Confidence
                    </h5>
                    {item.confidence && (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Freshness:</span>
                          <span className="text-white flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {item.confidence.dataFreshness}h ago
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Validations:</span>
                          <span className="text-white flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {item.confidence.validationsPassed}/{item.confidence.totalValidations}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Reliability:</span>
                          <span className="text-white">
                            {(item.confidence.reliabilityIndex * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Anomaly Score:</span>
                          <span className={item.confidence.anomalyScore > 0.5 ? 'text-red-400' : 'text-green-400'}>
                            {(item.confidence.anomalyScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Historical Context */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-gray-300 flex items-center">
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Historical Context
                    </h5>
                    {item.context && (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Percentile:</span>
                          <span className="text-white">
                            {item.context.historicalPercentile.toFixed(0)}th
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Trend:</span>
                          <span className="text-white flex items-center">
                            {getTrendIcon(item.context.trenDirection)}
                            <span className="ml-1">{item.context.trenDirection}</span>
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Cycle:</span>
                          <span className="text-white">
                            {item.context.cyclicalPosition}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Ranking:</span>
                          <span className={getContextualRankingColor(item.context.contextualRanking)}>
                            {item.context.contextualRanking.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Volatility:</span>
                          <span className="text-white">
                            {(item.context.volatilityMeasure * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}