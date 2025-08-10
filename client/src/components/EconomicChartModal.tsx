import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Calendar, BarChart3, LineChart as LineChartIcon, AreaChartIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface EconomicData {
  date: string;
  value: number;
  formattedDate: string;
}

interface EconomicChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: {
    id: string;
    name: string;
    unit?: string;
    description?: string;
    currentValue?: number;
  };
}

type ChartType = 'line' | 'area' | 'bar';
type TimeRange = '3M' | '6M' | '12M' | '24M';

export function EconomicChartModal({ isOpen, onClose, metric }: EconomicChartModalProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [timeRange, setTimeRange] = useState<TimeRange>('12M');

  // ADD: Calculate percentage change for the time period - move to component level
  const calculatePeriodChange = (data: any) => {
    if (!data || data.length < 2) return null;

    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;

    if (firstValue === 0) return null;

    const changePercent = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
    const changeValue = lastValue - firstValue;

    return {
      percent: changePercent,
      value: changeValue,
      isPositive: changePercent >= 0
    };
  };

  const { data: chartData, isLoading, error } = useQuery({
    queryKey: ['economic-chart', metric.id, timeRange],
    queryFn: async () => {
      const months = timeRange === '3M' ? 3 : timeRange === '6M' ? 6 : timeRange === '12M' ? 12 : 24;

      // FIX: Add better error handling and logging
      console.log(`🔍 Fetching economic chart data for ${metric.id} (${months}M)`);

      const response = await fetch(`/api/economic-indicators/${metric.id}/history?months=${months}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Economic chart API error:`, errorText);
        throw new Error(`Failed to fetch chart data: ${response.status}`);
      }

      const result = await response.json();
      console.log(`📊 Economic chart data received:`, result);

      // FIX: Handle both success/data format and direct data format
      if (result.success === false) {
        throw new Error(result.error || 'API returned error');
      }

      // Return consistent format
      return {
        data: result.data || result, // Handle both wrapped and direct data
        metadata: result.metadata || { source: 'FRED', lastUpdate: new Date().toISOString() }
      };
    },
    enabled: isOpen && !!metric.id,
    retry: 2,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const handleExport = async (format: 'png' | 'csv') => {
    try {
      const response = await fetch(`/api/charts/export/${format}/${metric.id}?timeRange=${timeRange}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metric.name}_${timeRange}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-600 rounded w-48 mb-4"></div>
            <div className="h-64 bg-gray-700/50 rounded"></div>
          </div>
        </div>
      );
    }

    if (error || !chartData?.data) {
      // FIX: Add more detailed error information
      console.error('Economic chart error:', error);
      console.log('Chart data received:', chartData);

      return (
        <div className="h-96 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Unable to load chart data</p>
            <p className="text-sm text-gray-500 mt-1">
              {error?.message || 'No data available for this indicator'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Metric ID: {metric.id} | Range: {timeRange}
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
              Retry
            </Button>
          </div>
        </div>
      );
    }

    const data = chartData.data;

    // Add debug logging after line 135
    console.log('📊 Chart Data Debug:', {
      hasData: !!chartData?.data,
      dataLength: chartData?.data?.length || 0,
      firstItem: chartData?.data?.[0],
      lastItem: chartData?.data?.[chartData.data.length - 1]
    });
    const isPositiveTrend = data.length > 1 && data[data.length - 1].value > data[0].value;

    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    const chartColor = isPositiveTrend ? '#10B981' : '#EF4444';

    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#6B7280" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6B7280" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value}${metric.unit || ''}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
                formatter={(value: number) => [`${value}${metric.unit || ''}`, metric.name]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                fillOpacity={1}
                fill="url(#colorValue)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#6B7280" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6B7280" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value}${metric.unit || ''}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
                formatter={(value: number) => [`${value}${metric.unit || ''}`, metric.name]}
              />
              <Bar dataKey="value" fill={chartColor} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      default: // line
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#6B7280" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#6B7280" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value}${metric.unit || ''}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
                formatter={(value: number) => [`${value}${metric.unit || ''}`, metric.name]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                dot={{ fill: chartColor, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 4, fill: chartColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full h-[85vh] bg-financial-card border-financial-border">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                {metric.name}
              </DialogTitle>
              <DialogDescription className="text-gray-400 mt-1">
                {metric.description || 'Historical economic data analysis'}
                {metric.currentValue && (
                  <span className="ml-2 text-sm">
                    Current: <span className="text-white font-medium">{metric.currentValue}{metric.unit || ''}</span>
                  </span>
                )}
                {/* ADD: Period change display */}
                {chartData?.data && (() => {
                  const periodChange = calculatePeriodChange(chartData.data);
                  return periodChange ? (
                    <span className="ml-4 text-sm">
                      Change ({timeRange}):
                      <span className={`font-medium ml-1 ${
                        periodChange.isPositive ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {periodChange.isPositive ? '+' : ''}{periodChange.percent.toFixed(2)}%
                        ({periodChange.isPositive ? '+' : ''}{periodChange.value.toFixed(2)}{metric.unit || ''})
                      </span>
                    </span>
                  ) : null;
                })()}
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                <SelectTrigger className="w-24 h-8 bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3M">3M</SelectItem>
                  <SelectItem value="6M">6M</SelectItem>
                  <SelectItem value="12M">12M</SelectItem>
                  <SelectItem value="24M">24M</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex rounded-md bg-gray-800 p-1">
                <button
                  onClick={() => setChartType('line')}
                  className={cn(
                    "p-1.5 rounded text-xs transition-colors",
                    chartType === 'line' ? "bg-blue-500 text-white" : "text-gray-400 hover:text-gray-300"
                  )}
                  data-testid="chart-type-line"
                >
                  <LineChartIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setChartType('area')}
                  className={cn(
                    "p-1.5 rounded text-xs transition-colors",
                    chartType === 'area' ? "bg-blue-500 text-white" : "text-gray-400 hover:text-gray-300"
                  )}
                  data-testid="chart-type-area"
                >
                  <AreaChartIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={cn(
                    "p-1.5 rounded text-xs transition-colors",
                    chartType === 'bar' ? "bg-blue-500 text-white" : "text-gray-400 hover:text-gray-300"
                  )}
                  data-testid="chart-type-bar"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExport('png')}
                className="h-8 px-3 bg-gray-800 border-gray-600 hover:bg-gray-700"
                data-testid="export-chart"
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderChart()}
        </div>
        
        {chartData?.metadata && (
          <div className="border-t border-gray-700 pt-3 text-xs text-gray-400">
            <div className="flex items-center justify-between">
              <span>Source: {chartData.metadata.source || 'FRED'}</span>
              <span>Updated: {chartData.metadata.lastUpdate || 'Recently'}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EconomicChartModal;