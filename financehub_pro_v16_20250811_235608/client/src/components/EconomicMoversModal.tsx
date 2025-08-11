import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Calendar, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface EconomicMoversModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicator: {
    metric: string;
    current: number;
    zScore: number;
    deltaZScore: number;
    previous: number;
    change: number;
    category: string;
    type: string;
  };
}

export function EconomicMoversModal({ isOpen, onClose, indicator }: EconomicMoversModalProps) {
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [timeRange, setTimeRange] = useState<'3M' | '6M' | '12M' | '24M'>('12M');

  const { data: chartData, isLoading, error } = useQuery({
    queryKey: ['economic-mover-chart', indicator.metric, timeRange],
    queryFn: async () => {
      const months = timeRange === '3M' ? 3 : timeRange === '6M' ? 6 : timeRange === '12M' ? 12 : 24;
      const indicatorId = indicator.metric.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const response = await fetch(`/api/economic-indicators/${indicatorId}/history?months=${months}`);
      if (!response.ok) throw new Error('Failed to fetch chart data');
      return response.json();
    },
    enabled: isOpen
  });

  const handleExport = async (format: 'png' | 'csv') => {
    try {
      const indicatorId = indicator.metric.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const response = await fetch(`/api/charts/export/${format}/${indicatorId}?timeRange=${timeRange}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${indicator.metric}_${timeRange}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatValue = (value: number) => {
    if (indicator.metric.toLowerCase().includes('rate')) {
      return `${value.toFixed(1)}%`;
    }
    if (indicator.metric.toLowerCase().includes('claims')) {
      return `${Math.round(value / 1000)}K`;
    }
    return value.toLocaleString();
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
            <p className="text-sm mt-2">Using sample data for demonstration</p>
          </div>
        </div>
      );
    }

    const ChartComponent = chartType === 'area' ? AreaChart : LineChart;
    const DataComponent = chartType === 'area' ? Area : Line;

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
            tickFormatter={formatValue}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6'
            }}
            formatter={(value: any) => [formatValue(value), indicator.metric]}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <DataComponent
            type="monotone"
            dataKey="value"
            stroke="#3B82F6"
            fill={chartType === 'area' ? 'rgba(59, 130, 246, 0.1)' : undefined}
            strokeWidth={2}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, fill: '#3B82F6' }}
          />
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            {indicator.metric}
          </DialogTitle>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <div className="text-green-400">
              Current: <span className="font-semibold">{formatValue(indicator.current)}</span>
            </div>
            <div className="text-blue-400">
              Z-Score: <span className="font-semibold">{indicator.zScore?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className={`${indicator.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Change: <span className="font-semibold">
                {indicator.change >= 0 ? '+' : ''}{formatValue(indicator.change)}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={timeRange === '3M' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('3M')}
              >
                3M
              </Button>
              <Button
                variant={timeRange === '6M' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('6M')}
              >
                6M
              </Button>
              <Button
                variant={timeRange === '12M' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('12M')}
              >
                12M
              </Button>
              <Button
                variant={timeRange === '24M' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('24M')}
              >
                24M
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

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-gray-400">Category</div>
              <div className="text-white font-medium">{indicator.category}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-gray-400">Type</div>
              <div className="text-white font-medium">{indicator.type}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-gray-400">Previous</div>
              <div className="text-white font-medium">{formatValue(indicator.previous)}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-gray-400">Δ Z-Score</div>
              <div className={`font-medium ${indicator.deltaZScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {indicator.deltaZScore?.toFixed(2) || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}