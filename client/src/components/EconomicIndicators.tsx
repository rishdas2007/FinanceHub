import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface EconomicIndicator {
  metric: string;
  type: 'Leading' | 'Coincident' | 'Lagging';
  category: string;
  current: number | null;
  forecast: number | null;
  vsForecast: number | null;
  prior: number | null;
  vsPrior: number | null;
  zScore: number | null;
  yoyChange: number | null;
  threeMonthAnnualized?: number | null;
  unit: string;
  frequency: string;
  dateOfRelease: string;
  nextRelease: string;
  lastUpdated?: string; // New field for tracking FRED updates
}

const formatValue = (value: any, unit: string): string => {
  if (value === null || value === undefined || value === 'N/A') return 'N/A';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(numValue) || !isFinite(numValue)) return 'N/A';
  
  if (unit === 'thousands') {
    if (Math.abs(numValue) >= 1000) {
      return `${Math.round(numValue / 1000)}M`;
    }
    return `${Math.round(numValue)}K`;
  }
  
  if (unit === 'percent') {
    return `${numValue.toFixed(2)}%`;
  }
  
  if (unit === 'basis_points') {
    return `${Math.round(numValue)} bps`;
  }
  
  if (unit === 'index') {
    return numValue.toFixed(1);
  }
  
  if (unit === 'decimal') {
    return numValue.toFixed(2);
  }
  
  return numValue.toFixed(2);
};

const formatVariance = (variance: any, unit: string): string => {
  if (variance === null || variance === undefined || variance === 'N/A') return '';
  
  const numValue = typeof variance === 'string' ? parseFloat(variance) : Number(variance);
  if (isNaN(numValue) || !isFinite(numValue)) return '';
  
  const sign = numValue > 0 ? '+' : '';
  
  if (unit === 'thousands') {
    if (Math.abs(numValue) >= 1000) {
      return `${sign}${Math.round(numValue / 1000)}M`;
    }
    return `${sign}${Math.round(numValue)}K`;
  }
  
  if (unit === 'percent') {
    return `${sign}${numValue.toFixed(2)}%`;
  }
  
  if (unit === 'basis_points') {
    return `${sign}${Math.round(numValue)} bps`;
  }
  
  return `${sign}${numValue.toFixed(2)}`;
};

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'Leading': return 'text-green-400';
    case 'Coincident': return 'text-yellow-400';
    case 'Lagging': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getVarianceColor = (variance: any): string => {
  if (variance === null || variance === undefined || variance === 'N/A') return 'text-gray-400';
  
  const numValue = typeof variance === 'string' ? parseFloat(variance) : Number(variance);
  if (isNaN(numValue) || !isFinite(numValue)) return 'text-gray-400';
  
  if (numValue > 0) return 'text-green-400';
  if (numValue < 0) return 'text-red-400';
  return 'text-gray-400';
};

type SortField = 'metric' | 'type' | 'category' | 'lastUpdated' | 'current' | 'forecast' | 'vsForecast' | 'prior' | 'vsPrior' | 'zScore' | 'threeMonthAnnualized' | 'yoyChange';
type SortDirection = 'asc' | 'desc';

export function EconomicIndicators() {
  const [sortField, setSortField] = useState<SortField>('metric');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { data: indicators, isLoading, error } = useQuery<EconomicIndicator[]>({
    queryKey: ['/api/economic-indicators'],
    staleTime: 4 * 60 * 60 * 1000, // 4 hours
    gcTime: 8 * 60 * 60 * 1000, // 8 hours
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUp className="w-4 h-4 text-gray-500" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-400" />
      : <ChevronDown className="w-4 h-4 text-blue-400" />;
  };

  const sortedIndicators = indicators ? [...indicators].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    // Handle null/undefined values
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    // Convert to numbers for numeric fields
    const numericFields: SortField[] = ['current', 'forecast', 'vsForecast', 'prior', 'vsPrior', 'zScore', 'threeMonthAnnualized', 'yoyChange'];
    
    // Handle date fields for lastUpdated
    if (sortField === 'lastUpdated') {
      const aDate = aVal ? new Date(aVal as string).getTime() : 0;
      const bDate = bVal ? new Date(bVal as string).getTime() : 0;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
    if (numericFields.includes(sortField)) {
      const aNum = typeof aVal === 'string' ? parseFloat(aVal) : Number(aVal);
      const bNum = typeof bVal === 'string' ? parseFloat(bVal) : Number(bVal);
      
      if (isNaN(aNum) && isNaN(bNum)) return 0;
      if (isNaN(aNum)) return 1;
      if (isNaN(bNum)) return -1;
      
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // String comparison for text fields
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    
    if (sortDirection === 'asc') {
      return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
    } else {
      return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
    }
  }) : [];

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Economic Indicators</h3>
        <p className="text-red-400">Failed to load economic indicators</p>
      </Card>
    );
  }

  if (isLoading || !indicators) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Economic Indicators</h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gray-900/50 border-gray-700">
      <h3 className="text-xl font-bold mb-6 text-white flex items-center">
        📊 Economic Indicators
        <span className="ml-2 text-sm text-gray-400 font-normal">Federal Reserve Economic Data</span>
      </h3>
      
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm bg-gray-900/80">
          <thead className="bg-gray-800">
            <tr>
              <th 
                className="text-left py-4 px-4 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('metric')}
              >
                <div className="flex items-center justify-between">
                  Metric
                  {getSortIcon('metric')}
                </div>
              </th>
              <th 
                className="text-center py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center justify-center gap-1">
                  Type
                  {getSortIcon('type')}
                </div>
              </th>
              <th 
                className="text-left py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center justify-between">
                  Category
                  {getSortIcon('category')}
                </div>
              </th>
              <th 
                className="text-center py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('lastUpdated')}
              >
                <div className="flex items-center justify-center gap-1">
                  Last Update
                  {getSortIcon('lastUpdated')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('current')}
              >
                <div className="flex items-center justify-end gap-1">
                  Current
                  {getSortIcon('current')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('forecast')}
              >
                <div className="flex items-center justify-end gap-1">
                  Forecast
                  {getSortIcon('forecast')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('vsForecast')}
              >
                <div className="flex items-center justify-end gap-1">
                  vs Forecast
                  {getSortIcon('vsForecast')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('prior')}
              >
                <div className="flex items-center justify-end gap-1">
                  Prior
                  {getSortIcon('prior')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('vsPrior')}
              >
                <div className="flex items-center justify-end gap-1">
                  vs Prior
                  {getSortIcon('vsPrior')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('zScore')}
              >
                <div className="flex items-center justify-end gap-1">
                  Z-Score
                  {getSortIcon('zScore')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('threeMonthAnnualized')}
              >
                <div className="flex items-center justify-end gap-1">
                  3M Ann
                  {getSortIcon('threeMonthAnnualized')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => handleSort('yoyChange')}
              >
                <div className="flex items-center justify-end gap-1">
                  12M YoY
                  {getSortIcon('yoyChange')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedIndicators.map((indicator, index) => (
              <tr 
                key={indicator.metric} 
                className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                  index % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-900/30'
                }`}
              >
                <td className="py-4 px-4 text-white font-semibold text-sm">
                  {indicator.metric}
                </td>
                <td className="py-4 px-3 text-center">
                  <span className={`${getTypeColor(indicator.type)} font-bold text-xs px-3 py-1 rounded-full border ${
                    indicator.type === 'Leading' ? 'border-green-600 bg-green-900/20' :
                    indicator.type === 'Coincident' ? 'border-yellow-600 bg-yellow-900/20' :
                    'border-red-600 bg-red-900/20'
                  }`}>
                    {indicator.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-4 px-3 text-gray-200 font-medium">
                  {indicator.category}
                </td>
                <td className="py-4 px-3 text-center">
                  {indicator.lastUpdated ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-green-400 font-medium text-xs bg-green-900/20 px-2 py-1 rounded border border-green-600">
                        FRED
                      </span>
                      <span className="text-gray-300 text-xs">
                        {new Date(indicator.lastUpdated).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: '2-digit'
                        })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">CSV</span>
                  )}
                </td>
                <td className="py-4 px-3 text-right text-white font-bold text-lg">
                  {formatValue(indicator.current, indicator.unit)}
                </td>
                <td className="py-4 px-3 text-right text-gray-200 font-medium">
                  {formatValue(indicator.forecast, indicator.unit)}
                </td>
                <td className={`py-4 px-3 text-right font-bold ${getVarianceColor(indicator.vsForecast)}`}>
                  {formatVariance(indicator.vsForecast, indicator.unit)}
                </td>
                <td className="py-4 px-3 text-right text-gray-200 font-medium">
                  {formatValue(indicator.prior, indicator.unit)}
                </td>
                <td className={`py-4 px-3 text-right font-bold ${getVarianceColor(indicator.vsPrior)}`}>
                  {formatVariance(indicator.vsPrior, indicator.unit)}
                </td>
                <td className={`py-4 px-3 text-right font-bold text-lg ${getVarianceColor(indicator.zScore)}`}>
                  {formatValue(indicator.zScore, 'decimal')}
                </td>
                <td className={`py-4 px-3 text-right font-bold text-lg ${getVarianceColor(indicator.threeMonthAnnualized)}`}>
                  {indicator.threeMonthAnnualized ? formatValue(indicator.threeMonthAnnualized, 'percent') : 'N/A'}
                </td>
                <td className={`py-4 px-3 text-right font-bold text-lg ${getVarianceColor(indicator.yoyChange)}`}>
                  {indicator.yoyChange ? formatValue(indicator.yoyChange, 'percent') : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0">
          <div>
            <p className="text-sm text-gray-300 font-medium">
              📈 Data Source: Federal Reserve Economic Data (FRED API)
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Updated every 2 hours • Real-time government economic statistics
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center">
              <span className="w-3 h-3 bg-green-400 rounded-full mr-2 border border-green-600"></span>
              <span className="text-green-400 font-semibold">LEADING</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2 border border-yellow-600"></span>
              <span className="text-yellow-400 font-semibold">COINCIDENT</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-red-400 rounded-full mr-2 border border-red-600"></span>
              <span className="text-red-400 font-semibold">LAGGING</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}