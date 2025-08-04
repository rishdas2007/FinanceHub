import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Target, 
  Calculator
} from 'lucide-react';

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

export function EconomicHealthScoreAppendix() {
  const [statisticalData, setStatisticalData] = useState<StatisticalHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatisticalData();
  }, []);

  const fetchStatisticalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const statisticalResponse = await fetch('/api/economic-health/statistical-score');
      
      if (statisticalResponse.ok) {
        const statisticalData = await statisticalResponse.json();
        setStatisticalData(statisticalData.statisticalScore);
      } else {
        throw new Error('Statistical health data not available');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistical data');
      console.error('Statistical health fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBarColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded mb-4"></div>
        <div className="h-32 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error || !statisticalData) {
    return null; // Hide appendix if no data available
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-700">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-400 mb-2">Appendix</h2>
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-400" />
          Economic Health Score Components
        </h3>
        <p className="text-sm text-gray-400 mt-2">
          Technical breakdown of statistical analysis components and data-driven weightings
        </p>
      </div>

      {/* Statistical Component Breakdown */}
      {statisticalData && (
        <Card className="bg-gray-900/50 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-400" />
              Statistical Component Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 lg:grid-cols-9 gap-4">
              {Object.entries(statisticalData.componentScores).map(([key, score]) => (
                <div key={key} className="text-center">
                  <div className="text-lg font-semibold text-white mb-1">
                    {Math.round(score)}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                    <div 
                      className={`h-full rounded-full ${getScoreBarColor(score)}`}
                      style={{ width: `${score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data-Driven Weights Visualization */}
      {statisticalData && statisticalData.dataDrivenWeights && (
        <Card className="bg-gray-900/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-green-400" />
              Data-Driven Component Weights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 lg:grid-cols-9 gap-4">
              {Object.entries(statisticalData.dataDrivenWeights).map(([key, weight]) => (
                <div key={key} className="text-center">
                  <div className="text-lg font-semibold text-green-400 mb-1">
                    {weight}%
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                    <div 
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${(weight / 15) * 100}%` }}
                    ></div>
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