import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, BarChart3, AlertCircle, Clock } from 'lucide-react';

interface EnhancedAnalysis {
  bottomLine: string;
  technicalAnalysis: string;
  economicAnalysis: string;
  sectorAnalysis: string;
  historicalPrecedents: string;
  riskAssessment: string;
  outlook: string;
  confidence: number;
  historicalContextUsed: boolean;
  generatedAt: string;
}

export function EnhancedAIAnalysis() {
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const { data: analysis, isLoading, error, refetch } = useQuery<EnhancedAnalysis>({
    queryKey: ['/api/enhanced-ai-analysis'],
    refetchInterval: 300000, // 5 minutes
    staleTime: 240000, // 4 minutes
  });

  const handleManualRefresh = async () => {
    setIsManualRefresh(true);
    await refetch();
    setIsManualRefresh(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Enhanced AI Market Commentary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-300">Generating enhanced analysis with historical context...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Enhanced AI Market Commentary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-red-400 mb-4">Failed to generate enhanced AI analysis</p>
            <Button onClick={handleManualRefresh} variant="outline" className="text-white border-gray-600">
              Retry Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Enhanced AI Market Commentary
            {analysis.historicalContextUsed && (
              <Badge variant="secondary" className="bg-blue-600 text-white">
                Historical Context
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatTimestamp(analysis.generatedAt)}
            </div>
            <Badge 
              variant="secondary" 
              className={`text-white ${getConfidenceColor(analysis.confidence)}`}
            >
              {analysis.confidence}% Confidence
            </Badge>
            <Button 
              onClick={handleManualRefresh} 
              variant="outline" 
              size="sm"
              disabled={isManualRefresh}
              className="text-white border-gray-600 hover:bg-gray-700"
            >
              {isManualRefresh ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bottom Line Assessment */}
        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Bottom Line Assessment
          </h3>
          <p className="text-gray-300 leading-relaxed">{analysis.bottomLine}</p>
        </div>

        {/* Technical Analysis */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-white font-semibold mb-2">Technical Analysis</h3>
          <p className="text-gray-300 leading-relaxed">{analysis.technicalAnalysis}</p>
        </div>

        {/* Economic Analysis with Historical Context */}
        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-yellow-500">
          <h3 className="text-white font-semibold mb-2">Economic Analysis with Historical Context</h3>
          <p className="text-gray-300 leading-relaxed">{analysis.economicAnalysis}</p>
        </div>

        {/* Historical Precedents */}
        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-purple-500">
          <h3 className="text-white font-semibold mb-2">Historical Precedents</h3>
          <p className="text-gray-300 leading-relaxed">{analysis.historicalPrecedents}</p>
        </div>

        {/* Sector Analysis */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-white font-semibold mb-2">Sector Analysis</h3>
          <p className="text-gray-300 leading-relaxed">{analysis.sectorAnalysis}</p>
        </div>

        {/* Risk Assessment */}
        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-red-500">
          <h3 className="text-white font-semibold mb-2">Risk Assessment</h3>
          <p className="text-gray-300 leading-relaxed">{analysis.riskAssessment}</p>
        </div>

        {/* Market Outlook */}
        <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-green-500">
          <h3 className="text-white font-semibold mb-2">Market Outlook</h3>
          <p className="text-gray-300 leading-relaxed">{analysis.outlook}</p>
        </div>
      </CardContent>
    </Card>
  );
}