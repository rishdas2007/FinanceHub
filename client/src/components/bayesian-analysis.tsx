import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, Activity, Clock, Target, BarChart3 } from 'lucide-react';

interface BayesianAnalysis {
  bottomLine: string;
  dominantTheme: string;
  setup: string;
  evidence: string;
  implications: string;
  confidence: number;
  analysisType: string;
  fromCache?: boolean;
  metadata?: {
    generatedAt: string;
    cacheStats: {
      validEntries: number;
      totalEntries: number;
    };
    tokenEfficiency: string;
    significanceScore?: string;
  };
}

interface CacheStats {
  validEntries: number;
  totalEntries: number;
  timestamp: string;
  costEfficiency: string;
}

export function BayesianAnalysis() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Query for Bayesian analysis
  const {
    data: analysis,
    isLoading,
    error,
    refetch: refetchAnalysis
  } = useQuery<BayesianAnalysis>({
    queryKey: ['/api/bayesian-analysis', refreshKey],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true
  });

  // Query for cache statistics
  const {
    data: cacheStats,
    refetch: refetchCacheStats
  } = useQuery<CacheStats>({
    queryKey: ['/api/bayesian-cache-stats'],
    refetchInterval: 30000, // Update every 30 seconds
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetchAnalysis();
    refetchCacheStats();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-600 dark:text-green-400';
    if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAnalysisTypeIcon = (type: string) => {
    switch (type) {
      case 'adaptive':
        return <Brain className="h-4 w-4" />;
      case 'cached':
        return <Clock className="h-4 w-4" />;
      case 'fallback':
        return <Activity className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse" />
            Bayesian AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-800 rounded mb-2"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-400 flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Bayesian Analysis Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-300 text-sm">
            Failed to load Bayesian analysis. Please try again.
          </p>
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            size="sm" 
            className="mt-3"
          >
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Analysis Card */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-400" />
              Sophisticated Bayesian Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge 
                variant={analysis?.fromCache ? "secondary" : "default"}
                className="flex items-center gap-1"
              >
                {getAnalysisTypeIcon(analysis?.analysisType || 'adaptive')}
                {analysis?.metadata?.tokenEfficiency || 'generated'}
              </Badge>
              <Button 
                onClick={handleRefresh}
                variant="outline" 
                size="sm"
                className="h-7 px-2"
              >
                <TrendingUp className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis && (
            <>
              {/* Bottom Line */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                    Bottom Line
                  </Badge>
                  <span className={`text-sm font-semibold ${getConfidenceColor(analysis.confidence)}`}>
                    {analysis.confidence}% confidence
                  </span>
                </div>
                <p className="text-white text-sm leading-relaxed">
                  {analysis.bottomLine}
                </p>
              </div>

              {/* Dominant Theme */}
              <div className="space-y-2">
                <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">
                  Dominant Theme
                </Badge>
                <p className="text-purple-200 text-sm font-medium">
                  {analysis.dominantTheme}
                </p>
              </div>

              {/* Market Setup */}
              <div className="space-y-2">
                <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                  Market Setup
                </Badge>
                <p className="text-green-100 text-sm leading-relaxed">
                  {analysis.setup}
                </p>
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
                  Evidence
                </Badge>
                <p className="text-yellow-100 text-sm leading-relaxed">
                  {analysis.evidence}
                </p>
              </div>

              {/* Implications */}
              <div className="space-y-2">
                <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
                  Implications
                </Badge>
                <p className="text-red-100 text-sm leading-relaxed">
                  {analysis.implications}
                </p>
              </div>

              {/* Metadata */}
              {analysis.metadata && (
                <div className="mt-4 pt-3 border-t border-gray-800">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Generated: {new Date(analysis.metadata.generatedAt).toLocaleTimeString()}</span>
                    <span>Type: {analysis.analysisType}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cache Statistics Card */}
      {cacheStats && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Token Efficiency Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-cyan-400">
                  {cacheStats.validEntries}
                </div>
                <div className="text-xs text-gray-400">Valid Cache</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {cacheStats.totalEntries}
                </div>
                <div className="text-xs text-gray-400">Total Entries</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {cacheStats.costEfficiency.split('%')[0]}%
                </div>
                <div className="text-xs text-gray-400">Hit Rate</div>
              </div>
            </div>
            <div className="mt-3 text-center">
              <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600/30">
                Cost Optimization Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}