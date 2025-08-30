import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  RefreshCw, 
  BarChart3,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
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
  
  // Investment-focused derived metrics
  yoyGrowthRate?: string | null;
  priorReading?: string | null;
  qoqAnnualizedRate?: string | null;
  momAnnualizedRate?: string | null;
  volatility12m?: string | null;
  trendStrength?: string | null;
  percentileRank1y?: string | null;
  percentileRank5y?: string | null;
  investmentSignal?: string | null;
  signalStrength?: string | null;
  cyclePosition?: string | null;
  regimeClassification?: string | null;
  
  // Real value adjustments
  realValue?: string | null;
  realYoyGrowth?: string | null;
  inflationImpact?: string | null;
  
  // Investment context
  sectorImplication?: string | null;
  assetClassImpact?: string | null;
  calculationConfidence?: string | null;
  
  // For timeline view
  releaseCount?: number;
  latestReleaseDate?: string;
  timeline?: any[];
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

type SortColumn = 'date' | 'metric' | 'priorReading' | 'signal' | 'trend';
type SortDirection = 'asc' | 'desc';

type ViewMode = 'all' | 'latest' | 'timeline';

export function EconomicCalendar() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('180'); // Last 6 months by default to capture quarterly data
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc'); // Most recent first
  const [viewMode, setViewMode] = useState<ViewMode>('all'); // Use simpler 'all' mode to avoid timeline complexity
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // For timeline view
  
  // Load saved view mode from localStorage on component mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem('economic-calendar-view-mode') as ViewMode;
    if (savedViewMode && ['all', 'latest', 'timeline'].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('economic-calendar-view-mode', viewMode);
  }, [viewMode]);

  // Calculate date range
  const getStartDate = (days: string) => {
    const daysNum = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    return startDate.toISOString().split('T')[0];
  };

  const { data, isLoading, error, refetch } = useQuery<EconomicCalendarResponse>({
    queryKey: ['/api/economic-calendar-simple', selectedCategory, selectedFrequency, dateRange, viewMode],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedFrequency) params.append('frequency', selectedFrequency);
      if (dateRange) params.append('startDate', getStartDate(dateRange));
      params.append('mode', viewMode);
      params.append('limit', '100');

      const response = await fetch(`/api/economic-calendar-simple?${params}`);
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

  const formatGrowthRate = (value: string | null): string => {
    if (!value) return 'N/A';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'N/A';
    return `${numValue > 0 ? '+' : ''}${numValue.toFixed(2)}%`;
  };

  const formatPercentile = (value: string | null): string => {
    if (!value) return 'N/A';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'N/A';
    return `${numValue.toFixed(0)}%ile`;
  };

  const getInvestmentSignalIcon = (signal: string | null): string => {
    if (!signal) return '⚫';
    switch (signal.toLowerCase()) {
      case 'bullish':
      case 'strong_buy':
        return '🟢';
      case 'bearish':
      case 'strong_sell':
        return '🔴';
      case 'neutral':
        return '🟡';
      case 'cautious':
        return '🟠';
      default:
        return '⚫';
    }
  };

  const getTrendIcon = (trendStrength: string | null): string => {
    if (!trendStrength) return '';
    const numValue = parseFloat(trendStrength);
    if (isNaN(numValue)) return '';
    
    if (numValue > 0.3) return '📈';
    if (numValue < -0.3) return '📉';
    return '➡️';
  };

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

  const toggleRowExpansion = (seriesId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesId)) {
        newSet.delete(seriesId);
      } else {
        newSet.add(seriesId);
      }
      return newSet;
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc'); // Default desc for date, asc for others
    }
  };

  const getCriticalIndicatorPriority = (seriesId: string): number => {
    const criticalIndicators = ['GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'PCE', 'UNRATE', 'PAYEMS', 'FEDFUNDS'];
    return criticalIndicators.includes(seriesId) ? 0 : 1;
  };

  const sortData = (data: EconomicCalendarEntry[]): EconomicCalendarEntry[] => {
    if (!data) return [];

    return [...data].sort((a, b) => {
      // For latest mode, prioritize critical indicators
      if (viewMode === 'latest' && sortColumn === 'date') {
        const aPriority = getCriticalIndicatorPriority(a.seriesId);
        const bPriority = getCriticalIndicatorPriority(b.seriesId);
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority; // 0 (critical) comes before 1 (regular)
        }
      }

      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'date':
          aValue = new Date(a.releaseDate).getTime();
          bValue = new Date(b.releaseDate).getTime();
          break;
        case 'metric':
          aValue = a.metricName.toLowerCase();
          bValue = b.metricName.toLowerCase();
          break;
        case 'priorReading':
          aValue = parseFloat(a.priorReading || '0') || 0;
          bValue = parseFloat(b.priorReading || '0') || 0;
          break;
        case 'signal':
          // Sort by investment signal priority
          const signalPriority = (signal: string | null) => {
            if (!signal) return 0;
            switch (signal.toLowerCase()) {
              case 'strong_buy': return 5;
              case 'bullish': return 4;
              case 'neutral': return 3;
              case 'cautious': return 2;
              case 'bearish': return 1;
              case 'strong_sell': return 0;
              default: return 0;
            }
          };
          aValue = signalPriority(a.investmentSignal);
          bValue = signalPriority(b.investmentSignal);
          break;
        case 'trend':
          aValue = parseFloat(a.trendStrength || '0') || 0;
          bValue = parseFloat(b.trendStrength || '0') || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-3 w-3 text-gray-500" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3 text-blue-400" />
      : <ChevronDown className="h-3 w-3 text-blue-400" />;
  };

  const categories = data?.metadata?.categories || [];
  const frequencies = data?.metadata?.frequencies || [];
  const sortedData = data?.data ? sortData(data.data) : [];

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
              {sortedData?.length && (
                <span className="text-gray-500 ml-1">
                  ({sortedData.length} shown, sorted by {sortColumn} {sortDirection === 'desc' ? '↓' : '↑'})
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

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 mb-4 p-1 bg-financial-gray/30 rounded-lg border border-financial-border">
          <button
            onClick={() => setViewMode('latest')}
            title="Show only the most recent value for each metric - eliminates duplicates"
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
              viewMode === 'latest' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-financial-gray/50'
            }`}
          >
            📊 Latest Values
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            title="Group metrics with expandable historical data - organized view with timeline"
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
              viewMode === 'timeline' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-financial-gray/50'
            }`}
          >
            📈 Timeline View
          </button>
          <button
            onClick={() => setViewMode('all')}
            title="Show every individual release chronologically - complete historical view"
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
              viewMode === 'all' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-financial-gray/50'
            }`}
          >
            📋 All Releases
          </button>
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
            <option value="365">Last year</option>
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
                  <th 
                    className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px] cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('date')}
                    data-testid="sort-date-header"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date</span>
                      {getSortIcon('date')}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[200px] cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('metric')}
                    data-testid="sort-metric-header"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Metric</span>
                      {getSortIcon('metric')}
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px]">
                    <span>Actual Value</span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[100px] cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('priorReading')}
                    data-testid="sort-prior-header"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Prior Reading</span>
                      {getSortIcon('priorReading')}
                    </div>
                  </th>
                  <th 
                    className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px] cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('signal')}
                    data-testid="sort-signal-header"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Signal</span>
                      {getSortIcon('signal')}
                    </div>
                  </th>
                  <th 
                    className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider min-w-[80px] cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('trend')}
                    data-testid="sort-trend-header"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Trend</span>
                      {getSortIcon('trend')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-financial-border">
                {sortedData.map((entry, index) => {
                  if (false && viewMode === 'timeline') { // Temporarily disable timeline to prevent crashes
                    // Timeline view - render metric summary with expandable history
                    const isExpanded = expandedRows.has(entry.seriesId);
                    const categoryColors = CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.Growth;
                    const timeline = Array.isArray(entry.timeline) ? entry.timeline : [];
                    const latestEntry = timeline[0] || {};
                    
                    return (
                      <>
                        <tr 
                          key={entry.seriesId} 
                          className="hover:bg-financial-gray/30 transition-colors cursor-pointer"
                          onClick={() => toggleRowExpansion(entry.seriesId)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              )}
                              <div>
                                <div className="text-sm text-white font-medium">
                                  Latest: {latestEntry.releaseDate ? formatDate(latestEntry.releaseDate) : 'N/A'}
                                </div>
                                <div 
                                  className="text-xs text-gray-400 cursor-help"
                                  title={`${entry.releaseCount} historical releases available. Updated ${FREQUENCY_LABELS[entry.frequency as keyof typeof FREQUENCY_LABELS]?.toLowerCase() || entry.frequency.toLowerCase()}`}
                                >
                                  📊 {entry.releaseCount} releases • 📅 {FREQUENCY_LABELS[entry.frequency as keyof typeof FREQUENCY_LABELS] || entry.frequency}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div 
                              className="text-sm text-white font-medium mb-1 cursor-help"
                              title={`${entry.metricName} - Measured in ${entry.unit}. Click to expand historical data.`}
                            >
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
                            <div className="text-xs text-gray-500 mt-1">
                              {entry.unit}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="text-sm font-medium text-gray-300">
                              {entry.priorReading ? formatValue(entry.priorReading, entry.unit) : 'N/A'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-lg">{getInvestmentSignalIcon(entry.investmentSignal)}</span>
                              {entry.investmentSignal && (
                                <span className="text-xs text-gray-400 capitalize">
                                  {entry.investmentSignal.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            {entry.calculationConfidence && parseFloat(entry.calculationConfidence) < 0.7 && (
                              <div className="text-xs text-yellow-400 mt-1">Low Conf.</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-lg">{getTrendIcon(entry.trendStrength)}</span>
                              {entry.volatility12m && (
                                <span className="text-xs text-gray-400">
                                  {parseFloat(entry.volatility12m).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expandable timeline history */}
                        {isExpanded && timeline.length > 0 && (
                          <tr>
                            <td colSpan={5} className="py-0 px-4">
                              <div className="bg-financial-gray/20 rounded-lg p-4 my-2">
                                <div className="text-xs text-gray-400 mb-3 font-medium">Historical Releases</div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {timeline.slice(0, 10).map((timelineEntry, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-1 text-sm">
                                      <div className="text-gray-300">
                                        {timelineEntry.releaseDate ? formatDate(timelineEntry.releaseDate) : 'N/A'}
                                      </div>
                                      <div className="flex items-center space-x-4">
                                        <span className="font-medium text-gray-300">
                                          {timelineEntry.priorReading ? formatValue(timelineEntry.priorReading, entry.unit) : 'N/A'}
                                        </span>
                                        <span className="text-center w-12">
                                          {getInvestmentSignalIcon(timelineEntry.investmentSignal)}
                                        </span>
                                        <span className="text-center w-12">
                                          {getTrendIcon(timelineEntry.trendStrength)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {timeline.length > 10 && (
                                  <div className="text-xs text-gray-500 mt-2 text-center">
                                    Showing latest 10 of {timeline.length} releases
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  } else {
                    // Regular view (all/latest) - render individual entries  
                    const variance = formatVariance(entry.variance, entry.variancePercent);
                    const categoryColors = CATEGORY_COLORS[entry.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.Growth;
                    
                    return (
                      <tr key={entry.id ? `${entry.id}` : `${entry.seriesId}-${entry.periodDate}-${index}`} className="hover:bg-financial-gray/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-sm text-white font-medium">
                            {viewMode === 'latest' ? (
                              <>Updated: {formatDate(entry.releaseDate)}</>
                            ) : (
                              formatDate(entry.releaseDate)
                            )}
                          </div>
                          <div 
                            className="text-xs text-gray-400 cursor-help"
                            title={`This metric is updated ${FREQUENCY_LABELS[entry.frequency as keyof typeof FREQUENCY_LABELS]?.toLowerCase() || entry.frequency.toLowerCase()}`}
                          >
                            📅 {FREQUENCY_LABELS[entry.frequency as keyof typeof FREQUENCY_LABELS] || entry.frequency}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div 
                            className="text-sm text-white font-medium mb-1 cursor-help" 
                            title={`${entry.metricName} - Measured in ${entry.unit}`}
                          >
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
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.unit}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="text-sm font-medium text-gray-300">
                            {entry.priorReading ? formatValue(entry.priorReading, entry.unit) : 'N/A'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-lg">{getInvestmentSignalIcon(entry.investmentSignal)}</span>
                              {entry.investmentSignal && (
                                <span className="text-xs text-gray-400 capitalize">
                                  {entry.investmentSignal.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            {entry.calculationConfidence && parseFloat(entry.calculationConfidence) < 0.7 && (
                              <div className="text-xs text-yellow-400">Low Conf.</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-lg">{getTrendIcon(entry.trendStrength)}</span>
                              {entry.volatility12m && (
                                <span className="text-xs text-gray-400">
                                  {parseFloat(entry.volatility12m).toFixed(1)}%
                                </span>
                              )}
                            </div>
                            {entry.regimeClassification && (
                              <div className="text-xs text-cyan-400 capitalize">
                                {entry.regimeClassification.replace('_', ' ')}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}