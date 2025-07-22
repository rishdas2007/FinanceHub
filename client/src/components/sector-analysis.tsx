import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, RotateCcw, Target, BarChart3, AlertTriangle } from "lucide-react";

interface SectorAnalysisData {
  cyclicalPatterns: CyclicalPattern[];
  rotationTiming: RotationSignal[];
  riskAdjustedReturns: RiskMetrics[];
  momentumStrategies: MomentumSignal[];
  correlationAnalysis: CorrelationData[];
  movingAverages: MovingAverageData[];
  technicalIndicators: TechnicalSignals[];
  summary: string;
  confidence: number;
  timestamp: string;
}

interface CyclicalPattern {
  sector: string;
  phase: 'early-cycle' | 'mid-cycle' | 'late-cycle' | 'defensive';
  strength: number;
  duration: number;
  confidence: number;
}

interface RotationSignal {
  fromSector: string;
  toSector: string;
  strength: 'weak' | 'moderate' | 'strong';
  timing: 'immediate' | 'short-term' | 'medium-term';
  rationale: string;
}

interface RiskMetrics {
  sector: string;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  riskAdjustedReturn: number;
}

interface MomentumSignal {
  sector: string;
  momentum: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  timeframe: '20d' | '50d' | '200d';
  signal: string;
}

interface CorrelationData {
  sector: string;
  spyCorrelation: number;
  correlationTrend: 'increasing' | 'decreasing' | 'stable';
  diversificationValue: number;
}

interface MovingAverageData {
  sector: string;
  ma20: number;
  ma50: number;
  ma200?: number;
  ma20Signal: 'bullish' | 'bearish' | 'neutral';
  ma50Signal: 'bullish' | 'bearish' | 'neutral';
  crossoverSignal?: string;
}

interface TechnicalSignals {
  sector: string;
  rsi?: number;
  macd?: number;
  zScore: number;
  technicalRating: 'oversold' | 'neutral' | 'overbought';
  signals: string[];
}

const sectorNames: Record<string, string> = {
  'XLK': 'Technology',
  'XLV': 'Healthcare', 
  'XLF': 'Financial',
  'XLY': 'Consumer Discretionary',
  'XLI': 'Industrial',
  'XLC': 'Communication',
  'XLP': 'Consumer Staples',
  'XLE': 'Energy',
  'XLU': 'Utilities',
  'XLB': 'Materials',
  'XLRE': 'Real Estate',
  'SPY': 'S&P 500'
};

const phaseColors = {
  'early-cycle': 'bg-green-500',
  'mid-cycle': 'bg-blue-500',
  'late-cycle': 'bg-yellow-500',
  'defensive': 'bg-purple-500'
};

const strengthColors = {
  'strong': 'bg-red-500',
  'moderate': 'bg-yellow-500',
  'weak': 'bg-green-500'
};

const momentumColors = {
  'bullish': 'text-green-500',
  'bearish': 'text-red-500',
  'neutral': 'text-gray-400'
};

export function SectorAnalysis() {

  const { data: analysis, isLoading, error } = useQuery<SectorAnalysisData>({
    queryKey: ['/api/sector-analysis'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <BarChart3 className="mr-2 h-5 w-5 text-blue-400" />
            Comprehensive Sector Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-400">Loading sector analysis...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-red-400" />
            Sector Analysis Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400">
            Sector analysis is temporarily unavailable. Historical data collection in progress.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5 text-blue-400" />
            Comprehensive Sector Analysis
          </div>
          <Badge variant="outline" className="text-blue-400 border-blue-400">
            {analysis.confidence}% Confidence
          </Badge>
        </CardTitle>
        <CardDescription className="text-gray-400">
          {analysis.summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-white font-medium">Cyclical Pattern Analysis</h4>
              {analysis.cyclicalPatterns.map((pattern) => (
                <div key={pattern.sector} className="flex items-center justify-between p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge className={`${phaseColors[pattern.phase]} text-white`}>
                      {pattern.phase.replace('-', ' ')}
                    </Badge>
                    <span className="text-white font-medium">{sectorNames[pattern.sector] || pattern.sector}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-white text-sm">Strength: {pattern.strength.toFixed(1)}/10</div>
                      <div className="text-gray-400 text-xs">{pattern.duration} months</div>
                    </div>
                    <Progress value={pattern.strength * 10} className="w-16" />
                  </div>
                </div>
              ))}
            </div>

          {/* Rotation Timing Section */}
          <div className="space-y-3"  id="rotation-section">
            <div className="space-y-3">
              <h4 className="text-white font-medium">Sector Rotation Signals</h4>
              {analysis.rotationTiming.map((signal, index) => (
                <div key={index} className="p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <RotateCcw className="h-4 w-4 text-blue-400" />
                      <span className="text-white">
                        {sectorNames[signal.fromSector]} → {sectorNames[signal.toSector]}
                      </span>
                    </div>
                    <Badge className={strengthColors[signal.strength]}>
                      {signal.strength}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-400 mb-1">
                    Timing: {signal.timing.replace('-', ' ')}
                  </div>
                  <div className="text-xs text-gray-400">{signal.rationale}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk-Adjusted Returns Section */}
          <div className="space-y-3">
            <div className="space-y-3">
              <h4 className="text-white font-medium">Risk-Adjusted Returns</h4>
              {analysis.riskAdjustedReturns.map((risk) => (
                <div key={risk.sector} className="p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{sectorNames[risk.sector] || risk.sector}</span>
                    <span className={`font-medium ${risk.riskAdjustedReturn > 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                      {risk.riskAdjustedReturn.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-gray-400">Volatility</div>
                      <div className="text-white">{risk.volatility.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Sharpe</div>
                      <div className="text-white">{risk.sharpeRatio.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Beta</div>
                      <div className="text-white">{risk.beta.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Max DD</div>
                      <div className="text-white">{risk.maxDrawdown.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Momentum Strategies Section */}
          <div className="space-y-3">
            <div className="space-y-3">
              <h4 className="text-white font-medium">Momentum Strategies</h4>
              {analysis.momentumStrategies.map((momentum) => (
                <div key={momentum.sector} className="p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className={`h-4 w-4 ${momentumColors[momentum.momentum]}`} />
                      <span className="text-white">{sectorNames[momentum.sector] || momentum.sector}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className={momentumColors[momentum.momentum]}>
                        {momentum.momentum}
                      </Badge>
                      <span className="text-white text-sm">{momentum.strength.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{momentum.signal}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Analysis Section */}
          <div className="space-y-3">
            <div className="space-y-3">
              <h4 className="text-white font-medium">Technical Analysis & Z-Scores</h4>
              {analysis.technicalIndicators.map((tech) => (
                <div key={tech.sector} className="p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{sectorNames[tech.sector] || tech.sector}</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className={
                        tech.technicalRating === 'oversold' ? 'text-green-400 border-green-400' :
                        tech.technicalRating === 'overbought' ? 'text-red-400 border-red-400' :
                        'text-gray-400 border-gray-400'
                      }>
                        {tech.technicalRating}
                      </Badge>
                      <span className={`text-sm font-medium ${
                        Math.abs(tech.zScore) > 2 ? 'text-red-400' :
                        Math.abs(tech.zScore) > 1 ? 'text-yellow-400' : 'text-gray-400'
                      }`}>
                        Z: {tech.zScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {tech.signals.map((signal, index) => (
                      <div key={index} className="text-xs text-gray-400">{signal}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlation Analysis Section */}
          <div className="space-y-3">
            <div className="space-y-3">
              <h4 className="text-white font-medium">Correlation Analysis & Diversification</h4>
              {analysis.correlationAnalysis.map((corr) => (
                <div key={corr.sector} className="p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{sectorNames[corr.sector] || corr.sector}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">SPY Corr:</span>
                      <span className={`text-sm font-medium ${
                        Math.abs(corr.spyCorrelation) > 0.8 ? 'text-red-400' :
                        Math.abs(corr.spyCorrelation) > 0.6 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {corr.spyCorrelation.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      Trend: {corr.correlationTrend}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">Diversification Value:</span>
                      <span className="text-sm text-green-400 font-medium">
                        {(corr.diversificationValue * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {analysis.movingAverages.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-white font-medium">Moving Average Signals</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.movingAverages.slice(0, 6).map((ma) => (
                <div key={ma.sector} className="p-3 bg-financial-dark rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm">{sectorNames[ma.sector] || ma.sector}</span>
                    <div className="flex space-x-1">
                      <Badge variant="outline" size="sm" className={
                        ma.ma20Signal === 'bullish' ? 'text-green-400 border-green-400' :
                        ma.ma20Signal === 'bearish' ? 'text-red-400 border-red-400' :
                        'text-gray-400 border-gray-400'
                      }>
                        20d
                      </Badge>
                      <Badge variant="outline" size="sm" className={
                        ma.ma50Signal === 'bullish' ? 'text-green-400 border-green-400' :
                        ma.ma50Signal === 'bearish' ? 'text-red-400 border-red-400' :
                        'text-gray-400 border-gray-400'
                      }>
                        50d
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="text-gray-400">20d MA: ${ma.ma20.toFixed(2)}</div>
                    <div className="text-gray-400">50d MA: ${ma.ma50.toFixed(2)}</div>
                    {ma.crossoverSignal && (
                      <div className={`text-xs ${ma.crossoverSignal.includes('Golden') ? 'text-green-400' : 'text-red-400'}`}>
                        {ma.crossoverSignal}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 flex items-center justify-between">
          <span>Last updated: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
          <span>Data from authentic market sources</span>
        </div>
      </CardContent>
    </Card>
  );
}