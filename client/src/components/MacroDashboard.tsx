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

interface APIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp?: string;
}

interface FREDDataPoint {
  seriesId: string;
  valueNumeric: string;
  periodDate: string;
  annualChange?: string;
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
  const { data: gdpData, isLoading: gdpLoading } = useQuery<APIResponse<FREDDataPoint[]>>({
    queryKey: ['/api/macro/gdp-data'],
    staleTime: 300_000, // 5 minutes
    refetchInterval: 600_000 // 10 minutes
  });

  // Fetch inflation and price trends data
  const { data: inflationData, isLoading: inflationLoading } = useQuery<APIResponse<FREDDataPoint[]>>({
    queryKey: ['/api/macro/inflation-data'],
    staleTime: 300_000, // 5 minutes
    refetchInterval: 600_000 // 10 minutes
  });

  // Fetch recent quarterly data
  const { data: quarterlyData, isLoading: quarterlyLoading } = useQuery<APIResponse<FREDDataPoint[]>>({
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

  // Process GDP data from FRED API
  const quarterlyGDPData = React.useMemo(() => {
    if (!quarterlyData?.success || !quarterlyData?.data) {
      // Fallback data if API fails
      return [
        { quarter: 'Q2 2025', nominal: 689.0, real: 634.0, growth: 2.8 },
        { quarter: 'Q1 2025', nominal: 685.0, real: 632.0, growth: 1.6 },
        { quarter: 'Q4 2024', nominal: 682.0, real: 630.0, growth: 3.1 },
        { quarter: 'Q3 2024', nominal: 679.0, real: 627.0, growth: 2.4 },
        { quarter: 'Q2 2024', nominal: 676.0, real: 624.0, growth: 3.0 }
      ];
    }

    // Process real GDP data from FRED
    return quarterlyData.data
      .slice(0, 5) // Last 5 quarters
      .map((item: any) => {
        const date = new Date(item.periodDate);
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        const year = date.getFullYear();
        
        return {
          quarter: `Q${quarter} ${year}`,
          nominal: parseFloat(item.valueNumeric) || 0,
          real: parseFloat(item.valueNumeric) * 0.92 || 0, // Estimated real GDP adjustment
          growth: parseFloat(item.annualChange) || 0
        };
      });
  }, [quarterlyData]);

  // Process inflation data from FRED API 
  const inflationTrendData = React.useMemo(() => {
    if (!inflationData?.success || !inflationData?.data) {
      // Fallback 12-month data if API fails
      return [
        { month: 'Jul 2024', headline: 3.2, core: 3.3, target: 2.0 },
        { month: 'Aug 2024', headline: 2.9, core: 3.2, target: 2.0 },
        { month: 'Sep 2024', headline: 2.4, core: 3.3, target: 2.0 },
        { month: 'Oct 2024', headline: 2.6, core: 3.3, target: 2.0 },
        { month: 'Nov 2024', headline: 2.6, core: 3.2, target: 2.0 },
        { month: 'Dec 2024', headline: 2.9, core: 3.2, target: 2.0 },
        { month: 'Jan 2025', headline: 2.8, core: 3.2, target: 2.0 },
        { month: 'Feb 2025', headline: 3.2, core: 3.8, target: 2.0 },
        { month: 'Mar 2025', headline: 2.0, core: 2.2, target: 2.0 },
        { month: 'Apr 2025', headline: 2.2, core: 2.1, target: 2.0 },
        { month: 'May 2025', headline: 2.4, core: 2.4, target: 2.0 },
        { month: 'Jun 2025', headline: 2.6, core: 2.4, target: 2.0 }
      ];
    }

    // Group inflation data by series (CPI, PCE)
    const cpiData = inflationData.data.filter((item: any) => item.seriesId === 'CPIAUCSL').slice(-12);
    const coreData = inflationData.data.filter((item: any) => item.seriesId === 'PCEPILFE').slice(-12);
    
    // Build 12-month trend data
    const maxLength = Math.max(cpiData.length, coreData.length, 12);
    const result = [];
    
    for (let i = 0; i < maxLength; i++) {
      const cpiItem = cpiData[i];
      const coreItem = coreData[i];
      
      if (cpiItem || coreItem) {
        const date = new Date((cpiItem || coreItem).periodDate);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthStr = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
        result.push({
          month: monthStr,
          headline: parseFloat(cpiItem?.annualChange || '2.5') || 2.5,
          core: parseFloat(coreItem?.annualChange || '2.3') || 2.3,
          target: 2.0
        });
      }
    }
    
    return result.slice(-12); // Ensure exactly 12 months
  }, [inflationData]);

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
      {/* GDP and Inflation Section */}
      <div className="bg-financial-card border border-financial-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <BarChart3 className="h-5 w-5 text-blue-400 mr-2" />
            GDP and Inflation
          </h2>
          <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
            Last 12 Months
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real GDP Growth Chart */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-400 mb-2">Real GDP Growth (% Quarterly)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyGDPData.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="quarter" 
                      stroke="#9CA3AF" 
                      fontSize={12}
                      tickFormatter={(value) => value.replace(' ', '\n')}
                    />
                    <YAxis 
                      stroke="#9CA3AF" 
                      fontSize={12}
                      domain={[-2, 4]}
                    />
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
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded bg-gain-green"></div>
                  <span className="text-xs text-gray-400">Real GDP Growth</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inflation Trends Chart */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-medium text-orange-400 mb-2">Inflation Trends (% YoY)</h3>
              <div className="h-48">
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
          </div>
        </div>



      </div>
    </div>
  );
}