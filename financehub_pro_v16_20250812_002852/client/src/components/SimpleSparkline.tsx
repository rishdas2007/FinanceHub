import { Area, AreaChart, XAxis, YAxis } from 'recharts';

interface SimpleSparklineProps {
  data: Array<{ t: number; value: number }>;
  height?: number;
  width?: number;
  className?: string;
  trend?: number;
}

export function SimpleSparkline({ 
  data, 
  height = 32, 
  width = 120, 
  className = "",
  trend = 0 
}: SimpleSparklineProps) {
  
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs ${className}`} style={{ height, width }}>
        —
      </div>
    );
  }

  // Convert data to format expected by Recharts
  const chartData = data.map(point => ({
    timestamp: point.t,
    value: point.value
  }));

  // Determine color based on trend
  const isPositive = trend >= 0;
  const strokeColor = isPositive ? '#10b981' : '#ef4444'; // emerald-500 : red-500
  const fillColor = isPositive ? '#10b98120' : '#ef444420'; // with alpha

  return (
    <div className={className} style={{ height, width }}>
      <AreaChart width={width} height={height} data={chartData}>
        <defs>
          <linearGradient id={`gradient-${isPositive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="timestamp" 
          axisLine={false} 
          tickLine={false} 
          tick={false}
        />
        <YAxis 
          domain={['dataMin - 0.1', 'dataMax + 0.1']} 
          axisLine={false} 
          tickLine={false} 
          tick={false}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={1.5}
          fill={`url(#gradient-${isPositive ? 'pos' : 'neg'})`}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </div>
  );
}