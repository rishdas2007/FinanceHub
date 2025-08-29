import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBatchSparklines } from '../hooks/useBatchSparklines';
import { BatchSparklineCell } from './BatchSparklineCell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Search, Filter, ChevronUp, ChevronDown, BarChart3 } from 'lucide-react';
import { EconomicChartModal } from './EconomicChartModal';
import { ErrorBoundary } from './ErrorBoundary';
// Removed SparklineCell import - using BatchSparklineCell for performance


interface MacroIndicator {
  metric: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: 'Growth' | 'Inflation' | 'Monetary Policy' | 'Labor' | 'Sentiment';
  releaseDate: string;
  currentReading: number | string;
  priorReading: number | string;
  varianceVsPrior: number | string;
  unit: string;
  zScore?: number | null;
  deltaZScore?: number | null;
  frequency?: string;
  period_date?: string;
  seriesId?: string; // For sparkline API
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
  formatIndicatorValue: (value: number | string | null, metric: string, unit?: string): string => {
    console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: input value=${JSON.stringify(value)} (type: ${typeof value}), unit=${unit}`);
    
    if (value === null || value === undefined) {
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: returning N/A (null/undefined)`);
      return 'N/A';
    }
    
    // If value is already a formatted string (from backend), return it as-is
    // Backend already applies proper formatting with units
    if (typeof value === 'string') {
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: returning backend string as-is: "${value}"`);
      return value; // Backend provides pre-formatted strings like "$720.1M", "2.1%", etc.
    }
    
    if (isNaN(value as number)) {
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: value is NaN, returning N/A`);
      return 'N/A';
    }

    const metricLower = metric.toLowerCase();
    console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: processing number ${value}, metricLower="${metricLower}"`);
    
    // Special handling for specific metrics that need fixed formatting
    if (metricLower.includes('durable goods orders')) {
      // Should show as 311.8B (billions), value comes as 311.8 
      const formatted = `${MacroFormatUtils.formatNumber(value, 1)}B`;
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: durable goods rule → ${formatted}`);
      return formatted;
    }
    
    if (metricLower.includes('existing home sales') && value >= 1000000) {
      // Convert 3930000 to 3.93M
      const formatted = `${MacroFormatUtils.formatNumber(value / 1000000, 2)}M`;
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: existing home sales rule → ${formatted}`);
      return formatted;
    }
    
    if (metricLower.includes('continuing jobless claims') && value >= 1000000) {
      // Convert 1955000 to 1.95M
      const formatted = `${MacroFormatUtils.formatNumber(value / 1000000, 2)}M`;
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: continuing jobless claims rule → ${formatted}`);
      return formatted;
    }
    
    if (metricLower.includes('initial jobless claims') && value >= 100000) {
      // Convert 217000 to 217K
      const formatted = `${MacroFormatUtils.formatNumber(value / 1000, 0)}K`;
      console.log(`🔍 [FRONTEND FORMAT DEBUG] ${metric}: initial jobless claims rule → ${formatted}`);
      return formatted;
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
  formatVariance: (variance: number | string, metric: string): string => {
    // If variance is already a formatted string (from backend), return it as is
    if (typeof variance === 'string') {
      return variance;
    }
    
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
    
    if (metricLower.includes('rate') || metricLower.includes('cpi') || metricLower.includes('growth') || metricLower.includes('inflation')) {
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
  },

  /**
   * Format z-score with proper colors and styling
   */
  formatZScore: (zScore: number | null): JSX.Element => {
    if (zScore === null || zScore === undefined || isNaN(zScore)) {
      return <span className="text-gray-400">N/A</span>;
    }

    const value = Number(zScore.toFixed(2));
    const absValue = Math.abs(value);
    
    // Determine color based on positive/negative
    let colorClass = '';
    if (value > 0) {
      colorClass = 'text-green-400';
    } else if (value < 0) {
      colorClass = 'text-red-400';
    } else {
      colorClass = 'text-gray-300';
    }
    
    // Bold for extreme values (>2 std dev)
    const isBold = absValue >= 2.0;
    const fontClass = isBold ? 'font-bold' : 'font-medium';
    
    return (
      <span className={`${colorClass} ${fontClass}`}>
        {value.toFixed(2)}
      </span>
    );
  }
};

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'metric' | 'type' | 'category' | 'period' | 'current' | 'zscore' | 'deltazscore' | 'prior' | 'variance';

const MacroeconomicIndicators: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('Growth');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [zScoreFilter, setZScoreFilter] = useState<string>('all');
  const [deltaZScoreFilter, setDeltaZScoreFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<{
    id: string;
    name: string;
    unit?: string;
    description?: string;
    currentValue?: number;
  } | null>(null);

  const queryClient = useQueryClient();

  // Enhanced logging for production debugging
  React.useEffect(() => {
    console.log('[MACRO DEBUG] Component mounted/updated', {
      timestamp: new Date().toISOString(),
      memoryUsage: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB',
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + 'MB'
      } : 'not available'
    });

    // Memory leak detection - cleanup interval on unmount
    const interval = setInterval(() => {
      console.log('[MACRO DEBUG] Component still alive:', {
        timestamp: new Date().toISOString(),
        memoryUsage: (performance as any).memory ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB',
          total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + 'MB'
        } : 'not available'
      });
    }, 30000);
    
    return () => {
      console.log('[MACRO DEBUG] Component unmounting');
      clearInterval(interval);
    };
  }, []);

  const { data: macroData, isLoading, error, refetch } = useQuery<MacroData>({
    queryKey: ['macroeconomic-indicators'],
    queryFn: async () => {
      const response = await fetch('/api/macroeconomic-indicators');
      if (!response.ok) throw new Error('Failed to fetch macro data');
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[MACRO DEBUG] API Response:', {
        indicatorCount: data.indicators?.length,
        duplicateCheck: data.indicators?.reduce((acc: Record<string, number>, curr) => {
          const key = curr.metric + curr.period_date;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
        firstFiveIndicators: data.indicators?.slice(0, 5),
        timestamp: new Date().toISOString()
      });
      
      // Check for duplicate entries that might cause table issues
      const duplicates = Object.entries(data.indicators?.reduce((acc: Record<string, number>, curr) => {
        const key = curr.metric + curr.period_date;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}) || {}).filter(([, count]) => count > 1);
      
      if (duplicates.length > 0) {
        console.warn('[MACRO DEBUG] DUPLICATE ENTRIES DETECTED:', duplicates);
      }
    },
    onError: (error) => {
      console.error('[MACRO DEBUG] API Error:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    },
    refetchInterval: false, // Disable automatic refetching
    staleTime: 5 * 60 * 1000, // 5 minutes - standardized
  });

  // Extract series IDs for batch sparklines
  const seriesIds = macroData?.indicators
    ?.filter(indicator => indicator.seriesId)
    ?.map(indicator => indicator.seriesId!)
    ?.slice(0, 15) || []; // Limit to first 15 for performance

  // Batch sparklines query for performance
  const { data: batchSparklinesData, isLoading: sparklinesLoading } = useBatchSparklines(
    seriesIds,
    12, // 12 months of data
    'YOY' // Year-over-year transform
  );



  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['economic-data'] });
    } finally {
      setIsRefreshing(false);
    }
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

  const getVarianceColor = (variance: number | string) => {
    if (typeof variance === 'string') {
      // String values from backend - check for parentheses (negative) or + sign
      if (variance.includes('(') || variance.startsWith('-')) return 'text-loss-red';
      if (variance.startsWith('+') || (parseFloat(variance) > 0)) return 'text-gain-green';
      return 'text-gray-400';
    }
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

  // Enhanced data validation to prevent crashes
  const validateIndicatorData = (indicators: MacroIndicator[] | undefined): MacroIndicator[] => {
    if (!indicators || !Array.isArray(indicators)) {
      console.warn('[MACRO DEBUG] Invalid indicators data received:', indicators);
      return [];
    }
    
    return indicators.filter((indicator, index) => {
      // Validate required fields
      if (!indicator.metric || typeof indicator.metric !== 'string') {
        console.warn(`[MACRO DEBUG] Invalid indicator at index ${index}: missing or invalid metric`, indicator);
        return false;
      }
      
      // Ensure all required fields have safe values
      if (!indicator.type || !indicator.category) {
        console.warn(`[MACRO DEBUG] Invalid indicator at index ${index}: missing type or category`, indicator);
        return false;
      }
      
      return true;
    });
  };

  // Enhanced filter and sort indicators with new filtering options
  const filteredAndSortedIndicators = (() => {
    console.log('[MACRO DEBUG] Filtering indicators...', {
      hasData: !!macroData,
      hasIndicators: !!macroData?.indicators,
      indicatorCount: macroData?.indicators?.length
    });
    
    if (!macroData || !macroData.indicators) {
      console.log('[MACRO DEBUG] No data available for filtering');
      return [];
    }
    
    // Validate and clean data first
    const validatedIndicators = validateIndicatorData(macroData.indicators);
    console.log('[MACRO DEBUG] Validated indicators:', {
      original: macroData.indicators.length,
      validated: validatedIndicators.length,
      dropped: macroData.indicators.length - validatedIndicators.length
    });
    
    let filtered = validatedIndicators.filter(indicator => {
      const matchesCategory = activeCategory === 'All' || indicator.category === activeCategory;
      const matchesSearch = indicator.metric.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || indicator.type === typeFilter;
      
      // Delta Z-Score filter
      let matchesDeltaZScore = true;
      if (deltaZScoreFilter !== 'all' && typeof indicator.deltaZScore === 'number') {
        const deltaZScore = indicator.deltaZScore;
        switch (deltaZScoreFilter) {
          case 'extreme':
            matchesDeltaZScore = Math.abs(deltaZScore) > 2;
            break;
          case 'significant':
            matchesDeltaZScore = Math.abs(deltaZScore) > 1;
            break;
          case 'positive':
            matchesDeltaZScore = deltaZScore > 0;
            break;
          case 'negative':
            matchesDeltaZScore = deltaZScore < 0;
            break;
        }
      }
      
      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter !== 'all' && indicator.period_date) {
        const indicatorDate = new Date(indicator.period_date);
        const now = new Date();
        
        switch (dateRangeFilter) {
          case 'last7days':
            matchesDateRange = indicatorDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'last30days':
            matchesDateRange = indicatorDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'last90days':
            matchesDateRange = indicatorDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case 'thismonth':
            matchesDateRange = indicatorDate.getMonth() === now.getMonth() && indicatorDate.getFullYear() === now.getFullYear();
            break;
          case 'lastmonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
            matchesDateRange = indicatorDate.getMonth() === lastMonth.getMonth() && indicatorDate.getFullYear() === lastMonth.getFullYear();
            break;
        }
      }
      
      // Z-Score filter
      let matchesZScore = true;
      if (zScoreFilter !== 'all' && typeof indicator.zScore === 'number') {
        const zScore = indicator.zScore;
        switch (zScoreFilter) {
          case 'extreme':
            matchesZScore = Math.abs(zScore) > 2;
            break;
          case 'significant':
            matchesZScore = Math.abs(zScore) > 1;
            break;
          case 'positive':
            matchesZScore = zScore > 0;
            break;
          case 'negative':
            matchesZScore = zScore < 0;
            break;
        }
      }
      
      return matchesCategory && matchesSearch && matchesType && matchesDeltaZScore && matchesDateRange && matchesZScore;
    }) || [];

    // Sort if column and direction are selected
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortColumn) {
          case 'metric':
            // Sort by release date instead of alphabetically
            aValue = new Date(a.releaseDate).getTime();
            bValue = new Date(b.releaseDate).getTime();
            break;
          case 'type':
            aValue = a.type;
            bValue = b.type;
            break;
          case 'category':
            aValue = a.category;
            bValue = b.category;
            break;
          case 'period':
            aValue = a.period_date ? new Date(a.period_date).getTime() : 0;
            bValue = b.period_date ? new Date(b.period_date).getTime() : 0;
            break;
          case 'current':
            aValue = typeof a.currentReading === 'number' ? a.currentReading : parseFloat(String(a.currentReading)) || 0;
            bValue = typeof b.currentReading === 'number' ? b.currentReading : parseFloat(String(b.currentReading)) || 0;
            break;
          case 'zscore':
            aValue = a.zScore || 0;
            bValue = b.zScore || 0;
            break;
          case 'deltazscore':
            aValue = a.deltaZScore || 0;
            bValue = b.deltaZScore || 0;
            break;
          case 'prior':
            aValue = typeof a.priorReading === 'number' ? a.priorReading : parseFloat(String(a.priorReading)) || 0;
            bValue = typeof b.priorReading === 'number' ? b.priorReading : parseFloat(String(b.priorReading)) || 0;
            break;
          case 'variance':
            aValue = typeof a.varianceVsPrior === 'number' ? a.varianceVsPrior : parseFloat(String(a.varianceVsPrior)) || 0;
            bValue = typeof b.varianceVsPrior === 'number' ? b.varianceVsPrior : parseFloat(String(b.varianceVsPrior)) || 0;
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

    return filtered;
  })();

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



      {/* Category Tabs and Detailed Table */}
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Economic Indicators Table</CardTitle>
              <div className="text-sm text-blue-400 font-medium">
                📊 {macroData?.indicators.length || 0} indicators available
              </div>
            </div>
            
            {/* Enhanced Controls - Now more prominent */}
            <div className="bg-financial-gray p-4 rounded-lg border border-blue-500/30">
              <div className="text-sm font-medium text-blue-400 mb-3 flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filter & Search Economic Indicators
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search indicators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none w-full"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
                >
                  <option value="all">All Types</option>
                  <option value="Leading">Leading</option>
                  <option value="Coincident">Coincident</option>
                  <option value="Lagging">Lagging</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">Δ Z-Score:</span>
                <select
                  value={deltaZScoreFilter}
                  onChange={(e) => setDeltaZScoreFilter(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
                >
                  <option value="all">All Δ Z-Scores</option>
                  <option value="extreme">Extreme (|Δz| {'>'} 2)</option>
                  <option value="significant">Significant (|Δz| {'>'} 1)</option>
                  <option value="positive">Positive (Δz {'>'} 0)</option>
                  <option value="negative">Negative (Δz {'<'} 0)</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">Date Range:</span>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
                >
                  <option value="all">All Dates</option>
                  <option value="last7days">Last 7 Days</option>
                  <option value="last30days">Last 30 Days</option>
                  <option value="last90days">Last 90 Days</option>
                  <option value="thismonth">This Month</option>
                  <option value="lastmonth">Last Month</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">Z-Score:</span>
                <select
                  value={zScoreFilter}
                  onChange={(e) => setZScoreFilter(e.target.value)}
                  className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
                >
                  <option value="all">All Z-Scores</option>
                  <option value="extreme">Extreme (|z| {'>'}  2)</option>
                  <option value="significant">Significant (|z| {'>'} 1)</option>
                  <option value="positive">Positive (z {'>'} 0)</option>
                  <option value="negative">Negative (z {'<'} 0)</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('all');
                    setDeltaZScoreFilter('all');
                    setDateRangeFilter('all');
                    setZScoreFilter('all');
                    setActiveCategory('Growth');
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              </div>
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
            <ErrorBoundary 
              onError={(error, errorInfo) => {
                console.error('[MACRO TABLE ERROR]', {
                  error: error.message,
                  stack: error.stack,
                  componentStack: errorInfo.componentStack,
                  timestamp: new Date().toISOString(),
                  data: { 
                    indicatorCount: macroData?.indicators?.length,
                    filteredCount: filteredAndSortedIndicators?.length
                  }
                });
              }}
            >
            <table className="w-full table-auto">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-financial-border bg-financial-card">
                  <th className="text-left py-3 px-2 w-1/5 bg-financial-card">
                    <button 
                      onClick={() => handleSort('metric')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center group"
                    >
                      Indicator
                      {getSortIcon('metric')}
                    </button>
                  </th>
                  <th className="text-center py-3 px-2 w-16 bg-financial-card">
                    <button 
                      onClick={() => handleSort('type')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-center group"
                    >
                      Type
                      {getSortIcon('type')}
                    </button>
                  </th>
                  <th className="text-center py-3 px-2 w-20 bg-financial-card">
                    <button 
                      onClick={() => handleSort('category')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-center group"
                    >
                      Category
                      {getSortIcon('category')}
                    </button>
                  </th>

                  <th className="text-center py-3 px-2 w-24 bg-financial-card">
                    <button 
                      onClick={() => handleSort('period')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-center group"
                    >
                      Period
                      {getSortIcon('period')}
                    </button>
                  </th>
                  <th className="text-right py-3 px-2 bg-financial-card">
                    <button 
                      onClick={() => handleSort('current')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                    >
                      Current
                      {getSortIcon('current')}
                    </button>
                  </th>
                  <th className="text-right py-3 px-2 bg-financial-card">
                    <button 
                      onClick={() => handleSort('zscore')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                    >
                      Z-Score
                      {getSortIcon('zscore')}
                    </button>
                  </th>
                  <th className="text-right py-3 px-2 bg-financial-card">
                    <button 
                      onClick={() => handleSort('deltazscore')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                    >
                      Δ Z-Score
                      {getSortIcon('deltazscore')}
                    </button>
                  </th>
                  <th className="text-right py-3 px-2 bg-financial-card">
                    <button 
                      onClick={() => handleSort('prior')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                    >
                      Prior
                      {getSortIcon('prior')}
                    </button>
                  </th>
                  <th className="text-right py-3 px-2 bg-financial-card">
                    <button 
                      onClick={() => handleSort('variance')}
                      className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                    >
                      vs Prior
                      {getSortIcon('variance')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {filteredAndSortedIndicators.map((indicator, index) => (
                  <tr key={index} className="border-b border-financial-border hover:bg-financial-gray/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedIndicator({
                        id: indicator.metric.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                        name: indicator.metric,
                        unit: indicator.unit,
                        description: `${indicator.type} ${indicator.category} indicator`,
                        currentValue: typeof indicator.currentReading === 'number' ? indicator.currentReading : undefined
                      })}
                      data-testid={`indicator-row-${index}`}
                  >
                    <td className="py-3 px-2 w-1/5">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-white font-medium text-sm break-words flex items-center gap-1">
                            {indicator.metric}
                            <BarChart3 className="h-3 w-3 text-blue-400 opacity-60" />
                          </div>
                          <div className="text-xs text-gray-400">
                            {indicator.releaseDate ? `Released: ${new Date(indicator.releaseDate).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center w-16">
                      <span className={`px-1 py-1 rounded text-xs font-medium border ${getTypeColor(indicator.type)}`}>
                        {indicator.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center w-20">
                      <span className={`px-1 py-1 rounded text-xs font-medium ${getCategoryColor(indicator.category)}`}>
                        {indicator.category}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-center w-24">
                      <div className="text-white text-sm">
                        {indicator.period_date ? new Date(indicator.period_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 text-white font-semibold">
                      {MacroFormatUtils.formatIndicatorValue(indicator.currentReading, indicator.metric)}
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        {MacroFormatUtils.formatZScore(indicator.zScore ?? null)}
                        {indicator.fallbackApplied && (
                          <span 
                            className="text-yellow-400 text-xs cursor-help" 
                            title={`Statistical validation applied: ${indicator.dataQualityWarning} (Sample size: ${indicator.sampleSize || 'N/A'})`}
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      {MacroFormatUtils.formatZScore(indicator.deltaZScore ?? null)}
                    </td>
                    <td className="text-right py-3 px-2 text-gray-300 font-medium">
                      {MacroFormatUtils.formatIndicatorValue(indicator.priorReading, indicator.metric)}
                    </td>
                    <td className={`text-right py-3 px-2 font-medium ${getVarianceColor(indicator.varianceVsPrior)}`}>
                      {MacroFormatUtils.formatVariance(indicator.varianceVsPrior, indicator.metric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </ErrorBoundary>
            {filteredAndSortedIndicators.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No indicators match your current filters
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Delta-Adjusted Z-Score Definition Footnote */}
      <div className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <p className="text-sm text-gray-400">
          <strong className="text-white">Delta-Adjusted Z-Score Definition:</strong> Measures how many standard deviations the current value is from its 12-month historical average, with economic directionality applied. 
          <strong className="text-blue-400"> Positive z-scores = Economic Strength, Negative z-scores = Economic Weakness.</strong> 
          Indicators marked "(Δ-adjusted)" have been inverted for consistent interpretation (e.g., lower unemployment rates show positive z-scores).
          <br />
          <strong className="text-white">Interactive Charts:</strong> Click any indicator row to view detailed historical charts with multiple time ranges and export options.
        </p>
      </div>

      {/* Economic Chart Modal */}
      {selectedIndicator && (
        <EconomicChartModal
          isOpen={!!selectedIndicator}
          onClose={() => setSelectedIndicator(null)}
          metric={selectedIndicator}
        />
      )}
    </div>
  );
};

export default MacroeconomicIndicators;