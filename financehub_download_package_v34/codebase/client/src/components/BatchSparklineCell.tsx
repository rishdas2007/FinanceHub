import { useMemo } from 'react';
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines';
import { useSparklineData } from '../hooks/useBatchSparklines';

interface BatchSparklineCellProps {
  seriesId: string;
  batchData?: Record<string, any[]>;
  isLoading?: boolean;
  className?: string;
}

export function BatchSparklineCell({ seriesId, batchData, isLoading, className = '' }: BatchSparklineCellProps) {
  const { data, isLoading: sparklineLoading, error } = useSparklineData(seriesId, batchData);

  const sparklineColor = useMemo(() => {
    if (!data || data.length < 2) return '#6b7280'; // gray for no data
    
    const first = data[0]?.value || 0;
    const last = data[data.length - 1]?.value || 0;
    return last >= first ? '#10b981' : '#ef4444'; // green for up, red for down
  }, [data]);

  if (isLoading || sparklineLoading) {
    return (
      <div className={`h-8 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded ${className}`} />
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className={`h-8 w-16 flex items-center justify-center text-xs text-gray-400 ${className}`}>
        N/A
      </div>
    );
  }

  const values = data.map(d => d.value);

  return (
    <div className={`h-8 w-16 ${className}`}>
      <Sparklines data={values} width={64} height={32} margin={2}>
        <SparklinesLine 
          color={sparklineColor} 
          style={{ strokeWidth: 1.5, fill: 'none' }} 
        />
        <SparklinesSpots 
          size={2} 
          style={{ fill: sparklineColor, fillOpacity: 0.8 }} 
        />
      </Sparklines>
    </div>
  );
}