import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, MessageSquare } from 'lucide-react';

interface EconomicDataResponse {
  statisticalData: {
    [category: string]: any;
  };
  aiAnalysis: string;
}

export function AIEconomicAnalysis() {
  const {
    data: economicData,
    isLoading,
    error,
    refetch
  } = useQuery<EconomicDataResponse>({
    queryKey: ['/api/economic-data-analysis'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <span>AI Economic Analysis</span>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load AI economic analysis. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-blue-400" />
            <span>AI Economic Analysis</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            OpenAI-powered analysis of current economic conditions
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={isLoading}
          variant="default" 
          size="sm"
          className="bg-black text-white border-black hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
              <span className="text-gray-300">Generating AI economic analysis...</span>
            </div>
          </CardContent>
        </Card>
      ) : economicData ? (
        <Card className="bg-financial-card border-financial-border">
          <CardHeader>
            <CardTitle className="text-white text-lg">Economic Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-300 leading-relaxed">
              {economicData.aiAnalysis.split('\n').map((line, index) => {
                // Check if line contains section headers (starts with capital letters and common header words)
                const isHeader = line.trim().match(/^(Cross-Category|Overall|Economic|Market|Analysis|Synthesis|Outlook)/i) && 
                                !line.includes(':') && !line.includes('.') && line.trim().length < 80;
                
                if (isHeader) {
                  return (
                    <div key={index} className="font-bold text-white text-base mb-3 mt-4">
                      {line.trim()}
                    </div>
                  );
                } else if (line.trim()) {
                  return (
                    <p key={index} className="mb-2">
                      {line.trim()}
                    </p>
                  );
                } else {
                  return <div key={index} className="mb-2"></div>;
                }
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-financial-card border-financial-border">
          <CardContent className="p-6">
            <p className="text-gray-400 text-center">No AI analysis available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}