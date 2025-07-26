import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Search, Filter } from 'lucide-react';

interface MacroIndicator {
  metric: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: 'Growth' | 'Inflation' | 'Monetary Policy' | 'Labor' | 'Sentiment';
  releaseDate: string;
  currentReading: number;
  priorReading: number;
  varianceVsPrior: number;
  unit: string;
}

interface MacroData {
  indicators: MacroIndicator[];
  aiSummary: string;
  lastUpdated: string;
  source: string;
}

// Enhanced formatting utilities for economic indicators
const MacroFormatUtils = {
  /**
   * Format economic indicator value with proper units and spacing
   */
  formatIndicatorValue: (value: number | null, metric: string, unit?: string): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';

    const metricLower = metric.toLowerCase();
    
    // Special handling for specific metrics that need fixed formatting
    if (metricLower.includes('durable goods orders')) {
      // Should show as 311.8B (billions), value comes as 311.8 
      return `${MacroFormatUtils.formatNumber(value, 1)}B`;
    }
    
    if (metricLower.includes('existing home sales') && value >= 1000000) {
      // Convert 3930000 to 3.93M
      return `${MacroFormatUtils.formatNumber(value / 1000000, 2)}M`;
    }
    
    if (metricLower.includes('continuing jobless claims') && value >= 1000000) {
      // Convert 1955000 to 1.95M
      return `${MacroFormatUtils.formatNumber(value / 1000000, 2)}M`;
    }
    
    if (metricLower.includes('initial jobless claims') && value >= 100000) {
      // Convert 217000 to 217K
      return `${MacroFormatUtils.formatNumber(value / 1000, 0)}K`;
    }
    
    // Use unit from data if provided and clean
    if (unit && unit !== '' && unit !== 'N/A') {
      switch (unit.toLowerCase()) {
        case '%':
          return `${MacroFormatUtils.formatNumber(value, 1)}%`;
        case 'k':
          // Avoid double-scaling
          if (value > 100000) {
            return `${MacroFormatUtils.formatNumber(value / 1000, 0)}K`;
          }
          return `${MacroFormatUtils.formatNumber(value, 0)}K`;
        case 'k units':
          return `${MacroFormatUtils.formatNumber(value, 1)}K Units`;
        case 'index':
          return MacroFormatUtils.formatNumber(value, 1);
        case 'm':
          return `${MacroFormatUtils.formatNumber(value, 1)}M`;
        case '$':
          // For retail sales in billions
          return `${MacroFormatUtils.formatNumber(value, 1)}B`;
        default:
          return `${MacroFormatUtils.formatNumber(value, 1)} ${unit}`;
      }
    }
    
    // Context-aware formatting based on metric name
    if (metricLower.includes('rate') || metricLower.includes('cpi') || metricLower.includes('growth') || metricLower.includes('inflation')) {
      return `${MacroFormatUtils.formatNumber(value, 1)}%`;
    }
    
    if (metricLower.includes('payroll') || metricLower.includes('jobless') || metricLower.includes('claims')) {
      return MacroFormatUtils.formatLargeNumber(value);
    }
    
    if (metricLower.includes('pmi') || metricLower.includes('confidence') || metricLower.includes('index')) {
      return MacroFormatUtils.formatNumber(value, 1);
    }
    
    if (metricLower.includes('housing') || metricLower.includes('starts') || metricLower.includes('permits') || metricLower.includes('sales')) {
      if (value < 10000) {
        return `${MacroFormatUtils.formatNumber(value, 1)}K Units`;
      } else {
        return `${MacroFormatUtils.formatNumber(value / 1000, 1)}K Units`;
      }
    }
    
    if (metricLower.includes('durable') && metricLower.includes('orders')) {
      return `${MacroFormatUtils.formatNumber(value, 1)}%`;
    }
    
    return MacroFormatUtils.formatNumber(value, 2);
  },

  /**
   * Format variance with appropriate sign and units matching current reading format
   */
  formatVariance: (variance: number, metric: string, unit?: string): string => {
    if (variance === 0) return '0';
    
    const sign = variance > 0 ? '+' : '';
    const absVariance = Math.abs(variance);
    const metricLower = metric.toLowerCase();
    
    // Special cases to match current reading format
    if (metricLower.includes('durable goods orders')) {
      return `${sign}${MacroFormatUtils.formatNumber(absVariance / 1000, 1)}B`;
    }
    
    if (metricLower.includes('existing home sales') && absVariance >= 100000) {
      return `${sign}${MacroFormatUtils.formatNumber(absVariance / 1000000, 2)}M`;
    }
    
    if (metricLower.includes('continuing jobless claims') && absVariance >= 1000) {
      return `${sign}${MacroFormatUtils.formatNumber(absVariance / 1000000, 2)}M`;
    }
    
    if (metricLower.includes('initial jobless claims') && absVariance >= 1000) {
      return `${sign}${MacroFormatUtils.formatNumber(absVariance / 1000, 0)}K`;
    }
    
    if (metricLower.includes('rate') || metricLower.includes('cpi') || (unit && unit === '%')) {
      return `${sign}${MacroFormatUtils.formatNumber(absVariance, 1)}%`;
    }
    
    if (metricLower.includes('payroll') || metricLower.includes('jobless') || metricLower.includes('claims')) {
      return `${sign}${MacroFormatUtils.formatLargeNumber(absVariance)}`;
    }
    
    if (metricLower.includes('housing') || metricLower.includes('starts') || metricLower.includes('permits')) {
      return `${sign}${MacroFormatUtils.formatNumber(absVariance, 0)} Units`;
    }
    
    return `${sign}${MacroFormatUtils.formatNumber(absVariance, 1)}`;
  },

  /**
   * Format number with specified decimal places, removing trailing zeros
   */
  formatNumber: (value: number, decimals: number): string => {
    return value.toFixed(decimals).replace(/\.0+$/, '');
  },

  /**
   * Format large numbers with K/M notation
   */
  formatLargeNumber: (value: number): string => {
    if (Math.abs(value) >= 1000000) {
      return `${MacroFormatUtils.formatNumber(value / 1000000, 1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${MacroFormatUtils.formatNumber(value / 1000, 0)}K`;
    }
    return MacroFormatUtils.formatNumber(value, 0);
  },

  /**
   * Format date consistently
   */
  formatDate: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }
};

const MacroeconomicIndicators: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('Growth');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryClient = useQueryClient();

  const { data: macroData, isLoading, error, refetch } = useQuery<MacroData>({
    queryKey: ['macroeconomic-indicators'],
    queryFn: async () => {
      const response = await fetch('/api/macroeconomic-indicators');
      if (!response.ok) throw new Error('Failed to fetch macro data');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['economic-data'] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-gain-green';
    if (variance < 0) return 'text-loss-red';
    return 'text-gray-400';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Leading': return 'bg-green-900 text-green-300 border-green-600';
      case 'Coincident': return 'bg-yellow-900 text-yellow-300 border-yellow-600';
      case 'Lagging': return 'bg-red-900 text-red-300 border-red-600';
      default: return 'bg-gray-900 text-gray-300 border-gray-600';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Growth': return 'bg-blue-900 text-blue-300';
      case 'Inflation': return 'bg-orange-900 text-orange-300';
      case 'Labor': return 'bg-purple-900 text-purple-300';
      case 'Monetary Policy': return 'bg-indigo-900 text-indigo-300';
      case 'Sentiment': return 'bg-pink-900 text-pink-300';
      default: return 'bg-gray-900 text-gray-300';
    }
  };

  const filteredIndicators = macroData?.indicators.filter(indicator => {
    const matchesSearch = indicator.metric.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || indicator.type === typeFilter;
    const matchesCategory = activeCategory === 'All' || indicator.category === activeCategory;
    return matchesSearch && matchesType && matchesCategory;
  }) || [];

  const categories = ['All', 'Growth', 'Inflation', 'Labor', 'Monetary Policy', 'Sentiment'];
  const recentIndicators = macroData?.indicators
    .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
    .slice(0, 6) || [];

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <span>Macroeconomic Indicators</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading macroeconomic data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span>Macroeconomic Indicators</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Unable to load macroeconomic data</p>
            <button
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!macroData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              <span>Macroeconomic Indicators</span>
            </CardTitle>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>
      </Card>



      {/* Recent Indicators */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white">Recent Economic Releases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentIndicators.map((indicator, index) => (
              <div key={index} className="bg-financial-gray rounded-lg p-4 border border-financial-border">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white font-medium text-sm">{indicator.metric}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getTypeColor(indicator.type)}`}>
                    {indicator.type}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Current:</span>
                    <span className="text-white font-semibold">
                      {MacroFormatUtils.formatIndicatorValue(indicator.currentReading, indicator.metric, indicator.unit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Prior:</span>
                    <span className="text-gray-300 font-medium">
                      {MacroFormatUtils.formatIndicatorValue(indicator.priorReading, indicator.metric, indicator.unit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">vs Prior:</span>
                    <span className={`font-medium ${getVarianceColor(indicator.varianceVsPrior)}`}>
                      {MacroFormatUtils.formatVariance(indicator.varianceVsPrior, indicator.metric, indicator.unit)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs and Detailed Table */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <div className="space-y-4">
            <CardTitle className="text-white">Detailed Analysis</CardTitle>
            
            {/* Controls */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search indicators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="Leading">Leading</option>
                  <option value="Coincident">Coincident</option>
                  <option value="Lagging">Lagging</option>
                </select>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-financial-gray text-gray-400 hover:text-white hover:bg-financial-border'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-financial-border sticky top-0 bg-financial-card">
                  <th className="text-left py-3 px-2 text-gray-300 font-medium">Indicator</th>
                  <th className="text-center py-3 px-2 text-gray-300 font-medium">Type</th>
                  <th className="text-center py-3 px-2 text-gray-300 font-medium">Category</th>
                  <th className="text-right py-3 px-2 text-gray-300 font-medium">Current</th>
                  <th className="text-right py-3 px-2 text-gray-300 font-medium">Prior</th>
                  <th className="text-right py-3 px-2 text-gray-300 font-medium">vs Prior</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {filteredIndicators.map((indicator, index) => (
                  <tr key={index} className="border-b border-financial-border hover:bg-financial-gray/50 transition-colors">
                    <td className="py-3 px-2">
                      <div>
                        <div className="text-white font-medium text-sm">{indicator.metric}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(indicator.releaseDate).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getTypeColor(indicator.type)}`}>
                        {indicator.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(indicator.category)}`}>
                        {indicator.category}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2 text-white font-semibold">
                      {MacroFormatUtils.formatIndicatorValue(indicator.currentReading, indicator.metric, indicator.unit)}
                    </td>
                    <td className="text-right py-3 px-2 text-gray-300 font-medium">
                      {MacroFormatUtils.formatIndicatorValue(indicator.priorReading, indicator.metric, indicator.unit)}
                    </td>
                    <td className={`text-right py-3 px-2 font-medium ${getVarianceColor(indicator.varianceVsPrior)}`}>
                      {MacroFormatUtils.formatVariance(indicator.varianceVsPrior, indicator.metric, indicator.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredIndicators.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No indicators match your current filters
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MacroeconomicIndicators;