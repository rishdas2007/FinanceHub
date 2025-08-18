// Demonstration component using the new 3-layer economic data model
// Shows consistent formatting and signal classifications

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatValue, getMultiSignalColor } from '../../../shared/formatters/economic-formatters';

interface EconomicIndicator {
  seriesId: string;
  displayName: string;
  category: string;
  typeTag: string;
  current: {
    value: number;
    formatted: string;
    periodEnd: string;
  };
  signals: {
    levelZ: number;
    changeZ: number;
    levelClass: string;
    trendClass: string;
    multiSignal: string;
    formattedLevelZ: string;
    formattedChangeZ: string;
  };
  metadata: {
    columnHeader: string;
  };
}

export function EconomicDataTable() {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['/api/econ/dashboard'],
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Economic Indicators - 3-Layer Data Model</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !dashboardData?.indicators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Economic Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 p-4">
            <p>Data temporarily unavailable</p>
            <p className="text-sm">Using 3-layer standardization model</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const indicators: EconomicIndicator[] = dashboardData.indicators;
  
  // Group by category for better organization
  const categorizedIndicators = indicators.reduce((acc, indicator) => {
    const category = indicator.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(indicator);
    return acc;
  }, {} as Record<string, EconomicIndicator[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Economic Indicators - Standardized Data Model
          <Badge variant="outline" className="text-xs">
            Bronze → Silver → Gold
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(categorizedIndicators).map(([category, categoryIndicators]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 text-blue-400">
                {category}
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-2">Indicator</th>
                      <th className="text-left p-2">Current Value</th>
                      <th className="text-right p-2">Level Z-Score</th>
                      <th className="text-right p-2">Change Z-Score</th>
                      <th className="text-left p-2">Signal</th>
                      <th className="text-center p-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryIndicators.map((indicator) => (
                      <tr key={indicator.seriesId} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{indicator.displayName}</div>
                            <div className="text-xs text-gray-400">{indicator.seriesId}</div>
                          </div>
                        </td>
                        
                        <td className="p-2">
                          <div className="font-mono">
                            {indicator.current.formatted}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(indicator.current.periodEnd).toLocaleDateString()}
                          </div>
                        </td>
                        
                        <td className="p-2 text-right font-mono">
                          <span className={
                            indicator.signals.levelZ >= 1 ? 'text-green-400' :
                            indicator.signals.levelZ <= -1 ? 'text-red-400' :
                            'text-gray-400'
                          }>
                            {indicator.signals.formattedLevelZ}
                          </span>
                        </td>
                        
                        <td className="p-2 text-right font-mono">
                          <span className={
                            indicator.signals.changeZ >= 0.5 ? 'text-green-400' :
                            indicator.signals.changeZ <= -0.5 ? 'text-red-400' :
                            'text-gray-400'
                          }>
                            {indicator.signals.formattedChangeZ}
                          </span>
                        </td>
                        
                        <td className="p-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getMultiSignalColor(indicator.signals.multiSignal)}`}
                          >
                            {indicator.signals.multiSignal}
                          </Badge>
                        </td>
                        
                        <td className="p-2 text-center">
                          <Badge 
                            variant={
                              indicator.typeTag === 'Leading' ? 'default' :
                              indicator.typeTag === 'Lagging' ? 'secondary' :
                              'outline'
                            }
                            className="text-xs"
                          >
                            {indicator.typeTag}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        
        {/* Data Model Information */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="text-sm font-semibold mb-2">3-Layer Data Model</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <div><strong>Bronze:</strong> Raw data exactly as received from sources</div>
            <div><strong>Silver:</strong> Standardized units and transforms (PCT_DECIMAL, USD, COUNT, etc.)</div>
            <div><strong>Gold:</strong> Z-scores and signal classifications using consistent thresholds</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}