import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface ETFMoversModalProps {
  isOpen: boolean;
  onClose: () => void;
  etf: {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    signal: string;
    strength: string;
    zScore: number;
  };
}

export function ETFMoversModal({ isOpen, onClose, etf }: ETFMoversModalProps) {
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D'>('30D');

  const { data: chartData, isLoading, error } = useQuery({
    queryKey: ['etf-mover-chart', etf.symbol, timeRange],
    queryFn: async () => {
      const days = timeRange === '7D' ? 7 : timeRange === '30D' ? 30 : 90;
      const response = await fetch(`/api/stocks/${etf.symbol}/history?days=${days}`);
      if (!response.ok) throw new Error(`Failed to fetch chart data: ${response.status}`);
      const rawData = await response.json();
      
      // Transform the data if it's an array format
      if (Array.isArray(rawData)) {
        return {
          success: true,
          data: rawData.map((item: any) => ({
            price: parseFloat(item.price),
            date: item.date || item.created_at || new Date().toISOString(),
            formattedDate: new Date(item.date || item.created_at || new Date()).toLocaleDateString()
          }))
        };
      }
      
      return rawData;
    },
    enabled: isOpen
  });

  const { data: technicalData } = useQuery({
    queryKey: ['etf-technical', etf.symbol],
    queryFn: async () => {
      const response = await fetch(`/api/etf-technical/${etf.symbol}`);
      if (!response.ok) throw new Error('Failed to fetch technical data');
      return response.json();
    },
    enabled: isOpen
  });

  const handleExport = async (format: 'png' | 'csv') => {
    try {
      const response = await fetch(`/api/charts/export/${format}/${etf.symbol}?timeRange=${timeRange}&type=price`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${etf.symbol}_${timeRange}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (error || !chartData?.data) {
      return (
        <div className="h-[400px] flex items-center justify-center text-gray-400">
          <div className="text-center">
            <p>Unable to load chart data</p>
            <p className="text-sm mt-2">Real-time price data will be available soon</p>
          </div>
        </div>
      );
    }

    const ChartComponent = chartType === 'area' ? AreaChart : LineChart;
    const DataComponent = chartType === 'area' ? Area : Line;

    const chartColor = etf.changePercent >= 0 ? '#10B981' : '#EF4444';

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent data={chartData.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="formattedDate" 
            stroke="#9CA3AF"
            fontSize={12}
          />
          <YAxis 
            stroke="#9CA3AF"
            fontSize={12}
            scale="log"
            domain={['dataMin * 0.99', 'dataMax * 1.01']}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6'
            }}
            formatter={(value: any) => [`$${value.toFixed(2)}`, 'Price']}
            labelStyle={{ color: '#9CA3AF' }}
          />
          {chartType === 'area' ? (
            <Area
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              fill={`${chartColor}20`}
              strokeWidth={2}
              dot={{ fill: chartColor, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: chartColor }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              strokeWidth={2}
              dot={{ fill: chartColor, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: chartColor }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            {etf.symbol} - {etf.name}
          </DialogTitle>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <div className="text-green-400">
              Current: <span className="font-semibold">${etf.price.toFixed(2)}</span>
            </div>
            <div className={`${etf.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Change: <span className="font-semibold">
                {etf.changePercent >= 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
              </span>
            </div>
            <div className="text-blue-400">
              Signal: <span className="font-semibold">{etf.signal}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={timeRange === '7D' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('7D')}
              >
                7D
              </Button>
              <Button
                variant={timeRange === '30D' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('30D')}
              >
                30D
              </Button>
              <Button
                variant={timeRange === '90D' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('90D')}
              >
                90D
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
              >
                <LineChartIcon className="h-4 w-4 mr-1" />
                Line
              </Button>
              <Button
                variant={chartType === 'area' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('area')}
              >
                <AreaChartIcon className="h-4 w-4 mr-1" />
                Area
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('png')}
              >
                <Download className="h-4 w-4 mr-1" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gray-800 rounded-lg p-4">
            {renderChart()}
          </div>

          {/* Technical Metrics */}
          {technicalData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">RSI</div>
                <div className="text-white font-medium">{technicalData.rsi?.toFixed(1) || 'N/A'}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">SMA 20</div>
                <div className="text-white font-medium">${technicalData.sma20?.toFixed(2) || 'N/A'}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">SMA 50</div>
                <div className="text-white font-medium">${technicalData.sma50?.toFixed(2) || 'N/A'}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400">Z-Score</div>
                <div className={`font-medium ${etf.zScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {etf.zScore?.toFixed(2) || 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}