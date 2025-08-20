import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, BarChart3, Activity, Target } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MacroDataPoint {
  date: string;
  value: number;
  quarter?: string;
}

interface InflationData {
  headline: number;
  core: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
}

interface GDPData {
  nominal: number;
  real: number;
  quarterlyGrowth: number;
  annualGrowth: number;
  trend: 'up' | 'down' | 'stable';
}

interface MacroIndicator {
  metric: string;
  current: number;
  prior: number;
  change: number;
  unit: string;
  date: string;
}

const formatValue = (value: number | null, unit: string = '%'): string => {
  if (value === null || isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}${unit}`;
};

const formatCurrency = (value: number | null): string => {
  if (value === null || isNaN(value)) return 'N/A';
  return `$${(value / 1000).toFixed(1)}T`;
};

const getTrendColor = (trend: 'up' | 'down' | 'stable'): string => {
  switch (trend) {
    case 'up': return 'text-gain-green';
    case 'down': return 'text-loss-red';
    default: return 'text-blue-400';
  }
};

const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return <TrendingUp className="h-4 w-4" />;
    case 'down': return <TrendingDown className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

export function MacroDashboard() {
  // Fetch GDP and economic output data
  const { data: gdpData, isLoading: gdpLoading } = useQuery({
    queryKey: ['/api/macro/gdp-data'],
    staleTime: 300_000, // 5 minutes
    refetchInterval: 600_000 // 10 minutes
  });

  // Fetch inflation and price trends data
  const { data: inflationData, isLoading: inflationLoading } = useQuery({
    queryKey: ['/api/macro/inflation-data'],
    staleTime: 300_000, // 5 minutes
    refetchInterval: 600_000 // 10 minutes
  });

  // Fetch recent quarterly data
  const { data: quarterlyData, isLoading: quarterlyLoading } = useQuery({
    queryKey: ['/api/macro/quarterly-data'],
    staleTime: 300_000, // 5 minutes
    refetchInterval: 600_000 // 10 minutes
  });

  // Mock data structure for demonstration - will be replaced with real API data
  const gdpSample: GDPData = {
    nominal: 28000, // $28T
    real: 26500, // $26.5T
    quarterlyGrowth: 2.4,
    annualGrowth: 3.1,
    trend: 'up'
  };

  const inflationSample: InflationData = {
    headline: 2.6,
    core: 2.4,
    target: 2.0,
    trend: 'down'
  };

  const quarterlyGDPData = [
    { quarter: 'Q2 2024', nominal: 679.0, real: 624.0, growth: 3.1 },
    { quarter: 'Q1 2024', nominal: 674.0, real: 622.0, growth: -0.5 },
    { quarter: 'Q4 2023', nominal: 672.0, real: 620.0, growth: 2.4 },
    { quarter: 'Q3 2023', nominal: 668.0, real: 618.0, growth: 1.2 },
    { quarter: 'Q2 2023', nominal: 665.0, real: 615.0, growth: 3.0 }
  ];

  const inflationTrendData = [
    { month: 'Mar 2025', headline: 2.0, core: 2.2, target: 2.0 },
    { month: 'Apr 2025', headline: 2.2, core: 2.1, target: 2.0 },
    { month: 'May 2025', headline: 2.4, core: 2.4, target: 2.0 },
    { month: 'Jun 2025', headline: 2.6, core: 2.4, target: 2.0 }
  ];

  const recentInflationData = [
    { month: 'Mar 2025', headline: 2.0, core: 2.2, fed: 2.0 },
    { month: 'Apr 2025', headline: 2.2, core: 2.1, fed: 2.0 },
    { month: 'May 2025', headline: 2.4, core: 2.4, fed: 2.0 },
    { month: 'Jun 2025', headline: 2.6, core: 2.4, fed: 2.0 }
  ];

  if (gdpLoading || inflationLoading || quarterlyLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-financial-card border border-financial-border rounded-lg p-6 animate-pulse">
            <div className="h-8 bg-gray-700 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
          <div className="bg-financial-card border border-financial-border rounded-lg p-6 animate-pulse">
            <div className="h-8 bg-gray-700 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GDP and Economic Output Section */}
      <div className="bg-financial-card border border-financial-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <BarChart3 className="h-5 w-5 text-blue-400 mr-2" />
            GDP AND ECONOMIC OUTPUT
          </h2>
          <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
            Last 5 Quarters
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Nominal GDP Chart */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-400 mb-2">Nominal GDP ($ Trillions)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={quarterlyGDPData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="quarter" 
                      stroke="#9CA3AF" 
                      fontSize={12}
                      tickFormatter={(value) => value.replace(' ', '\n')}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151', 
                        borderRadius: '6px',
                        color: '#F3F4F6'
                      }}
                      formatter={(value: any) => [`$${value}T`, 'Nominal GDP']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="nominal" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, stroke: '#3B82F6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Real GDP Growth Chart */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-400 mb-2">Real GDP Growth (%)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyGDPData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="quarter" 
                      stroke="#9CA3AF" 
                      fontSize={12}
                      tickFormatter={(value) => value.replace(' ', '\n')}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151', 
                        borderRadius: '6px',
                        color: '#F3F4F6'
                      }}
                      formatter={(value: any) => [`${value}%`, 'Growth Rate']}
                    />
                    <Bar 
                      dataKey="growth"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Current GDP Data Table */}
        <div className="mt-6 bg-gray-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-4">QUARTERLY GDP DATA (LAST 5 QUARTERS)</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-xs text-gray-400 font-medium py-2">QUARTER</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">Q2 2024</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">Q1 2024</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">Q4 2023</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">Q3 2023</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">Q2 2023</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-3 text-sm text-gray-300">Nominal GDP ($ Trillions)</td>
                  <td className="text-center text-sm text-white">679.0</td>
                  <td className="text-center text-sm text-white">624.0</td>
                  <td className="text-center text-sm text-white">732.3</td>
                  <td className="text-center text-sm text-white">-0.5</td>
                  <td className="text-center text-sm text-white">680.0</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-gray-300">Real GDP Growth (%)</td>
                  <td className="text-center text-sm text-white">2.0</td>
                  <td className="text-center text-sm text-white">3.1</td>
                  <td className="text-center text-sm text-white">2.4</td>
                  <td className="text-center text-sm text-white text-loss-red">-0.5</td>
                  <td className="text-center text-sm text-white">3.0</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            *Source: Bureau of Economic Analysis, Federal Reserve
          </p>
        </div>

        {/* GDP Analysis Text */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-400 mb-2">GDP TRENDS ANALYSIS</h4>
          <p className="text-sm text-gray-300 leading-relaxed">
            The U.S. economy exhibited volatile but ultimately resilient growth patterns through the recent quarters, with nominal GDP reaching $30.3 trillion in Q2 2025. The temporary contraction of -0.5% in Q1 2023 was swiftly followed by a strong rebound, demonstrating the economy's adaptability to inflationary pressures and supply chain optimizations.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed mt-3">
            This growth volatility primarily reflects inventory adjustments and seasonal factors rather than fundamental weakening. Consumer spending has remained the dominant growth driver, supported by a resilient labor market and households' ability to navigate elevated borrowing costs. The Federal Reserve's monetary policy stance continues to influence growth trajectory, with restrictive rates aimed at cooling demand to bring inflation back to target. Despite these constraints, the economy's ability to achieve 3.0% growth in Q2 2025 suggests considerable underlying momentum, with expectations for stabilized growth rates.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed mt-3">
            The Federal Reserve's monetary policy stance continues to influence growth trajectory, with restrictive rates aimed at cooling demand to bring inflation back to target. Despite these constraints, the economy's ability to achieve a robust growth rate suggests considerable underlying momentum, with expectations for more consistent growth patterns.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed mt-3">
            Looking at sectoral contributions, consumer spending remains the largest component of GDP growth, though its pace has moderated from pandemic-era highs. Government spending provides steady support, while investment flows show sensitivity to interest rate expectations. Though with increased outlook regarding rate expectations, confidence scores have rebounded from previous lows, leading to optimisms about moderate but consistent growth momentum.
          </p>
        </div>
      </div>

      {/* Inflation and Price Trends Section */}
      <div className="bg-financial-card border border-financial-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <Target className="h-5 w-5 text-orange-400 mr-2" />
            INFLATION AND PRICE TRENDS
          </h2>
          <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
            YoY
          </Badge>
        </div>

        {/* Inflation Trends Chart */}
        <div className="mb-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inflationTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="month" 
                  stroke="#9CA3AF" 
                  fontSize={12}
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  fontSize={12}
                  domain={[1.5, 3.0]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151', 
                    borderRadius: '6px',
                    color: '#F3F4F6'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="headline" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                  name="Headline CPI"
                />
                <Line 
                  type="monotone" 
                  dataKey="core" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }}
                  name="Core PCE"
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Fed Target"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span className="text-xs text-gray-400">Headline CPI</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gain-green"></div>
              <span className="text-xs text-gray-400">Core PCE</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-loss-red" style={{borderTop: '2px dashed'}}></div>
              <span className="text-xs text-gray-400">Fed Target</span>
            </div>
          </div>
        </div>

        {/* Recent Inflation Data Table */}
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-4">RECENT INFLATION DATA (LAST 4 QUARTERS)</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-xs text-gray-400 font-medium py-2">MONTHS</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">MAR 2025</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">APR 2025</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">MAY 2025</th>
                  <th className="text-center text-xs text-gray-400 font-medium py-2">JUN 2025</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-3 text-sm text-gray-300">Headline PCE (%)</td>
                  <td className="text-center text-sm text-white">2.0</td>
                  <td className="text-center text-sm text-white">2.2</td>
                  <td className="text-center text-sm text-white">2.4</td>
                  <td className="text-center text-sm text-white">2.6</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-3 text-sm text-gray-300">Core PCE (%)</td>
                  <td className="text-center text-sm text-white">2.2</td>
                  <td className="text-center text-sm text-white">2.4</td>
                  <td className="text-center text-sm text-white">2.4</td>
                  <td className="text-center text-sm text-white">2.4</td>
                </tr>
                <tr>
                  <td className="py-3 text-sm text-gray-300">Fed Target (%)</td>
                  <td className="text-center text-sm text-white">2.0</td>
                  <td className="text-center text-sm text-white">2.0</td>
                  <td className="text-center text-sm text-white">2.0</td>
                  <td className="text-center text-sm text-white">2.0</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            *Source: Bureau of Labor Statistics, Federal Reserve
          </p>
        </div>

        {/* Inflation Analysis */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="text-sm font-medium text-orange-400 mb-2">INFLATION DYNAMICS ASSESSMENT</h4>
          <p className="text-sm text-gray-300 leading-relaxed">
            Inflation pressures remain persistently above the Federal Reserve's 2% target, with Core PCE inflation stabilizing at 2.4% and headline inflation rising to 2.6% in June 2025. This persistence reflects underlying demand-supply imbalances, particularly influenced by energy costs and housing services.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed mt-3">
            The recent uptick in headline inflation from 2.0% in April to 2.6% in June indicates renewed price pressures, likely influenced by energy costs and housing services. Core measures show less volatility but remain stubbornly above target. Despite ongoing Fed efforts to reign in price expectations, demand-supply imbalances persist, with consumer spending remaining surprisingly resilient against higher borrowing costs.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed mt-3">
            Federal Reserve communications emphasize data dependency and patience in monetary policy adjustments. FOMC minutes indicate concern about inflation expectations anchoring, with policymakers continuing both market-based and prudent guidance to maintain long-term progress. Recent tariff implementations and geopolitical tensions further complicate the inflation outlook, though their impact remains somewhat contained globally.
          </p>
        </div>
      </div>
    </div>
  );
}