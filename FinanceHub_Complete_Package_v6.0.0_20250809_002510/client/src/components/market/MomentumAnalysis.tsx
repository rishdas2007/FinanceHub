import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { MomentumTable } from './MomentumTable';
import { RiskReturnChart } from './RiskReturnChart';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorDisplay } from './ErrorDisplay';

export function MomentumAnalysis() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/momentum-analysis'],
    staleTime: 5 * 60 * 1000, // 5 minutes - standardized
    gcTime: 10 * 60 * 1000,   // 10 minutes cache retention
  });

  if (error) {
    return <ErrorDisplay message="Unable to load momentum analysis data" />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Analyzing momentum strategies..." />;
  }

  return (
    <div className="space-y-6">
      <MomentumTable strategies={data?.strategies || []} />
      <RiskReturnChart chartData={data?.chartData || []} />
    </div>
  );
}

// Sub-components for better organization
function MomentumTable({ strategies }: { strategies: any[] }) {
  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Momentum Strategies</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-financial-border">
              <th className="text-left text-gray-400 pb-2">SECTOR</th>
              <th className="text-left text-gray-400 pb-2">SYMBOL</th>
              <th className="text-left text-gray-400 pb-2">ANNUAL RETURN</th>
              <th className="text-left text-gray-400 pb-2">RSI</th>
              <th className="text-left text-gray-400 pb-2">SHARPE RATIO</th>
              <th className="text-left text-gray-400 pb-2">MOMENTUM</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((strategy, index) => (
              <MomentumRow key={index} strategy={strategy} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MomentumRow({ strategy }: { strategy: any }) {
  const getMomentumColor = (signal: string) => {
    if (signal.includes('bullish')) return 'text-gain-green';
    if (signal.includes('bearish')) return 'text-loss-red';
    return 'text-gray-400';
  };

  const getRSIColor = (rsi: number) => {
    if (rsi > 70) return 'text-loss-red';    // Overbought
    if (rsi < 30) return 'text-gain-green';  // Oversold
    return 'text-gray-300';                  // Neutral
  };

  return (
    <tr className="border-b border-financial-border/30 hover:bg-financial-gray/10 transition-colors">
      <td className="py-3 text-white">{strategy.name}</td>
      <td className="py-3 text-blue-400 font-mono">{strategy.symbol}</td>
      <td className="py-3 text-white font-mono">{(strategy.annualReturn * 100).toFixed(1)}%</td>
      <td className={`py-3 font-mono ${getRSIColor(strategy.rsi || 0)}`}>
        {strategy.rsi?.toFixed(1) || 'N/A'}
      </td>
      <td className="py-3 text-white font-mono">{strategy.sharpeRatio?.toFixed(2) || 'N/A'}</td>
      <td className={`py-3 text-sm ${getMomentumColor(strategy.momentumSignal || '')}`}>
        {strategy.momentumSignal || 'Neutral'}
      </td>
    </tr>
  );
}

function RiskReturnChart({ chartData }: { chartData: any[] }) {
  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Risk-Return Analysis</h3>
      
      <div className="h-64 bg-financial-gray/20 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">
          Interactive chart with {chartData.length} data points
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        Chart shows 1-Day Z-Score vs RSI analysis for sector momentum evaluation
      </div>
    </Card>
  );
}

function LoadingSpinner({ message }: { message: string }) {
  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
        <span className="text-gray-400">{message}</span>
      </div>
    </Card>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="text-red-400 text-sm">{message}</div>
    </Card>
  );
}