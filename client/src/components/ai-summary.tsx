import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Brain, TrendingUp, Activity, Loader2 } from 'lucide-react';

interface EconomicEvent {
  title: string;
  actual: string;
  forecast: string;
  date: string;
  category: string;
}

interface AISummaryData {
  summary: string;
  keyInsights: string[];
  recentEconomicReadings: EconomicEvent[];
  riskLevel: 'low' | 'moderate' | 'high';
  confidence: number;
}

export function AISummary() {
  const { data: aiSummary, isLoading, error } = useQuery<AISummaryData>({
    queryKey: ['/api/ai-summary'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="text-blue-400" size={24} />
          <h2 className="text-xl font-semibold text-white">AI Market Summary</h2>
        </div>
        <div className="text-red-400 text-sm">
          Unable to generate AI summary. Please check your OpenAI API configuration.
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="text-blue-400" size={24} />
          <h2 className="text-xl font-semibold text-white">AI Market Summary</h2>
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
          <Loader2 className="animate-spin" size={16} />
          <span>Analyzing momentum data and economic readings...</span>
        </div>
      </Card>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-gain-green';
      case 'moderate': return 'text-yellow-400';
      case 'high': return 'text-loss-red';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Brain className="text-blue-400" size={24} />
          <h2 className="text-xl font-semibold text-white">AI Market Summary</h2>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Activity size={16} className="text-blue-400" />
            <span className="text-gray-300">Risk Level:</span>
            <span className={`font-semibold ${getRiskColor(aiSummary?.riskLevel || 'moderate')}`}>
              {aiSummary?.riskLevel?.toUpperCase() || 'MODERATE'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-gray-300">Confidence:</span>
            <span className="font-semibold text-white">{aiSummary?.confidence}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Main Summary */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Market Overview</h3>
          <p className="text-gray-300 leading-relaxed">{aiSummary?.summary}</p>
        </div>

        {/* Key Insights */}
        {aiSummary?.keyInsights && aiSummary.keyInsights.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Key Insights</h3>
            <ul className="space-y-2">
              {aiSummary.keyInsights.map((insight: string, index: number) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span 
                    className="text-gray-300"
                    dangerouslySetInnerHTML={{ __html: insight }}
                  ></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent Economic Readings */}
        {aiSummary?.recentEconomicReadings && aiSummary.recentEconomicReadings.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Recent Economic Readings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiSummary.recentEconomicReadings.map((event, index) => (
                <div key={index} className="bg-financial-gray/20 p-3 rounded border border-financial-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{event.title}</span>
                    <span className="text-xs text-gray-400">{event.date}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-blue-400">{event.actual}</span>
                    <span className="text-gray-500">vs</span>
                    <span className="text-gray-300">{event.forecast} forecast</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-financial-border">
        <p className="text-xs text-gray-400">
          Generated by OpenAI GPT-4o • Analysis based on RSI momentum data and recent economic readings • Updated every 5 minutes
        </p>
      </div>
    </Card>
  );
}