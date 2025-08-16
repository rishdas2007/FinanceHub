import { useQuery } from '@tanstack/react-query';
import { SimpleSparkline } from '../SimpleSparkline';
import { Calendar, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EconMover {
  seriesId: string;
  displayName: string;
  transform: string;
  unit: string;
  period: string;
  current: number | null;
  prior: number | null;
  vsPrior: number | null;
  zScore: number | null;
  spark12m: Array<{ t: number; value: number }>;
}

// Note: formatValue function removed - now using backend pre-formatted values
// All economic indicators now use standard_unit formatting from API

function formatPeriod(period: string): string {
  const date = new Date(period);
  if (isNaN(date.getTime())) return period;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short'
  });
}

function formatVsPrior(vsPrior: number | null, transform?: string): string {
  if (vsPrior === null) return '—';
  
  const sign = vsPrior >= 0 ? '+' : '';
  
  // For YOY transforms, show as percentage points
  if (transform?.includes('YOY') || transform?.includes('PERCENT')) {
    return `${sign}${vsPrior.toFixed(2)}pp`;
  }
  
  return `${sign}${vsPrior.toFixed(2)}`;
}

function ZScoreBadge({ zScore }: { zScore: number | null }) {
  if (!Number.isFinite(zScore)) {
    return <span className="text-gray-400">—</span>;
  }

  const absZ = Math.abs(zScore!);
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';
  
  if (absZ >= 2) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  } else if (absZ >= 1) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
  }

  return (
    <span className={cn("px-2 py-1 rounded text-xs font-medium", bgColor, textColor)}>
      {zScore!.toFixed(2)}
    </span>
  );
}

export default function EconMovers({ limit = 5 }: { limit?: number }) {
  const { data, isLoading, error } = useQuery<{ data: EconMover[] }>({
    queryKey: ['/api/movers/econ', { limit }],
    refetchInterval: 30 * 60 * 1000, // 30 minutes
    staleTime: 25 * 60 * 1000 // 25 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Unable to load economic indicators</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  if (!data.data || data.data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">No economic updates</p>
        <p className="text-sm mt-1">No recent economic data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="econ-movers-section">
      {data.data.map((indicator) => (
        <div 
          key={indicator.seriesId} 
          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          {/* Name and Period */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {indicator.displayName}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {formatPeriod(indicator.period)}
            </div>
          </div>



          {/* Current Value */}
          <div className="text-right w-20">
            <div className="font-medium text-sm">
              {indicator.current !== null ? indicator.current.toFixed(2) : '—'}
            </div>
            <div className="text-xs text-gray-500">Current</div>
          </div>

          {/* Prior Value */}
          <div className="text-right w-20 mx-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {indicator.prior !== null ? indicator.prior.toFixed(2) : '—'}
            </div>
            <div className="text-xs text-gray-500">Prior</div>
          </div>

          {/* vs Prior */}
          <div className="text-right w-16">
            <div className={cn("text-sm font-medium",
              indicator.vsPrior && indicator.vsPrior > 0 ? 'text-emerald-600' : 
              indicator.vsPrior && indicator.vsPrior < 0 ? 'text-red-600' : 'text-gray-600'
            )}>
              {formatVsPrior(indicator.vsPrior, indicator.transform)}
            </div>
            <div className="text-xs text-gray-500">Change</div>
          </div>

          {/* Z-Score */}
          <div className="text-right w-16">
            <ZScoreBadge zScore={indicator.zScore} />
            <div className="text-xs text-gray-500 mt-1">z-score</div>
          </div>
        </div>
      ))}
    </div>
  );
}