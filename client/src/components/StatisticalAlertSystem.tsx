import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, BarChart3, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';
import { useState } from 'react';

interface MetricStatistics {
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  start_value: number | null;
  end_value: number | null;
  period_start_date: string;
  period_end_date: string;
  z_score: number | null;
}

interface MetricAnalysis {
  statistics: MetricStatistics;
  trend: 'increasing' | 'decreasing' | 'stable' | 'not enough data';
  data_points_12_months: Array<{
    period_date_desc: string;
    value_numeric: number;
  }>;
}

interface CategoryAnalysis {
  [metric: string]: MetricAnalysis;
}

interface EconomicDataResponse {
  statisticalData: {
    [category: string]: CategoryAnalysis;
  };
  aiAnalysis: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'metric' | 'trend' | 'current' | 'zscore' | 'mean' | 'std';

export function StatisticalAlertSystem() {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const {
    data: economicData,
    isLoading,
    error,
    refetch
  } = useQuery<EconomicDataResponse>({
    queryKey: ['/api/economic-data-analysis'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ChevronUp className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4 text-blue-400" />;
    } else if (sortDirection === 'desc') {
      return <ChevronDown className="h-4 w-4 text-blue-400" />;
    }
    return null;
  };

  const getSortedData = () => {
    if (!economicData?.statisticalData) {
      return {};
    }

    const allMetrics: Array<{category: string, metric: string, analysis: MetricAnalysis}> = [];
    
    Object.entries(economicData.statisticalData).forEach(([category, metrics]) => {
      Object.entries(metrics).forEach(([metric, analysis]) => {
        // Apply search filter
        const matchesSearch = searchTerm === '' || 
          metric.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Apply category filter
        const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
        
        if (matchesSearch && matchesCategory) {
          allMetrics.push({ category, metric, analysis });
        }
      });
    });

    // Apply sorting if specified
    if (sortColumn && sortDirection) {
      allMetrics.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortColumn) {
          case 'metric':
            aValue = a.metric.toLowerCase();
            bValue = b.metric.toLowerCase();
            break;
          case 'trend':
            aValue = a.analysis.trend;
            bValue = b.analysis.trend;
            break;
          case 'current':
            aValue = a.analysis.statistics.end_value || 0;
            bValue = b.analysis.statistics.end_value || 0;
            break;
          case 'zscore':
            aValue = a.analysis.statistics.z_score || 0;
            bValue = b.analysis.statistics.z_score || 0;
            break;
          case 'mean':
            aValue = a.analysis.statistics.mean || 0;
            bValue = b.analysis.statistics.mean || 0;
            break;
          case 'std':
            aValue = a.analysis.statistics.std || 0;
            bValue = b.analysis.statistics.std || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc' 
            ? (aValue - bValue)
            : (bValue - aValue);
        }
      });
    }

    // Group back by category
    const groupedData: {[category: string]: CategoryAnalysis} = {};
    allMetrics.forEach(({category, metric, analysis}) => {
      if (!groupedData[category]) {
        groupedData[category] = {};
      }
      groupedData[category][metric] = analysis;
    });

    return groupedData;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendBadgeVariant = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'default';
      case 'decreasing':
        return 'destructive';
      case 'stable':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatValue = (value: number | null): string => {
    if (value === null) return 'N/A';
    return value.toFixed(2);
  };

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <span>Statistical Alert System</span>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load statistical analysis. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-blue-400" />
            <span>Statistical Alert System</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Database-driven analysis - showing only metrics &gt;1 standard deviation from mean
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={isLoading}
          variant="default" 
          size="sm"
          className="bg-black text-white border-black hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search indicators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
          />
        </div>
        
        {/* Category Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          >
            <option value="all">All Categories</option>
            <option value="Growth">Growth</option>
            <option value="Inflation">Inflation</option>
            <option value="Labor">Labor</option>
            <option value="Monetary Policy">Monetary Policy</option>
            <option value="Sentiment">Sentiment</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-gray-300">Performing statistical analysis...</span>
            </div>
          </CardContent>
        </Card>
      ) : economicData ? (
        <>
          {/* Economic Indicators Table */}
          <Card className="bg-financial-card border-financial-border">
            <CardHeader>
              <CardTitle className="text-white text-lg">Economic Indicators Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-financial-border">
                      <th 
                        className="text-left p-4 text-white font-semibold cursor-pointer group hover:bg-gray-800 transition-colors"
                        onClick={() => handleSort('metric')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Indicator</span>
                          {getSortIcon('metric')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-white font-semibold cursor-pointer group hover:bg-gray-800 transition-colors"
                        onClick={() => handleSort('trend')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Trend</span>
                          {getSortIcon('trend')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-white font-semibold cursor-pointer group hover:bg-gray-800 transition-colors"
                        onClick={() => handleSort('current')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Current</span>
                          {getSortIcon('current')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-white font-semibold cursor-pointer group hover:bg-gray-800 transition-colors"
                        onClick={() => handleSort('zscore')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Z-Score</span>
                          {getSortIcon('zscore')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-white font-semibold cursor-pointer group hover:bg-gray-800 transition-colors"
                        onClick={() => handleSort('mean')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Mean</span>
                          {getSortIcon('mean')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-white font-semibold cursor-pointer group hover:bg-gray-800 transition-colors"
                        onClick={() => handleSort('std')}
                      >
                        <div className="flex items-center justify-between">
                          <span>Std Dev</span>
                          {getSortIcon('std')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(getSortedData()).map(([category, metrics]) =>
                      Object.entries(metrics).map(([metric, analysis]) => (
                        <tr key={`${category}-${metric}`} className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                          <td className="p-4">
                            <div>
                              <div className="text-white font-medium">{metric}</div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {category}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              {getTrendIcon(analysis.trend)}
                              <Badge variant={getTrendBadgeVariant(analysis.trend)} className="text-xs">
                                {analysis.trend}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-white font-medium">
                              {formatValue(analysis.statistics.end_value)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className={`font-medium ${
                              analysis.statistics.z_score !== null
                                ? analysis.statistics.z_score > 0 
                                  ? analysis.statistics.z_score > 2 
                                    ? 'text-green-400 font-bold' 
                                    : 'text-green-400'
                                  : analysis.statistics.z_score < -2 
                                    ? 'text-red-400 font-bold' 
                                    : 'text-red-400'
                                : 'text-gray-400'
                            }`}>
                              {formatValue(analysis.statistics.z_score)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-gray-300">
                              {formatValue(analysis.statistics.mean)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-gray-300">
                              {formatValue(analysis.statistics.std)}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Z-Score Definition Footnote */}
          <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
            <p className="text-sm text-gray-400">
              <strong className="text-white">Z-Score Definition:</strong> Measures how many standard deviations the current value is from its 12-month historical average. 
              Calculation: (Current Value - 12-Month Average) ÷ 12-Month Standard Deviation. 
              Values above ±2.0 indicate statistically significant deviations from the historical norm.
            </p>
          </div>
        </>
      ) : (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <p className="text-gray-400 text-center">No statistical data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}