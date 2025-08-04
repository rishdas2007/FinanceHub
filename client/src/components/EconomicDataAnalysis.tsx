import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CorrelationMatrix } from './CorrelationMatrix';

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

export function EconomicDataAnalysis() {
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-400" />;
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

  const formatPercent = (value: number | null): string => {
    if (value === null) return 'N/A';
    return `${value.toFixed(1)}%`;
  };

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <span>Economic Data Analysis</span>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load economic data analysis. Please try again.</p>
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
            <span>Economic Data Analysis</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Statistical alert system - showing only metrics &gt;1 standard deviation from mean
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

      {isLoading ? (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-gray-300">Performing statistical analysis and generating AI insights...</span>
            </div>
          </CardContent>
        </Card>
      ) : economicData ? (
        <>
          {/* AI Analysis Section */}
          <Card className="bg-financial-card border-financial-border">
            <CardHeader>
              <CardTitle className="text-white text-lg">AI Economic Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-300 leading-relaxed">
                {economicData.aiAnalysis.split('\n').map((line, index) => {
                  // Check if line contains section headers (starts with capital letters and common header words)
                  const isHeader = line.trim().match(/^(Cross-Category|Overall|Economic|Market|Analysis|Synthesis|Outlook)/i) && 
                                  !line.includes(':') && !line.includes('.') && line.trim().length < 80;
                  
                  if (isHeader) {
                    return (
                      <div key={index} className="font-bold text-white text-base mb-3 mt-4">
                        {line.trim()}
                      </div>
                    );
                  } else if (line.trim()) {
                    return (
                      <p key={index} className="mb-2">
                        {line.trim()}
                      </p>
                    );
                  } else {
                    return <div key={index} className="mb-2"></div>;
                  }
                })}
              </div>
            </CardContent>
          </Card>

          {/* Statistical Data Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(economicData.statisticalData).map(([category, metrics]) => (
              <Card key={category} className="bg-financial-card border-financial-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm font-medium">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(metrics).map(([metric, analysis]) => (
                    <div key={metric} className="space-y-2">
                      <div className="text-xs font-medium text-gray-200 truncate" title={metric}>
                        {metric}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getTrendIcon(analysis.trend)}
                          <Badge variant={getTrendBadgeVariant(analysis.trend)} className="text-xs">
                            {analysis.trend}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <div>Current: {formatValue(analysis.statistics.end_value)}</div>
                        <div className="text-blue-400 font-medium">
                          Z-Score: {analysis.statistics.z_score !== null ? formatValue(analysis.statistics.z_score) : 'N/A'}
                        </div>
                        <div>Mean: {formatValue(analysis.statistics.mean)}</div>
                        <div>Std Dev: {formatValue(analysis.statistics.std)}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Economic Correlation Analysis */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium text-blue-400">Priority 1: Cross-Indicator Correlation Analysis</h3>
              <div className="text-xs text-gray-400 bg-slate-800 px-2 py-1 rounded">
                Dynamic Thresholds: VIX-Adjusted
              </div>
            </div>
            <CorrelationMatrix />
          </div>
        </>
      ) : (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <p className="text-gray-400 text-center">No economic data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}