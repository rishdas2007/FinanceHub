import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Brain, Clock, Database } from "lucide-react";
import { useState } from "react";

interface AISummaryResponse {
  analysis: string;
  dataAge: string;
  timestamp: string;
  success: boolean;
  dataSources: {
    momentum: boolean;
    technical: boolean;
    economic: boolean;
  };
  cacheInfo?: {
    cached: boolean;
    age: number;
    context: string;
    dataTimestamp: string;
    expiresIn: number;
  };
}

export function AISummaryOptimized() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: summary, isLoading, error, isFetching } = useQuery<AISummaryResponse>({
    queryKey: ['ai-summary-optimized', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/ai-summary-optimized');
      if (!response.ok) {
        throw new Error('Failed to fetch AI summary');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,   // 15 minutes
    retry: 1,
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (error) {
    console.error('AI Summary Error:', error);
    return (
      <Card className="p-6 bg-gray-900/50 border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white flex items-center">
          <Brain className="text-blue-400 mr-2" />
          AI Market Summary
        </h3>
        <p className="text-red-400">AI analysis temporarily updating</p>
        <p className="text-gray-400 text-sm mt-2">Error: {error?.message || 'Unknown error'}</p>
        <Button 
          onClick={handleRefresh}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Analysis
        </Button>
      </Card>
    );
  }

  if (isLoading || !summary) {
    return (
      <Card className="p-6 bg-gray-900/50 border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white flex items-center">
          <Brain className="text-blue-400 mr-2" />
          AI Market Summary
        </h3>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gray-900/50 border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Brain className="text-blue-400 mr-2" />
          AI Market Summary
          {!summary.success && (
            <span className="ml-2 text-sm text-yellow-400 font-normal">(Cached)</span>
          )}
        </h3>
        <Button 
          onClick={handleRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
          disabled={isFetching}
        >
          {isFetching ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Analysis Content */}
      <div className="mb-4">
        <p className="text-gray-100 leading-relaxed text-sm">
          {summary.analysis}
        </p>
      </div>

      {/* Data Sources and Timestamps */}
      <div className="space-y-2 border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center text-gray-400">
            <Clock className="w-3 h-3 mr-1" />
            Analysis: {formatTimestamp(summary.timestamp)}
          </div>
          <div className="flex items-center text-gray-400">
            <Database className="w-3 h-3 mr-1" />
            Data: {summary.dataAge}
          </div>
        </div>

        {/* Cache Information Display */}
        {summary.cacheInfo && (
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-700">
            <div className="flex items-center text-gray-400">
              <span className={`w-2 h-2 rounded-full mr-2 ${summary.cacheInfo.cached ? 'bg-blue-400' : 'bg-green-400'}`}></span>
              {summary.cacheInfo.cached ? 'Cached' : 'Fresh'} ({summary.cacheInfo.context} hours)
            </div>
            <div className="text-gray-400">
              {summary.cacheInfo.cached 
                ? `${Math.round(summary.cacheInfo.age / 1000)}s old, expires in ${Math.round(summary.cacheInfo.expiresIn / 60)}m`
                : `Cached for ${Math.round(summary.cacheInfo.expiresIn / 60)}m`
              }
            </div>
          </div>
        )}

        {/* Data Source Indicators */}
        <div className="flex items-center space-x-4 text-xs">
          <span className="text-gray-400">Sources:</span>
          <div className="flex space-x-3">
            <span className={`flex items-center ${summary.dataSources.momentum ? 'text-green-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${summary.dataSources.momentum ? 'bg-green-400' : 'bg-gray-500'}`}></span>
              Momentum
            </span>
            <span className={`flex items-center ${summary.dataSources.technical ? 'text-green-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${summary.dataSources.technical ? 'bg-green-400' : 'bg-gray-500'}`}></span>
              Technical
            </span>
            <span className={`flex items-center ${summary.dataSources.economic ? 'text-green-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${summary.dataSources.economic ? 'bg-green-400' : 'bg-gray-500'}`}></span>
              Economic
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}