import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  XCircle, 
  Target, 
  Shield,
  BarChart3,
  Calculator,
  Info,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface OriginalHealthData {
  economicHealthScore: number;
  scoreBreakdown: {
    coreHealth: number;
    correlationHarmony: number;
    marketStress: number;
    confidence: number;
  };
  healthGrade: 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'CRITICAL';
  trendDirection: 'STRENGTHENING' | 'STABLE' | 'WEAKENING';
  monthlyChange: number;
  historicalPercentile: number;
  recessonProbability: number;
  narrative: string;
  recommendations: string[];
  nextKeyEvent: {
    date: string;
    event: string;
    expectedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  alertLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  sectorGuidance: {
    opportunities: string[];
    risks: string[];
  };
  riskFactors: string[];
  confidence: number;
}

interface StatisticalHealthData {
  overallScore: number;
  confidenceInterval: [number, number];
  statisticalSignificance: number;
  dataQualityScore: number;
  scoreBreakdown: {
    coreHealth: number;
    correlationHarmony: number;
    marketStress: number;
    confidence: number;
  };
  componentScores: {
    gdpHealth: number;
    employmentHealth: number;
    inflationStability: number;
    correlationAlignment: number;
    leadingConsistency: number;
    alertFrequency: number;
    regimeStability: number;
    dataQuality: number;
    sectorAlignment: number;
  };
  weightingMethod: 'data_driven' | 'theory_based';
  dataDrivenWeights?: any;
}

export function EnhancedEconomicHealthDashboard() {
  const [originalData, setOriginalData] = useState<OriginalHealthData | null>(null);
  const [statisticalData, setStatisticalData] = useState<StatisticalHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both original and statistical health data
      const [originalResponse, statisticalResponse] = await Promise.all([
        fetch('/api/economic-health/dashboard'),
        fetch('/api/economic-health/statistical-score')
      ]);
      
      if (!originalResponse.ok) {
        throw new Error('Failed to fetch original economic health data');
      }

      const originalData = await originalResponse.json();
      setOriginalData(originalData);

      if (statisticalResponse.ok) {
        const statisticalData = await statisticalResponse.json();
        setStatisticalData(statisticalData.statisticalScore);
      } else {
        throw new Error('Statistical health data not available');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load economic health data');
      console.error('Economic health fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number): string => {
    if (score >= 85) return 'text-green-400 bg-green-900/30 border-green-500';
    if (score >= 70) return 'text-green-300 bg-green-900/20 border-green-600';
    if (score >= 55) return 'text-yellow-300 bg-yellow-900/20 border-yellow-600';
    if (score >= 40) return 'text-orange-300 bg-orange-900/20 border-orange-600';
    return 'text-red-300 bg-red-900/20 border-red-600';
  };

  const getHealthGrade = (score: number): string => {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'STRONG';
    if (score >= 55) return 'MODERATE';
    if (score >= 40) return 'WEAK';
    return 'CRITICAL';
  };

  const getScoreBarColor = (score: number): string => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-green-400';
    if (score >= 55) return 'bg-yellow-400';
    if (score >= 40) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const currentData = statisticalData;
  const currentScore = statisticalData?.overallScore || 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-gray-900/50 border-gray-700 animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-16 bg-gray-700 rounded mb-4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-500">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-5 w-5" />
            <span>Error: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentData) return null;

  return (
    <div className="space-y-6">
      {/* Statistical Health Score Header */}
      <Card className="bg-gray-900/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-blue-400" />
              <CardTitle className="text-xl font-semibold text-white">
                Economic Health Score
              </CardTitle>
              <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                Statistical Analysis with Z-Score Normalization
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Data-driven scoring with Z-score normalization, historical correlation-based weights, and confidence intervals</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-white">
                {currentScore}
              </div>
              <div className={`px-3 py-1 rounded-full border ${getHealthColor(currentScore)}`}>
                {getHealthGrade(currentScore)}
              </div>
            </div>
            
            {/* Statistical Confidence Interval */}
            {statisticalData && (
              <div className="text-right">
                <div className="text-sm text-gray-400">95% Confidence Interval</div>
                <div className="text-white font-medium">
                  {Math.round(statisticalData.confidenceInterval[0])}-{Math.round(statisticalData.confidenceInterval[1])}
                </div>
                <div className="text-xs text-gray-500">
                  Data Quality: {statisticalData.dataQualityScore}%
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(currentScore)}`}
              style={{ width: `${currentScore}%` }}
            ></div>
          </div>
          
          {/* Statistical Method Details */}
          {statisticalData && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Weighting Method:</span>
                <span className="text-white ml-2 capitalize">
                  {statisticalData.weightingMethod.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Statistical Significance:</span>
                <span className="text-white ml-2">
                  p = {statisticalData.statisticalSignificance.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            key: 'coreHealth', 
            label: 'Core Health', 
            icon: Target, 
            weight: '40%',
            description: 'GDP, Employment, Inflation fundamentals'
          },
          { 
            key: 'correlationHarmony', 
            label: 'Correlations', 
            icon: TrendingUp, 
            weight: '25%',
            description: 'Cross-indicator alignment and consistency'
          },
          { 
            key: 'marketStress', 
            label: 'Market Stress', 
            icon: AlertTriangle, 
            weight: '20%',
            description: 'Volatility regimes and alert frequency'
          },
          { 
            key: 'confidence', 
            label: 'Confidence', 
            icon: Shield, 
            weight: '15%',
            description: 'Data quality and sector alignment'
          }
        ].map(({ key, label, icon: Icon, weight, description }) => {
          const score = currentData?.scoreBreakdown?.[key as keyof typeof currentData.scoreBreakdown] || 0;
          
          return (
            <TooltipProvider key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-gray-900/50 border-gray-700 hover:border-gray-600 transition-colors cursor-help">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="h-5 w-5 text-blue-400" />
                        <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                          {weight}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {score}
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {label}
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(score)}`}
                          style={{ width: `${score}%` }}
                        ></div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-gray-300">{description}</p>
                  <p className="text-xs text-gray-400 mt-1">Weight: {weight} of total score</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>


    </div>
  );
}