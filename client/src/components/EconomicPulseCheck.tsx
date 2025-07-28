import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

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

interface PulseMetric {
  name: string;
  currentValue: number;
  zScore: number;
  formattedValue: string;
}

interface PulseData {
  positive: {
    Growth: PulseMetric[];
    Inflation: PulseMetric[];
    Labor: PulseMetric[];
    'Monetary Policy': PulseMetric[];
    Sentiment: PulseMetric[];
  };
  negative: {
    Growth: PulseMetric[];
    Inflation: PulseMetric[];
    Labor: PulseMetric[];
    'Monetary Policy': PulseMetric[];
    Sentiment: PulseMetric[];
  };
}

const formatValue = (value: number, metricName: string): string => {
  // Simple formatting based on metric name patterns
  if (metricName.toLowerCase().includes('rate') || 
      metricName.toLowerCase().includes('unemployment') ||
      metricName.toLowerCase().includes('inflation') ||
      metricName.toLowerCase().includes('growth')) {
    return `${value.toFixed(1)}%`;
  }
  
  if (metricName.toLowerCase().includes('claims') ||
      metricName.toLowerCase().includes('jobs') ||
      metricName.toLowerCase().includes('payrolls')) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  
  if (metricName.toLowerCase().includes('housing') ||
      metricName.toLowerCase().includes('sales') ||
      metricName.toLowerCase().includes('permits')) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  
  if (metricName.toLowerCase().includes('index') ||
      metricName.toLowerCase().includes('pmi') ||
      metricName.toLowerCase().includes('sentiment') ||
      metricName.toLowerCase().includes('confidence')) {
    return value.toFixed(1);
  }
  
  // Default formatting
  return value.toFixed(1);
};

export function EconomicPulseCheck() {
  const {
    data: economicData,
    isLoading,
    error
  } = useQuery<EconomicDataResponse>({
    queryKey: ['/api/economic-data-analysis'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const processPulseData = (): PulseData => {
    const pulseData: PulseData = {
      positive: {
        Growth: [],
        Inflation: [],
        Labor: [],
        'Monetary Policy': [],
        Sentiment: []
      },
      negative: {
        Growth: [],
        Inflation: [],
        Labor: [],
        'Monetary Policy': [],
        Sentiment: []
      }
    };

    if (!economicData?.statisticalData) return pulseData;

    // Process each category
    Object.entries(economicData.statisticalData).forEach(([category, metrics]) => {
      Object.entries(metrics).forEach(([metricName, analysis]) => {
        const stats = analysis.statistics;
        const currentValue = stats.end_value;
        const zScore = stats.z_score;

        if (currentValue !== null && zScore !== null && Math.abs(zScore) >= 0.5) {
          const pulseMetric: PulseMetric = {
            name: metricName,
            currentValue,
            zScore,
            formattedValue: formatValue(currentValue, metricName)
          };

          const categoryKey = category as keyof typeof pulseData.positive;
          if (zScore > 0) {
            pulseData.positive[categoryKey]?.push(pulseMetric);
          } else {
            pulseData.negative[categoryKey]?.push(pulseMetric);
          }
        }
      });
    });

    // Sort by z-score descending for each category
    Object.keys(pulseData.positive).forEach(category => {
      const categoryKey = category as keyof typeof pulseData.positive;
      pulseData.positive[categoryKey].sort((a, b) => b.zScore - a.zScore);
      pulseData.negative[categoryKey].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    });

    return pulseData;
  };

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Economic Pulse Check</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-700 rounded"></div>
              ))}
            </div>
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
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Economic Pulse Check</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load economic pulse data. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const pulseData = processPulseData();
  const categories = ['Growth', 'Inflation', 'Labor', 'Monetary Policy', 'Sentiment'];

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-400" />
          <span>Economic Pulse Check</span>
        </CardTitle>
        <p className="text-gray-400 text-sm mt-1">
          Real-time z-score analysis by category - showing indicators with |z-score| ≥ 0.5
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-gray-400 px-3 py-2 w-24">Z-Score</th>
                {categories.map(category => (
                  <th key={category} className="text-center text-sm font-medium text-gray-400 px-3 py-2 min-w-32">
                    {category}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="space-y-2">
              {/* Positive Z-Scores Row */}
              <tr className="border-t border-financial-border">
                <td className="px-3 py-4 align-top">
                  <div className="flex items-center space-x-2 text-gain-green">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Positive</span>
                  </div>
                </td>
                {categories.map(category => (
                  <td key={`positive-${category}`} className="px-3 py-4 align-top">
                    <div className="space-y-2 min-h-[80px]">
                      {pulseData.positive[category as keyof typeof pulseData.positive]?.slice(0, 3).map((metric, idx) => (
                        <div key={idx} className="bg-financial-gray rounded p-2 text-xs">
                          <div className="font-medium text-white truncate" title={metric.name}>
                            {metric.name.length > 20 ? `${metric.name.substring(0, 17)}...` : metric.name}
                          </div>
                          <div className="text-gain-green font-bold">
                            {metric.formattedValue}
                          </div>
                          <div className="text-gray-400">
                            z: {metric.zScore.toFixed(2)}
                          </div>
                        </div>
                      ))}
                      {pulseData.positive[category as keyof typeof pulseData.positive]?.length === 0 && (
                        <div className="text-gray-500 text-xs italic text-center py-4">
                          No positive outliers
                        </div>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
              
              {/* Negative Z-Scores Row */}
              <tr className="border-t border-financial-border">
                <td className="px-3 py-4 align-top">
                  <div className="flex items-center space-x-2 text-loss-red">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">Negative</span>
                  </div>
                </td>
                {categories.map(category => (
                  <td key={`negative-${category}`} className="px-3 py-4 align-top">
                    <div className="space-y-2 min-h-[80px]">
                      {pulseData.negative[category as keyof typeof pulseData.negative]?.slice(0, 3).map((metric, idx) => (
                        <div key={idx} className="bg-financial-gray rounded p-2 text-xs">
                          <div className="font-medium text-white truncate" title={metric.name}>
                            {metric.name.length > 20 ? `${metric.name.substring(0, 17)}...` : metric.name}
                          </div>
                          <div className="text-loss-red font-bold">
                            {metric.formattedValue}
                          </div>
                          <div className="text-gray-400">
                            z: {metric.zScore.toFixed(2)}
                          </div>
                        </div>
                      ))}
                      {pulseData.negative[category as keyof typeof pulseData.negative]?.length === 0 && (
                        <div className="text-gray-500 text-xs italic text-center py-4">
                          No negative outliers
                        </div>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}