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
  unit: string;
  frequency: string;
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
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-white">Economic Indicators</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left py-3 px-2 text-gray-300 font-medium">Metric</th>
              <th className="text-left py-3 px-2 text-gray-300 font-medium">Type</th>
              <th className="text-left py-3 px-2 text-gray-300 font-medium">Category</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">Current</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">Forecast</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">vs Forecast</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">Prior</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">vs Prior</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">Z-Score</th>
              <th className="text-right py-3 px-2 text-gray-300 font-medium">12M YoY</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator, index) => (
              <tr 
                key={indicator.metric} 
                className={`border-b border-gray-700 hover:bg-gray-800/50 ${
                  index % 2 === 0 ? 'bg-gray-800/20' : ''
                }`}
              >
                <td className="py-3 px-2 text-white font-medium">
                  {indicator.metric}
                </td>
                <td className="py-3 px-2">
                  <span className={`${getTypeColor(indicator.type)} font-medium text-xs px-2 py-1 rounded`}>
                    {indicator.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-2 text-gray-300">
                  {indicator.category}
                </td>
                <td className="py-3 px-2 text-right text-white font-medium">
                  {formatValue(indicator.current, indicator.unit)}
                </td>
                <td className="py-3 px-2 text-right text-white">
                  {formatValue(indicator.forecast, indicator.unit)}
                </td>
                <td className={`py-3 px-2 text-right font-medium ${getVarianceColor(indicator.vsForecast)}`}>
                  {formatVariance(indicator.vsForecast, indicator.unit)}
                </td>
                <td className="py-3 px-2 text-right text-white">
                  {formatValue(indicator.prior, indicator.unit)}
                </td>
                <td className={`py-3 px-2 text-right font-medium ${getVarianceColor(indicator.vsPrior)}`}>
                  {formatVariance(indicator.vsPrior, indicator.unit)}
                </td>
                <td className={`py-3 px-2 text-right font-medium ${getVarianceColor(indicator.zScore)}`}>
                  {indicator.zScore?.toFixed(2) || 'N/A'}
                </td>
                <td className={`py-3 px-2 text-right font-medium ${getVarianceColor(indicator.yoyChange)}`}>
                  {indicator.yoyChange ? `${indicator.yoyChange.toFixed(1)}%` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-xs text-gray-400">
        <p>Data source: Federal Reserve Economic Data (FRED) • Updated every 4 hours</p>
        <p className="mt-1">
          <span className="text-green-400">LEADING</span> • 
          <span className="text-yellow-400 ml-2">COINCIDENT</span> • 
          <span className="text-red-400 ml-2">LAGGING</span>
        </p>
      </div>
    </Card>
  );
}