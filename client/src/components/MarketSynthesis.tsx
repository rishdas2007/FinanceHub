import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp, Target, Clock } from "lucide-react";

interface MarketSynthesis {
  marketPulse: string;
  criticalCatalysts: string[];
  actionItems: string[];
  confidence: number;
  timestamp: string;
}

export default function MarketSynthesis() {
  // Wait for AI Summary to be available first
  const { data: aiSummary } = useQuery({
    queryKey: ['/api/ai-summary'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: synthesis, isLoading, error, refetch } = useQuery<MarketSynthesis>({
    queryKey: ['/api/market-synthesis'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    // Wait for AI summary to be available before fetching synthesis
    enabled: !!aiSummary,
  });

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <AlertCircle className="h-5 w-5 text-red-400" />
            Market Synthesis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-sm">
            Analysis temporarily unavailable. Please try again.
            <button 
              onClick={() => refetch()} 
              className="ml-2 text-blue-400 hover:text-blue-300 underline"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Market Synthesis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full bg-gray-800" />
          <Skeleton className="h-16 w-full bg-gray-800" />
          <Skeleton className="h-16 w-full bg-gray-800" />
        </CardContent>
      </Card>
    );
  }

  if (!synthesis) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Market Synthesis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400">No synthesis data available</div>
        </CardContent>
      </Card>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-400";
    if (confidence >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getRiskLevel = () => {
    const pulse = synthesis.marketPulse.toLowerCase();
    if (pulse.includes('high risk') || pulse.includes('risk level: high')) return 'HIGH';
    if (pulse.includes('moderate risk') || pulse.includes('risk level: moderate')) return 'MODERATE';
    if (pulse.includes('low risk') || pulse.includes('risk level: low')) return 'LOW';
    return 'MODERATE';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'LOW': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-gray-100">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Market Synthesis
          </span>
          <div className="flex items-center gap-2 text-sm">
            <span className={`${getConfidenceColor(synthesis.confidence)}`}>
              {synthesis.confidence}% confidence
            </span>
            <span className={`px-2 py-1 rounded-full border text-xs font-medium ${getRiskColor(getRiskLevel())}`}>
              {getRiskLevel()} RISK
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Pulse */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <h3 className="text-blue-400 font-semibold text-sm">MARKET PULSE</h3>
          </div>
          <p className="text-gray-100 text-sm leading-relaxed pl-4 border-l-2 border-blue-400/30">
            {synthesis.marketPulse}
          </p>
        </div>

        {/* Critical Catalysts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-orange-400" />
            <h3 className="text-orange-400 font-semibold text-sm">CRITICAL CATALYSTS</h3>
          </div>
          <div className="space-y-2 pl-6">
            {synthesis.criticalCatalysts.map((catalyst, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-gray-200 text-sm leading-relaxed">{catalyst}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-green-400" />
            <h3 className="text-green-400 font-semibold text-sm">ACTION ITEMS</h3>
          </div>
          <div className="space-y-3 pl-6">
            {synthesis.actionItems.map((item, index) => {
              const isTactical = item.toLowerCase().includes('tactical');
              const isStrategic = item.toLowerCase().includes('strategic');
              const isRisk = item.toLowerCase().includes('risk');
              
              let icon = Target;
              let iconColor = 'text-green-400';
              
              if (isTactical) {
                icon = Clock;
                iconColor = 'text-blue-400';
              } else if (isRisk) {
                icon = AlertCircle;
                iconColor = 'text-yellow-400';
              }
              
              const IconComponent = icon;
              
              return (
                <div key={index} className="flex items-start gap-3 group">
                  <IconComponent className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
                  <p className="text-gray-200 text-sm leading-relaxed group-hover:text-gray-100 transition-colors">
                    {item}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timestamp */}
        <div className="pt-3 border-t border-gray-700">
          <p className="text-gray-500 text-xs">
            Generated: {new Date(synthesis.timestamp).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}