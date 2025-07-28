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
  [category: string]: {
    positive: PulseMetric[];
    negative: PulseMetric[];
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
      Growth: { positive: [], negative: [] },
      Inflation: { positive: [], negative: [] },
      Labor: { positive: [], negative: [] },
      'Monetary Policy': { positive: [], negative: [] },
      Sentiment: { positive: [], negative: [] }
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

          if (pulseData[category]) {
            if (zScore > 0) {
              pulseData[category].positive.push(pulseMetric);
            } else {
              pulseData[category].negative.push(pulseMetric);
            }
          }
        }
      });
    });

    // Sort by z-score descending for each category
    Object.keys(pulseData).forEach(category => {
      pulseData[category].positive.sort((a, b) => b.zScore - a.zScore);
      pulseData[category].negative.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
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
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-2 w-32">Category</th>
                <th className="text-left text-sm font-medium text-gain-green px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Positive Z-Scores</span>
                  </div>
                </th>
                <th className="text-left text-sm font-medium text-loss-red px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="h-4 w-4" />
                    <span>Negative Z-Scores</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category} className="border-t border-financial-border">
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm font-medium text-white">
                      {category}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 min-h-[60px]">
                      {pulseData[category]?.positive.slice(0, 4).map((metric, idx) => (
                        <div key={idx} className="bg-financial-gray rounded-lg p-3 border-l-2 border-gain-green">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 mr-3">
                              <div className="font-medium text-white text-sm mb-1" title={metric.name}>
                                {metric.name}
                              </div>
                              <div className="text-gain-green font-bold text-lg">
                                {metric.formattedValue}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-400">z-score</div>
                              <div className="text-sm font-bold text-gain-green">
                                +{metric.zScore.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {pulseData[category]?.positive.length === 0 && (
                        <div className="text-gray-500 text-sm italic py-4">
                          No positive outliers
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 min-h-[60px]">
                      {pulseData[category]?.negative.slice(0, 4).map((metric, idx) => (
                        <div key={idx} className="bg-financial-gray rounded-lg p-3 border-l-2 border-loss-red">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 mr-3">
                              <div className="font-medium text-white text-sm mb-1" title={metric.name}>
                                {metric.name}
                              </div>
                              <div className="text-loss-red font-bold text-lg">
                                {metric.formattedValue}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-400">z-score</div>
                              <div className="text-sm font-bold text-loss-red">
                                {metric.zScore.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {pulseData[category]?.negative.length === 0 && (
                        <div className="text-gray-500 text-sm italic py-4">
                          No negative outliers
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}