import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, BarChart3, Zap, Volume2, DollarSign } from "lucide-react";

interface ETFData {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  fiveDayChange?: number;
  oneMonthChange?: number;
  volume?: number;
}

interface TechnicalIndicators {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  percent_b: number | null;
  adx: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  sma_20: number | null;
  sma_50: number | null;
  vwap: number | null;
  atr: number | null;
  willr: number | null;
}

interface MomentumStrategy {
  ticker: string;
  sector: string;
  momentum: 'bullish' | 'bearish' | 'neutral';
  rsi: number;
  zScore: number;
  fiveDayZScore: number;
  sharpeRatio: number;
  volatility: number;
  oneDayChange: number;
  fiveDayChange: number;
  oneMonthChange: number;
  correlationToSPY: number;
  signal: string;
}

interface ETFMetrics {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  // Bollinger Bands & Position/Squeeze
  bollingerPosition: number | null; // %B
  bollingerSqueeze: boolean;
  bollingerStatus: string;
  // ATR & Volatility
  atr: number | null;
  volatility: number | null;
  // Moving Average (Trend)
  maSignal: string;
  maTrend: 'bullish' | 'bearish' | 'neutral';
  // RSI (Momentum)
  rsi: number | null;
  rsiSignal: string;
  rsiDivergence: boolean;
  // Z-Score, Sharpe, Returns
  zScore: number | null;
  sharpeRatio: number | null;
  fiveDayReturn: number | null;
  // Volume, VWAP, OBV
  volumeRatio: number | null;
  vwapSignal: string;
  obvTrend: string;
}

const ETF_LIST = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLF', name: 'Financial' },
  { symbol: 'XLI', name: 'Industrial' },
  { symbol: 'XLY', name: 'Consumer Discretionary' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' }
];

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatNumber = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined) return 'N/A';
  return value.toFixed(decimals);
};

const getRSIStatus = (rsi: number | null): { signal: string; color: string } => {
  if (rsi === null) return { signal: 'No Data', color: 'text-gray-500' };
  if (rsi >= 70) return { signal: 'Overbought', color: 'text-red-600' }; // Bad - sell signal
  if (rsi <= 30) return { signal: 'Oversold', color: 'text-green-600' }; // Good - buy signal
  if (rsi >= 60) return { signal: 'Strong', color: 'text-yellow-600' }; // Neutral - caution
  if (rsi <= 40) return { signal: 'Weak', color: 'text-yellow-600' }; // Neutral - caution
  return { signal: 'Neutral', color: 'text-yellow-600' }; // Neutral
};

const getBollingerStatus = (percentB: number | null): { status: string; squeeze: boolean; color: string } => {
  if (percentB === null) return { status: 'No Data', squeeze: false, color: 'text-gray-500' };
  
  const squeeze = percentB > 0.1 && percentB < 0.9; // Not near extremes = potential squeeze
  
  if (percentB >= 1.0) return { status: 'Above Upper', squeeze, color: 'text-red-600' }; // Bad - overbought
  if (percentB <= 0.0) return { status: 'Below Lower', squeeze, color: 'text-green-600' }; // Good - oversold
  if (percentB >= 0.8) return { status: 'Near Upper', squeeze, color: 'text-yellow-600' }; // Neutral - caution
  if (percentB <= 0.2) return { status: 'Near Lower', squeeze, color: 'text-yellow-600' }; // Neutral - caution
  return { status: 'Middle', squeeze, color: 'text-yellow-600' }; // Neutral
};

const getMASignal = (sma20: number | null, sma50: number | null, price: number): { signal: string; trend: 'bullish' | 'bearish' | 'neutral'; color: string } => {
  if (!sma20 || !sma50) return { signal: 'No Data', trend: 'neutral', color: 'text-gray-500' };
  
  const ma20AboveMA50 = sma20 > sma50;
  const priceAboveMA20 = price > sma20;
  const priceAboveMA50 = price > sma50;
  
  if (ma20AboveMA50 && priceAboveMA20 && priceAboveMA50) {
    return { signal: 'Strong Bull', trend: 'bullish', color: 'text-green-600' }; // Good
  }
  if (!ma20AboveMA50 && !priceAboveMA20 && !priceAboveMA50) {
    return { signal: 'Strong Bear', trend: 'bearish', color: 'text-red-600' }; // Bad
  }
  if (ma20AboveMA50) {
    return { signal: 'Bull Trend', trend: 'bullish', color: 'text-green-500' }; // Good
  }
  if (!ma20AboveMA50) {
    return { signal: 'Bear Trend', trend: 'bearish', color: 'text-red-500' }; // Bad
  }
  return { signal: 'Mixed', trend: 'neutral', color: 'text-yellow-600' }; // Neutral
};

const getVWAPSignal = (price: number, vwap: number | null): { signal: string; color: string; deviation: number | null } => {
  if (!vwap) return { signal: 'No Data', color: 'text-gray-500', deviation: null };
  
  const deviation = ((price - vwap) / vwap) * 100;
  
  if (deviation >= 2) return { signal: 'Strong Above', color: 'text-green-600', deviation }; // Good
  if (deviation <= -2) return { signal: 'Strong Below', color: 'text-red-600', deviation }; // Bad
  if (deviation > 0) return { signal: 'Above VWAP', color: 'text-green-500', deviation }; // Good
  if (deviation < 0) return { signal: 'Below VWAP', color: 'text-red-500', deviation }; // Bad
  return { signal: 'At VWAP', color: 'text-yellow-600', deviation }; // Neutral
};

export default function ETFMetricsTable() {
  // NEW: Single consolidated API call - Database-first approach
  const { data: etfMetricsResponse, isLoading, error } = useQuery<{ 
    success: boolean; 
    metrics: ETFMetrics[]; 
    count: number; 
    timestamp: string;
    source: string;
  }>({
    queryKey: ['/api/etf-metrics'],
    refetchInterval: 300000, // 5 minutes - respects database-first caching
    staleTime: 240000, // 4 minutes
    retry: 2,
  });

  const etfMetrics = useMemo(() => {
    if (!etfMetricsResponse?.success || !etfMetricsResponse?.metrics) {
      return [];
    }
    return etfMetricsResponse.metrics;
  }, [etfMetricsResponse]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="etf-metrics-loading">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900">ETF Technical Metrics</h3>
          <span className="text-sm text-blue-600">Loading from database...</span>
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !etfMetricsResponse?.success) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6" data-testid="etf-metrics-error">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">ETF Technical Metrics</h3>
          <span className="text-sm text-red-600">Database Error</span>
        </div>
        <p className="text-gray-600">Unable to load ETF metrics from database. Please refresh the page.</p>
      </div>
    );
  }

  if (!etfMetrics.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">ETF Technical Metrics</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <span className="text-gray-600">No ETF data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6" data-testid="etf-metrics-table">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">ETF Technical Metrics</h3>
        <span className="text-sm text-gray-500">({etfMetrics.length} ETFs)</span>
      </div>

      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-700">
          <strong>Color Guide:</strong> 
          <span className="text-green-600 font-medium">Green = Good/Buy signals</span>, 
          <span className="text-yellow-600 font-medium">Yellow = Neutral/Caution</span>, 
          <span className="text-red-600 font-medium">Red = Bad/Sell signals</span>. 
          <br />
          <strong>Metrics:</strong> 
          <strong> Bollinger</strong> - Price position in bands (oversold=good, overbought=bad). 
          <strong> ATR</strong> - Volatility measure. 
          <strong> MA Trend</strong> - Bull/bear crossover signals. 
          <strong> RSI</strong> - Momentum (oversold=good, overbought=bad). 
          <strong> Z-Score</strong> - Historical performance deviation. 
          <strong> VWAP</strong> - Price vs volume-weighted average.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3 font-medium text-gray-900 sticky left-0 bg-gray-50 z-10">ETF</th>
              <th className="text-center p-3 font-medium text-gray-700 min-w-[120px]">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>Bollinger Bands</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-gray-700 min-w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  <Zap className="h-4 w-4" />
                  <span>ATR/Volatility</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-gray-700 min-w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>MA Trend</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-gray-700 min-w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>RSI</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-gray-700 min-w-[120px]">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>Z-Score/Sharpe</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-gray-700 min-w-[120px]">
                <div className="flex items-center justify-center gap-1">
                  <Volume2 className="h-4 w-4" />
                  <span>VWAP Signal</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {etfMetrics.map((etf, index) => {
              const rsiResult = getRSIStatus(etf.rsi);
              const bollingerResult = getBollingerStatus(etf.bollingerPosition);
              const vwapResult = getVWAPSignal(etf.price, null); // Will be updated with actual VWAP data

              return (
                <tr key={etf.symbol} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                  {/* ETF Column */}
                  <td className="p-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{etf.symbol}</span>
                      <span className="text-xs text-gray-500">{etf.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-sm font-medium">${etf.price.toFixed(2)}</span>
                        <span className={`text-xs ${etf.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(etf.changePercent)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Bollinger Bands */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-medium ${bollingerResult.color}`}>
                        {etf.bollingerStatus}
                      </span>
                      <span className="text-xs text-gray-500">
                        %B: {formatNumber(etf.bollingerPosition, 3)}
                      </span>
                      {etf.bollingerSqueeze && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded mt-1">
                          Squeeze
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ATR/Volatility */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {formatNumber(etf.atr, 2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Vol: {formatPercentage(etf.volatility)}
                      </span>
                    </div>
                  </td>

                  {/* MA Trend */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-medium ${
                        etf.maTrend === 'bullish' ? 'text-green-600' : 
                        etf.maTrend === 'bearish' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {etf.maSignal}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        {etf.maTrend === 'bullish' ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : etf.maTrend === 'bearish' ? (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        ) : (
                          <Activity className="h-3 w-3 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </td>

                  {/* RSI */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {formatNumber(etf.rsi, 1)}
                      </span>
                      <span className={`text-xs ${rsiResult.color}`}>
                        {etf.rsiSignal}
                      </span>
                    </div>
                  </td>

                  {/* Z-Score/Sharpe */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-medium ${
                        etf.zScore && etf.zScore > 2 ? 'text-green-600' :
                        etf.zScore && etf.zScore < -2 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        Z: {formatNumber(etf.zScore, 2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Sharpe: {formatNumber(etf.sharpeRatio, 2)}
                      </span>
                      <span className={`text-xs ${
                        etf.fiveDayReturn && etf.fiveDayReturn > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        5d: {formatPercentage(etf.fiveDayReturn)}
                      </span>
                    </div>
                  </td>

                  {/* VWAP Signal */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-medium ${vwapResult.color}`}>
                        {etf.vwapSignal || vwapResult.signal}
                      </span>
                      {vwapResult.deviation !== null && (
                        <span className="text-xs text-gray-500">
                          {vwapResult.deviation > 0 ? '+' : ''}{vwapResult.deviation.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


    </div>
  );
}