import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, RefreshCw, AlertCircle, Search, ChevronUp, ChevronDown } from 'lucide-react';

interface EconomicIndicator {
  metric: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: 'Growth' | 'Inflation' | 'Monetary Policy' | 'Labor' | 'Sentiment';
  period_date: string;
  currentReading: number | string;
  zScore: number | null;
  deltaZScore: number | null;
  priorReading: number | string;
  varianceVsPrior: number | string;
  unit?: string;
}

interface EconomicData {
  indicators: EconomicIndicator[];
  aiSummary: string;
  lastUpdated: string;
  source: string;
}

type SortColumn = 'indicator' | 'type' | 'category' | 'period' | 'current' | 'zscore' | 'deltazscore' | 'prior' | 'variance';
type SortDirection = 'asc' | 'desc' | null;

const formatValue = (value: number | string, unit?: string): string => {
  if (value === null || value === undefined) return 'N/A';
  
  if (typeof value === 'string') return value;
  
  if (isNaN(value as number)) return 'N/A';
  
  const num = Number(value);
  
  if (unit) {
    switch (unit.toLowerCase()) {
      case '%':
        return `${num.toFixed(1)}%`;
      case 'k':
        return `${(num / 1000).toFixed(1)}K`;
      case 'm':
        return `${(num / 1000000).toFixed(1)}M`;
      case 'b':
        return `${(num / 1000000000).toFixed(1)}B`;
      default:
        return `${num.toFixed(1)} ${unit}`;
    }
  }
  
  if (Math.abs(num) >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  } else if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  
  return num.toFixed(1);
};

const formatVariance = (variance: number | string): string => {
  if (typeof variance === 'string') return variance;
  if (variance === null || variance === undefined || isNaN(variance as number)) return 'N/A';
  
  const num = Number(variance);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${formatValue(num)}`;
};

const formatZScore = (zScore: number | null): JSX.Element => {
  if (zScore === null || zScore === undefined || isNaN(zScore)) {
    return <span className="text-gray-400">N/A</span>;
  }

  const value = Number(zScore.toFixed(2));
  const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-300';
  const fontClass = Math.abs(value) >= 2.0 ? 'font-bold' : 'font-medium';
  
  return <span className={`${colorClass} ${fontClass}`}>{value.toFixed(2)}</span>;
};

const getVarianceColor = (variance: number | string): string => {
  if (typeof variance === 'string') {
    if (variance.includes('(') || variance.startsWith('-')) return 'text-red-400';
    if (variance.startsWith('+') || (parseFloat(variance) > 0)) return 'text-green-400';
    return 'text-gray-400';
  }
  
  const num = Number(variance);
  if (num > 0) return 'text-green-400';
  if (num < 0) return 'text-red-400';
  return 'text-gray-400';
};

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'Leading': return 'bg-green-900 text-green-300 border-green-600';
    case 'Coincident': return 'bg-yellow-900 text-yellow-300 border-yellow-600';
    case 'Lagging': return 'bg-red-900 text-red-300 border-red-600';
    default: return 'bg-gray-900 text-gray-300 border-gray-600';
  }
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'Growth': return 'bg-blue-900 text-blue-300';
    case 'Inflation': return 'bg-orange-900 text-orange-300';
    case 'Labor': return 'bg-purple-900 text-purple-300';
    case 'Monetary Policy': return 'bg-indigo-900 text-indigo-300';
    case 'Sentiment': return 'bg-pink-900 text-pink-300';
    default: return 'bg-gray-900 text-gray-300';
  }
};

export const EconomicIndicatorsTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const { data: economicData, isLoading, error, refetch } = useQuery<EconomicData>({
    queryKey: ['macroeconomic-indicators'],
    queryFn: async () => {
      const response = await fetch('/api/macroeconomic-indicators');
      if (!response.ok) throw new Error('Failed to fetch economic data');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

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

  const filteredAndSortedIndicators = React.useMemo(() => {
    if (!economicData?.indicators) return [];
    
    let filtered = economicData.indicators.filter(indicator =>
      indicator.metric.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortColumn) {
          case 'indicator':
            aValue = a.metric;
            bValue = b.metric;
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
            aValue = new Date(a.period_date).getTime();
            bValue = new Date(b.period_date).getTime();
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
          return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc' ? (aValue - bValue) : (bValue - aValue);
        }
      });
    }

    return filtered;
  }, [economicData?.indicators, searchTerm, sortColumn, sortDirection]);

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <span>Economic Indicators Table</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading economic indicators...</span>
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
            <span>Economic Indicators Table</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Unable to load economic indicators</p>
            <button
              onClick={() => refetch()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <span>Economic Indicators Table</span>
          </CardTitle>
          <div className="text-sm text-blue-400 font-medium">
            {economicData?.indicators.length || 0} indicators
          </div>
        </div>
        
        <div className="flex items-center space-x-2 mt-4">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search indicators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none flex-1"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-financial-border">
                <th className="text-left py-3 px-2">
                  <button 
                    onClick={() => handleSort('indicator')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center group"
                  >
                    Indicator
                    {getSortIcon('indicator')}
                  </button>
                </th>
                <th className="text-center py-3 px-2">
                  <button 
                    onClick={() => handleSort('type')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-center group"
                  >
                    Type
                    {getSortIcon('type')}
                  </button>
                </th>
                <th className="text-center py-3 px-2">
                  <button 
                    onClick={() => handleSort('category')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-center group"
                  >
                    Category
                    {getSortIcon('category')}
                  </button>
                </th>
                <th className="text-center py-3 px-2">
                  <button 
                    onClick={() => handleSort('period')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-center group"
                  >
                    Period
                    {getSortIcon('period')}
                  </button>
                </th>
                <th className="text-right py-3 px-2">
                  <button 
                    onClick={() => handleSort('current')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                  >
                    Current
                    {getSortIcon('current')}
                  </button>
                </th>
                <th className="text-right py-3 px-2">
                  <button 
                    onClick={() => handleSort('zscore')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                  >
                    Z-Score
                    {getSortIcon('zscore')}
                  </button>
                </th>
                <th className="text-right py-3 px-2">
                  <button 
                    onClick={() => handleSort('deltazscore')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                  >
                    Δ Z-Score
                    {getSortIcon('deltazscore')}
                  </button>
                </th>
                <th className="text-right py-3 px-2">
                  <button 
                    onClick={() => handleSort('prior')}
                    className="text-gray-300 font-medium hover:text-white transition-colors flex items-center justify-end group w-full"
                  >
                    Prior
                    {getSortIcon('prior')}
                  </button>
                </th>
                <th className="text-right py-3 px-2">
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
            <tbody>
              {filteredAndSortedIndicators.map((indicator, index) => (
                <tr key={index} className="border-b border-financial-border hover:bg-financial-gray/50 transition-colors">
                  <td className="py-3 px-2">
                    <div className="text-white font-medium text-sm">
                      {indicator.metric}
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
                  <td className="py-3 px-2 text-center text-white text-sm">
                    {indicator.period_date ? new Date(indicator.period_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3 px-2 text-right text-white font-semibold">
                    {formatValue(indicator.currentReading, indicator.unit)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatZScore(indicator.zScore)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatZScore(indicator.deltaZScore)}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-300 font-medium">
                    {formatValue(indicator.priorReading, indicator.unit)}
                  </td>
                  <td className={`py-3 px-2 text-right font-medium ${getVarianceColor(indicator.varianceVsPrior)}`}>
                    {formatVariance(indicator.varianceVsPrior)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredAndSortedIndicators.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No indicators found matching your search
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EconomicIndicatorsTable;