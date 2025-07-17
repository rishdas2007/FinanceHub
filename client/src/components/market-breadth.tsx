import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { useETF } from "@/context/etf-context";

interface MarketIndicatorsData {
  spy_vwap: number;
  nasdaq_vwap: number;
  dow_vwap: number;
  mcclellan_oscillator: number;
  spy_rsi: number;
  nasdaq_rsi: number;
  dow_rsi: number;
  williams_r: number;
}

export function MarketBreadth() {
  const { selectedETF } = useETF();
  
  // Get market indicators data
  const { data: indicatorsData, isLoading } = useQuery<MarketIndicatorsData>({
    queryKey: ['/api/market-indicators'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !indicatorsData) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Market Breadth Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 py-8">Loading market indicators...</div>
        </CardContent>
      </Card>
    );
  }

  const indicators = [
    {
      title: 'S&P 500 VWAP',
      value: `$${indicatorsData.spy_vwap.toFixed(2)}`,
      subtitle: 'Volume Weighted Average Price',
      isPositive: true
    },
    {
      title: 'NASDAQ VWAP', 
      value: `$${indicatorsData.nasdaq_vwap.toFixed(2)}`,
      subtitle: 'Volume Weighted Average Price',
      isPositive: true
    },
    {
      title: 'DOW VWAP',
      value: `$${indicatorsData.dow_vwap.toFixed(2)}`,
      subtitle: 'Volume Weighted Average Price', 
      isPositive: true
    },
    {
      title: 'McClellan Oscillator',
      value: indicatorsData.mcclellan_oscillator.toFixed(1),
      subtitle: 'Momentum Indicator',
      isPositive: indicatorsData.mcclellan_oscillator > 0,
      isDanger: indicatorsData.mcclellan_oscillator < -50
    },
    {
      title: 'S&P 500 RSI',
      value: indicatorsData.spy_rsi.toFixed(1),
      subtitle: '14-day RSI',
      isWarning: indicatorsData.spy_rsi > 70 || indicatorsData.spy_rsi < 30
    },
    {
      title: 'NASDAQ RSI',
      value: indicatorsData.nasdaq_rsi.toFixed(1), 
      subtitle: '14-day RSI',
      isWarning: indicatorsData.nasdaq_rsi > 70 || indicatorsData.nasdaq_rsi < 30
    },
    {
      title: 'DOW RSI',
      value: indicatorsData.dow_rsi.toFixed(1),
      subtitle: '14-day RSI',
      isWarning: indicatorsData.dow_rsi > 70 || indicatorsData.dow_rsi < 30
    },
    {
      title: 'Williams %R',
      value: indicatorsData.williams_r.toFixed(1),
      subtitle: 'Momentum Oscillator',
      isDanger: indicatorsData.williams_r < -80,
      isWarning: indicatorsData.williams_r > -20
    }
  ];

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Market Breadth Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {indicators.map((indicator, index) => (
            <div key={index} className="bg-financial-card p-4 rounded-lg text-center">
              <div className="text-sm text-gray-400 mb-1">{indicator.title}</div>
              <div className={`text-2xl font-bold mb-1 ${
                indicator.isPositive ? 'text-gain-green' : 
                indicator.isWarning ? 'text-warning-yellow' : 
                indicator.isDanger ? 'text-loss-red' : 'text-white'
              }`}>
                {indicator.value}
              </div>
              <div className="text-xs text-gray-500">{indicator.subtitle}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>
            Market breadth indicators including VWAP levels, RSI momentum readings, McClellan Oscillator, 
            and Williams %R across major indices. VWAP shows volume-weighted price levels, 
            RSI above 70 suggests overbought conditions, McClellan tracks market momentum.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
