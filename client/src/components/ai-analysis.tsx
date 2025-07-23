import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, AlertTriangle, Target, Brain } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AiAnalysis, StockData, MarketSentiment, TechnicalIndicators, SectorData, EconomicEvent } from "@/types/financial";

interface ThematicAnalysisData {
  bottomLine?: string;
  dominantTheme?: string;
  setup?: string;
  evidence?: string;
  implications?: string;
  confidence?: number;
  timestamp?: string;
  // Handle the actual response format from backend
  overallMarketSentiment?: string;
  momentumOutliers?: string;
}

export function AIAnalysisComponent() {
  const queryClient = useQueryClient();

  // Use enhanced AI analysis with SPY momentum focus - force fresh data
  const { data: analysis, isLoading, error } = useQuery<ThematicAnalysisData>({
    queryKey: ['/api/enhanced-ai-analysis', 'spy-momentum-v2'], // Updated key to force refresh
    refetchInterval: 300000, // Refresh every 5 minutes
    refetchOnMount: true, // Always fetch fresh data on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid excessive calls
    staleTime: 0, // Always consider data stale to force fresh fetches
    retry: 1,
    gcTime: 0, // Don't cache to force fresh requests
    queryFn: async () => {
      // Add cache busting timestamp to force fresh request
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/enhanced-ai-analysis?t=${timestamp}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Increase timeout to 2 minutes for AI analysis
        signal: AbortSignal.timeout(120000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🎯 Fresh SPY momentum analysis received:', data);
      return data;
    }
  });

  const { data: currentStock } = useQuery<StockData>({
    queryKey: ['/api/stocks/SPY'],
  });

  const { data: sentiment } = useQuery<MarketSentiment>({
    queryKey: ['/api/sentiment'],
  });

  const { data: technical } = useQuery<TechnicalIndicators>({
    queryKey: ['/api/technical/SPY'],
  });

  const { data: sectors } = useQuery<SectorData[]>({
    queryKey: ['/api/sectors'],
  });

  const { data: economicEvents } = useQuery<EconomicEvent[]>({
    queryKey: ['/api/economic-events'],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enhanced-ai-analysis'] });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">AI Market Commentary</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-warning-yellow rounded-full animate-pulse"></span>
              <span className="text-xs text-gray-400">Powered by GPT-4o</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-financial-card rounded-lg p-4 h-80 flex flex-col items-center justify-center space-y-3">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-gray-400 text-center">
              <div>Generating AI market analysis...</div>
              <div className="text-sm text-gray-500 mt-1">This may take up to 60 seconds</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">AI Market Commentary</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-loss-red rounded-full"></span>
              <span className="text-xs text-gray-400">Error Loading</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-financial-card rounded-lg p-4 h-80 flex items-center justify-center">
            <div className="text-gray-400">Unable to load AI analysis. Please refresh the page.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">AI Market Commentary</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-warning-yellow rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-400">Powered by GPT-4o</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-financial-card rounded-lg p-6 overflow-y-auto h-[600px]">
          {analysis ? (
            <div className="space-y-6 text-sm">
              {/* SPY Momentum Analysis Header */}
              <div className="border-l-4 border-blue-400 pl-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <h4 className="font-semibold text-white text-lg">SPY Momentum Analysis with Sector Outliers</h4>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                    Confidence: {analysis.confidence || 85}%
                  </span>
                </div>
              </div>

              {/* SPY Momentum Analysis */}
              <div className="bg-financial-gray/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <h5 className="font-semibold text-blue-400">SPY Momentum Assessment</h5>
                </div>
                <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {analysis.overallMarketSentiment || analysis.bottomLine || 'Loading SPY momentum analysis...'}
                </div>
              </div>

              {/* Sector Outliers Analysis */}
              <div className="bg-financial-gray/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <h5 className="font-semibold text-orange-400">Momentum Outliers & Sector Rotation</h5>
                </div>
                <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {analysis.momentumOutliers || analysis.setup || 'Loading sector outlier analysis...'}
                </div>
              </div>

              {/* Analysis Timestamp */}
              <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-600">
                Analysis updated: {analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : 'Just now'}
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">
              <div>No analysis data available</div>
              <div className="text-sm text-gray-500 mt-1">Loading momentum analysis...</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
                          .filter(event => event.actual && event.forecast)
                          .slice(0, 4)
                          .map((event, index) => (
                            <div key={index} className="text-gray-300">
                              • {event.title}: <span className="font-bold text-blue-400">{event.actual}</span> vs <span className="text-gray-400">{event.forecast}</span> forecast
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Implications */}
              <div className="border-l-4 border-yellow-500/30 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">💡</span>
                  <h4 className="font-semibold text-white text-base">Implications</h4>
                </div>
                <p className="text-gray-300 leading-relaxed" 
                   dangerouslySetInnerHTML={{
                     __html: analysis.implications.replace(/(\d+\.?\d*%?)/g, '<span class="font-bold text-blue-400">$1</span>')
                   }}>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-12">No analysis data available</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}