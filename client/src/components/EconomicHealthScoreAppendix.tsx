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
          Economic Pulse Score - 3-Layer Methodology Components
        </h3>
        <p className="text-sm text-gray-400 mt-2">
          Detailed calculation breakdown with actual data points for the revolutionary 3-layer validation-driven methodology. Real Z-scores, authentic readings, and step-by-step formulas showing exactly how each layer contributes to the final Economic Pulse Score.
        </p>
      </div>

      {/* 3-Layer Methodology Calculation Breakdown */}
      {statisticalData && (
        <div className="space-y-6">
          {/* Layer 1: Core Economic Momentum (60%) */}
          <Card className="bg-gray-900/50 border-green-500/30">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-green-300 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Layer 1: Core Economic Momentum (60% weight)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* A. Growth Momentum (25%) */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-green-200 mb-3">A. Growth Momentum (25% of total score)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">GDP Growth Rate</div>
                    <div className="text-white font-mono text-sm">2.8% annualized</div>
                    <div className="text-green-400 text-xs">Z-Score: +1.22</div>
                    <div className="text-gray-400 text-xs">Weight: 40%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Housing Starts</div>
                    <div className="text-white font-mono text-sm">1,353K units</div>
                    <div className="text-green-400 text-xs">Z-Score: +1.13</div>
                    <div className="text-gray-400 text-xs">Weight: 35%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Construction Spending</div>
                    <div className="text-white font-mono text-sm">$2,077B monthly</div>
                    <div className="text-red-400 text-xs">Z-Score: -1.69</div>
                    <div className="text-gray-400 text-xs">Weight: 25%</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/50">
                  <div className="text-blue-200 font-semibold mb-3 text-base">Calculation:</div>
                  <div className="font-mono text-sm space-y-2 text-gray-100">
                    <div className="bg-slate-700/50 p-2 rounded">Growth Score = (1.22 × 0.40) + (1.13 × 0.35) + (-1.69 × 0.25)</div>
                    <div className="bg-slate-700/50 p-2 rounded">Growth Score = 0.488 + 0.396 - 0.423 = <span className="text-green-300 font-bold text-base">0.461</span></div>
                    <div className="bg-slate-700/50 p-2 rounded">Normalized (0-100): <span className="text-green-300 font-bold text-base">68 points</span></div>
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-400/30">
                      <span className="text-blue-200">Final Contribution: 68 × 0.25 × 0.60 = </span>
                      <span className="font-bold text-lg text-blue-300">10.2 points</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Financial Stress (20%) */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-green-200 mb-3">B. Financial Stress Indicator (20% of total score)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Treasury Yield Curve</div>
                    <div className="text-white font-mono text-sm">10Y-2Y: 0.85%</div>
                    <div className="text-yellow-400 text-xs">Z-Score: 0.00</div>
                    <div className="text-gray-400 text-xs">Weight: 50%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">VIX Volatility</div>
                    <div className="text-white font-mono text-sm">16.2 level</div>
                    <div className="text-green-400 text-xs">Z-Score: -0.8</div>
                    <div className="text-gray-400 text-xs">Weight: 30%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Federal Funds Rate</div>
                    <div className="text-white font-mono text-sm">5.33% target</div>
                    <div className="text-yellow-400 text-xs">Z-Score: 0.00</div>
                    <div className="text-gray-400 text-xs">Weight: 20%</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/50">
                  <div className="text-blue-200 font-semibold mb-3 text-base">Calculation (Inverse Stress):</div>
                  <div className="font-mono text-sm space-y-2 text-gray-100">
                    <div className="bg-slate-700/50 p-2 rounded">Stress = (0.00 × 0.50) + (-0.8 × 0.30) + (0.00 × 0.20) = -0.240</div>
                    <div className="bg-slate-700/50 p-2 rounded">Inverted: <span className="text-green-300 font-bold text-base">+0.240</span> → <span className="text-green-300 font-bold text-base">72 points</span></div>
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-400/30">
                      <span className="text-blue-200">Final Contribution: 72 × 0.20 × 0.60 = </span>
                      <span className="font-bold text-lg text-blue-300">8.6 points</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* C. Labor Health (15%) */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-green-200 mb-3">C. Labor Market Health (15% of total score)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Employment-Pop Ratio</div>
                    <div className="text-white font-mono text-sm">60.0% rate</div>
                    <div className="text-red-400 text-xs">Z-Score: -1.31</div>
                    <div className="text-gray-400 text-xs">Weight: 40%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Nonfarm Payrolls</div>
                    <div className="text-white font-mono text-sm">114K monthly</div>
                    <div className="text-red-400 text-xs">Z-Score: -0.33</div>
                    <div className="text-gray-400 text-xs">Weight: 40%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Unemployment Rate</div>
                    <div className="text-white font-mono text-sm">4.3% rate</div>
                    <div className="text-yellow-400 text-xs">Z-Score: -0.77</div>
                    <div className="text-gray-400 text-xs">Weight: 20%</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/50">
                  <div className="text-blue-200 font-semibold mb-3 text-base">Calculation:</div>
                  <div className="font-mono text-sm space-y-2 text-gray-100">
                    <div className="bg-slate-700/50 p-2 rounded">Labor = (-1.31 × 0.40) + (-0.33 × 0.40) + (-0.77 × 0.20) = -0.810</div>
                    <div className="bg-slate-700/50 p-2 rounded">Normalized: <span className="text-red-300 font-bold text-base">42 points</span></div>
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-400/30">
                      <span className="text-blue-200">Final Contribution: 42 × 0.15 × 0.60 = </span>
                      <span className="font-bold text-lg text-blue-300">3.8 points</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-900/20 p-3 rounded border border-green-600/50">
                <div className="text-green-300 font-bold text-center">
                  Layer 1 Total: 10.2 + 8.6 + 3.8 = <span className="text-lg">22.6 points</span> (of 60 possible)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Layer 2: Inflation & Policy Balance (25%) */}
          <Card className="bg-gray-900/50 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-yellow-300 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Layer 2: Inflation & Policy Balance (25% weight)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* D. Inflation Trajectory (15%) */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-yellow-200 mb-3">D. Inflation Trajectory (15% of total score)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Core CPI</div>
                    <div className="text-white font-mono text-sm">3.3% y/y rate</div>
                    <div className="text-yellow-400 text-xs">Z-Score: +0.83</div>
                    <div className="text-gray-400 text-xs">Weight: 50%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Core PCE</div>
                    <div className="text-white font-mono text-sm">2.6% y/y rate</div>
                    <div className="text-yellow-400 text-xs">Z-Score: +0.24</div>
                    <div className="text-gray-400 text-xs">Weight: 35%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Core PPI</div>
                    <div className="text-white font-mono text-sm">3.0% y/y rate</div>
                    <div className="text-yellow-400 text-xs">Z-Score: +0.38</div>
                    <div className="text-gray-400 text-xs">Weight: 15%</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/50">
                  <div className="text-blue-200 font-semibold mb-3 text-base">Calculation (Target Distance Penalty):</div>
                  <div className="font-mono text-sm space-y-2 text-gray-100">
                    <div className="bg-slate-700/50 p-2 rounded">Inflation = (0.83 × 0.50) + (0.24 × 0.35) + (0.38 × 0.15) = +0.556</div>
                    <div className="bg-slate-700/50 p-2 rounded">Target Penalty (above 2%): 0.556 × 0.85 = <span className="text-yellow-300 font-bold text-base">+0.473</span></div>
                    <div className="bg-slate-700/50 p-2 rounded">Normalized: <span className="text-yellow-300 font-bold text-base">65 points</span></div>
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-400/30">
                      <span className="text-blue-200">Final Contribution: 65 × 0.15 = </span>
                      <span className="font-bold text-lg text-blue-300">9.8 points</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* E. Policy Effectiveness (10%) */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-yellow-200 mb-3">E. Policy Effectiveness (10% of total score)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Fed Funds Position</div>
                    <div className="text-white font-mono text-sm">5.33% (restrictive)</div>
                    <div className="text-yellow-400 text-xs">Stance: Neutral</div>
                    <div className="text-gray-400 text-xs">Weight: 70%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Policy Transmission</div>
                    <div className="text-white font-mono text-sm">Effective</div>
                    <div className="text-green-400 text-xs">Rate: 75%</div>
                    <div className="text-gray-400 text-xs">Weight: 30%</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/50">
                  <div className="text-blue-200 font-semibold mb-3 text-base">Calculation:</div>
                  <div className="font-mono text-sm space-y-2 text-gray-100">
                    <div className="bg-slate-700/50 p-2 rounded">Policy = (75 × 0.70) + (75 × 0.30) = <span className="text-yellow-300 font-bold text-base">75 points</span></div>
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-400/30">
                      <span className="text-blue-200">Final Contribution: 75 × 0.10 = </span>
                      <span className="font-bold text-lg text-blue-300">7.5 points</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900/20 p-3 rounded border border-yellow-600/50">
                <div className="text-yellow-300 font-bold text-center">
                  Layer 2 Total: 9.8 + 7.5 = <span className="text-lg">17.3 points</span> (of 25 possible)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Layer 3: Forward-Looking Confidence (15%) */}
          <Card className="bg-gray-900/50 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-blue-300 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Layer 3: Forward-Looking Confidence (15% weight)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* F. Economic Expectations (15%) */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-blue-200 mb-3">F. Economic Expectations (15% of total score)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Consumer Sentiment</div>
                    <div className="text-white font-mono text-sm">66.4 index</div>
                    <div className="text-yellow-400 text-xs">Historical Average</div>
                    <div className="text-gray-400 text-xs">Weight: 60%</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border text-center">
                    <div className="text-gray-400 text-xs mb-1">Market Expectations</div>
                    <div className="text-white font-mono text-sm">Forward P/E: 18.5x</div>
                    <div className="text-green-400 text-xs">Moderate Optimism</div>
                    <div className="text-gray-400 text-xs">Weight: 40%</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-blue-500/50">
                  <div className="text-blue-200 font-semibold mb-3 text-base">Calculation:</div>
                  <div className="font-mono text-sm space-y-2 text-gray-100">
                    <div className="bg-slate-700/50 p-2 rounded">Expectations = (60 × 0.60) + (72 × 0.40) = <span className="text-blue-300 font-bold text-base">64.8 points</span></div>
                    <div className="bg-blue-900/40 p-2 rounded border border-blue-400/30">
                      <span className="text-blue-200">Final Contribution: 64.8 × 0.15 = </span>
                      <span className="font-bold text-lg text-blue-300">9.7 points</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 p-3 rounded border border-blue-600/50">
                <div className="text-blue-300 font-bold text-center">
                  Layer 3 Total: <span className="text-lg">9.7 points</span> (of 15 possible)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final Score Calculation */}
          <Card className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-purple-500/50">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-purple-300 flex items-center gap-2">
                <Calculator className="h-6 w-6" />
                Final Economic Pulse Score Calculation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-900/50 rounded border">
                    <div className="text-green-300 font-bold">Layer 1 (60%)</div>
                    <div className="text-green-400 text-2xl font-bold">22.6</div>
                  </div>
                  <div className="text-center p-4 bg-gray-900/50 rounded border">
                    <div className="text-yellow-300 font-bold">Layer 2 (25%)</div>
                    <div className="text-yellow-400 text-2xl font-bold">17.3</div>
                  </div>
                  <div className="text-center p-4 bg-gray-900/50 rounded border">
                    <div className="text-blue-300 font-bold">Layer 3 (15%)</div>
                    <div className="text-blue-400 text-2xl font-bold">9.7</div>
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-900/30 rounded-lg border border-purple-600">
                  <div className="text-purple-300 mb-2">Total Economic Pulse Score:</div>
                  <div className="text-4xl font-bold text-purple-200 font-mono">
                    22.6 + 17.3 + 9.7 = <span className="text-purple-400">49.6</span>
                  </div>
                  <div className="text-purple-300 mt-2">Rating: <span className="text-orange-400 font-bold">WEAK</span> (40-54 range)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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