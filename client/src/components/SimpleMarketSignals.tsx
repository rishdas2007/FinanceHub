import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ETFSignal {
  symbol: string;
  price: number;
  pctChange: number;
  zScore: number | null;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  spark: Array<{ t: number; value: number }>;
}

interface ETFMoversData {
  benchmark: ETFSignal;
  signals: ETFSignal[];
}

interface EconomicIndicator {
  seriesId: string;
  displayName: string;
  period: string;
  current: number;
  prior: number;
  vsPrior: number;
  zScore: number | null;
  spark12m: Array<{ t: number; value: number }>;
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

function formatPercent(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function SimpleSparkline({ data, trend }: { data: Array<{ t: number; value: number }>; trend?: 'up' | 'down' | 'neutral' }) {
  if (!data || data.length < 2) return null;
  
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 40;
    const y = 10 - ((d.value - min) / range) * 8;
    return `${x},${y}`;
  }).join(' ');
  
  const color = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';
  
  return (
    <svg width="42" height="12" className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1"
        points={points}
      />
    </svg>
  );
}

export function ETFSignals() {
  const { data, isLoading, error } = useQuery<ETFMoversData>({
    queryKey: ['/api/movers/etf'],
    refetchInterval: 60000,
    staleTime: 50000
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-12 bg-gray-800 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">Unable to load ETF signals</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  const { benchmark, signals } = data;
  const buySignals = signals.filter(s => s.signal === 'BUY');
  const sellSignals = signals.filter(s => s.signal === 'SELL');

  return (
    <div className="space-y-4" data-testid="etf-signals">
      {/* SPY Benchmark */}
      {benchmark && (
        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-400">{benchmark.symbol}</span>
              <span className="text-xs text-gray-400">BENCHMARK</span>
            </div>
            <SimpleSparkline 
              data={benchmark.spark} 
              trend={benchmark.pctChange >= 0 ? 'up' : 'down'} 
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">{formatPrice(benchmark.price)}</span>
            <span className={cn("text-sm font-medium", 
              benchmark.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {formatPercent(benchmark.pctChange)}
            </span>
          </div>
        </div>
      )}

      {/* BUY Signals */}
      {buySignals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            BUY SIGNALS ({buySignals.length})
          </h4>
          <div className="space-y-2">
            {buySignals.map((signal) => (
              <div key={signal.symbol} className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white text-sm">{signal.symbol}</span>
                  <SimpleSparkline 
                    data={signal.spark} 
                    trend={signal.pctChange >= 0 ? 'up' : 'down'} 
                  />
                  {signal.zScore !== null && (
                    <span className="text-xs text-emerald-400">Z: {signal.zScore.toFixed(1)}</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-white text-sm">{formatPrice(signal.price)}</div>
                  <div className={cn("text-xs", 
                    signal.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {formatPercent(signal.pctChange)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SELL Signals */}
      {sellSignals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            SELL SIGNALS ({sellSignals.length})
          </h4>
          <div className="space-y-2">
            {sellSignals.map((signal) => (
              <div key={signal.symbol} className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white text-sm">{signal.symbol}</span>
                  <SimpleSparkline 
                    data={signal.spark} 
                    trend={signal.pctChange >= 0 ? 'up' : 'down'} 
                  />
                  {signal.zScore !== null && (
                    <span className="text-xs text-red-400">Z: {signal.zScore.toFixed(1)}</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-white text-sm">{formatPrice(signal.price)}</div>
                  <div className={cn("text-xs", 
                    signal.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {formatPercent(signal.pctChange)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Signals State */}
      {buySignals.length === 0 && sellSignals.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No signals right now</p>
          <p className="text-xs mt-1">Market in neutral territory</p>
        </div>
      )}
    </div>
  );
}

export function EconomicPulse() {
  const { data, isLoading, error } = useQuery<EconomicIndicator[]>({
    queryKey: ['/api/movers/econ', { limit: 5 }],
    refetchInterval: 30 * 60 * 1000,
    staleTime: 25 * 60 * 1000
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="font-medium">Unable to load economic data</p>
        <p className="text-sm mt-1">Please try again later</p>
      </div>
    );
  }

  if (data.length === 0) {
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
      {data.map((indicator, i) => {
        const isPositive = indicator.vsPrior >= 0;
        const trendDirection = isPositive ? 'up' : 'down';
        const vsPriorFormatted = isPositive ? `+${indicator.vsPrior.toFixed(2)}` : indicator.vsPrior.toFixed(2);
        
        return (
          <div key={`${indicator.seriesId}-${i}`} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 pr-3">
                <div className="font-medium text-white text-sm leading-tight">{indicator.displayName}</div>
                <div className="text-xs text-gray-400 mt-1">{indicator.period}</div>
              </div>
              <div className="flex-shrink-0">
                <SimpleSparkline 
                  data={indicator.spark12m} 
                  trend={trendDirection}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-400">Current</div>
                <div className="text-white font-medium">{indicator.current.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400">Prior</div>
                <div className="text-gray-300">{indicator.prior.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400">vs Prior</div>
                <div className={cn("font-medium", 
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {vsPriorFormatted}
                </div>
              </div>
            </div>
            {indicator.zScore !== null && (
              <div className="mt-2 text-xs">
                <span className="text-gray-400">Z-Score: </span>
                <span className={cn("font-medium",
                  indicator.zScore > 1.5 ? 'text-red-400' :
                  indicator.zScore < -1.5 ? 'text-emerald-400' : 'text-gray-300'
                )}>
                  {indicator.zScore.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}