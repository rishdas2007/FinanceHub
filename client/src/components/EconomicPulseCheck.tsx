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
  indicators: any[];
  aiSummary: string;
  lastUpdated: string;
  source: string;
}

interface PulseMetric {
  name: string;
  currentValue: number;
  priorValue: number | null;
  zScore: number;
  formattedValue: string;
  formattedPriorValue: string;
  periodDate: string;
  changeFromPrior: number | null;
  formattedChange: string;
}

interface PulseData {
  [category: string]: {
    positive: PulseMetric[];
    negative: PulseMetric[];
  };
}

// Comprehensive metric name to unit mapping - same as Economic Indicators Table
const getMetricDisplayUnit = (metricName: string): string => {
  const metricToUnitMap: Record<string, string> = {
    // Growth - millions_dollars
    'Retail Sales': 'millions_dollars',
    'Retail Sales: Food Services': 'millions_dollars',
    'Retail Sales Ex-Auto': 'millions_dollars',
    'E-commerce Retail Sales': 'millions_dollars',
    'Total Construction Spending': 'millions_dollars',
    'Durable Goods Orders': 'millions_dollars',
    'Consumer Durable Goods New Orders': 'millions_dollars',
    
    // Growth - thousands
    'Housing Starts': 'thousands',
    'New Home Sales': 'thousands',
    'Existing Home Sales': 'thousands',
    'Building Permits': 'thousands',
    'Nonfarm Payrolls': 'thousands',
    'Initial Jobless Claims': 'thousands',
    'Continuing Jobless Claims': 'thousands',
    'JOLTS Hires': 'thousands',
    'JOLTS Job Openings': 'thousands',
    
    // Growth - percent
    'GDP Growth Rate (Annualized)': 'percent',
    'Capacity Utilization (Mfg)': 'percent',
    'Personal Savings Rate': 'percent',
    'Industrial Production YoY': 'percent',
    
    // Growth - index
    'Industrial Production': 'index',
    'US Leading Economic Index': 'index',
    'Leading Economic Index': 'index',
    'ISM Manufacturing PMI': 'index',
    'S&P Global Mfg PMI': 'index',
    
    // Growth - chained_dollars (trillions)
    'Real Disposable Personal Income': 'chained_dollars',
    
    // Growth - months_supply
    'Months Supply of Homes': 'months_supply',
    
    // Labor - percent
    'Unemployment Rate': 'percent',
    'U-6 Unemployment Rate': 'percent',
    'Employment Population Ratio': 'percent',
    'Labor Force Participation Rate': 'percent',
    'JOLTS Quit Rate': 'percent',
    
    // Labor - dollars_per_hour
    'Average Hourly Earnings': 'dollars_per_hour',
    
    // Labor - hours
    'Average Weekly Hours': 'hours',
    
    // Inflation - index
    'CPI All Items': 'index',
    'Core CPI': 'index',
    'PPI All Commodities': 'percent',
    'Core PPI': 'percent',
    'PCE Price Index': 'index',
    'Core PCE Price Index': 'index',
    'CPI Energy': 'index',
    
    // Inflation - dollars_per_gallon
    'US Regular Gasoline Price': 'dollars_per_gallon',
    
    // Monetary Policy - percent
    'Federal Funds Rate': 'percent',
    '10-Year Treasury Yield': 'percent',
    '30-Year Fixed Mortgage Rate': 'percent',
    
    // Monetary Policy - basis_points
    'Yield Curve (10yr-2yr)': 'basis_points',
    
    // Monetary Policy - billions_dollars
    'Commercial & Industrial Loans': 'billions_dollars',
    
    // Sentiment - index
    'Michigan Consumer Sentiment': 'index',
    'Consumer Confidence Index': 'index'
  };

  return metricToUnitMap[metricName] || 'index';
};

const formatNumber = (value: number | null | undefined, unit: string): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const numValue = parseFloat(String(value));

  switch (unit) {
    case 'percent':
      return numValue.toFixed(1) + '%';
    case 'thousands':
      // Convert from actual values to thousands format
      if (numValue >= 1000000) {
        return (numValue / 1000000).toFixed(2) + 'M'; // Convert millions to M format
      } else if (numValue >= 1000) {
        return (numValue / 1000).toFixed(1) + 'K'; // Convert thousands to K format
      } else {
        return numValue.toFixed(1) + 'K'; // Data is already in thousands
      }
    case 'millions_dollars':
      return '$' + numValue.toFixed(1) + 'M'; // Data is already in millions
    case 'billions_dollars':
      // Handle different scales of billions data
      if (numValue >= 1000) {
        return '$' + (numValue / 1000).toFixed(1) + 'T'; // Convert to trillions
      } else if (numValue >= 1) {
        return '$' + numValue.toFixed(1) + 'B'; // Already in billions
      } else {
        return '$' + (numValue * 1000).toFixed(1) + 'B'; // Convert from trillions to billions
      }
    case 'index':
      return numValue.toFixed(1);
    case 'basis_points':
      return numValue.toFixed(0) + ' bps';
    case 'dollars_per_hour':
      return '$' + numValue.toFixed(2);
    case 'hours':
      return numValue.toFixed(1) + ' hrs';
    case 'months_supply':
      return numValue.toFixed(1) + ' months';
    case 'chained_dollars': // For Real Disposable Personal Income (trillions)
      return '$' + numValue.toFixed(2) + 'T';
    case 'dollars_per_gallon':
      return '$' + numValue.toFixed(2) + '/gal';
    case 'units': // Generic units
      return numValue.toLocaleString();
    default:
      return numValue.toFixed(2);
  }
};

const formatValue = (value: number, metricName: string): string => {
  const unit = getMetricDisplayUnit(metricName);
  return formatNumber(value, unit);
};

export function EconomicPulseCheck() {
  const {
    data: economicData,
    isLoading,
    error
  } = useQuery<EconomicDataResponse>({
    queryKey: ['/api/macroeconomic-indicators'],
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

    if (!economicData?.indicators) return pulseData;

    // Process indicators that have z-scores exceeding 0.5 standard deviation
    economicData.indicators.forEach(indicator => {
      if (indicator.zScore && Math.abs(indicator.zScore) >= 0.5) {
        // Parse numeric values from formatted strings
        const currentValueStr = indicator.currentReading.replace(/[^\d.\-]/g, '');
        const priorValueStr = indicator.priorReading.replace(/[^\d.\-]/g, '');
        const currentValue = parseFloat(currentValueStr) || 0;
        const priorValue = parseFloat(priorValueStr) || 0;
        
        // Parse variance handling parentheses for negative values
        let varianceValue = 0;
        if (indicator.varianceVsPrior && indicator.varianceVsPrior !== 'N/A') {
          const varianceStr = indicator.varianceVsPrior.replace(/[^\d.\-()]/g, '');
          if (varianceStr.includes('(') && varianceStr.includes(')')) {
            varianceValue = -parseFloat(varianceStr.replace(/[()]/g, ''));
          } else {
            varianceValue = parseFloat(varianceStr) || 0;
          }
        }
        
        const pulseMetric: PulseMetric = {
          name: indicator.metric,
          currentValue: currentValue,
          priorValue: priorValue,
          zScore: indicator.zScore,
          formattedValue: indicator.currentReading,
          formattedPriorValue: indicator.priorReading,
          periodDate: indicator.releaseDate || '',
          changeFromPrior: varianceValue,
          formattedChange: indicator.varianceVsPrior || 'N/A'
        };

        if (pulseData[indicator.category]) {
          if (indicator.zScore > 0.5) {
            pulseData[indicator.category].positive.push(pulseMetric);
          } else if (indicator.zScore < -0.5) {
            pulseData[indicator.category].negative.push(pulseMetric);
          }
        }
      }
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
            <span>Statistical Alert System</span>
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
            <span>Statistical Alert System</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load statistical analysis. Please try again.</p>
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
          <span>Statistical Alert System</span>
        </CardTitle>
        <p className="text-gray-400 text-sm mt-1">
          Statistical alerts for indicators exceeding 0.5 standard deviations from historical mean
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
                          <div className="flex justify-between items-start mb-2">
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
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">Prior:</span> <span className="text-white">{metric.formattedPriorValue}</span>
                              <span className="ml-2 text-gray-500">Change:</span> <span className={`ml-1 ${metric.changeFromPrior && metric.changeFromPrior >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>{metric.formattedChange}</span>
                            </div>
                            <div className="text-gray-500">
                              {metric.periodDate !== 'N/A' ? new Date(metric.periodDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
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
                          <div className="flex justify-between items-start mb-2">
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
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">Prior:</span> <span className="text-white">{metric.formattedPriorValue}</span>
                              <span className="ml-2 text-gray-500">Change:</span> <span className={`ml-1 ${metric.changeFromPrior && metric.changeFromPrior >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>{metric.formattedChange}</span>
                            </div>
                            <div className="text-gray-500">
                              {metric.periodDate !== 'N/A' ? new Date(metric.periodDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
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