import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { useETF } from "@/context/etf-context";

interface MarketBreadthData {
  id: number;
  advancingIssues: number;
  decliningIssues: number;
  advancingVolume: string;
  decliningVolume: string;
  newHighs: number;
  newLows: number;
  mcclellanOscillator: string | null;
  timestamp: string;
}

export function MarketBreadth() {
  const { selectedETF } = useETF();
  const { data: breadthData, isLoading } = useQuery<MarketBreadthData>({
    queryKey: ['/api/market-breadth'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get technical data for the selected ETF  
  const { data: technical } = useQuery({
    queryKey: ['/api/technical', selectedETF.symbol],
    refetchInterval: 60000,
  });

  if (isLoading || !breadthData) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">{selectedETF.symbol} Market Breadth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 py-8">Loading market breadth data...</div>
        </CardContent>
      </Card>
    );
  }

  const advDeclineRatio = (breadthData.advancingIssues / breadthData.decliningIssues).toFixed(2);
  const newHighLowRatio = breadthData.newLows > 0 ? (breadthData.newHighs / breadthData.newLows).toFixed(2) : 'N/A';
  const mcclellan = breadthData.mcclellanOscillator ? parseFloat(breadthData.mcclellanOscillator) : 0;
  
  const marketBreadthData = [
    { 
      label: 'Advancing', 
      value: breadthData.advancingIssues.toLocaleString(), 
      description: 'NYSE Up',
      isPositive: breadthData.advancingIssues > breadthData.decliningIssues
    },
    { 
      label: 'Declining', 
      value: breadthData.decliningIssues.toLocaleString(), 
      description: 'NYSE Down',
      isDanger: breadthData.decliningIssues > breadthData.advancingIssues
    },
    { 
      label: 'A/D Ratio', 
      value: advDeclineRatio, 
      description: 'Market Breadth',
      isPositive: parseFloat(advDeclineRatio) > 1.5,
      isWarning: parseFloat(advDeclineRatio) < 1 && parseFloat(advDeclineRatio) > 0.7
    },
    { 
      label: 'New Highs', 
      value: breadthData.newHighs.toString(), 
      description: '52-week highs',
      isPositive: breadthData.newHighs > 100
    },
    { 
      label: 'New Lows', 
      value: breadthData.newLows.toString(), 
      description: '52-week lows',
      isDanger: breadthData.newLows > 100
    },
    { 
      label: 'Hi/Lo Ratio', 
      value: newHighLowRatio, 
      description: 'Strength',
      isPositive: parseFloat(newHighLowRatio) > 2,
      isWarning: parseFloat(newHighLowRatio) < 1 && newHighLowRatio !== 'N/A'
    },
    { 
      label: 'McClellan', 
      value: mcclellan.toFixed(1), 
      description: 'Momentum',
      isPositive: mcclellan > 50,
      isDanger: mcclellan < -50,
      isWarning: mcclellan >= -50 && mcclellan <= 50
    },
  ];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-white">{selectedETF.symbol} Market Breadth</CardTitle>
        <span className="text-xs text-gray-400">
          Updated: {formatTimestamp(breadthData.timestamp)}
        </span>
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
            Real-time market breadth data shows advancing vs declining issues on the NYSE, 
            new highs/lows ratios, and McClellan Oscillator momentum. Values above 1.5 for A/D ratio 
            indicate strong breadth; McClellan above 50 suggests bullish momentum.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
