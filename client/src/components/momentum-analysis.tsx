import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Scatter, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

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

// Helper function to get sector full names
const getSectorFullName = (symbol: string): string => {
  const names: Record<string, string> = {
    'SPY': 'S&P 500 ETF',
    'XLK': 'Technology',
    'XLV': 'Health Care',
    'XLF': 'Financial',
    'XLY': 'Consumer Discretionary',
    'XLI': 'Industrial',
    'XLC': 'Communication Services',
    'XLP': 'Consumer Staples',
    'XLE': 'Energy',
    'XLU': 'Utilities',
    'XLB': 'Materials',
    'XLRE': 'Real Estate'
  };
  return names[symbol] || symbol;
};

// Helper function to get color for each ETF
const getETFColor = (symbol: string, index: number): string => {
  if (symbol === 'SPY') return '#1E40AF'; // Bold blue for SPY
  
  const colors = [
    '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', 
    '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
  ];
  return colors[index % colors.length];
};

const MomentumAnalysis = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: analysis, isLoading, error, refetch } = useQuery<MomentumAnalysis>({
    queryKey: ['/api/momentum-analysis', refreshKey],
    queryFn: () => fetch('/api/momentum-analysis').then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    }),
    refetchInterval: 0,
    staleTime: 1 * 60 * 1000, // 1 minute cache for cost optimization
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
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


      {/* Chart: Annual Return vs 1-Day Z-Score */}
      <Card className="bg-gray-100 border-gray-300">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">
            Risk-Return: Annual Return vs 1-Day Z-Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-50 rounded-lg p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={analysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                <XAxis 
                  dataKey="fiveDayZScore" 
                  type="number" 
                  stroke="#6B7280"
                  label={{ value: 'Z-Score of the Latest 1-Day Move', position: 'insideBottom', offset: -5, style: { fill: '#6B7280' } }}
                />
                <YAxis 
                  dataKey="annualReturn" 
                  type="number" 
                  stroke="#6B7280"
                  label={{ value: 'Annual Return %', angle: -90, position: 'insideLeft', style: { fill: '#6B7280' } }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload as ChartDataPoint;
                      const strategy = analysis.momentumStrategies.find(s => s.sector === data.sector);
                      const sectorName = getSectorFullName(data.sector);
                      return (
                        <div className="bg-white border border-gray-300 rounded p-3 shadow-lg">
                          <p className={`font-bold ${data.sector === 'SPY' ? 'text-blue-600' : 'text-gray-800'}`}>
                            {data.sector} - {sectorName}
                          </p>
                          <p className="text-gray-600">Annual Return: {data.annualReturn.toFixed(1)}%</p>
                          <p className="text-gray-600">1-Day Z-Score: {data.fiveDayZScore.toFixed(2)}</p>
                          <p className="text-gray-600">Sharpe Ratio: {data.sharpeRatio.toFixed(2)}</p>
                          {strategy && (
                            <p className="text-gray-600">Volatility: {strategy.volatility.toFixed(1)}%</p>
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
                  <LabelList 
                    dataKey="sector" 
                    position="center" 
                    content={(props: any) => {
                      const { x, y, payload } = props;
                      if (!payload?.sector || x === undefined || y === undefined) return null;
                      const isSPY = payload.sector === 'SPY';
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="#1F2937"
                          fontSize={isSPY ? "14px" : "10px"}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ 
                            textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                            pointerEvents: 'none'
                          }}
                        >
                          {payload.sector}
                        </text>
                      );
                    }}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
            {analysis.chartData.map((entry, index) => {
              const color = getETFColor(entry.sector, index);
              const sectorName = getSectorFullName(entry.sector);
              return (
                <div key={entry.sector} className="text-gray-600 flex items-center">
                  <span 
                    className="inline-block w-3 h-3 rounded mr-2" 
                    style={{ backgroundColor: color }}
                  ></span>
                  <span className={entry.sector === 'SPY' ? 'font-bold text-blue-600' : ''}>
                    {entry.sector} - {sectorName}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Momentum Strategies Table */}
      <Card className="bg-gray-100 border-gray-300">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">
            Momentum Strategies with Enhanced Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-gray-50 rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left p-3 text-gray-700 font-semibold">Sector</th>
                  <th className="text-left p-3 text-gray-700 font-semibold">Ticker</th>
                  <th className="text-left p-3 text-gray-700 font-semibold">Momentum</th>
                  <th className="text-right p-3 text-gray-700 font-semibold">Annual Return</th>
                  <th className="text-right p-3 text-gray-700 font-semibold">Sharpe Ratio</th>
                  <th className="text-right p-3 text-gray-700 font-semibold">Z-Score</th>
                  <th className="text-left p-3 text-gray-700 font-semibold">Signal</th>
                </tr>
              </thead>
              <tbody>
                {analysis.momentumStrategies.map((strategy, index) => (
                  <tr key={strategy.sector} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-3">
                      <span className="text-gray-800 font-medium">{getSectorFullName(strategy.sector)}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-gray-800 font-medium">{strategy.sector}</span>
                    </td>
                    <td className="p-3">
                      <Badge className={`${getMomentumColor(strategy.momentum)} text-xs flex items-center space-x-1 w-fit`}>
                        {getMomentumIcon(strategy.momentum)}
                        <span className="capitalize">{strategy.momentum}</span>
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${strategy.annualReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.annualReturn.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${strategy.sharpeRatio >= 0.5 ? 'text-green-600' : strategy.sharpeRatio >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {strategy.sharpeRatio.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`${Math.abs(strategy.zScore) > 1.5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {strategy.zScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 text-xs max-w-48 truncate" title={strategy.signal}>
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