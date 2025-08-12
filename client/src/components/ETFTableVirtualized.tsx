import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';

type Row = {
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
};

function RowView({ data, index, style }: any) {
  const row: Row = data.items[index];
  return (
    <div style={style} className="grid grid-cols-8 px-3 py-2 border-b text-sm">
      <div className="font-mono">{row.symbol}</div>
      <div className="truncate">{row.name}</div>
      <div className="text-right">{row.last_price.toFixed(2)}</div>
      <div className={row.pct_change_1d >= 0 ? 'text-green-600 text-right' : 'text-red-600 text-right'}>
        {row.pct_change_1d.toFixed(2)}%
      </div>
      <div className="text-right">{(row.perf_5d ?? 0).toFixed(2)}%</div>
      <div className="text-right">{(row.perf_1m ?? 0).toFixed(2)}%</div>
      <div className="text-right">{row.volume?.toLocaleString() ?? '-'}</div>
      <div className="text-right">{(row.rsi ?? 0).toFixed(1)}</div>
    </div>
  );
}

const areEqual = (prev: any, next: any) => {
  const a = prev.data.items[prev.index];
  const b = next.data.items[next.index];
  return a === b ||
    (a.symbol === b.symbol &&
     a.last_price === b.last_price &&
     a.pct_change_1d === b.pct_change_1d &&
     a.perf_5d === b.perf_5d &&
     a.perf_1m === b.perf_1m &&
     a.volume === b.volume &&
     a.rsi === b.rsi);
};

const MemoRow = memo(RowView, areEqual);

export function ETFTableVirtualized({ items }: { items: Row[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl shadow-sm border p-8 text-center text-gray-500">
        No ETF data available
      </div>
    );
  }
  
  const height = Math.min(600, Math.max(300, items.length * 40));
  return (
    <div className="rounded-xl shadow-sm border bg-white dark:bg-financial-card">
      <div className="grid grid-cols-8 px-3 py-2 bg-gray-50 dark:bg-financial-dark text-xs uppercase tracking-wide font-medium">
        <div>Symbol</div><div>Name</div><div>Price</div><div>1D %</div><div>5D %</div><div>1M %</div><div>Volume</div><div>RSI</div>
      </div>
      <List
        height={height}
        width="100%"
        itemCount={items.length}
        itemSize={40}
        itemData={{ items }}
      >
        {MemoRow}
      </List>
    </div>
  );
}