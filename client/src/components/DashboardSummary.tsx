import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, AlertCircle } from "lucide-react";

interface DashboardSummaryData {
  executiveSummary: string;
  keyInsights: string[];
  marketOutlook: string;
  riskFactors: string[];
  actionItems: string[];
  confidence: number;
  timestamp: string;
}

export function DashboardSummary() {
  const { data: summary, isLoading, error } = useQuery<DashboardSummaryData>({
    queryKey: ['/api/dashboard-summary'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Brain className="h-5 w-5 text-blue-400" />
            <span>Dashboard Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full bg-financial-dark" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 w-full bg-financial-dark" />
            <Skeleton className="h-32 w-full bg-financial-dark" />
            <Skeleton className="h-32 w-full bg-financial-dark" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span>Dashboard Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Unable to generate dashboard summary at this time.</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-blue-400" />
            <span>AI Dashboard Summary</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-400">Confidence: {summary.confidence}%</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div className="bg-financial-dark rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Executive Summary
          </h3>
          <p className="text-gray-300 leading-relaxed">{summary.executiveSummary}</p>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Key Insights */}
          <div className="bg-financial-dark rounded-lg p-4">
            <h4 className="font-semibold text-green-400 mb-3">Key Insights</h4>
            <ul className="space-y-2">
              {summary.keyInsights.map((insight, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start">
                  <span className="text-green-400 mr-2 mt-1">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Market Outlook */}
          <div className="bg-financial-dark rounded-lg p-4">
            <h4 className="font-semibold text-blue-400 mb-3">Market Outlook</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{summary.marketOutlook}</p>
          </div>

          {/* Risk Factors & Actions */}
          <div className="bg-financial-dark rounded-lg p-4 space-y-4">
            <div>
              <h4 className="font-semibold text-red-400 mb-2">Risk Factors</h4>
              <ul className="space-y-1">
                {summary.riskFactors.map((risk, index) => (
                  <li key={index} className="text-xs text-gray-300 flex items-start">
                    <span className="text-red-400 mr-2 mt-1">⚠</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-yellow-400 mb-2">Action Items</h4>
              <ul className="space-y-1">
                {summary.actionItems.map((action, index) => (
                  <li key={index} className="text-xs text-gray-300 flex items-start">
                    <span className="text-yellow-400 mr-2 mt-1">→</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-financial-border">
          Generated at {new Date(summary.timestamp).toLocaleTimeString()} | 
          AI-powered analysis of all dashboard components
        </div>
      </CardContent>
    </Card>
  );
}