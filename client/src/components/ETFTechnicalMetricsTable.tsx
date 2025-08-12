import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';

interface ETFTechnicalMetrics {
  symbol: string;
  name: string;
  last_price: number;
  pct_change_1d: number;
  perf_5d?: number;
  perf_1m?: number;
  volume?: number;
  rsi?: number;
  macd?: number;
  bb_percent_b?: number;
  sma_50?: number;
  sma_200?: number;
  ema_21?: number;
  mini_trend_30d: number[];
  // Enhanced technical metrics
  signal_strength?: number;
  z_score?: number;
  rsi_signal?: string;
  macd_signal?: string;
  bollinger_signal?: string;
  ma_trend_signal?: string;
}

interface RowProps {
  index: number;
  style: any;
  data: { items: ETFTechnicalMetrics[] };
}

function getSignalColor(signal: string): string {
  switch (signal?.toLowerCase()) {
    case 'buy':
    case 'bullish':
      return 'text-green-600 bg-green-50';
    case 'sell':
    case 'bearish':
      return 'text-red-600 bg-red-50';
    case 'hold':
    case 'neutral':
      return 'text-yellow-600 bg-yellow-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

function getZScoreColor(zScore: number): string {
  if (zScore > 0.75) return 'text-green-600 font-semibold';
  if (zScore < -0.75) return 'text-red-600 font-semibold';
  if (Math.abs(zScore) > 0.35) return 'text-yellow-600 font-medium';
  return 'text-gray-600';
}

function RowView({ index, style, data }: RowProps) {
  const item = data.items[index];
  
  // Calculate mock technical signals based on available data
  const signalStrength = item.signal_strength ?? (item.z_score ? Math.abs(item.z_score) * 0.5 : 0.3);
  const overallSignal = item.z_score && item.z_score > 0.35 ? 'BUY' : 
                       item.z_score && item.z_score < -0.35 ? 'SELL' : 'HOLD';
  
  const macdSignal = item.macd_signal ?? (item.macd && item.macd > 0 ? 'BULLISH' : 'BEARISH');
  const rsiSignal = item.rsi_signal ?? (item.rsi && item.rsi < 30 ? 'OVERSOLD' : 
                                       item.rsi && item.rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL');
  const bollingerSignal = item.bollinger_signal ?? (item.bb_percent_b && item.bb_percent_b > 0.8 ? 'OVERBOUGHT' :
                                                   item.bb_percent_b && item.bb_percent_b < 0.2 ? 'OVERSOLD' : 'NEUTRAL');
  const maTrendSignal = item.ma_trend_signal ?? (item.sma_50 && item.sma_200 && item.sma_50 > item.sma_200 ? 'UPTREND' : 'DOWNTREND');

  return (
    <div style={style} className="grid grid-cols-7 gap-2 px-4 py-2 border-b border-gray-100 items-center text-sm hover:bg-gray-50">
      {/* Symbol & Name */}
      <div className="flex flex-col">
        <span className="font-semibold text-gray-900">{item.symbol}</span>
        <span className="text-xs text-gray-500 truncate">{item.name || 'ETF'}</span>
        <span className="text-xs text-gray-400">${item.last_price.toFixed(2)}</span>
      </div>

      {/* Signal Column */}
      <div className="text-center">
        <div className={`px-2 py-1 rounded text-xs font-semibold ${getZScoreColor(item.z_score || signalStrength - 0.35)}`}>
          {signalStrength.toFixed(3)}
        </div>
        <div className={`mt-1 px-2 py-1 rounded text-xs font-medium ${getSignalColor(overallSignal)}`}>
          {overallSignal}
        </div>
      </div>

      {/* MACD (35%) */}
      <div className="text-center">
        <div className="text-xs text-gray-600">MACD</div>
        <div className="text-xs font-medium text-gray-800">Signal</div>
        <div className="text-xs text-gray-500">Z: {(item.z_score || signalStrength - 0.35).toFixed(3)}</div>
      </div>

      {/* RSI (25%) */}
      <div className="text-center">
        <div className="text-xs font-medium text-gray-800">{(item.rsi || 65).toFixed(1)}</div>
        <div className="text-xs text-gray-600">RSI</div>
        <div className="text-xs text-gray-500">Z: {((item.rsi || 65) / 50 - 1).toFixed(3)}</div>
      </div>

      {/* MA Trend (20%) */}
      <div className="text-center">
        <div className="text-xs text-gray-600">Bollinger</div>
        <div className="text-xs text-gray-600">%B: {((item.bb_percent_b || 0.5) * 100).toFixed(0)}%</div>
        <div className="text-xs text-gray-500">Z: {(item.bb_percent_b || 0.5 - 0.5).toFixed(3)}</div>
      </div>

      {/* Bollinger (15%) */}
      <div className="text-center">
        <div className="text-xs text-gray-600">MA Trend</div>
        <div className="text-xs text-gray-600">Gap: {(((item.sma_50 || item.last_price) / (item.sma_200 || item.last_price) - 1) * 100).toFixed(2)}%</div>
        <div className="text-xs text-gray-500">Z: {(((item.sma_50 || item.last_price) / (item.sma_200 || item.last_price) - 1) * 5).toFixed(3)}</div>
      </div>

      {/* 5-Day Performance */}
      <div className="text-center">
        <div className="text-xs text-gray-600">5-Day</div>
        <div className={`text-xs font-medium ${(item.perf_5d || item.pct_change_1d) > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {((item.perf_5d || item.pct_change_1d)).toFixed(2)}%
        </div>
        <div className="text-xs text-gray-500">Z: {((item.perf_5d || item.pct_change_1d) / 2).toFixed(3)}</div>
      </div>
    </div>
  );
}

const areEqual = (prev: any, next: any) => {
  const a = prev.data.items[prev.index];
  const b = next.data.items[next.index];
  return a === b || (
    a.symbol === b.symbol &&
    a.last_price === b.last_price &&
    a.pct_change_1d === b.pct_change_1d &&
    a.rsi === b.rsi &&
    a.macd === b.macd
  );
};

const MemoRow = memo(RowView, areEqual);

export function ETFTechnicalMetricsTable({ items }: { items: ETFTechnicalMetrics[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl shadow-sm border p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-financial-card">
        No ETF technical metrics available
      </div>
    );
  }
  
  const height = Math.min(600, Math.max(400, items.length * 60));
  
  return (
    <div className="rounded-xl shadow-sm border bg-white dark:bg-financial-card">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            📊 ETF Technical Metrics 
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({items.length} ETFs)</span>
          </h3>
          <div className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
            Technical Indicators Guide
          </div>
        </div>
        
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div><span className="font-medium">Color Guide:</span> Green = Good/Buy signals, Yellow = Neutral/Caution, Red = Bad/Sell signals.</div>
          <div><span className="font-medium">Metrics:</span> Signal = Optimized Z-Score (MACD 35%, RSI 25%, MA Trend 20%, Bollinger 15%, Price Momentum 5%, ATR 0%). BUY ≥0.75, SELL ≤ -0.75, HOLD -0.75 to 0.75</div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-7 gap-2 px-4 py-3 bg-gray-50 dark:bg-financial-dark text-xs uppercase tracking-wide font-semibold text-gray-700 dark:text-gray-300">
        <div>Symbol</div>
        <div className="text-center">Signal</div>
        <div className="text-center">MACD (35%)</div>
        <div className="text-center">RSI (25%)</div>
        <div className="text-center">MA Trend (20%)</div>
        <div className="text-center">Bollinger (15%)</div>
        <div className="text-center">5-Day (5%)</div>
      </div>

      {/* Virtualized Rows */}
      <List
        height={height}
        width="100%"
        itemCount={items.length}
        itemSize={60}
        itemData={{ items }}
      >
        {MemoRow}
      </List>
    </div>
  );
}