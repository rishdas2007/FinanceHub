import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, AlertTriangle, Target, Brain } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AiAnalysis, StockData, MarketSentiment, TechnicalIndicators, SectorData } from "@/types/financial";

interface ThematicAnalysisData {
  bottomLine: string;
  dominantTheme: string;
  setup: string;
  evidence: string;
  implications: string;
  confidence: number;
  timestamp: string;
}

export function AIAnalysisComponent() {
  const queryClient = useQueryClient();

  // Use thematic analysis instead of standard analysis
  const { data: analysis, isLoading, error } = useQuery<ThematicAnalysisData>({
    queryKey: ['/api/thematic-analysis'],
    refetchInterval: 300000, // Refresh every 5 minutes
    refetchOnMount: true, // Always fetch fresh data on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid excessive calls
    staleTime: 0, // Always consider data stale to force fresh fetches
    retry: 1,
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

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/thematic-analysis'] });
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
          <div className="bg-financial-card rounded-lg p-4 h-80 flex items-center justify-center">
            <div className="text-gray-400">Loading AI market analysis...</div>
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
        <div className="bg-financial-card rounded-lg p-6 overflow-y-auto h-[800px]">
          {analysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              {/* Current Market Position */}
              <div className="lg:col-span-3 border-l-4 border-gain-green pl-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-gain-green" />
                  <h4 className="font-semibold text-white text-lg">Current Market Position</h4>
                </div>
                <p className="text-gray-300 leading-relaxed mb-4">
                  {currentStock ? (
                    <>
                      The S&P 500 (SPY) closed at ${currentStock.price ? parseFloat(currentStock.price).toFixed(2) : 'N/A'}, gaining {currentStock.changePercent ? (parseFloat(currentStock.changePercent) >= 0 ? '+' : '') + parseFloat(currentStock.changePercent).toFixed(2) : 'N/A'}% today. 
                      {currentStock.price && parseFloat(currentStock.price) > 620 && (
                        <span className="text-warning-yellow"> This puts the market near historical highs, trading at elevated valuations that warrant careful monitoring.</span>
                      )}
                    </>
                  ) : (
                    "Loading current market position..."
                  )}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-financial-gray bg-opacity-30 rounded-lg p-4">
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">Current Price</span>
                    <div className="text-white font-bold text-lg">
                      {currentStock?.price ? `$${parseFloat(currentStock.price).toFixed(2)}` : '---'}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">Daily Change</span>
                    <div className={`font-bold text-lg ${currentStock?.changePercent && parseFloat(currentStock.changePercent) >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>
                      {currentStock?.changePercent ? `${parseFloat(currentStock.changePercent) >= 0 ? '+' : ''}${parseFloat(currentStock.changePercent).toFixed(2)}%` : '---'}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">VIX Level</span>
                    <div className="text-warning-yellow font-bold text-lg">
                      {sentiment?.vix ? parseFloat(sentiment.vix).toFixed(1) : '---'}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">AAII Bullish</span>
                    <div className="text-gain-green font-bold text-lg">
                      {sentiment?.aaiiBullish ? `${parseFloat(sentiment.aaiiBullish).toFixed(1)}%` : '---'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thematic Analysis Bottom Line */}
              <div className="lg:col-span-3 border-l-4 border-gain-green pl-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-gain-green" />
                  <h4 className="font-semibold text-white text-lg">Bottom Line</h4>
                </div>
                <p className="text-gray-300 leading-relaxed mb-4">{analysis.bottomLine}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>Theme: <span className="text-white font-medium">{analysis.dominantTheme}</span></span>
                  <span>•</span>
                  <span>Updated: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span>{Math.round(analysis.confidence * 100)}% Confidence</span>
                </div>
              </div>

              {/* Market Setup */}
              <div className="border-l-4 border-green-500/30 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📊</span>
                  <h4 className="font-semibold text-white text-base">Market Setup</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">{analysis.setup}</p>
              </div>

              {/* Evidence */}
              <div className="border-l-4 border-blue-500/30 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🔍</span>
                  <h4 className="font-semibold text-white text-base">Evidence</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">{analysis.evidence}</p>
              </div>

              {/* Implications */}
              <div className="border-l-4 border-yellow-500/30 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">💡</span>
                  <h4 className="font-semibold text-white text-base">Implications</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">{analysis.implications}</p>
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