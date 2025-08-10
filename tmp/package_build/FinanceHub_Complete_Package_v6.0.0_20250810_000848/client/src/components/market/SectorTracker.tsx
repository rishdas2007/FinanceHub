import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface SectorData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  fiveDayChange: number;
  oneMonthChange: number;
}

export function SectorTracker() {
  const { data: sectors, isLoading, error } = useQuery({
    queryKey: ['/api/sectors'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border p-6">
        <div className="text-red-400 text-sm">
          Unable to load sector data. Please check your connection.
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-gain-green" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-loss-red" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-gain-green';
    if (change < 0) return 'text-loss-red';
    return 'text-gray-400';
  };

  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="flex items-center space-x-3 mb-4">
        <TrendingUp className="text-blue-400" size={24} />
        <h2 className="text-xl font-semibold text-white">Sector Tracker</h2>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-4 text-xs font-medium text-gray-400 pb-2 border-b border-financial-border">
          <span>SECTOR</span>
          <span>SYMBOL</span>
          <span>PRICE</span>
          <span>1 DAY</span>
          <span>5 DAY</span>
          <span>1 MONTH</span>
        </div>

        {sectors?.map((sector: SectorData) => (
          <div key={sector.symbol} className="grid grid-cols-6 gap-4 items-center py-2 hover:bg-financial-gray/10 rounded transition-colors">
            <div className="text-sm font-medium text-white truncate">
              {sector.name.replace(' ETF', '').replace(' SPDR', '')}
            </div>
            <div className="text-sm text-blue-400 font-mono">
              {sector.symbol}
            </div>
            <div className="text-sm text-white font-mono">
              {formatCurrency(sector.price)}
            </div>
            <div className={`text-sm flex items-center space-x-1 ${getChangeColor(sector.changePercent)}`}>
              {getTrendIcon(sector.changePercent)}
              <span className="font-mono">
                {formatPercentage(sector.changePercent)}
              </span>
            </div>
            <div className={`text-sm font-mono ${getChangeColor(sector.fiveDayChange || 0)}`}>
              {formatPercentage(sector.fiveDayChange || 0)}
            </div>
            <div className={`text-sm font-mono ${getChangeColor(sector.oneMonthChange || 0)}`}>
              {formatPercentage(sector.oneMonthChange || 0)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}