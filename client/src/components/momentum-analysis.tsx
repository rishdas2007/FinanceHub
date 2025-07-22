import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Scatter, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MomentumStrategy {
  sector: string;
  momentum: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  annualReturn: number;
  volatility: number;
  sharpeRatio: number;
  zScore: number;
  correlationToSPY: number;
  fiveDayZScore: number;
  signal: string;
}

interface ChartDataPoint {
  sector: string;
  annualReturn: number;
  fiveDayZScore: number;
  sharpeRatio: number;
}

interface MomentumAnalysis {
  momentumStrategies: MomentumStrategy[];
  chartData: ChartDataPoint[];
  summary: string;
  confidence: number;
  timestamp: string;
}

const MomentumAnalysis = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: analysis, isLoading, error, refetch } = useQuery<MomentumAnalysis>({
    queryKey: ['/api/momentum-analysis', refreshKey],
    queryFn: () => fetch('/api/momentum-analysis').then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    }),
    refetchInterval: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case 'bullish': return 'text-green-600 bg-green-50 border-green-200';
      case 'bearish': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getMomentumIcon = (momentum: string) => {
    switch (momentum) {
      case 'bullish': return <TrendingUp className="w-4 h-4" />;
      case 'bearish': return <TrendingDown className="w-4 h-4" />;
      default: return <ArrowRight className="w-4 h-4" />;
    }
  };

  const getColorByCorrelation = (correlation: number) => {
    // Color by correlation strength: high correlation (red) to low correlation (green)
    const absCorr = Math.abs(correlation);
    if (absCorr > 0.8) return '#dc2626'; // Red (high correlation)
    if (absCorr > 0.6) return '#ea580c'; // Orange
    if (absCorr > 0.4) return '#ca8a04'; // Yellow
    if (absCorr > 0.2) return '#16a34a'; // Green
    return '#059669'; // Dark green (low correlation, good for diversification)
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-gray-300">Loading momentum analysis with verified calculations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-400 mb-4">Error loading momentum analysis</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Retry Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold text-white">
            Simplified Momentum Analysis
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-blue-900 text-blue-100">
              {analysis.confidence}% Confidence
            </Badge>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300 text-sm">{analysis.summary}</p>
          <p className="text-gray-500 text-xs mt-2">
            Last updated: {new Date(analysis.timestamp).toLocaleTimeString()}
          </p>
        </CardContent>
      </Card>

      {/* Chart: Annual Return vs 5-Day Z-Score */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Risk-Return: Annual Return vs 5-Day Z-Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={analysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="fiveDayZScore" 
                  type="number" 
                  stroke="#9CA3AF"
                  label={{ value: '5-Day Z-Score', position: 'insideBottom', offset: -5, style: { fill: '#9CA3AF' } }}
                />
                <YAxis 
                  dataKey="annualReturn" 
                  type="number" 
                  stroke="#9CA3AF"
                  label={{ value: 'Annual Return %', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload as ChartDataPoint;
                      const strategy = analysis.momentumStrategies.find(s => s.sector === data.sector);
                      const sectorName = getSectorFullName(data.sector);
                      return (
                        <div className="bg-gray-800 border border-gray-600 rounded p-3 shadow-lg">
                          <p className={`font-bold ${data.sector === 'SPY' ? 'text-blue-400' : 'text-white'}`}>
                            {data.sector} - {sectorName}
                          </p>
                          <p className="text-gray-300">Annual Return: {data.annualReturn.toFixed(1)}%</p>
                          <p className="text-gray-300">5-Day Z-Score: {data.fiveDayZScore.toFixed(2)}</p>
                          <p className="text-gray-300">Sharpe Ratio: {data.sharpeRatio.toFixed(2)}</p>
                          {strategy && (
                            <p className="text-gray-300">Volatility: {strategy.volatility.toFixed(1)}%</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter dataKey="annualReturn">
                  {analysis.chartData.map((entry, index) => {
                    const color = getETFColor(entry.sector, index);
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
            {analysis.chartData.map((entry, index) => {
              const color = getETFColor(entry.sector, index);
              const sectorName = getSectorFullName(entry.sector);
              return (
                <div key={entry.sector} className="text-gray-400 flex items-center">
                  <span 
                    className="inline-block w-3 h-3 rounded mr-2" 
                    style={{ backgroundColor: color }}
                  ></span>
                  <span className={entry.sector === 'SPY' ? 'font-bold text-blue-400' : ''}>
                    {entry.sector} - {sectorName}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Momentum Strategies Table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Momentum Strategies with Enhanced Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 text-gray-300 font-semibold">Sector</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Momentum</th>
                  <th className="text-right p-3 text-gray-300 font-semibold">Annual Return</th>
                  <th className="text-right p-3 text-gray-300 font-semibold">Sharpe Ratio</th>
                  <th className="text-right p-3 text-gray-300 font-semibold">Z-Score</th>
                  <th className="text-right p-3 text-gray-300 font-semibold">SPY Correlation</th>
                  <th className="text-right p-3 text-gray-300 font-semibold">Volatility</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Signal</th>
                </tr>
              </thead>
              <tbody>
                {analysis.momentumStrategies.map((strategy, index) => (
                  <tr key={strategy.sector} className={`border-b border-gray-800 ${index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}`}>
                    <td className="p-3">
                      <span className="text-white font-medium">{strategy.sector}</span>
                    </td>
                    <td className="p-3">
                      <Badge className={`${getMomentumColor(strategy.momentum)} text-xs flex items-center space-x-1 w-fit`}>
                        {getMomentumIcon(strategy.momentum)}
                        <span className="capitalize">{strategy.momentum}</span>
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${strategy.annualReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {strategy.annualReturn.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${strategy.sharpeRatio >= 0.5 ? 'text-green-400' : strategy.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {strategy.sharpeRatio.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${Math.abs(strategy.zScore) > 1.5 ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {strategy.zScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${Math.abs(strategy.correlationToSPY) < 0.5 ? 'text-green-400' : 'text-gray-300'}`}>
                        {strategy.correlationToSPY.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-right text-gray-300">
                      {strategy.volatility.toFixed(1)}%
                    </td>
                    <td className="p-3 text-gray-300 text-xs max-w-48 truncate" title={strategy.signal}>
                      {strategy.signal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MomentumAnalysis;