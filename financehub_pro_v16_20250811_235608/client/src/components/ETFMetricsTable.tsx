import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, BarChart3, Zap, Volume2, DollarSign } from "lucide-react";
import { TechnicalIndicatorLegend } from './TechnicalIndicatorLegend';
import { Sparkline } from '@/components/ui/sparkline';
import { formatNumber } from '@/lib/utils';
import { getZScoreColor, formatZScore } from '../lib/zscoreUtils';

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
  
  // Weighted Technical Indicator Scoring System
  weightedScore: number | null;
  weightedSignal: string | null;
  
  // Multi-Horizon Z-Score data from enhanced system
  zScoreData: {
    rsiZScore: number | null;
    macdZScore: number | null;
    bollingerZScore: number | null;
    atrZScore: number | null;
    priceMomentumZScore: number | null;
    maTrendZScore: number | null;
    compositeZScore: number | null;
    shortTermZScore: number | null;    // 63-day horizon
    mediumTermZScore: number | null;   // 252-day horizon  
    longTermZScore: number | null;     // 756-day horizon
    ultraLongZScore: number | null;    // 1260-day horizon
    signal: string | null;
    regimeAware: boolean | null;       // Indicates multi-horizon analysis
  } | null;
  
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
  maGap: number | null;
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
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Sparkline container component with harmonized scaling
function SparklineContainer({ symbol }: { symbol: string }) {
  const { data: sparklineData, isLoading } = useQuery({
    queryKey: ['sparkline', symbol],
    queryFn: async () => {
      const response = await fetch(`/api/stocks/${symbol}/sparkline`);
      if (!response.ok) throw new Error('Failed to fetch sparkline data');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="h-8 w-24 bg-gray-700 rounded animate-pulse" />
    );
  }

  if (!sparklineData?.success || !sparklineData.data?.length) {
    return (
      <div className="text-xs text-gray-500">No data</div>
    );
  }

  // Use normalized data if available, otherwise use raw data
  const chartData = sparklineData.normalizedData || sparklineData.data;

  return (
    <div className="flex flex-col items-center">
      <Sparkline 
        data={chartData}
        trend={sparklineData.trend}
        height={32}
        width="80px"
        className="mb-1"
      />
      <div className={`text-xs font-medium ${
        sparklineData.change >= 0 ? 'text-green-400' : 'text-red-400'
      }`}>
        {sparklineData.change >= 0 ? '+' : ''}{sparklineData.change?.toFixed(1)}%
      </div>
    </div>
  );
}

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

// Helper function for safe number formatting with null handling
const safeFormatNumber = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return formatNumber(value, decimals);
};

// Individual ETF Row Component
function ETFRow({ etf }: { etf: ETFMetrics }) {
  const rsiStatus = getRSIStatus(etf.rsi);
  const bollingerStatus = getBollingerStatus(etf.bollingerPosition);
  
  // Signal color mapping
  const getSignalColor = (signal: string) => {
    if (signal === 'BULLISH' || signal === 'BUY') return 'text-green-400';
    if (signal === 'BEARISH' || signal === 'SELL') return 'text-red-400';
    return 'text-yellow-400';
  };

  // Format percentage change
  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Format price
  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${(price/1000).toFixed(1)}k`;
    return `$${price.toFixed(2)}`;
  };

  // Safe format number function
  const safeFormatNumber = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
      <td className="py-3 px-1">
        <div className="flex flex-col">
          <span className="font-medium text-white">{etf.symbol}</span>
          <span className="text-xs text-gray-400 truncate max-w-[80px]">{etf.name}</span>
        </div>
      </td>
      <td className="py-3 px-1">
        <div className="flex flex-col">
          <span className="text-white font-medium">{formatPrice(etf.price)}</span>
          <span className={`text-xs font-medium ${etf.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(etf.changePercent)}
          </span>
        </div>
      </td>

      {/* Signal Column - Most important column with special styling */}
      <td className="py-3 px-1 text-center bg-blue-900/40 border-2 border-blue-400/30">
        <div className="flex flex-col items-center">
          <span className={`text-lg font-bold font-mono ${
            (etf.zScoreData?.compositeZScore || 0) >= 0.75 ? 'text-green-400' :
            (etf.zScoreData?.compositeZScore || 0) <= -0.75 ? 'text-red-400' : 
            'text-yellow-400'
          }`}>
            {safeFormatNumber(etf.zScoreData?.compositeZScore, 3)}
          </span>
          <span className={`text-sm font-bold mt-1 px-3 py-1 rounded-md ${
            (etf.zScoreData?.compositeZScore || 0) >= 0.75 ? 'bg-green-800/50 text-green-300 border border-green-600' :
            (etf.zScoreData?.compositeZScore || 0) <= -0.75 ? 'bg-red-800/50 text-red-300 border border-red-600' :
            'bg-gray-800/50 text-yellow-300 border border-yellow-600'
          }`}>
            {(etf.zScoreData?.compositeZScore || 0) >= 0.75 ? 'BUY' :
             (etf.zScoreData?.compositeZScore || 0) <= -0.75 ? 'SELL' : 'HOLD'}
          </span>
        </div>
      </td>

      {/* MACD with Z-Score (35%) - Highest weight */}
      <td className="py-3 px-1 text-center bg-purple-900/20">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-white">
            MACD
          </span>
          <span className="text-xs text-gray-400">
            Signal
          </span>
          <span className={`text-xs font-mono mt-1 ${getZScoreColor('macdZ', etf.zScoreData?.macdZScore)}`}>
            Z: {formatZScore(etf.zScoreData?.macdZScore, 3)}
          </span>
        </div>
      </td>

      {/* RSI with Z-Score (25%) */}
      <td className="py-3 px-1 text-center bg-purple-900/20">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-white">
            {etf.rsi ? etf.rsi.toFixed(1) : 'N/A'}
          </span>
          <span className={`text-xs ${rsiStatus.color}`}>
            RSI
          </span>
          <span className={`text-xs font-mono mt-1 ${getZScoreColor('rsiZ', etf.zScoreData?.rsiZScore)}`}>
            Z: {formatZScore(etf.zScoreData?.rsiZScore, 3)}
          </span>
        </div>
      </td>

      {/* Bollinger with Z-Score (15%) */}
      <td className="py-3 px-1 text-center bg-purple-900/20">
        <div className="flex flex-col items-center">
          <span className={`text-sm font-medium ${bollingerStatus.color}`}>
            Bollinger
          </span>
          <span className="text-xs text-gray-400">
            %B: {etf.bollingerPosition ? (etf.bollingerPosition * 100).toFixed(0) + '%' : 'N/A'}
          </span>
          <span className={`text-xs font-mono mt-1 ${getZScoreColor('bollZ', etf.zScoreData?.bollingerZScore)}`}>
            Z: {formatZScore(etf.zScoreData?.bollingerZScore, 3)}
          </span>
        </div>
      </td>

      {/* MA Trend with Z-Score (20%) */}
      <td className="py-3 px-1 text-center bg-purple-900/20">
        <div className="flex flex-col items-center">
          <span className={`text-sm font-medium ${(etf.maGap || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            MA Trend
          </span>
          <span className="text-xs text-gray-400">
            Gap: {formatPercent(etf.maGap)}
          </span>
          <span className={`text-xs font-mono mt-1 ${getZScoreColor('maGapZ', etf.zScoreData?.maTrendZScore)}`}>
            Z: {formatZScore(etf.zScoreData?.maTrendZScore, 3)}
          </span>
        </div>
      </td>

      {/* Price Momentum with Z-Score (5%) */}
      <td className="py-3 px-1 text-center bg-purple-900/20">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-white">
            5-Day
          </span>
          <span className={`text-xs ${
            (etf.fiveDayReturn || 0) > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatPercent(etf.fiveDayReturn)}
          </span>
          <span className={`text-xs font-mono mt-1 ${getZScoreColor('mom5dZ', etf.zScoreData?.priceMomentumZScore)}`}>
            Z: {formatZScore(etf.zScoreData?.priceMomentumZScore, 3)}
          </span>
        </div>
      </td>
    </tr>
  );
}

export default function ETFMetricsTable() {
  // Database-first ETF metrics API call
  const { data: etfMetricsResponse, isLoading, error } = useQuery<any>({
    queryKey: ['/api/etf-metrics'],
    staleTime: 30000, // 30 seconds
    refetchInterval: 120000, // 2 minutes  
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Extract ETF metrics data - simplified and robust
  const etfMetrics = useMemo(() => {
    console.log('🔍 Fresh ETF Data Extraction:', { 
      hasResponse: !!etfMetricsResponse,
      response: etfMetricsResponse 
    });
    
    if (!etfMetricsResponse?.success) {
      console.log('❌ No successful response');
      return [];
    }
    
    // Try data field first
    const dataArray = etfMetricsResponse.data;
    if (Array.isArray(dataArray) && dataArray.length > 0) {
      console.log('✅ SUCCESS: Using data field with', dataArray.length, 'ETFs');
      return dataArray;
    }
    
    // Try metrics field as fallback
    const metricsArray = etfMetricsResponse.metrics;
    if (Array.isArray(metricsArray) && metricsArray.length > 0) {
      console.log('✅ SUCCESS: Using metrics field with', metricsArray.length, 'ETFs');
      return metricsArray;
    }
    
    console.warn('❌ FAILED: No valid ETF array found');
    return [];
  }, [etfMetricsResponse]);

  // Show loading only if we truly have no data yet
  if (isLoading && etfMetrics.length === 0) {
    return (
      <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="etf-metrics-loading">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>
          <span className="text-sm text-blue-400">Loading from database...</span>
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Show non-blocking empty state only for actual errors
  if (error) {
    console.error('ETF Metrics API Error:', error);
    return (
      <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="etf-metrics-error">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>
          <span className="text-sm text-red-400">Unable to load data</span>
        </div>
        <p className="text-gray-400">API request failed</p>
      </div>
    );
  }

  // Debug logging for troubleshooting
  console.log('🚨 FINAL RENDER DECISION:', {
    etfMetricsLength: etfMetrics.length,
    etfMetricsType: typeof etfMetrics,
    etfMetricsIsArray: Array.isArray(etfMetrics),
    isLoading,
    hasError: !!error,
    firstETF: etfMetrics[0]?.symbol || 'none'
  });

  // Show table if we have data, loading if still fetching, empty state only if error or no data after loading
  const hasData = etfMetrics.length > 0;
  
  // Show loading state if no data yet and still loading
  if (isLoading && !hasData) {
    return (
      <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="etf-metrics-loading">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>
          <span className="text-sm text-blue-400">Loading...</span>
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Show table if we have data
  if (hasData) {
    return (
      <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="etf-metrics-table">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>
            <span className="text-sm text-gray-400">({etfMetrics.length} ETFs)</span>
          </div>
          <TechnicalIndicatorLegend />
        </div>

        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
          <p className="text-sm text-gray-300">
            <strong className="text-white">Color Guide:</strong> 
            <span className="text-green-400 font-medium">Green = Good/Buy signals</span>, 
            <span className="text-yellow-400 font-medium">Yellow = Neutral/Caution</span>, 
            <span className="text-red-400 font-medium">Red = Bad/Sell signals</span>. 
            <br />
            <strong className="text-white">Metrics:</strong> 
            <strong className="text-white"> Signal</strong> - Optimized Z-Score Weighted System (MACD 35%, RSI 25%, MA Trend 20%, Bollinger 15%, Price Momentum 5%, ATR 0%). BUY ≥0.75, SELL ≤-0.75, HOLD -0.75 to 0.75. Dynamic thresholds adjust for market volatility.
            <strong className="text-white"> Bollinger</strong> - Price position in bands (oversold=good, overbought=bad). 
            <strong className="text-white"> RSI</strong> - Momentum oscillator (≤30=oversold/good, ≥70=overbought/bad).
            <strong className="text-white"> Volatility</strong> - Price variation indicator. 
            <strong className="text-white"> MA Gap</strong> - SMA20 vs SMA50 spread (positive=uptrend).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 px-1 text-gray-300 font-medium">Symbol</th>
                <th className="text-left py-2 px-1 text-gray-300 font-medium">Price</th>
                <th className="text-center py-2 px-1 text-blue-300 font-bold bg-blue-900/40 border-2 border-blue-400">Signal</th>
                <th className="text-center py-2 px-1 text-purple-300 font-medium bg-purple-900/20">MACD (35%)</th>
                <th className="text-center py-2 px-1 text-purple-300 font-medium bg-purple-900/20">RSI (25%)</th>
                <th className="text-center py-2 px-1 text-purple-300 font-medium bg-purple-900/20">MA Trend (20%)</th>
                <th className="text-center py-2 px-1 text-purple-300 font-medium bg-purple-900/20">Bollinger (15%)</th>
                <th className="text-center py-2 px-1 text-purple-300 font-medium bg-purple-900/20">5-Day (5%)</th>
              </tr>
            </thead>
            <tbody>
              {etfMetrics.map((etf) => (
                <ETFRow key={etf.symbol} etf={etf} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state only if not loading and no data
  if (!hasData) {
    return (
      <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="etf-metrics-empty">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>

        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <span className="text-gray-400">
              No ETF data available
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700 p-6" data-testid="etf-metrics-table">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">ETF Technical Metrics</h3>
          <span className="text-sm text-gray-400">({etfMetrics.length} ETFs)</span>
        </div>
        <TechnicalIndicatorLegend />
      </div>

      <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
        <p className="text-sm text-gray-300">
          <strong className="text-white">Color Guide:</strong> 
          <span className="text-green-400 font-medium">Green = Good/Buy signals</span>, 
          <span className="text-yellow-400 font-medium">Yellow = Neutral/Caution</span>, 
          <span className="text-red-400 font-medium">Red = Bad/Sell signals</span>. 
          <br />
          <strong className="text-white">Metrics:</strong> 
          <strong className="text-white"> Signal</strong> - Optimized Z-Score Weighted System (MACD 35%, RSI 25%, MA Trend 20%, Bollinger 15%, Price Momentum 5%, ATR 0%). BUY ≥0.75, SELL ≤-0.75, HOLD -0.75 to 0.75. Dynamic thresholds adjust for market volatility.
          <strong className="text-white"> Bollinger</strong> - Price position in bands (oversold=good, overbought=bad). 
          <strong className="text-white"> ATR</strong> - Volatility measure. 
          <strong className="text-white"> MA Trend</strong> - Bull/bear crossover signals. 
          <strong className="text-white"> RSI</strong> - Momentum (oversold=good, overbought=bad). 
          <strong className="text-white"> Z-Score Composite</strong> - Enhanced statistical normalization with 252-day institutional-grade window using 10-year historical datasets (2015-2025) for reliable scale-independent signals.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-600">
              <th className="text-left p-3 font-medium text-white sticky left-0 bg-gray-800/50 z-10">ETF</th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-[120px]">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>30-Day Trend</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-gray-300 min-w-[100px] bg-gray-700/80">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>Signal</span>
                </div>
              </th>
              <th className="text-center p-3 font-medium text-blue-300 min-w-[140px] bg-blue-900/20">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>Multi-Horizon Z-Score</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">ST/MT/LT/UL</div>
              </th>
              <th className="text-center p-3 font-medium text-purple-300 min-w-[120px] bg-purple-900/20">
                <div className="flex items-center justify-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>RSI</span>
                </div>
                <div className="text-xs text-gray-400">(25%)</div>
              </th>
              <th className="text-center p-3 font-medium text-purple-300 min-w-[120px] bg-purple-900/20">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>MACD</span>
                </div>
                <div className="text-xs text-gray-400">(35%)</div>
              </th>
              <th className="text-center p-3 font-medium text-purple-300 min-w-[120px] bg-purple-900/20">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>Bollinger</span>
                </div>
                <div className="text-xs text-gray-400">(15%)</div>
              </th>
              <th className="text-center p-3 font-medium text-purple-300 min-w-[120px] bg-purple-900/20">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>MA Trend</span>
                </div>
                <div className="text-xs text-gray-400">(20%)</div>
              </th>
              <th className="text-center p-3 font-medium text-purple-300 min-w-[120px] bg-purple-900/20">
                <div className="flex items-center justify-center gap-1">
                  <Zap className="h-4 w-4" />
                  <span>Price Mom</span>
                </div>
                <div className="text-xs text-gray-400">(5%)</div>
              </th>
              <th className="text-center p-3 font-medium text-purple-300 min-w-[90px] bg-purple-900/30">
                <div className="text-xs font-bold">Composite Z</div>
                <div className="text-xs text-gray-400">Final Signal</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {etfMetrics.map((etf, index) => {
              const rsiResult = getRSIStatus(etf.rsi);
              // Get color based on backend bollingerStatus text instead of calculating from position
              const getBollingerColor = (status: string): string => {
                if (status === 'Oversold') return 'text-green-400'; // Good - buy signal
                if (status === 'Overbought') return 'text-red-400'; // Bad - sell signal
                if (status === 'Strong' || status === 'Weak') return 'text-yellow-400'; // Neutral - caution
                return 'text-yellow-400'; // Neutral (includes 'No Data', 'Neutral', etc.)
              };

              return (
                <tr key={etf.symbol} className={`border-b border-gray-600 hover:bg-gray-800/50 ${index % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-800/30'}`}>
                  {/* ETF Column */}
                  <td className="p-3 sticky left-0 bg-gray-900/95 z-10 border-r border-gray-600">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{etf.symbol}</span>
                      <span className="text-xs text-gray-400">{etf.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-sm font-medium text-white">
                          ${etf.price > 0 ? etf.price.toFixed(2) : 'Loading...'}
                        </span>
                        <span className={`text-xs ${etf.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercentage(etf.changePercent)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Sparkline Column */}
                  <td className="p-3 text-center">
                    <SparklineContainer symbol={etf.symbol} />
                  </td>

                  {/* Weighted Signal Column - Dark and prominent */}
                  <td className="p-3 text-center bg-gray-700/80">
                    <div className="flex flex-col items-center">
                      <span className={`inline-block px-3 py-2 rounded-lg text-sm font-bold border-2 ${
                        etf.zScoreData?.signal === 'BUY' ? 'bg-green-900/50 text-green-300 border-green-500' : 
                        etf.zScoreData?.signal === 'SELL' ? 'bg-red-900/50 text-red-300 border-red-500' : 
                        'bg-gray-800/50 text-yellow-300 border-yellow-500'
                      }`}>
                        {etf.zScoreData?.signal || 'HOLD'}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        Z: {formatNumber(etf.zScoreData?.compositeZScore, 2)}
                      </span>
                      {etf.zScoreData?.regimeAware && (
                        <span className="text-xs bg-blue-900/50 text-blue-300 px-1 rounded mt-1">
                          Multi-Horizon
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Multi-Horizon Z-Score Analysis (New Feature) */}
                  <td className="p-3 text-center bg-blue-900/20">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-blue-300 font-semibold mb-1">Multi-Horizon Analysis</span>
                      {etf.zScoreData?.regimeAware ? (
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className="text-left">
                            <span className="text-gray-400">ST:</span> 
                            <span className={`ml-1 ${
                              (etf.zScoreData.shortTermZScore || 0) > 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              {formatNumber(etf.zScoreData.shortTermZScore, 2)}
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-gray-400">MT:</span> 
                            <span className={`ml-1 ${
                              (etf.zScoreData.mediumTermZScore || 0) > 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              {formatNumber(etf.zScoreData.mediumTermZScore, 2)}
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-gray-400">LT:</span> 
                            <span className={`ml-1 ${
                              (etf.zScoreData.longTermZScore || 0) > 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              {formatNumber(etf.zScoreData.longTermZScore, 2)}
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-gray-400">UL:</span> 
                            <span className={`ml-1 ${
                              (etf.zScoreData.ultraLongZScore || 0) > 0 ? 'text-green-300' : 'text-red-300'
                            }`}>
                              {formatNumber(etf.zScoreData.ultraLongZScore, 2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Legacy Analysis</span>
                      )}
                    </div>
                  </td>

                  {/* Bollinger Bands */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-medium ${getBollingerColor(etf.bollingerStatus)}`}>
                        {etf.bollingerStatus}
                      </span>
                      <span className="text-xs text-gray-400">
                        %B: {formatNumber(etf.bollingerPosition, 3)}
                      </span>
                      {etf.zScoreData?.bollingerZScore !== null && etf.zScoreData?.bollingerZScore !== undefined && (
                        <span className={`text-xs font-mono mt-1 ${
                          etf.zScoreData.bollingerZScore > 0 ? 'text-red-300' :
                          etf.zScoreData.bollingerZScore < 0 ? 'text-green-300' : 'text-gray-300'
                        }`}>
                          Z: {formatNumber(etf.zScoreData.bollingerZScore, 2)}
                        </span>
                      )}
                      {etf.bollingerSqueeze && (
                        <span className="text-xs bg-yellow-900/50 text-yellow-300 px-1 rounded mt-1">
                          Squeeze
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ATR/Volatility */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-white">
                        {formatNumber(etf.atr, 2)}
                      </span>
                      <span className="text-xs text-gray-400">
                        Vol: {formatPercentage(etf.volatility)}
                      </span>
                      {etf.zScoreData?.atrZScore !== null && etf.zScoreData?.atrZScore !== undefined && (
                        <span className={`text-xs font-mono mt-1 ${
                          etf.zScoreData.atrZScore > 0 ? 'text-red-300' :
                          etf.zScoreData.atrZScore < 0 ? 'text-green-300' : 'text-gray-300'
                        }`}>
                          Z: {formatNumber(etf.zScoreData.atrZScore, 2)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* MA Trend */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-medium ${
                        etf.maTrend === 'bullish' ? 'text-green-400' : 
                        etf.maTrend === 'bearish' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {etf.maSignal}
                      </span>
                      {etf.maGap !== null && (
                        <span className="text-xs text-gray-300 mt-1">
                          Gap: {formatNumber(etf.maGap, 2)}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        {etf.maTrend === 'bullish' ? (
                          <TrendingUp className="h-3 w-3 text-green-400" />
                        ) : etf.maTrend === 'bearish' ? (
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        ) : (
                          <Activity className="h-3 w-3 text-gray-400" />
                        )}
                      </div>
                      {etf.zScoreData?.maTrendZScore !== null && etf.zScoreData?.maTrendZScore !== undefined && (
                        <span className={`text-xs font-mono mt-1 ${
                          etf.zScoreData.maTrendZScore > 0 ? 'text-green-300' :
                          etf.zScoreData.maTrendZScore < 0 ? 'text-red-300' : 'text-gray-300'
                        }`}>
                          Z: {formatNumber(etf.zScoreData.maTrendZScore, 2)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* RSI */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-white">
                        {formatNumber(etf.rsi, 1)}
                      </span>
                      <span className={`text-xs ${
                        rsiResult.color.includes('green') ? 'text-green-400' :
                        rsiResult.color.includes('red') ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {etf.rsiSignal}
                      </span>
                      {etf.zScoreData?.rsiZScore !== null && etf.zScoreData?.rsiZScore !== undefined && (
                        <span className={`text-xs font-mono mt-1 ${
                          etf.zScoreData.rsiZScore > 0 ? 'text-red-300' :
                          etf.zScoreData.rsiZScore < 0 ? 'text-green-300' : 'text-gray-300'
                        }`}>
                          Z: {formatNumber(etf.zScoreData.rsiZScore, 2)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Individual Z-Score Components */}
                  {/* RSI Z-Score (25%) */}
                  <td className="p-3 text-center bg-purple-900/20">
                    <span className={`text-sm font-mono ${
                      (etf.zScoreData?.rsiZScore || 0) > 0 ? 'text-red-300' :
                      (etf.zScoreData?.rsiZScore || 0) < 0 ? 'text-green-300' : 'text-gray-300'
                    }`}>
                      {formatNumber(etf.zScoreData?.rsiZScore, 3)}
                    </span>
                  </td>

                  {/* MACD Z-Score (35%) */}
                  <td className="p-3 text-center bg-purple-900/20">
                    <span className={`text-sm font-mono ${
                      (etf.zScoreData?.macdZScore || 0) > 0 ? 'text-green-300' :
                      (etf.zScoreData?.macdZScore || 0) < 0 ? 'text-red-300' : 'text-gray-300'
                    }`}>
                      {formatNumber(etf.zScoreData?.macdZScore, 3)}
                    </span>
                  </td>

                  {/* Bollinger Z-Score (15%) */}
                  <td className="p-3 text-center bg-purple-900/20">
                    <span className={`text-sm font-mono ${
                      (etf.zScoreData?.bollingerZScore || 0) > 0 ? 'text-red-300' :
                      (etf.zScoreData?.bollingerZScore || 0) < 0 ? 'text-green-300' : 'text-gray-300'
                    }`}>
                      {formatNumber(etf.zScoreData?.bollingerZScore, 3)}
                    </span>
                  </td>

                  {/* MA Trend Z-Score (20%) */}
                  <td className="p-3 text-center bg-purple-900/20">
                    <span className={`text-sm font-mono ${
                      (etf.zScoreData?.maTrendZScore || 0) > 0 ? 'text-green-300' :
                      (etf.zScoreData?.maTrendZScore || 0) < 0 ? 'text-red-300' : 'text-gray-300'
                    }`}>
                      {formatNumber(etf.zScoreData?.maTrendZScore, 3)}
                    </span>
                  </td>

                  {/* Price Momentum Z-Score (5%) */}
                  <td className="p-3 text-center bg-purple-900/20">
                    <span className={`text-sm font-mono ${
                      (etf.zScoreData?.priceMomentumZScore || 0) > 0 ? 'text-green-300' :
                      (etf.zScoreData?.priceMomentumZScore || 0) < 0 ? 'text-red-300' : 'text-gray-300'
                    }`}>
                      {formatNumber(etf.zScoreData?.priceMomentumZScore, 3)}
                    </span>
                  </td>

                  {/* ATR Z-Score (0% - not used) */}
                  <td className="p-3 text-center bg-purple-900/20">
                    <span className="text-sm font-mono text-gray-500">
                      {formatNumber(etf.zScoreData?.atrZScore, 3)}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">Not Used</div>
                  </td>

                  {/* Composite Z-Score - Final weighted result */}
                  <td className="p-3 text-center bg-purple-900/30">
                    <div className="flex flex-col items-center">
                      <span className={`text-base font-bold font-mono ${
                        (etf.zScoreData?.compositeZScore || 0) > 0.5 ? 'text-green-400' :
                        (etf.zScoreData?.compositeZScore || 0) < -0.5 ? 'text-red-400' : 
                        'text-yellow-400'
                      }`}>
                        {formatNumber(etf.zScoreData?.compositeZScore, 3)}
                      </span>
                      <span className={`text-xs font-medium mt-1 px-2 py-1 rounded ${
                        etf.zScoreData?.signal === 'BUY' ? 'bg-green-800/50 text-green-300' :
                        etf.zScoreData?.signal === 'SELL' ? 'bg-red-800/50 text-red-300' :
                        'bg-gray-800/50 text-yellow-300'
                      }`}>
                        {etf.zScoreData?.signal || 'HOLD'}
                      </span>
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