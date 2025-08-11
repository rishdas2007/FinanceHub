import { useQuery } from '@tanstack/react-query';
import { SimpleSparkline } from '../SimpleSparkline';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EtfMover {
  symbol: string;
  price: number | null;
  pctChange: number | null;
  zScore: number | null;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  spark: Array<{ t: number; value: number }>;
}

interface EtfMoversData {
  benchmark: EtfMover;
  signals: EtfMover[];
}

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `$${price.toFixed(2)}`;
}

function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(2)}%`;
}

function SignalBadge({ signal, zScore }: { signal: string; zScore: number | null }) {
  const config = {
    BUY: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: TrendingUp },
    SELL: { bg: 'bg-red-100', text: 'text-red-700', icon: TrendingDown },
    NEUTRAL: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Minus }
  }[signal] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: Minus };

  const IconComponent = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium", config.bg, config.text)}>
      <IconComponent className="h-3 w-3" />
      {signal}
      {Number.isFinite(zScore) && (
        <span className="ml-1 opacity-80">
          z={zScore!.toFixed(2)}
        </span>
      )}
    </div>
  );
}

export default function EtfMovers({ universe }: { universe?: string[] }) {
  const defaultUniverse = ['SPY', 'XLK', 'XLF', 'XLV', 'XLY', 'XLI', 'XLC', 'XLE', 'XLP', 'XLU', 'IYR', 'IWM'];
  const params = new URLSearchParams({
    universe: (universe?.length ? universe : defaultUniverse).join(','),
    horizon: '60D',
    limit: '12'
  }).toString();

  const { data, isLoading, error } = useQuery<{ data: EtfMoversData }>({
    queryKey: ['/api/movers/etf', params],
    refetchInterval: 60000, // 60s
    staleTime: 50000
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        <div className="grid md:grid-cols-2 gap-3">
          <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Unable to load ETF movers data</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  const { benchmark, signals } = data.data;

  return (
    <div className="space-y-4" data-testid="etf-movers-section">
      {/* Benchmark row */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <div className="font-semibold text-lg">S&P 500 (SPY)</div>
          <SignalBadge signal={benchmark?.signal || 'NEUTRAL'} zScore={benchmark?.zScore} />
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="font-medium">{formatPrice(benchmark?.price)}</div>
            <div className={cn("text-sm", 
              benchmark?.pctChange && benchmark.pctChange > 0 ? 'text-emerald-600' : 'text-red-600'
            )}>
              {formatPct(benchmark?.pctChange)}
            </div>
          </div>
          <div className="w-32 h-12">
            <SimpleSparkline 
              data={benchmark?.spark || []} 
              trend={benchmark?.pctChange || 0}
              height={48}
              width={128}
            />
          </div>
        </div>
      </div>

      {/* BUY / SELL signals */}
      <div className="grid md:grid-cols-2 gap-4">
        {['BUY', 'SELL'].map(signalType => {
          const filteredSignals = signals.filter((r: EtfMover) => r.signal === signalType);
          
          return (
            <div key={signalType} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", 
                  signalType === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'
                )} />
                <div className="font-semibold text-sm">
                  {signalType} Signals ({filteredSignals.length})
                </div>
              </div>
              
              <div className="space-y-3">
                {filteredSignals.map((signal: EtfMover) => (
                  <div key={signal.symbol} className="flex items-center justify-between text-sm">
                    <div className="w-12 font-medium">{signal.symbol}</div>
                    <div className="w-16 text-right">{formatPrice(signal.price)}</div>
                    <div className={cn("w-16 text-right", 
                      signal.pctChange && signal.pctChange > 0 ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {formatPct(signal.pctChange)}
                    </div>
                    <div className="w-24 h-8">
                      <SimpleSparkline 
                        data={signal.spark} 
                        trend={signal.pctChange || 0}
                        height={32}
                        width={96}
                      />
                    </div>
                    <div className="w-16 text-right text-xs text-gray-600 dark:text-gray-400">
                      {Number.isFinite(signal.zScore) ? `z=${signal.zScore!.toFixed(2)}` : '—'}
                    </div>
                  </div>
                ))}
                
                {filteredSignals.length === 0 && (
                  <div className="text-sm text-gray-500 py-4 text-center">
                    No {signalType.toLowerCase()} signals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}