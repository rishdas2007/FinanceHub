import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  RefreshCw, 
  BarChart3,
  Clock
} from 'lucide-react';

interface EconomicCalendarEntry {
  id?: number;
  seriesId: string;
  metricName: string;
  category: string;
  releaseDate: string;
  periodDate: string;
  actualValue: string;
  previousValue: string | null;
  variance: string | null;
  variancePercent: string | null;
  unit: string;
  frequency: string;
  seasonalAdjustment?: string | null;
}

interface EconomicCalendarResponse {
  success: boolean;
  data: EconomicCalendarEntry[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    offset: number;
  };
  metadata: {
    responseTime: number;
    categories: string[];
    frequencies: string[];
  };
  timestamp: string;
}

const CATEGORY_COLORS = {
  'Growth': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'Inflation': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'Labor': 'text-green-400 bg-green-400/10 border-green-400/20',
  'Housing': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'Finance': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'Consumption': 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  'Government': 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  'Trade': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
};

const FREQUENCY_LABELS = {
  'daily': 'Daily',
  'weekly': 'Weekly',
  'monthly': 'Monthly',
  'quarterly': 'Quarterly',
  'annual': 'Annual'
};

export function EconomicCalendar() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30'); // Last 30 days by default

  // Calculate date range
  const getStartDate = (days: string) => {
    const daysNum = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    return startDate.toISOString().split('T')[0];
  };

  const { data, isLoading, error, refetch } = useQuery<EconomicCalendarResponse>({
    queryKey: ['/api/economic-calendar', selectedCategory, selectedFrequency, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedFrequency) params.append('frequency', selectedFrequency);
      if (dateRange) params.append('startDate', getStartDate(dateRange));
      params.append('limit', '100');

      const response = await fetch(`/api/economic-calendar?${params}`);
      if (!response.ok) {
        const errorMessage = response.status === 404 
          ? 'Economic calendar API endpoint not found'
          : response.status === 500 
          ? 'Server error while fetching economic data'
          : response.status === 429
          ? 'Too many requests - please try again later'
          : `Failed to fetch economic calendar: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data.success) {
        throw new Error(data.error || 'Invalid response from economic calendar API');
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });

  const formatValue = (value: string, unit: string): string => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'N/A';

    // Format based on unit type
    if (unit.toLowerCase().includes('percent') || unit.toLowerCase() === '%') {
      return `${numValue.toFixed(2)}%`;
    } else if (unit.toLowerCase().includes('billions of dollars')) {
      return `$${numValue.toFixed(1)}B`;
    } else if (unit.toLowerCase().includes('billion')) {
      return `${(numValue / 1000).toFixed(2)}T`; // Convert to trillions for display
    } else if (unit.toLowerCase().includes('million')) {
      return `${(numValue / 1000).toFixed(1)}B`; // Convert to billions for display
    } else if (unit.toLowerCase().includes('thousands')) {
      // Handle case where value is already in thousands (like Initial Claims)
      if (numValue >= 1000) {
        return `${(numValue / 1000).toFixed(0)}M`;
      } else {
        return `${numValue.toFixed(0)}K`;
      }
    } else if (unit.toLowerCase().includes('thousand')) {
      return `${numValue.toLocaleString()}K`;
    } else if (unit.toLowerCase().includes('dollar') && numValue > 1000) {
      return `$${(numValue / 1000).toFixed(1)}K`;
    } else if (unit.toLowerCase().includes('index')) {
      return numValue.toFixed(1);
    } else if (unit.toLowerCase().includes('rate') || unit.toLowerCase().includes('percent')) {
      return `${numValue.toFixed(2)}%`;
    }
    
    // For whole numbers, don't show decimals
    if (numValue % 1 === 0) {
      return numValue.toLocaleString();
    }
    
    return numValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatVariance = (variance: string | null, variancePercent: string | null): {
    display: string;
    isPositive: boolean;
    isNeutral: boolean;
  } => {
    if (!variance || !variancePercent) {
      return { display: 'N/A', isPositive: false, isNeutral: true };
    }

    const varNum = parseFloat(variance);
    const varPercentNum = parseFloat(variancePercent);
    
    if (isNaN(varNum) || isNaN(varPercentNum)) {
      return { display: 'N/A', isPositive: false, isNeutral: true };
    }

    const isPositive = varNum > 0;
    const isNeutral = Math.abs(varNum) < 0.01;
    
    const percentDisplay = `${varPercentNum > 0 ? '+' : ''}${varPercentNum.toFixed(2)}%`;
    
    return {
      display: percentDisplay,
      isPositive,
      isNeutral
    };
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  };

  const categories = data?.metadata?.categories || [];
  const frequencies = data?.metadata?.frequencies || [];

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-red-400 mb-2">❌ Error loading economic calendar</div>
            <div className="text-gray-400 text-sm mb-4">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Economic Calendar</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-blue-400 font-medium">
              📊 {data?.pagination.total ? data.pagination.total.toLocaleString() : 0} releases
              {data?.data?.length && (
                <span className="text-gray-500 ml-1">
                  ({data.data.length} shown)
                </span>
              )}
            </div>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 sm:gap-3">
          {/* Time Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-financial-gray border border-financial-border rounded px-3 py-1 text-sm text-white min-w-[120px] flex-shrink-0"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-financial-gray border border-financial-border rounded px-3 py-1 text-sm text-white min-w-[140px] flex-shrink-0"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Frequency Filter */}
          <select
            value={selectedFrequency}
            onChange={(e) => setSelectedFrequency(e.target.value)}
            className="bg-financial-gray border border-financial-border rounded px-3 py-1 text-sm text-white min-w-[140px] flex-shrink-0"
          >
            <option value="">All Frequencies</option>
            {frequencies.map(freq => (
              <option key={freq} value={freq}>
                {FREQUENCY_LABELS[freq as keyof typeof FREQUENCY_LABELS] || freq}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(selectedCategory || selectedFrequency) && (
            <button
              onClick={() => {
                setSelectedCategory('');
                setSelectedFrequency('');
              }}
              className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-600 rounded transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="animate-pulse flex items-center justify-center space-x-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-gray-400">Loading economic calendar...</span>
              </div>
            </div>
            {/* Loading skeleton */}
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4 p-3 bg-financial-gray/20 rounded">
                  <div className="flex-shrink-0">
                    <div className="h-4 bg-financial-gray rounded w-16"></div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-financial-gray rounded w-1/2"></div>
                    <div className="h-3 bg-financial-gray/70 rounded w-1/4"></div>
                  </div>
                  <div className="flex-shrink-0 space-y-2">
                    <div className="h-4 bg-financial-gray rounded w-12"></div>
                    <div className="h-3 bg-financial-gray/70 rounded w-8"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !data?.data?.length ? (
          <div className="p-6 text-center">
            <BarChart3 className="h-12 w-12 text-gray-500 mx-auto mb-2" />
            <div className="text-gray-400">No economic releases found for the selected criteria</div>
            <div className="text-sm text-gray-500 mt-1">Try adjusting your filters or date range</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-financial-gray/50 border-b border-financial-border">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px]">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[200px]">
                    Metric
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px]">
                    Actual
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px]">
                    Previous
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px]">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-financial-border">
                {data.data.map((entry, index) => {
                  const variance = formatVariance(entry.variance, entry.variancePercent);
                  const categoryColors = CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.Growth;
                  
                  return (
                    <tr key={entry.id ? `${entry.id}` : `${entry.seriesId}-${entry.periodDate}-${index}`} className="hover:bg-financial-gray/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-sm text-white font-medium">
                          {formatDate(entry.releaseDate)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {FREQUENCY_LABELS[entry.frequency as keyof typeof FREQUENCY_LABELS] || entry.frequency}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-white font-medium mb-1">
                          {entry.metricName}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${categoryColors}`}>
                            {entry.category}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-medium text-white">
                          {formatValue(entry.actualValue, entry.unit)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm text-gray-400">
                          {entry.previousValue ? formatValue(entry.previousValue, entry.unit) : 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className={`text-sm font-medium flex items-center justify-end space-x-1 ${
                          variance.isNeutral 
                            ? 'text-gray-400' 
                            : variance.isPositive 
                              ? 'text-gain-green' 
                              : 'text-loss-red'
                        }`}>
                          <span>{variance.display}</span>
                          {!variance.isNeutral && (
                            variance.isPositive 
                              ? <TrendingUp className="h-3 w-3" />
                              : <TrendingDown className="h-3 w-3" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}