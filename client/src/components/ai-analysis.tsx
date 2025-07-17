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
        <div className="bg-financial-card rounded-lg p-4 h-80 overflow-y-auto">
          {analysis ? (
            <div className="space-y-4 text-sm">
              <div className="border-l-4 border-gain-green pl-4">
                <h4 className="font-semibold text-white mb-2">Current Market Analysis</h4>
                <p className="text-gray-300 leading-relaxed">
                  {analysis.marketConditions}
                </p>
              </div>
              <div className="border-l-4 border-warning-yellow pl-4">
                <h4 className="font-semibold text-white mb-2">Technical Outlook</h4>
                <p className="text-gray-300 leading-relaxed">
                  {analysis.technicalOutlook}
                </p>
              </div>
              <div className="border-l-4 border-loss-red pl-4">
                <h4 className="font-semibold text-white mb-2">Risk Assessment</h4>
                <p className="text-gray-300 leading-relaxed">
                  {analysis.riskAssessment}
                </p>
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
