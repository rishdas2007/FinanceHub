import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Clock, Target, Building2, Shield } from 'lucide-react';

interface EconomicHealthData {
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

export function EconomicHealthDashboard() {
  const [healthData, setHealthData] = useState<EconomicHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/economic-health/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch economic health data');
      }

      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load economic health data');
      console.error('Economic health fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (grade: string): string => {
    switch (grade) {
      case 'EXCELLENT': return 'text-green-400 bg-green-900/30 border-green-500';
      case 'STRONG': return 'text-green-300 bg-green-900/20 border-green-600';
      case 'MODERATE': return 'text-yellow-300 bg-yellow-900/20 border-yellow-600';
      case 'WEAK': return 'text-orange-300 bg-orange-900/20 border-orange-600';
      case 'CRITICAL': return 'text-red-300 bg-red-900/20 border-red-600';
      default: return 'text-gray-300 bg-gray-900/20 border-gray-600';
    }
  };

  const getScoreBarColor = (score: number): string => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-green-400';
    if (score >= 55) return 'bg-yellow-400';
    if (score >= 40) return 'bg-orange-400';
    return 'bg-red-500';
  };

  const getTrendIcon = (direction: string, change: number) => {
    if (direction === 'STRENGTHENING') {
      return <TrendingUp className={`w-4 h-4 ${change > 0 ? 'text-green-400' : 'text-gray-400'}`} />;
    } else if (direction === 'WEAKENING') {
      return <TrendingDown className={`w-4 h-4 ${change < 0 ? 'text-red-400' : 'text-gray-400'}`} />;
    }
    return <Activity className="w-4 h-4 text-blue-400" />;
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'HIGH': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'MEDIUM': return <Activity className="w-4 h-4 text-yellow-400" />;
      case 'LOW': return <CheckCircle className="w-4 h-4 text-green-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <Activity className="w-5 h-5 animate-pulse" />
            <span>Calculating Economic Health Score...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !healthData) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-400">
            <XCircle className="w-5 h-5" />
            <span>{error || 'Failed to load economic health data'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scorePercentage = (healthData.economicHealthScore / 100) * 100;

  return (
    <div className="space-y-6">
      {/* Main Health Score Card */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Economic Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-white mb-2">
              {healthData.economicHealthScore}<span className="text-3xl text-gray-400">/100</span>
            </div>
            <div className={`inline-flex items-center px-4 py-2 rounded-lg border-2 ${getHealthColor(healthData.healthGrade)}`}>
              <span className="font-bold text-lg">{healthData.healthGrade}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className={`h-4 rounded-full transition-all duration-1000 ${getScoreBarColor(healthData.economicHealthScore)}`}
              style={{ width: `${scorePercentage}%` }}
            ></div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-financial-gray p-4 rounded-lg text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                {getTrendIcon(healthData.trendDirection, healthData.monthlyChange)}
                <span className="text-sm text-gray-300">Trend</span>
              </div>
              <div className="font-semibold text-white">{healthData.trendDirection}</div>
              <div className={`text-sm ${healthData.monthlyChange > 0 ? 'text-green-400' : healthData.monthlyChange < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {healthData.monthlyChange > 0 ? '+' : ''}{healthData.monthlyChange} pts this month
              </div>
            </div>

            <div className="bg-financial-gray p-4 rounded-lg text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Percentile</span>
              </div>
              <div className="font-semibold text-white">{healthData.historicalPercentile}th</div>
              <div className="text-sm text-gray-400">Since 1990</div>
            </div>

            <div className="bg-financial-gray p-4 rounded-lg text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-300">Next Review</span>
              </div>
              <div className="font-semibold text-white">{formatDate(healthData.nextKeyEvent.date)}</div>
              <div className="text-sm text-gray-400">{healthData.nextKeyEvent.event}</div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{healthData.scoreBreakdown.coreHealth}</div>
              <div className="text-xs text-gray-400">CORE HEALTH</div>
              <div className="text-xs text-green-400">GDP • Jobs • Inflation</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{healthData.scoreBreakdown.correlationHarmony}</div>
              <div className="text-xs text-gray-400">CORRELATIONS</div>
              <div className="text-xs text-blue-400">Alignment • Consistency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{healthData.scoreBreakdown.marketStress}</div>
              <div className="text-xs text-gray-400">MARKET STRESS</div>
              <div className="text-xs text-orange-400">Alerts • Volatility</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{healthData.scoreBreakdown.confidence}</div>
              <div className="text-xs text-gray-400">CONFIDENCE</div>
              <div className="text-xs text-purple-400">Data • Predictions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Economic Narrative */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Economic Analysis
            </div>
            <div className="flex items-center space-x-2">
              {getAlertIcon(healthData.alertLevel)}
              <span className="text-sm text-gray-400">{healthData.alertLevel} Alert Level</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300 leading-relaxed mb-4">
            {healthData.narrative}
          </p>
          
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Recession Probability</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {healthData.recessonProbability}%
              <span className="text-sm text-gray-400 ml-2">
                ({healthData.recessonProbability <= 10 ? 'Low Risk' : 
                  healthData.recessonProbability <= 25 ? 'Moderate Risk' : 'High Risk'})
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations and Sector Guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommendations */}
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthData.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-financial-gray rounded-lg">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-300 text-sm">{recommendation}</span>
                </div>
              ))}
            </div>

            {healthData.riskFactors.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Key Risk Factors
                </h4>
                <div className="space-y-2">
                  {healthData.riskFactors.slice(0, 3).map((risk, index) => (
                    <div key={index} className="text-xs text-gray-400 bg-orange-900/20 p-2 rounded border-l-2 border-orange-500">
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sector Guidance */}
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              Sector Impact Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Opportunities */}
            {healthData.sectorGuidance.opportunities.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-green-400 mb-3">Strong Economy Benefits:</h4>
                <div className="space-y-2">
                  {healthData.sectorGuidance.opportunities.map((opportunity, index) => (
                    <div key={index} className="text-sm text-gray-300 bg-green-900/20 p-2 rounded border-l-2 border-green-500">
                      {opportunity}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {healthData.sectorGuidance.risks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-400 mb-3">Risks to Watch:</h4>
                <div className="space-y-2">
                  {healthData.sectorGuidance.risks.map((risk, index) => (
                    <div key={index} className="text-sm text-gray-300 bg-red-900/20 p-2 rounded border-l-2 border-red-500">
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Confidence */}
            <div className="mt-6 pt-4 border-t border-financial-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Analysis Confidence:</span>
                <span className={`font-bold ${healthData.confidence > 80 ? 'text-green-400' : healthData.confidence > 60 ? 'text-yellow-400' : 'text-orange-400'}`}>
                  {healthData.confidence}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}