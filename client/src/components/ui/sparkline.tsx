import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  trend?: 'up' | 'down' | 'flat';
  height?: number;
  width?: string;
  className?: string;
  showTooltip?: boolean;
  isFallback?: boolean; // FIX 6: Add fallback indicator
}

export function Sparkline({ 
  data, 
  trend = 'flat', 
  height = 40, 
  width = '100%',
  className,
  showTooltip = false,
  isFallback = false
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className={cn("bg-gray-800/30 rounded animate-pulse", className)}
        style={{ height, width }}
      />
    );
  }

  // Transform array of numbers to chart format
  const chartData = data.map((value, index) => ({ index, value }));

  const strokeColor = 
    trend === 'up' ? '#10B981' : // gain-green
    trend === 'down' ? '#EF4444' : // loss-red
    '#6B7280'; // neutral gray

  return (
    <div className={cn("relative", className)} style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            activeDot={showTooltip ? { r: 2, fill: strokeColor } : false}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {/* FIX 6: Fallback indicator badge */}
      {isFallback && (
        <div className="absolute top-0 right-0 text-xs bg-yellow-600 text-white px-1 rounded">
          Sample
        </div>
      )}
      
      {/* Overlay gradient for visual enhancement */}
      <div 
        className="absolute inset-0 pointer-events-none rounded"
        style={{
          background: `linear-gradient(to bottom, transparent 0%, ${strokeColor}10 100%)`
        }}
      />
    </div>
  );
}

export default Sparkline;