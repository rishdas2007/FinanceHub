import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";

interface EconomicIndicator {
  metric: string;
  current: string;
  type: string;
  lastUpdated?: string;
  change?: string;
  zScore?: number | string;
}

export function RecentEconomicReadings() {
  const { data: indicators, isLoading } = useQuery<EconomicIndicator[]>({
    queryKey: ['/api/economic-indicators'],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Recent Economic Readings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-financial-dark" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!indicators || indicators.length === 0) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Recent Economic Readings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">No economic data available</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by lastUpdated date (most recent first) and take top 6
  const sortedByDate = indicators
    .filter(ind => ind.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
    .slice(0, 6);
  
  // If we don't have enough with dates, fill with others
  const remaining = indicators.filter(ind => !ind.lastUpdated).slice(0, 6 - sortedByDate.length);
  const recentReadings = [...sortedByDate, ...remaining].slice(0, 6);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recent';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: '2-digit' 
      });
    } catch {
      return 'Recent';
    }
  };

  const getVarianceColor = (current: string, forecast?: string) => {
    if (!forecast || !current) return 'text-gray-400';
    
    const currentNum = parseFloat(current.replace(/[^-\d.]/g, ''));
    const forecastNum = parseFloat(forecast.replace(/[^-\d.]/g, ''));
    
    if (isNaN(currentNum) || isNaN(forecastNum)) return 'text-gray-400';
    
    return currentNum > forecastNum ? 'text-green-400' : 'text-red-400';
  };

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          <span>Recent Economic Readings</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentReadings.map((indicator, index) => (
            <div 
              key={`${indicator.metric}-${index}`}
              className="bg-financial-dark rounded-lg p-4 border border-financial-border"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-sm font-medium text-gray-300 leading-tight">
                  {indicator.metric}
                </h3>
                <span className="text-xs text-gray-500 ml-2">
                  {formatDate(indicator.lastUpdated)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-blue-400">
                    {indicator.current}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">
                    {indicator.type === 'Leading' && 'Leading'}
                    {indicator.type === 'Coincident' && 'Coincident'}
                    {indicator.type === 'Lagging' && 'Lagging'}
                  </span>
                </div>
                
                {indicator.change && (
                  <span className={`text-sm font-medium ${getVarianceColor(indicator.current, indicator.change)}`}>
                    vs {indicator.change} forecast
                  </span>
                )}
              </div>

              {indicator.zScore !== undefined && indicator.zScore !== null && (
                <div className="mt-2 text-xs text-gray-500">
                  Z-Score: <span className="text-yellow-400 font-medium">
                    {typeof indicator.zScore === 'number' 
                      ? indicator.zScore.toFixed(2) 
                      : parseFloat(indicator.zScore.toString()).toFixed(2)
                    }
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}