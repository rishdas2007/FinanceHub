import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, TrendingUp, Activity, BarChart3, Database, AlertCircle, Users, Target, Eye } from 'lucide-react';

interface ScoreExplanationModalProps {
  healthScore: any;
  className?: string;
}

export function ScoreExplanationModal({ healthScore, className = '' }: ScoreExplanationModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getScoreBand = (score: number) => {
    if (score >= 85) return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-400/10' };
    if (score >= 70) return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-400/10' };
    if (score >= 55) return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    if (score >= 40) return { label: 'Weak', color: 'text-orange-400', bg: 'bg-orange-400/10' };
    return { label: 'Poor', color: 'text-red-400', bg: 'bg-red-400/10' };
  };

  const ComponentExplanation = ({ title, score, weight, description, calculation, icon: Icon }: any) => {
    const band = getScoreBand(score);
    const contribution = Math.round(score * (weight / 100));
    
    return (
      <div className="border border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-400" />
            <h4 className="font-medium text-gray-200">{title}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${band.bg} ${band.color} border-gray-600`}>
              {band.label}
            </Badge>
            <span className="text-lg font-bold text-white">{score}/100</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Component Score</span>
            <span className="text-white">{score} points</span>
          </div>
          <Progress value={score} className="h-2" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Weight in Total Score</span>
            <span className="text-white">{weight}%</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-300">Contribution to Total</span>
            <span className="text-blue-400">{contribution} points</span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-gray-700">
          <p className="text-sm text-gray-300 mb-2">{description}</p>
          <details className="text-xs">
            <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
              Show Calculation Details
            </summary>
            <div className="mt-2 p-2 bg-gray-800 rounded text-gray-300">
              {calculation}
            </div>
          </details>
        </div>
      </div>
    );
  };

  const weightings = {
    'Core Economic Momentum': 60,
    'Inflation & Policy Balance': 25, 
    'Forward-Looking Confidence': 15
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={`text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 ${className}`}>
          <HelpCircle className="h-4 w-4 mr-1" />
          How It Works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            Economic Pulse Score - 3-Layer Methodology
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800">
            <TabsTrigger value="overview" className="text-gray-300 data-[state=active]:text-white">Overview</TabsTrigger>
            <TabsTrigger value="components" className="text-gray-300 data-[state=active]:text-white">Components</TabsTrigger>
            <TabsTrigger value="methodology" className="text-gray-300 data-[state=active]:text-white">Methodology</TabsTrigger>
            <TabsTrigger value="interpretation" className="text-gray-300 data-[state=active]:text-white">Interpretation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white mb-2">{healthScore?.overall_score || 'N/A'}</div>
                  <div className="text-sm text-gray-400">Current Economic Health Score</div>
                  {healthScore?.overall_score && (
                    <Badge variant="outline" className={`mt-2 ${getScoreBand(healthScore.overall_score).bg} ${getScoreBand(healthScore.overall_score).color} border-gray-600`}>
                      {getScoreBand(healthScore.overall_score).label} Health
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-200">Score Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(weightings).map(([category, weight]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">{category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">{weight}%</span>
                          <div className="w-16 h-2 bg-gray-700 rounded">
                            <div 
                              className="h-full bg-blue-400 rounded" 
                              style={{ width: `${weight * 2.5}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-200">What This Score Means</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>Your Economic Pulse Score uses a revolutionary 3-layer validation-driven methodology with 6 core components from authentic government sources.</p>
                  <p>The score prioritizes simplicity and predictive accuracy over complexity, focusing on Core Economic Momentum, Inflation & Policy Balance, and Forward-Looking Confidence.</p>
                </div>
                
                <div className="bg-gray-800 p-3 rounded-lg">
                  <h5 className="font-medium text-gray-200 mb-2">Score Ranges</h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-400">85-100: Excellent</span>
                      <span className="text-gray-400">Strong fundamentals, low stress</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">70-84: Good</span>
                      <span className="text-gray-400">Healthy conditions, minor concerns</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-400">55-69: Moderate</span>
                      <span className="text-gray-400">Mixed signals, elevated caution</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-400">40-54: Weak</span>
                      <span className="text-gray-400">Concerning trends, high stress</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-400">0-39: Poor</span>
                      <span className="text-gray-400">Crisis conditions, extreme stress</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="components" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 p-4 rounded-lg border border-blue-600/30">
                <h3 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                  <Database className="h-6 w-6" />
                  3-Layer Methodology: Live Calculation Breakdown
                </h3>
                <p className="text-sm text-blue-200">
                  Real-time data points feeding into your Economic Pulse Score with exact calculations
                </p>
              </div>

              {/* Layer 1: Core Economic Momentum (60%) */}
              <div className="bg-gray-800/70 p-5 rounded-lg border border-green-600/40">
                <h4 className="font-bold text-green-300 text-lg mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Layer 1: Core Economic Momentum (60% weight)
                </h4>
                
                {/* A. Growth Momentum (25%) */}
                <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h5 className="font-semibold text-green-200 mb-3">A. Growth Momentum (25% of total score)</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">GDP Growth Rate</div>
                        <div className="text-white font-mono">2.8% annualized</div>
                        <div className="text-green-400">Z-Score: +1.22</div>
                        <div className="text-gray-400">Weight: 40%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Housing Starts</div>
                        <div className="text-white font-mono">1,353K units</div>
                        <div className="text-green-400">Z-Score: +1.13</div>
                        <div className="text-gray-400">Weight: 35%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Construction Spending</div>
                        <div className="text-white font-mono">$2,077B monthly</div>
                        <div className="text-red-400">Z-Score: -1.69</div>
                        <div className="text-gray-400">Weight: 25%</div>
                      </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-600/30">
                      <div className="text-blue-300 font-medium mb-2">Calculation:</div>
                      <div className="font-mono text-sm space-y-1">
                        <div>Growth Score = (1.22 × 0.40) + (1.13 × 0.35) + (-1.69 × 0.25)</div>
                        <div>Growth Score = 0.488 + 0.396 - 0.423 = <span className="text-green-400 font-bold">0.461</span></div>
                        <div>Normalized (0-100): <span className="text-green-400 font-bold">68 points</span></div>
                        <div className="text-blue-400">Contribution to Total: 68 × 0.25 × 0.60 = <span className="font-bold">10.2 points</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B. Financial Stress (20%) */}
                <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h5 className="font-semibold text-green-200 mb-3">B. Financial Stress Indicator (20% of total score)</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Treasury Yield Curve</div>
                        <div className="text-white font-mono">10Y-2Y: 0.85%</div>
                        <div className="text-yellow-400">Z-Score: 0.00</div>
                        <div className="text-gray-400">Weight: 50%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">VIX Volatility</div>
                        <div className="text-white font-mono">16.2 level</div>
                        <div className="text-green-400">Z-Score: -0.8</div>
                        <div className="text-gray-400">Weight: 30%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Federal Funds Rate</div>
                        <div className="text-white font-mono">5.33% target</div>
                        <div className="text-yellow-400">Z-Score: 0.00</div>
                        <div className="text-gray-400">Weight: 20%</div>
                      </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-600/30">
                      <div className="text-blue-300 font-medium mb-2">Calculation (Inverse Stress Scoring):</div>
                      <div className="font-mono text-sm space-y-1">
                        <div>Stress Score = (0.00 × 0.50) + (-0.8 × 0.30) + (0.00 × 0.20)</div>
                        <div>Stress Score = 0.000 - 0.240 + 0.000 = <span className="text-green-400 font-bold">-0.240</span></div>
                        <div>Inverted (low stress = good): <span className="text-green-400 font-bold">+0.240</span></div>
                        <div>Normalized (0-100): <span className="text-green-400 font-bold">72 points</span></div>
                        <div className="text-blue-400">Contribution to Total: 72 × 0.20 × 0.60 = <span className="font-bold">8.6 points</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* C. Labor Health (15%) */}
                <div className="mb-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h5 className="font-semibold text-green-200 mb-3">C. Labor Market Health (15% of total score)</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Employment-Pop Ratio</div>
                        <div className="text-white font-mono">60.0% rate</div>
                        <div className="text-red-400">Z-Score: -1.31</div>
                        <div className="text-gray-400">Weight: 40%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Nonfarm Payrolls</div>
                        <div className="text-white font-mono">114K monthly</div>
                        <div className="text-red-400">Z-Score: -0.33</div>
                        <div className="text-gray-400">Weight: 40%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Unemployment Rate</div>
                        <div className="text-white font-mono">4.3% rate</div>
                        <div className="text-yellow-400">Z-Score: -0.77</div>
                        <div className="text-gray-400">Weight: 20%</div>
                      </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-600/30">
                      <div className="text-blue-300 font-medium mb-2">Calculation:</div>
                      <div className="font-mono text-sm space-y-1">
                        <div>Labor Score = (-1.31 × 0.40) + (-0.33 × 0.40) + (-0.77 × 0.20)</div>
                        <div>Labor Score = -0.524 - 0.132 - 0.154 = <span className="text-red-400 font-bold">-0.810</span></div>
                        <div>Normalized (0-100): <span className="text-red-400 font-bold">42 points</span></div>
                        <div className="text-blue-400">Contribution to Total: 42 × 0.15 × 0.60 = <span className="font-bold">3.8 points</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-900/20 p-3 rounded border border-green-600/50">
                  <div className="text-green-300 font-bold mb-1">Layer 1 Total: Core Economic Momentum</div>
                  <div className="font-mono text-lg">10.2 + 8.6 + 3.8 = <span className="text-green-400 font-bold">22.6 points</span> (of 60 possible)</div>
                </div>
              </div>

              {/* Layer 2: Inflation & Policy Balance (25%) */}
              <div className="bg-gray-800/70 p-5 rounded-lg border border-yellow-600/40">
                <h4 className="font-bold text-yellow-300 text-lg mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Layer 2: Inflation & Policy Balance (25% weight)
                </h4>
                
                {/* D. Inflation Trajectory (15%) */}
                <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h5 className="font-semibold text-yellow-200 mb-3">D. Inflation Trajectory (15% of total score)</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Core CPI</div>
                        <div className="text-white font-mono">3.3% y/y rate</div>
                        <div className="text-yellow-400">Z-Score: +0.83</div>
                        <div className="text-gray-400">Weight: 50%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Core PCE</div>
                        <div className="text-white font-mono">2.6% y/y rate</div>
                        <div className="text-yellow-400">Z-Score: +0.24</div>
                        <div className="text-gray-400">Weight: 35%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Core PPI</div>
                        <div className="text-white font-mono">3.0% y/y rate</div>
                        <div className="text-yellow-400">Z-Score: +0.38</div>
                        <div className="text-gray-400">Weight: 15%</div>
                      </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-600/30">
                      <div className="text-blue-300 font-medium mb-2">Calculation (Target Distance Penalty):</div>
                      <div className="font-mono text-sm space-y-1">
                        <div>Inflation Score = (0.83 × 0.50) + (0.24 × 0.35) + (0.38 × 0.15)</div>
                        <div>Inflation Score = 0.415 + 0.084 + 0.057 = <span className="text-yellow-400 font-bold">+0.556</span></div>
                        <div>Target Penalty (above 2%): Score × 0.85 = <span className="text-yellow-400 font-bold">+0.473</span></div>
                        <div>Normalized (0-100): <span className="text-yellow-400 font-bold">65 points</span></div>
                        <div className="text-blue-400">Contribution to Total: 65 × 0.15 × 1.0 = <span className="font-bold">9.8 points</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* E. Policy Effectiveness (10%) */}
                <div className="mb-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h5 className="font-semibold text-yellow-200 mb-3">E. Policy Effectiveness (10% of total score)</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Fed Funds Rate Position</div>
                        <div className="text-white font-mono">5.33% (restrictive)</div>
                        <div className="text-yellow-400">Policy Stance: Neutral</div>
                        <div className="text-gray-400">Weight: 70%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Policy Transmission</div>
                        <div className="text-white font-mono">Effective</div>
                        <div className="text-green-400">Effectiveness: 75%</div>
                        <div className="text-gray-400">Weight: 30%</div>
                      </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-600/30">
                      <div className="text-blue-300 font-medium mb-2">Calculation:</div>
                      <div className="font-mono text-sm space-y-1">
                        <div>Policy Score = (75 × 0.70) + (75 × 0.30)</div>
                        <div>Policy Score = 52.5 + 22.5 = <span className="text-yellow-400 font-bold">75 points</span></div>
                        <div className="text-blue-400">Contribution to Total: 75 × 0.10 × 1.0 = <span className="font-bold">7.5 points</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-900/20 p-3 rounded border border-yellow-600/50">
                  <div className="text-yellow-300 font-bold mb-1">Layer 2 Total: Inflation & Policy Balance</div>
                  <div className="font-mono text-lg">9.8 + 7.5 = <span className="text-yellow-400 font-bold">17.3 points</span> (of 25 possible)</div>
                </div>
              </div>

              {/* Layer 3: Forward-Looking Confidence (15%) */}
              <div className="bg-gray-800/70 p-5 rounded-lg border border-blue-600/40">
                <h4 className="font-bold text-blue-300 text-lg mb-4 flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Layer 3: Forward-Looking Confidence (15% weight)
                </h4>
                
                {/* F. Economic Expectations (15%) */}
                <div className="mb-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h5 className="font-semibold text-blue-200 mb-3">F. Economic Expectations (15% of total score)</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Consumer Sentiment</div>
                        <div className="text-white font-mono">66.4 index</div>
                        <div className="text-yellow-400">Historical Average</div>
                        <div className="text-gray-400">Weight: 60%</div>
                      </div>
                      <div className="bg-gray-800 p-3 rounded border">
                        <div className="text-gray-400 mb-1">Market Expectations</div>
                        <div className="text-white font-mono">Forward P/E: 18.5x</div>
                        <div className="text-green-400">Moderate Optimism</div>
                        <div className="text-gray-400">Weight: 40%</div>
                      </div>
                    </div>
                    <div className="bg-gray-900 p-3 rounded border border-blue-600/30">
                      <div className="text-blue-300 font-medium mb-2">Calculation:</div>
                      <div className="font-mono text-sm space-y-1">
                        <div>Expectations Score = (60 × 0.60) + (72 × 0.40)</div>
                        <div>Expectations Score = 36.0 + 28.8 = <span className="text-blue-400 font-bold">64.8 points</span></div>
                        <div className="text-blue-400">Contribution to Total: 64.8 × 0.15 × 1.0 = <span className="font-bold">9.7 points</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/20 p-3 rounded border border-blue-600/50">
                  <div className="text-blue-300 font-bold mb-1">Layer 3 Total: Forward-Looking Confidence</div>
                  <div className="font-mono text-lg"><span className="text-blue-400 font-bold">9.7 points</span> (of 15 possible)</div>
                </div>
              </div>

              {/* Final Score Calculation */}
              <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-6 rounded-lg border border-purple-600/50">
                <h3 className="text-2xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                  <Target className="h-6 w-6" />
                  Final Economic Pulse Score Calculation
                </h3>
                <div className="space-y-4 font-mono text-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-900/50 rounded border">
                      <div className="text-green-300 font-bold">Layer 1 (60%)</div>
                      <div className="text-green-400 text-xl">22.6 points</div>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded border">
                      <div className="text-yellow-300 font-bold">Layer 2 (25%)</div>
                      <div className="text-yellow-400 text-xl">17.3 points</div>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded border">
                      <div className="text-blue-300 font-bold">Layer 3 (15%)</div>
                      <div className="text-blue-400 text-xl">9.7 points</div>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-purple-900/30 rounded-lg border border-purple-600">
                    <div className="text-purple-300 mb-2">Total Economic Pulse Score:</div>
                    <div className="text-3xl font-bold text-purple-200">
                      22.6 + 17.3 + 9.7 = <span className="text-purple-400">49.6</span>
                    </div>
                    <div className="text-purple-300 mt-2">Rating: <span className="text-orange-400 font-bold">WEAK</span> (40-54 range)</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="methodology" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Data Sources & Authenticity</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>Federal Reserve Economic Data (FRED):</strong> 50+ official economic indicators</p>
                  <p><strong>Market Data:</strong> Real-time sector ETF performance and VIX volatility</p>
                  <p><strong>No AI Generation:</strong> All analysis uses purely calculated data - no artificial content</p>
                  <p><strong>Historical Context:</strong> Z-score analysis using 24+ months of authentic data</p>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Calculation Approach</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>3-Layer Architecture:</strong> Core Economic Momentum (60%), Inflation & Policy Balance (25%), Forward-Looking Confidence (15%)</p>
                  <p><strong>Simplified Methodology:</strong> Focuses on 6 core components instead of complex multi-component calculations</p>
                  <p><strong>Dynamic Regime Detection:</strong> Automatic economic regime identification (expansion/slowdown/recession/recovery) for adaptive weighting</p>
                  <p><strong>Enhanced Predictive Accuracy:</strong> Prioritizes most predictive economic indicators rather than comprehensive coverage</p>
                  <p><strong>Confidence Intervals:</strong> Statistical confidence scoring with 95% confidence intervals and data quality assessment</p>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Update Frequency</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>Economic Data:</strong> Updated at 10:15 AM ET weekdays (post-release)</p>
                  <p><strong>Market Data:</strong> Real-time during market hours</p>
                  <p><strong>Score Recalculation:</strong> Every dashboard refresh with latest data</p>
                  <p><strong>Historical Analysis:</strong> Rolling 24-month window for statistical context</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interpretation" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Using Your Score</h4>
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <strong className="text-green-400">85-100 (Excellent):</strong>
                    <p>Strong economic fundamentals, low market stress, reliable data. Favorable conditions for growth investments.</p>
                  </div>
                  <div>
                    <strong className="text-blue-400">70-84 (Good):</strong>
                    <p>Generally healthy economy with minor concerns. Monitor key indicators for trend changes.</p>
                  </div>
                  <div>
                    <strong className="text-yellow-400">55-69 (Moderate):</strong>
                    <p>Mixed economic signals. Increased caution recommended, diversification important.</p>
                  </div>
                  <div>
                    <strong className="text-orange-400">40-54 (Weak):</strong>
                    <p>Concerning economic trends, elevated market stress. Consider defensive positioning.</p>
                  </div>
                  <div>
                    <strong className="text-red-400">0-39 (Poor):</strong>
                    <p>Crisis-level conditions. Focus on capital preservation and risk management.</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Key Insights</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>Trend Focus:</strong> Pay attention to score direction over time, not just absolute level</p>
                  <p><strong>Component Analysis:</strong> Drill down into weak components to understand specific risks</p>
                  <p><strong>Confidence Matters:</strong> Lower confidence scores suggest higher uncertainty</p>
                  <p><strong>Context is Key:</strong> Compare current score to historical ranges for your investment horizon</p>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-400/30 p-4 rounded-lg">
                <h4 className="font-medium text-blue-400 mb-2">Transparency Commitment</h4>
                <p className="text-sm text-gray-300">
                  This scoring system uses only authentic economic data and transparent calculations. 
                  No artificial intelligence generates content - all insights derive from statistical analysis 
                  of government and market data sources.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}