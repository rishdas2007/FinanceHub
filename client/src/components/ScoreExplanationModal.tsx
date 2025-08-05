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
            <div className="grid gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-200 text-lg">Layer 1: Core Economic Momentum (60%)</h4>
                
                <ComponentExplanation
                  title="Growth Momentum"
                  score={healthScore?.growthMomentum || 0}
                  weight={25}
                  description="GDP growth rate, housing starts, and construction spending trends"
                  calculation="Weighted composite of GDP growth velocity, housing market strength, and construction activity with regime-adaptive scoring"
                  icon={TrendingUp}
                />
                
                <ComponentExplanation
                  title="Financial Stress"
                  score={healthScore?.financialStress || 0}
                  weight={20}
                  description="Credit spreads, treasury yield curve, and market volatility assessment"
                  calculation="Inverse scoring of financial stress indicators including yield curve inversions, VIX levels, and credit market conditions"
                  icon={AlertCircle}
                />
                
                <ComponentExplanation
                  title="Labor Health"
                  score={healthScore?.laborHealth || 0}
                  weight={15}
                  description="Employment population ratio, nonfarm payrolls, and jobless claims"
                  calculation="Composite employment strength using multiple labor indicators with dynamic regime detection"
                  icon={Users}
                />
              </div>

              <div className="space-y-3 mt-6">
                <h4 className="font-medium text-gray-200 text-lg">Layer 2: Inflation & Policy Balance (25%)</h4>
                
                <ComponentExplanation
                  title="Inflation Trajectory"
                  score={healthScore?.inflationTrajectory || 0}
                  weight={15}
                  description="Core CPI, PCE, and PPI trend analysis relative to 2% target"
                  calculation="Multi-measure inflation assessment with trend momentum and target distance scoring"
                  icon={BarChart3}
                />
                
                <ComponentExplanation
                  title="Policy Effectiveness"
                  score={healthScore?.policyEffectiveness || 0}
                  weight={10}
                  description="Federal funds rate positioning and monetary policy transmission"
                  calculation="Assessment of policy rate appropriateness and economic response effectiveness"
                  icon={Target}
                />
              </div>

              <div className="space-y-3 mt-6">
                <h4 className="font-medium text-gray-200 text-lg">Layer 3: Forward-Looking Confidence (15%)</h4>
                
                <ComponentExplanation
                  title="Economic Expectations"
                  score={healthScore?.economicExpectations || 0}
                  weight={15}
                  description="Consumer sentiment, business confidence, and leading indicators"
                  calculation="Forward-looking indicator composite with confidence interval assessment and expectation stability"
                  icon={Eye}
                />
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