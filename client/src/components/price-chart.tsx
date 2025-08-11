import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";
import { useETF } from "@/context/etf-context";
import type { StockData, TechnicalIndicators } from "@/types/financial";

interface ChartData {
  date: string;
  price: number;
  rsi: number;
  timestamp: string;
  formattedDate: string;
}

interface SparklineData {
  success: boolean;
  symbol: string;
  data: number[];
  trend: 'up' | 'down' | 'flat';
  change: number;
  timestamp: string;
}

const timeframes = [
  { label: '7D', value: '7D', days: 7 },
  { label: '30D', value: '30D', days: 30 },
  { label: '90D', value: '90D', days: 90 },
];

export function PriceChart() {
  const { selectedETF } = useETF();
  const [selectedTimeframe, setSelectedTimeframe] = useState('30D');
  
  const currentTimeframe = timeframes.find(t => t.value === selectedTimeframe) || timeframes[1];

  // Use sparkline API which has actual working data
  const { data: sparklineData, isLoading: historyLoading, error } = useQuery<SparklineData>({
    queryKey: [`/api/stocks/${selectedETF.symbol}/sparkline`],
    refetchInterval: false,
  });

  const { data: technical } = useQuery<TechnicalIndicators>({
    queryKey: [`/api/technical/${selectedETF.symbol}`],
    refetchInterval: false,
  });

  // FIX 3: Remove Random RSI - Calculate Real RSI
  const calculateRealRSI = (prices: number[], period: number = 14): number[] => {
    if (prices.length < period + 1) {
      return prices.map(() => 50); // Neutral RSI for insufficient data
    }

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsiValues: number[] = [];

    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }

    return rsiValues;
  };

  // Convert sparkline data to chart format
  const chartData: ChartData[] = (sparklineData?.data || []).map((price, index) => {
    const totalPoints = sparklineData?.data.length || 0;
    const daysAgo = totalPoints - 1 - index;
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - daysAgo);

    // Create chart data with actual sparkline prices
    const prices = sparklineData?.data || [];
    const rsiValues = calculateRealRSI(prices);

    return {
      price: Number(price),
      rsi: rsiValues[index] || 50,
      date: dateObj.toISOString().split('T')[0],
      timestamp: dateObj.toISOString(),
      formattedDate: dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
    };
  }).filter((_, index) => {
    // Filter based on selected timeframe - show most recent N points
    const totalPoints = sparklineData?.data.length || 0;
    const keepPoints = Math.min(currentTimeframe.days, totalPoints);
    return index >= totalPoints - keepPoints;
  });

  // Debug logging
  console.log('🔍 Sparkline Data Debug:', {
    sparklineData: sparklineData ? 'loaded' : 'missing',
    dataLength: sparklineData?.data?.length || 0,
    samplePrices: sparklineData?.data?.slice(0, 3) || [],
    chartDataLength: chartData.length,
    sampleChartData: chartData.slice(0, 2),
    selectedTimeframe,
    currentTimeframe
  });

  console.log(`📈 Final chart data sample:`, chartData.slice(0, 3));

  // ADD: Calculate percentage change for current timeframe
  const calculateStockPeriodChange = () => {
    if (!chartData || chartData.length < 2) return null;

    // Sort by date to ensure proper order
    const sortedData = [...chartData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstPrice = parseFloat(String(sortedData[0].price));
    const lastPrice = parseFloat(String(sortedData[sortedData.length - 1].price));

    if (firstPrice === 0) return null;

    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    const changeValue = lastPrice - firstPrice;

    return {
      percent: changePercent,
      value: changeValue,
      isPositive: changePercent >= 0,
      period: selectedTimeframe
    };
  };

  const stockPeriodChange = calculateStockPeriodChange();

  // Debug: Log the actual price range and date range for chart display
  if (chartData.length > 0) {
    const prices = chartData.map(d => d.price);
    const dates = chartData.map(d => d.formattedDate);
    const timestamps = chartData.map(d => d.timestamp);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    console.log(`📈 Stock Chart Debug:`, {
      stockHistoryLength: stockHistory?.length || 0,
      chartDataLength: chartData?.length || 0,
      sampleDates: chartData?.slice(0, 3).map(d => d.formattedDate) || [],
      periodChange: stockPeriodChange
    });
    console.log(`${selectedETF.symbol} Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
    console.log(`${selectedETF.symbol} Date Range:`, dates);
  }



  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              📈 {selectedETF.name} Price Chart
            </CardTitle>
            {/* ADD: Stock period change display */}
            {stockPeriodChange && (
              <p className="text-sm text-gray-400 mt-1">
                {stockPeriodChange.period} Change:
                <span className={`font-semibold ml-1 ${
                  stockPeriodChange.isPositive ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stockPeriodChange.isPositive ? '+' : ''}{stockPeriodChange.percent.toFixed(2)}%
                  (${stockPeriodChange.value.toFixed(2)})
                </span>
              </p>
            )}
          </div>

          {/* Existing timeframe buttons */}
          <div className="flex space-x-2">
            {timeframes.map((timeframe) => (
              <Button
                key={timeframe.value}
                variant={selectedTimeframe === timeframe.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe.value)}
                className={`text-xs font-medium transition-colors ${
                  selectedTimeframe === timeframe.value
                    ? 'bg-gain-green text-white hover:bg-green-600'
                    : 'bg-financial-card hover:bg-financial-border text-white border-financial-border'
                }`}
              >
                {timeframe.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-1 bg-gain-green rounded"></div>
            <span className="text-gray-400">{selectedETF.symbol} Price</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-1 bg-blue-500 rounded"></div>
            <span className="text-gray-400">RSI</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-1 bg-red-400 rounded"></div>
            <span className="text-gray-400">Overbought (70)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-1 bg-green-400 rounded"></div>
            <span className="text-gray-400">Oversold (30)</span>
          </div>
        </div>
        
        <div className="bg-financial-card rounded-lg p-4 h-80">
          {/* FIX 7: Add Chart Loading States */}
          {historyLoading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-600 rounded w-3/4 mb-4"></div>
              <div className="h-64 bg-gray-700/50 rounded"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 flex flex-col items-center justify-center h-full">
              <p className="mb-4">Error loading data: {error.message}</p>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : !sparklineData || !sparklineData.data || sparklineData.data.length === 0 ? (
            <div className="text-center text-gray-400 flex flex-col items-center justify-center h-full">
              <p className="mb-4">No price data available for {selectedETF.symbol}</p>
              <p className="text-sm">Sparkline Data: {sparklineData ? 'loaded' : 'missing'}</p>
              <p className="text-sm">Data Points: {sparklineData?.data?.length || 0}</p>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : chartData.length > 0 ? (
            <div className="w-full h-full">
              <div className="mb-2 text-xs text-gray-400">
                Chart Data: {chartData.length} points | Range: ${Math.min(...chartData.map(d => d.price)).toFixed(2)} - ${Math.max(...chartData.map(d => d.price)).toFixed(2)}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                  <XAxis 
                    dataKey="formattedDate" 
                    stroke="#9CA3AF"
                    fontSize={11}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    yAxisId="price"
                    orientation="left"
                    stroke="#9CA3AF"
                    fontSize={11}
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#2D2D2D',
                      border: '1px solid #404040',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'price') return [`$${value.toFixed(2)}`, 'Price'];
                      return [value, name];
                    }}
                  />
                  {/* Price Line */}
                  <Line 
                    yAxisId="price"
                    type="monotone" 
                    dataKey="price" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#10B981' }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p>Chart data length: {chartData.length}</p>
                <p>Sparkline data: {sparklineData?.data?.length || 0} points</p>
                <p>No chart data to display</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">RSI (14):</span>
            <span className="text-white font-medium ml-2">
              {technical?.rsi ? parseFloat(technical.rsi).toFixed(1) : '--'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">MACD:</span>
            <span className="text-white font-medium ml-2">
              {technical?.macd ? parseFloat(technical.macd).toFixed(3) : '--'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Volume:</span>
            <span className="text-gain-green font-medium ml-2">Active</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
