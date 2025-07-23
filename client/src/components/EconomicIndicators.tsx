import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

const formatValue = (value: number | null, unit: string): string => {
  if (value === null) return 'N/A';
  
  if (unit === 'thousands') {
    if (Math.abs(value) >= 1000) {
      return `${Math.round(value / 1000)}M`;
    }
    return `${Math.round(value)}K`;
  }
  
  if (unit === 'percent') {
    return `${value.toFixed(2)}%`;
  }
  
  if (unit === 'basis_points') {
    return `${Math.round(value)} bps`;
  }
  
  if (unit === 'index') {
    return value.toFixed(1);
  }
  
  return value.toFixed(2);
};

const formatVariance = (variance: number | null, unit: string): string => {
  if (variance === null) return '';
  
  const sign = variance > 0 ? '+' : '';
  
  if (unit === 'thousands') {
    if (Math.abs(variance) >= 1000) {
      return `${sign}${Math.round(variance / 1000)}M`;
    }
    return `${sign}${Math.round(variance)}K`;
  }
  
  if (unit === 'percent') {
    return `${sign}${variance.toFixed(2)}%`;
  }
  
  if (unit === 'basis_points') {
    return `${sign}${Math.round(variance)} bps`;
  }
  
  return `${sign}${variance.toFixed(2)}`;
};

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'Leading': return 'text-green-400';
    case 'Coincident': return 'text-yellow-400';
    case 'Lagging': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getVarianceColor = (variance: number | null): string => {
  if (variance === null) return 'text-gray-400';
  if (variance > 0) return 'text-green-400';
  if (variance < 0) return 'text-red-400';
  return 'text-gray-400';
};

export function EconomicIndicators() {
  const { data: indicators, isLoading, error } = useQuery<EconomicIndicator[]>({
    queryKey: ['/api/economic-indicators'],
    staleTime: 4 * 60 * 60 * 1000, // 4 hours
    gcTime: 8 * 60 * 60 * 1000, // 8 hours
  });

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
              <th className="text-left py-4 px-4 text-gray-200 font-semibold border-b border-gray-600">Metric</th>
              <th className="text-center py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Type</th>
              <th className="text-left py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Category</th>
              <th className="text-center py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Last Update</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Current</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Forecast</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">vs Forecast</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Prior</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">vs Prior</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">Z-Score</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">3M Ann</th>
              <th className="text-right py-4 px-3 text-gray-200 font-semibold border-b border-gray-600">12M YoY</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator, index) => (
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
                    <span className="text-green-400 font-medium text-xs bg-green-900/20 px-2 py-1 rounded border border-green-600">
                      TODAY
                    </span>
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
                  {indicator.zScore?.toFixed(2) || 'N/A'}
                </td>
                <td className={`py-4 px-3 text-right font-bold text-lg ${getVarianceColor(indicator.threeMonthAnnualized)}`}>
                  {indicator.threeMonthAnnualized ? `${indicator.threeMonthAnnualized.toFixed(1)}%` : 'N/A'}
                </td>
                <td className={`py-4 px-3 text-right font-bold text-lg ${getVarianceColor(indicator.yoyChange)}`}>
                  {indicator.yoyChange ? `${indicator.yoyChange.toFixed(1)}%` : 'N/A'}
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