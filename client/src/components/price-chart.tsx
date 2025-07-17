import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from "react";
import type { StockData, TechnicalIndicators } from "@/types/financial";

interface ChartData {
  date: string;
  price: number;
  timestamp: string;
}

const timeframes = [
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '1Y', value: '1Y' },
];

export function PriceChart() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1W');

  const { data: stockHistory } = useQuery<StockData[]>({
    queryKey: ['/api/stocks/SPY/history', { limit: 30 }],
    refetchInterval: 30000,
  });

  const { data: technical } = useQuery<TechnicalIndicators>({
    queryKey: ['/api/technical/SPY'],
    refetchInterval: 60000,
  });

  const chartData: ChartData[] = stockHistory?.map(item => ({
    date: new Date(item.timestamp).toLocaleDateString(),
    price: parseFloat(item.price),
    timestamp: item.timestamp.toString(),
  })) || [];

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">SPY Price Chart</CardTitle>
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
        <div className="bg-financial-card rounded-lg p-4 h-80">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickFormatter={(value) => value.split('/').slice(0, 2).join('/')}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#2D2D2D',
                    border: '1px solid #404040',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading chart data...
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
