import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataSufficiencyIndicator, DataSufficiencyWarning } from '@/components/DataSufficiencyWarning';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Database, Info } from 'lucide-react';
import { Scatter, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MomentumStrategy {
  sector: string;
  ticker: string;
  momentum: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  annualReturn: number;
  volatility: number;
  sharpeRatio: number;
  zScore: number;
  correlationToSPY: number;
  fiveDayZScore: number;
  oneDayChange: number;
  fiveDayChange: number;
  oneMonthChange: number;
  signal: string;
  rsi: number;
  // Data sufficiency properties
  dataReliability?: 'high' | 'medium' | 'low' | 'unreliable';
  dataConfidence?: number;
  dataPoints?: number;
  requiredDataPoints?: number;
}

interface DataSufficiencyReport {
  symbol: string;
  reliability: 'high' | 'medium' | 'low' | 'unreliable';
  confidence: number;
  sufficiencyRatio: number;
  hasWarning: boolean;
  message: string;
}

/**
 * Enhanced Momentum Analysis with Data Sufficiency Integration
 * Addresses the data sufficiency problem by showing reliability warnings
 * alongside momentum analysis results
 */
const EnhancedMomentumAnalysis = () => {
  const [showDataWarnings, setShowDataWarnings] = useState(true);

  // Fetch momentum analysis data
  const { data: momentumData, isLoading: momentumLoading, error: momentumError } = useQuery({
    queryKey: ['/api/momentum-analysis'],
    queryFn: () => fetch('/api/momentum-analysis').then(res => {
      if (!res.ok) throw new Error(`Failed to fetch momentum data`);
      return res.json();
    }),
    staleTime: 5 * 60 * 1000
  });

  // Fetch data sufficiency reports for symbols in momentum analysis
  const symbols = momentumData?.momentumStrategies?.map((s: MomentumStrategy) => s.ticker) || [];
  const { data: sufficiencyData, isLoading: sufficiencyLoading } = useQuery({
    queryKey: ['/api/data-sufficiency/reports', symbols.join(',')],
    queryFn: () => fetch('/api/data-sufficiency/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols })
    }).then(res => res.json()),
    enabled: symbols.length > 0,
    staleTime: 10 * 60 * 1000
  });

  if (momentumLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading momentum analysis...</span>
        </CardContent>
      </Card>
    );
  }

  if (momentumError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load momentum analysis: {(momentumError as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const strategies: MomentumStrategy[] = momentumData?.momentumStrategies || [];
  const sufficiencyReports: DataSufficiencyReport[] = sufficiencyData?.data?.reports || [];

  // Merge momentum data with sufficiency data
  const enhancedStrategies = strategies.map(strategy => {
    const sufficiencyReport = sufficiencyReports.find(r => r.symbol === strategy.ticker);
    return {
      ...strategy,
      dataReliability: sufficiencyReport?.reliability || 'unreliable',
      dataConfidence: sufficiencyReport?.confidence || 0,
      hasDataWarning: sufficiencyReport?.hasWarning || true
    };
  });

  // Calculate reliability statistics
  const reliabilityStats = {
    total: enhancedStrategies.length,
    high: enhancedStrategies.filter(s => s.dataReliability === 'high').length,
    medium: enhancedStrategies.filter(s => s.dataReliability === 'medium').length,
    low: enhancedStrategies.filter(s => s.dataReliability === 'low').length,
    unreliable: enhancedStrategies.filter(s => s.dataReliability === 'unreliable').length,
    avgConfidence: enhancedStrategies.reduce((sum, s) => sum + (s.dataConfidence || 0), 0) / enhancedStrategies.length
  };

  const criticalIssues = enhancedStrategies.filter(s => s.dataReliability === 'unreliable');

  return (
    <div className="space-y-6">
      {/* Data Sufficiency Warning Summary */}
      {showDataWarnings && criticalIssues.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">
                Critical Data Sufficiency Issues Detected
              </p>
              <p>
                {criticalIssues.length} of {strategies.length} symbols have unreliable z-score data. 
                Trading signals may be 40-50% noise.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/data-sufficiency'}
                  data-testid="view-data-sufficiency-button"
                >
                  <Database className="h-4 w-4 mr-2" />
                  View Data Sufficiency Dashboard
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowDataWarnings(false)}
                >
                  Hide Warnings
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Reliability Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Data Reliability Overview
            </span>
            <Badge variant="outline">
              {Math.round(reliabilityStats.avgConfidence * 100)}% Avg Confidence
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{reliabilityStats.high}</div>
              <div className="text-xs text-muted-foreground">High Reliability</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{reliabilityStats.medium}</div>
              <div className="text-xs text-muted-foreground">Medium Reliability</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{reliabilityStats.low}</div>
              <div className="text-xs text-muted-foreground">Low Reliability</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{reliabilityStats.unreliable}</div>
              <div className="text-xs text-muted-foreground">Unreliable</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Momentum Strategies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Momentum Analysis with Data Reliability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Reliability</th>
                  <th className="text-center py-2">Momentum</th>
                  <th className="text-right py-2">Z-Score</th>
                  <th className="text-right py-2">5D Change</th>
                  <th className="text-right py-2">Sharpe Ratio</th>
                  <th className="text-center py-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {enhancedStrategies.map((strategy, index) => (
                  <tr 
                    key={strategy.ticker}
                    className={`border-b hover:bg-muted/50 ${
                      strategy.dataReliability === 'unreliable' ? 'bg-red-50 dark:bg-red-950/5' : ''
                    }`}
                    data-testid={`strategy-row-${strategy.ticker.toLowerCase()}`}
                  >
                    <td className="py-2 font-medium">{strategy.ticker}</td>
                    <td className="py-2">
                      <DataSufficiencyIndicator 
                        reliability={strategy.dataReliability || 'unreliable'}
                        confidence={strategy.dataConfidence || 0}
                      />
                    </td>
                    <td className="py-2 text-center">
                      <Badge 
                        variant={
                          strategy.momentum === 'bullish' ? 'default' :
                          strategy.momentum === 'bearish' ? 'destructive' : 'secondary'
                        }
                      >
                        {strategy.momentum === 'bullish' && <TrendingUp className="h-3 w-3 mr-1" />}
                        {strategy.momentum === 'bearish' && <TrendingDown className="h-3 w-3 mr-1" />}
                        {strategy.momentum.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-mono">
                      <span className={
                        strategy.dataReliability === 'unreliable' ? 'text-red-500 line-through' :
                        Math.abs(strategy.zScore) > 2 ? 'font-bold' : ''
                      }>
                        {strategy.zScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={strategy.fiveDayChange > 0 ? 'text-green-600' : 'text-red-600'}>
                        {strategy.fiveDayChange > 0 ? '+' : ''}{strategy.fiveDayChange.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">{strategy.sharpeRatio.toFixed(2)}</td>
                    <td className="py-2 text-center">
                      <Badge 
                        variant={
                          strategy.dataReliability === 'unreliable' ? 'destructive' :
                          strategy.signal.includes('BUY') ? 'default' :
                          strategy.signal.includes('SELL') ? 'destructive' : 'secondary'
                        }
                      >
                        {strategy.dataReliability === 'unreliable' ? 'UNRELIABLE' : strategy.signal}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues Detail */}
      {showDataWarnings && criticalIssues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Symbols with Critical Data Issues</h3>
          {criticalIssues.map(strategy => {
            const report = sufficiencyReports.find(r => r.symbol === strategy.ticker);
            if (!report) return null;
            
            return (
              <DataSufficiencyWarning
                key={strategy.ticker}
                symbol={strategy.ticker}
                dataPoints={strategy.dataPoints || 0}
                requiredDataPoints={strategy.requiredDataPoints || 252}
                confidence={strategy.dataConfidence || 0}
                reliability={strategy.dataReliability || 'unreliable'}
                message={report.message}
                hasWarning={true}
              />
            );
          })}
        </div>
      )}

      {/* Performance Chart with Reliability Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Risk-Return Analysis with Data Reliability</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={enhancedStrategies}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="volatility" 
                name="Volatility" 
                unit="%" 
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <YAxis 
                dataKey="annualReturn" 
                name="Annual Return" 
                unit="%" 
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{data.ticker}</p>
                      <p>Return: {data.annualReturn.toFixed(1)}%</p>
                      <p>Volatility: {data.volatility.toFixed(1)}%</p>
                      <p>Sharpe: {data.sharpeRatio.toFixed(2)}</p>
                      <p>Z-Score: {data.zScore.toFixed(2)}</p>
                      <p className="flex items-center gap-1 mt-1">
                        Reliability: 
                        <DataSufficiencyIndicator 
                          reliability={data.dataReliability || 'unreliable'}
                          confidence={data.dataConfidence || 0}
                        />
                      </p>
                    </div>
                  );
                }}
              />
              {enhancedStrategies.map((strategy, index) => (
                <Cell 
                  key={strategy.ticker}
                  fill={strategy.dataReliability === 'unreliable' ? '#ef4444' : 
                       strategy.dataReliability === 'low' ? '#f59e0b' :
                       strategy.dataReliability === 'medium' ? '#3b82f6' : '#22c55e'}
                  stroke={strategy.dataReliability === 'unreliable' ? '#dc2626' : 'none'}
                  strokeWidth={strategy.dataReliability === 'unreliable' ? 2 : 0}
                  strokeDasharray={strategy.dataReliability === 'unreliable' ? '5,5' : 'none'}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>High Reliability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Medium Reliability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Low Reliability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-600" style={{borderStyle: 'dashed'}} />
              <span>Unreliable (40-50% noise)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedMomentumAnalysis;