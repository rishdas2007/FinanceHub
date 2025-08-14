import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';

interface SparklineData {
  t: number;
  date: string;
  value: number;
}

interface SparklineCellProps {
  api: string;
  params: {
    seriesId?: string;
    months?: number;
    transform?: string;
    symbol?: string;
    days?: number;
  };
  className?: string;
  height?: number;
  width?: number;
}

export function SparklineCell({ 
  api, 
  params, 
  className = "",
  height = 32,
  width = 120
}: SparklineCellProps) {
  
  // Build query string from params
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  ).toString();

  const { data, isLoading, error } = useQuery({
    queryKey: [api, queryString],
    queryFn: async () => {
      const response = await fetch(`${api}?${queryString}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for economic data
    refetchOnWindowFocus: false,
    // Force refresh if main data updates
    refetchInterval: 5 * 60 * 1000  // Check every 5 minutes
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height, width }}>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-full" />
      </div>
    );
  }

  // Error or no data state
  if (error || !data?.success || !data?.data || data.data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs ${className}`} style={{ height, width }}>
        —
      </div>
    );
  }

  const sparklineData = data.data as SparklineData[];
  
  // Determine trend direction for color
  const firstValue = sparklineData[0]?.value || 0;
  const lastValue = sparklineData[sparklineData.length - 1]?.value || 0;
  const isPositive = lastValue >= firstValue;

  return (
    <div className={`${className}`} style={{ height, width }}>
      <AreaChart
        width={width}
        height={height}
        data={sparklineData}
        margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
      >
        <XAxis 
          type="number" 
          dataKey="t" 
          hide 
          domain={['dataMin', 'dataMax']}
        />
        <YAxis 
          hide 
          domain={['dataMin', 'dataMax']}
        />
        <Area 
          dataKey="value"
          stroke={isPositive ? '#10b981' : '#ef4444'}
          strokeWidth={1.5}
          fill={isPositive ? '#10b98120' : '#ef444420'}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </div>
  );
}