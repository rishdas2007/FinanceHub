import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AiAnalysis } from "@/types/financial";

export function AIAnalysisComponent() {
  const queryClient = useQueryClient();

  const { data: analysis, isLoading } = useQuery<AiAnalysis>({
    queryKey: ['/api/analysis'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis'] });
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
        <div className="bg-financial-card rounded-lg p-6 min-h-96 overflow-y-auto">
          {analysis ? (
            <div className="space-y-6 text-sm">
              <div className="border-l-4 border-gain-green pl-4">
                <h4 className="font-semibold text-white mb-3 text-base">📈 Current Market Analysis</h4>
                <p className="text-gray-300 leading-relaxed mb-3">
                  {analysis.marketConditions}
                </p>
                <div className="bg-financial-gray bg-opacity-50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="text-center">
                      <span className="text-gray-400">Market Trend</span>
                      <div className="text-gain-green font-medium">Bullish</div>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-400">Confidence</span>
                      <div className="text-white font-medium">{(parseFloat(analysis.confidence) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-l-4 border-warning-yellow pl-4">
                <h4 className="font-semibold text-white mb-3 text-base">🔧 Technical Outlook</h4>
                <p className="text-gray-300 leading-relaxed mb-3">
                  {analysis.technicalOutlook}
                </p>
                <div className="bg-financial-gray bg-opacity-50 rounded-lg p-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <span className="text-gray-400">RSI Signal</span>
                      <div className="text-warning-yellow font-medium">Overbought</div>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-400">MACD</span>
                      <div className="text-gain-green font-medium">Bullish</div>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-400">Trend</span>
                      <div className="text-gain-green font-medium">Strong</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-l-4 border-loss-red pl-4">
                <h4 className="font-semibold text-white mb-3 text-base">⚠️ Risk Assessment</h4>
                <p className="text-gray-300 leading-relaxed mb-3">
                  {analysis.riskAssessment}
                </p>
                <div className="bg-financial-gray bg-opacity-50 rounded-lg p-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <span className="text-gray-400">VIX Level</span>
                      <div className="text-warning-yellow font-medium">Elevated</div>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-400">Volatility</span>
                      <div className="text-warning-yellow font-medium">Moderate</div>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-400">Risk Level</span>
                      <div className="text-warning-yellow font-medium">Medium</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 text-xs text-gray-400">
                <div className="flex justify-between items-center">
                  <span>Confidence: {(parseFloat(analysis.confidence) * 100).toFixed(0)}%</span>
                  <span>Updated: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No analysis available
            </div>
          )}
        </div>
        <Button
          className="w-full mt-4 bg-gain-green hover:bg-green-600 text-white transition-colors"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh Analysis
        </Button>
      </CardContent>
    </Card>
  );
}
