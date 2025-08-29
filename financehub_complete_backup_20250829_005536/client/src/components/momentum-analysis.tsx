import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, ArrowRight, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { TechnicalIndicatorLegend } from './TechnicalIndicatorLegend';
import { Scatter, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';

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
}

interface ChartDataPoint {
  sector: string;
  rsi: number;
  zScore: number;
  fiveDayZScore: number;
  sharpeRatio: number;
  annualReturn: number;
}

interface MomentumAnalysis {
  momentumStrategies: MomentumStrategy[];
  chartData: ChartDataPoint[];
  summary: string;
  confidence: number;
  timestamp: string;
}





const getETFColor = (sector: string, index: number) => {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#6366f1', '#84cc16'
  ];
  if (sector === 'SPY') return '#3b82f6'; // Blue for SPY
  return colors[index % colors.length];
};

type SortField = 'sector' | 'ticker' | 'momentum' | 'oneDayChange' | 'fiveDayChange' | 'oneMonthChange' | 'rsi' | 'zScore' | 'annualReturn' | 'sharpeRatio';
type SortDirection = 'asc' | 'desc';

const MomentumAnalysis = () => {
  // Momentum analysis disabled to conserve API quota
  return (
    <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-yellow-500/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-yellow-400" />
        <h3 className="text-xl font-semibold text-yellow-400">Momentum Analysis Temporarily Disabled</h3>
      </div>
      <div className="space-y-3">
        <p className="text-gray-300">
          The momentum strategies table has been temporarily removed to preserve API quota for core functionality.
        </p>
        <p className="text-gray-400 text-sm">
          This table was consuming excessive API calls for 1-day, 5-day, and 1-month percentage changes, 
          which was causing rate limit issues and potentially corrupted data.
        </p>
        <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
          <p className="text-blue-300 text-sm">
            <strong>Core features still available:</strong> ETF metrics, technical indicators, economic health score, 
            and sector analysis continue to work with authentic data.
          </p>
        </div>
      </div>
    </div>
  );
export default MomentumAnalysis;
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

  const getETFColor = (sector: string, index: number) => {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
      '#6366f1', '#84cc16'
    ];
    if (sector === 'SPY') return '#3b82f6'; // Blue for SPY
    return colors[index % colors.length];
  };

  const getSectorFullName = (ticker: string): string => {
    const sectorMap: { [key: string]: string } = {
      'SPY': 'S&P 500 INDEX',
      'XLK': 'Technology',
      'XLV': 'Health Care',
      'XLF': 'Financials',
      'XLY': 'Consumer Discretionary',
      'XLI': 'Industrials',
      'XLC': 'Communication Services',
      'XLP': 'Consumer Staples',
      'XLE': 'Energy',
      'XLU': 'Utilities',
      'XLB': 'Materials',
      'XLRE': 'Real Estate'
    };
    return sectorMap[ticker] || ticker;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="momentum-loading">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-blue-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">Momentum Analysis</h3>
          <span className="text-sm text-blue-400">Processing market data...</span>
        </div>
        <div className="space-y-4">
          {/* Chart skeleton */}
          <div className="h-[400px] bg-gray-800/50 rounded-lg p-4">
            <div className="h-6 bg-gray-700 rounded w-1/4 mb-4 animate-pulse" />
            <div className="h-full bg-gray-700 rounded animate-pulse" />
          </div>
          
          {/* Table skeleton */}
          <div className="space-y-3">
            <div className="h-6 bg-gray-800 rounded w-1/3 animate-pulse" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center space-x-4 p-4 bg-gray-800/50 rounded">
                <div className="h-6 w-16 bg-gray-700 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-2/3 animate-pulse" />
                  <div className="h-3 bg-gray-700 rounded w-1/2 animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-12 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
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
            1-Day Z-Score vs RSI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] bg-gray-50 rounded-lg p-4 pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={analysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                <XAxis 
                  dataKey="rsi" 
                  type="number" 
                  domain={[0, 90]}
                  tickCount={10}
                  stroke="#6B7280"
                  label={{ value: 'RSI', position: 'insideBottom', offset: -5, style: { fill: '#6B7280' } }}
                />
                <YAxis 
                  dataKey="zScore" 
                  type="number" 
                  domain={[-1.5, 1.5]}
                  tickCount={7}
                  stroke="#6B7280"
                  label={{ value: 'Z-Score of the Latest 1-Day Move', angle: -90, position: 'insideLeft', style: { fill: '#6B7280' } }}
                />
                {/* Reference lines for RSI levels with labels */}
                <ReferenceLine x={30} stroke="#dc2626" strokeDasharray="2 2" strokeWidth={2} 
                  label={{ value: "Oversold", position: "bottom", offset: 20, fill: "#dc2626", fontSize: 12, fontWeight: "bold" }} />
                <ReferenceLine x={70} stroke="#dc2626" strokeDasharray="2 2" strokeWidth={2} 
                  label={{ value: "Overbought", position: "bottom", offset: 20, fill: "#dc2626", fontSize: 12, fontWeight: "bold" }} />
                {/* Reference line for Y-axis intersection at 45 RSI */}
                <ReferenceLine x={45} stroke="#6b7280" strokeDasharray="1 1" strokeWidth={1} opacity={0.5} />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="1 1" strokeWidth={1} opacity={0.5} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload as ChartDataPoint;
                      const strategy = analysis.momentumStrategies.find(s => s.ticker === data.sector);
                      const sectorName = getSectorFullName(data.sector);
                      return (
                        <div className="bg-white border border-gray-300 rounded p-3 shadow-lg">
                          <p className={`font-bold ${data.sector === 'SPY' ? 'text-blue-600' : 'text-gray-800'}`}>
                            {data.sector} - {sectorName}
                          </p>
                          <p className="text-gray-600">RSI: {data.rsi.toFixed(1)}</p>
                          <p className="text-gray-600">1-Day Z-Score: {data.zScore.toFixed(2)}</p>
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
                <Scatter dataKey="zScore" fill="#8884d8">
                  {analysis.chartData.map((entry, index) => {
                    const color = getETFColor(entry.sector, index);
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                  <LabelList 
                    dataKey="sector" 
                    position="top"
                    fontSize={11}
                    fill="#000"
                    fontWeight="bold"
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
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <strong>How to interpret this chart:</strong> Each dot represents a sector ETF plotted by its RSI (x-axis) and 1-day Z-score (y-axis). 
              
              <strong>RSI (Relative Strength Index):</strong> Measures momentum on a 0-100 scale. Values above 70 indicate overbought conditions (potential selling pressure), while values below 30 suggest oversold conditions (potential buying opportunity). Values between 30-70 represent neutral momentum.
              
              <strong>Z-Score:</strong> Shows how many standard deviations the current 1-day move is from the historical average. Positive values indicate above-average gains, negative values show above-average losses. Values beyond ±2 are statistically significant events.
              
              <strong>Sector Positioning:</strong> Top-right quadrant (high RSI + positive Z-score) shows momentum leaders with recent strength. Bottom-left quadrant (low RSI + negative Z-score) indicates potential value opportunities or sectors under pressure. SPY (S&P 500) serves as the market benchmark with larger labels for easy identification.
            </p>

          </div>
        </CardContent>
      </Card>



      {/* Top Sector Highlight */}
      {analysis.momentumStrategies && analysis.momentumStrategies.length > 0 && (() => {
        // Find top performing sector by Z-Score (excluding SPY) for consistency
        const topSector = analysis.momentumStrategies
          .filter(s => s.ticker !== 'SPY')
          .sort((a, b) => b.zScore - a.zScore)[0];
        
        if (topSector) {
          return (
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                  Top Performing Sector
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-gray-800">{topSector.sector}</span>
                      <span className="ml-2 text-lg text-gray-600">({topSector.ticker})</span>
                    </div>
                    <Badge className={`${getMomentumColor(topSector.momentum)} text-sm`}>
                      {getMomentumIcon(topSector.momentum)}
                      <span className="capitalize ml-1">{topSector.momentum}</span>
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-gray-500 uppercase">RSI</div>
                      <div className={`text-lg font-semibold ${topSector.rsi >= 70 ? 'text-red-600' : topSector.rsi <= 30 ? 'text-green-600' : 'text-blue-600'}`}>
                        {topSector.rsi.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {topSector.rsi >= 70 ? 'Overbought' : topSector.rsi <= 30 ? 'Oversold' : 'Neutral'}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-gray-500 uppercase">Sharpe Ratio</div>
                      <div className={`text-lg font-semibold ${topSector.sharpeRatio >= 0.5 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {topSector.sharpeRatio.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">Risk-Adjusted</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-gray-500 uppercase">1-Month Return</div>
                      <div className={`text-lg font-semibold ${topSector.oneMonthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {topSector.oneMonthChange >= 0 ? '+' : ''}{topSector.oneMonthChange.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">Performance</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-gray-500 uppercase">Z-Score</div>
                      <div className={`text-lg font-semibold ${Math.abs(topSector.zScore) > 1.5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {topSector.zScore.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.abs(topSector.zScore) > 1.5 ? 'Unusual Move' : 'Normal Range'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="text-sm font-medium text-gray-700 mb-2">Market Signal Analysis:</div>
                    <div className="text-sm text-gray-600">{topSector.signal}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Momentum Strategies Table */}
      <Card className="bg-gray-100 border-gray-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-gray-800" title="Enhanced momentum analysis with fixed RSI calculations, corrected Z-score scaling, and industry-standard moving average calculations. No dynamic period adjustments compromise indicator integrity.">
              Momentum Strategies with Enhanced Metrics
            </CardTitle>
            <TechnicalIndicatorLegend />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-gray-50 rounded-lg p-4">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left p-2 text-gray-700 font-semibold w-32 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sector')}>
                    Sector{getSortIcon('sector')}
                  </th>
                  <th className="text-left p-2 text-gray-700 font-semibold w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ticker')}>
                    Ticker{getSortIcon('ticker')}
                  </th>
                  <th className="text-left p-2 text-gray-700 font-semibold w-20 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('momentum')}>
                    Momentum{getSortIcon('momentum')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('oneDayChange')}>
                    1-Day<br/>Move{getSortIcon('oneDayChange')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('fiveDayChange')}>
                    5-Day<br/>Move{getSortIcon('fiveDayChange')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('oneMonthChange')}>
                    1-Month<br/>Move{getSortIcon('oneMonthChange')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('rsi')} title="Relative Strength Index (14-period). Fixed calculation ensures proper sample size validation.">
                    RSI{getSortIcon('rsi')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-20 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('zScore')} title="Z-Score statistical analysis using 20-day rolling window. Improved scaling and enhanced extreme value handling.">
                    Z-Score of Latest<br/>1-Day Move{getSortIcon('zScore')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-20 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('annualReturn')}>
                    Annual<br/>Return{getSortIcon('annualReturn')}
                  </th>
                  <th className="text-right p-2 text-gray-700 font-semibold w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sharpeRatio')}>
                    Sharpe<br/>Ratio{getSortIcon('sharpeRatio')}
                  </th>
                  <th className="text-left p-2 text-gray-700 font-semibold">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sortStrategies(analysis.momentumStrategies)
                  .map((strategy, index) => {
                    const isSPY = strategy.ticker === 'SPY';
                    return (
                  <tr key={strategy.ticker} className={`border-b border-gray-200 ${isSPY ? 'bg-blue-50 border-blue-200' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="p-2 w-32">
                      <span className="text-gray-800 font-medium text-sm">{strategy.sector}</span>
                    </td>
                    <td className="p-2 w-16">
                      <span className="text-gray-800 font-medium text-sm">{strategy.ticker}</span>
                    </td>
                    <td className="p-2 w-20">
                      <Badge className={`${getMomentumColor(strategy.momentum)} text-xs flex items-center space-x-1 w-fit`}>
                        {getMomentumIcon(strategy.momentum)}
                        <span className="capitalize">{strategy.momentum}</span>
                      </Badge>
                    </td>
                    <td className="p-2 text-right w-16">
                      <span className={`text-sm font-medium ${strategy.oneDayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.oneDayChange >= 0 ? '+' : ''}{strategy.oneDayChange.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-right w-16">
                      <span className={`text-sm font-medium ${strategy.fiveDayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.fiveDayChange >= 0 ? '+' : ''}{strategy.fiveDayChange.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-right w-16">
                      <span className={`text-sm font-medium ${strategy.oneMonthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.oneMonthChange >= 0 ? '+' : ''}{strategy.oneMonthChange.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-right w-16">
                      <span className={`text-sm ${strategy.rsi >= 70 ? 'text-red-600' : strategy.rsi <= 30 ? 'text-green-600' : 'text-gray-600'}`}>
                        {strategy.rsi.toFixed(1)}
                      </span>
                    </td>
                    <td className="p-2 text-right w-20">
                      <span className={`text-sm ${Math.abs(strategy.zScore) > 1.5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {strategy.zScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-2 text-right w-20">
                      <span className={`text-sm ${strategy.annualReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.annualReturn.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 text-right w-16">
                      <span className={`text-sm ${strategy.sharpeRatio >= 0.5 ? 'text-green-600' : strategy.sharpeRatio >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {strategy.sharpeRatio.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-2 text-gray-600 text-xs">
                      <div className="max-w-none overflow-visible">
                        {strategy.signal}
                      </div>
                    </td>
                  </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


    </div>
  );
};

export default MomentumAnalysis;