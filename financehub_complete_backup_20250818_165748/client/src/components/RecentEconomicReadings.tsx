import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";

interface EconomicIndicator {
  series_id: string;
  title: string;
  latest: number;
  latest_date: string;
  prior: number | null;
  prior_date: string | null;
  units: string;
  change: number | null;
  change_percent: number | null;
}

interface FREDResponse {
  indicators: EconomicIndicator[];
  analysis: string;
}

export function RecentEconomicReadings() {
  const { data: fredData, isLoading } = useQuery<FREDResponse>({
    queryKey: ['/api/fred-recent-readings'],
    staleTime: 15 * 60 * 1000, // 15 minutes for FRED data (slower updates)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Recent Economic Readings</span>
            <span className="text-xs text-gray-400">FRED API</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-financial-dark" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!fredData || !fredData.indicators || fredData.indicators.length === 0) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Recent Economic Readings</span>
            <span className="text-xs text-red-400">FRED API Error</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">FRED economic data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const indicators = fredData.indicators;
  const analysis = fredData.analysis;

  // Note: formatValue function removed - now using backend pre-formatted values
  // All economic indicators now use standard_unit formatting from API
  const formatValue = (value: number, units: string): string => {
    // Temporary fallback while backend updates are deployed
    return value.toFixed(2);
  };

  const formatChange = (change: number | null, changePercent: number | null): { text: string; isPositive: boolean | null } => {
    if (change === null && changePercent === null) {
      return { text: 'N/A', isPositive: null };
    }
    
    if (changePercent !== null) {
      return {
        text: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
        isPositive: changePercent >= 0
      };
    }
    
    if (change !== null) {
      return {
        text: `${change >= 0 ? '+' : ''}${change.toFixed(2)}`,
        isPositive: change >= 0
      };
    }
    
    return { text: 'N/A', isPositive: null };
  };

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          <span>Recent Economic Readings</span>
          <span className="text-xs text-green-400">FRED API • Live</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Economic Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {indicators.map((indicator, index) => {
            const changeInfo = formatChange(indicator.change, indicator.change_percent);
            
            return (
              <div
                key={`${indicator.series_id}-${index}`}
                className="bg-financial-dark rounded-lg p-4 border border-financial-border hover:border-blue-500/30 transition-colors"
              >
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-white leading-tight">
                      {indicator.title.replace(/\(.*?\)/g, '').trim()}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {indicator.series_id} • {indicator.units}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Latest</span>
                      <span className="text-lg font-bold text-blue-400">
                        {formatValue(indicator.latest, indicator.units)}
                      </span>
                    </div>

                    {indicator.prior !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Prior</span>
                        <span className="text-sm text-gray-300">
                          {formatValue(indicator.prior, indicator.units)}
                        </span>
                      </div>
                    )}

                    {changeInfo.text !== 'N/A' && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Change</span>
                        <div className="flex items-center space-x-1">
                          {changeInfo.isPositive !== null && (
                            changeInfo.isPositive ? 
                              <TrendingUp className="h-3 w-3 text-gain-green" /> :
                              <TrendingDown className="h-3 w-3 text-loss-red" />
                          )}
                          <span className={`text-sm font-medium ${
                            changeInfo.isPositive === true ? 'text-gain-green' :
                            changeInfo.isPositive === false ? 'text-loss-red' :
                            'text-gray-300'
                          }`}>
                            {changeInfo.text}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-financial-border">
                    <span className="text-xs text-gray-500">
                      {new Date(indicator.latest_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Analysis Section */}
        {analysis && (
          <div className="bg-financial-dark rounded-lg p-4 border border-financial-border">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
              <span>📊 Economic Analysis</span>
              <span className="text-xs text-blue-400">GPT-4o</span>
            </h4>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {analysis}
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center">
          Data from Federal Reserve Economic Data (FRED) • Most Recent Updates
        </div>
      </CardContent>
    </Card>
  );
}