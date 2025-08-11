import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketSignal {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength?: number;
}

function SignalBadge({ signal }: { signal: string }) {
  const config = {
    BUY: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: TrendingUp },
    SELL: { bg: 'bg-red-500/20', text: 'text-red-400', icon: TrendingDown },
    NEUTRAL: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Minus }
  }[signal] || { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Minus };

  const IconComponent = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium", config.bg, config.text)}>
      <IconComponent className="h-3 w-3" />
      {signal}
    </div>
  );
}

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function formatChange(change: number, changePercent: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
}

export function ETFSignals() {
  const { data, isLoading, error } = useQuery<{ etfMovers: { gainers: MarketSignal[], losers: MarketSignal[] } }>({
    queryKey: ['/api/top-movers'],
    refetchInterval: 60000,
    staleTime: 50000
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data?.etfMovers) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">Unable to load signals</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  const topSignals = [...(data.etfMovers.gainers || []), ...(data.etfMovers.losers || [])]
    .slice(0, 5);

  if (topSignals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">No signals right now</p>
        <p className="text-sm mt-1">Market in neutral territory</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="etf-signals">
      {topSignals.map((signal, i) => (
        <div key={`${signal.symbol}-${i}`} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="font-medium text-white">{signal.symbol}</div>
            <SignalBadge signal={signal.signal} />
          </div>
          <div className="text-right">
            <div className="font-medium text-white">{formatPrice(signal.price)}</div>
            <div className={cn("text-sm", 
              signal.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {formatChange(signal.change, signal.changePercent)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EconomicPulse() {
  const { data, isLoading, error } = useQuery<{ indicators: any[] }>({
    queryKey: ['/api/macroeconomic-indicators'],
    refetchInterval: 30 * 60 * 1000,
    staleTime: 25 * 60 * 1000
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data?.indicators) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">Unable to load economic data</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  const topIndicators = (data.indicators || []).slice(0, 5);

  if (topIndicators.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">No economic updates</p>
        <p className="text-sm mt-1">Waiting for data refresh</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="economic-pulse">
      {topIndicators.map((indicator, i) => (
        <div key={`${indicator.metric}-${i}`} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex-1">
            <div className="font-medium text-white text-sm">{indicator.metric}</div>
            <div className="text-xs text-gray-400">{indicator.period}</div>
          </div>
          <div className="text-right">
            <div className="font-medium text-white">{indicator.value}</div>
            <div className={cn("text-sm", 
              indicator.trend === 'up' ? 'text-emerald-400' : 
              indicator.trend === 'down' ? 'text-red-400' : 'text-gray-400'
            )}>
              {indicator.change || '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}