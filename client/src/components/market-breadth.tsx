import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const marketBreadthData = [
  { label: 'S&P 500 VWAP', value: '$622.33', description: 'Volume Weighted' },
  { label: 'S&P 500 RSI', value: '64.2', description: '14-day RSI', isWarning: true },
  { label: 'NASDAQ VWAP', value: '$556.35', description: 'Volume Weighted' },
  { label: 'NASDAQ RSI', value: '68.5', description: '14-day RSI', isWarning: true },
  { label: 'DOW VWAP', value: '$440.87', description: 'Volume Weighted' },
  { label: 'DOW RSI', value: '72.3', description: '14-day RSI', isDanger: true },
  { label: 'McClellan', value: '46.7', description: 'Momentum', isPositive: true },
];

export function MarketBreadth() {
  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Market Breadth Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {marketBreadthData.map((item, index) => (
            <div key={index} className="bg-financial-card p-4 rounded-lg text-center">
              <div className={`text-xl font-bold ${
                item.isPositive ? 'text-gain-green' : 
                item.isWarning ? 'text-warning-yellow' : 
                item.isDanger ? 'text-loss-red' : 'text-white'
              }`}>
                {item.value}
              </div>
              <div className="text-sm text-gray-400">{item.label}</div>
              <div className="text-xs text-gray-500">{item.description}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>
            Market breadth indicators reveal the underlying health and momentum of major indices. 
            RSI readings above 70 indicate overbought conditions, below 30 suggest oversold levels, 
            with 50 being neutral. These technical indicators help identify potential momentum shifts 
            and market turning points.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
