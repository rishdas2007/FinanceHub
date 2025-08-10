import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smile, TrendingUp, Activity, RefreshCw } from "lucide-react";
import { useState } from "react";

interface MoodData {
  emoji: string;
  mood: string;
  confidence: number;
  reasoning: string;
  marketFactors: {
    momentum: string;
    technical: string;
    economic: string;
  };
  color: string;
}

export function FinancialMoodEmoji() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // First, check if momentum data is available
  const { data: momentumData, isLoading: momentumLoading } = useQuery({
    queryKey: ['/api/momentum-analysis'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  // Only fetch mood data after momentum data is available
  const { data: moodData, isLoading: moodLoading } = useQuery<MoodData>({
    queryKey: ['/api/financial-mood'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!momentumData, // Only run when momentum data is available
  });
  
  const isLoading = momentumLoading || moodLoading;

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Invalidate mood cache on server
      await fetch('/api/cache/invalidate?key=financial-mood');
      // Invalidate React Query cache
      await queryClient.invalidateQueries({ queryKey: ['/api/financial-mood'] });
    } catch (error) {
      console.error('Failed to refresh mood:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000); // Keep spinning for visual feedback
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smile className="h-5 w-5 text-blue-400" />
              <span>Financial Mood</span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              variant="outline"
              size="sm"
              className="bg-financial-card hover:bg-financial-border text-white border-financial-border text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="animate-pulse text-4xl">🤔</div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white mb-2">Analyzing</div>
              <div className="text-sm text-gray-400">
                {momentumLoading ? 'Waiting for market data...' : 'Processing financial mood...'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!moodData) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smile className="h-5 w-5 text-blue-400" />
              <span>Financial Mood</span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              variant="outline"
              size="sm"
              className="bg-financial-card hover:bg-financial-border text-white border-financial-border text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400 space-y-4">
            <div className="text-4xl mb-2">😐</div>
            <div>
              <p className="text-lg font-semibold text-white mb-2">Analyzing</p>
              <p className="text-sm">Market data is being processed. Please refresh for updated mood analysis.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="bg-financial-dark rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Momentum</div>
                <div className="text-sm font-semibold text-white">Loading</div>
              </div>
              <div className="bg-financial-dark rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Technical</div>
                <div className="text-sm font-semibold text-white">Loading</div>
              </div>
              <div className="bg-financial-dark rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Economic</div>
                <div className="text-sm font-semibold text-white">Loading</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Smile className="h-5 w-5 text-blue-400" />
            <span>Financial Mood</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm">
              <Activity size={16} className="text-blue-400" />
              <span className="text-gray-300">Confidence:</span>
              <span className="font-semibold text-white">{moodData.confidence}%</span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              variant="outline"
              size="sm"
              className="bg-financial-card hover:bg-financial-border text-white border-financial-border text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Mood Display */}
        <div className="text-center">
          <div className="text-6xl mb-3">{moodData.emoji}</div>
          <h3 className={`text-xl font-bold ${moodData.color}`}>{moodData.mood}</h3>
        </div>

        {/* Reasoning */}
        <div className="bg-financial-dark rounded-lg p-4">
          <h4 className="text-blue-400 font-semibold mb-2">Market Analysis</h4>
          <p className="text-gray-300 text-sm leading-relaxed">{moodData.reasoning}</p>
        </div>

        {/* Market Factors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-financial-dark rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">Momentum</div>
            <div className="text-sm font-semibold text-white">{moodData.marketFactors.momentum}</div>
          </div>
          <div className="bg-financial-dark rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">Technical</div>
            <div className="text-sm font-semibold text-white">{moodData.marketFactors.technical}</div>
          </div>
          <div className="bg-financial-dark rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">Economic</div>
            <div className="text-sm font-semibold text-white">{moodData.marketFactors.economic}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t border-financial-border">
          Based on real-time market data and AI analysis
        </div>
      </CardContent>
    </Card>
  );
}