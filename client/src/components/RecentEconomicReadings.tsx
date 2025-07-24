import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";

interface OpenAIEconomicReading {
  metric: string;
  value: string;
  analysis: string;
}

export function RecentEconomicReadings() {
  // Use OpenAI-based economic readings due to FRED API access restrictions
  const { data: economicData, isLoading } = useQuery<OpenAIEconomicReading[]>({
    queryKey: ['/api/recent-economic-openai'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Recent Economic Readings</span>
            <span className="text-xs text-gray-400">AI-Generated</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-financial-dark" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!economicData || !Array.isArray(economicData) || economicData.length === 0) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span>Recent Economic Readings</span>
            <span className="text-xs text-red-400">API Error</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Economic data temporarily unavailable</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          <span>Recent Economic Readings</span>
          <span className="text-xs text-green-400">AI-Generated • Live</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Economic Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {economicData.map((reading: OpenAIEconomicReading, index: number) => (
            <div
              key={`${reading.metric}-${index}`}
              className="bg-financial-dark p-4 rounded-lg border border-financial-border"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-white font-semibold text-sm leading-tight">
                  {reading.metric}
                </h4>
              </div>
              
              <div className="space-y-1">
                <div className="text-xl font-bold text-blue-400">
                  {reading.value}
                </div>
                
                <div className="text-xs text-gray-300 leading-relaxed">
                  {reading.analysis}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Generated Note */}
        <div className="bg-financial-dark p-4 rounded-lg border border-financial-border">
          <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span>AI Economic Analysis</span>
          </h3>
          <div className="text-gray-300 space-y-2">
            <p className="text-sm leading-relaxed">
              These economic readings are AI-generated based on recent market conditions and economic trends. 
              FRED API is temporarily unavailable due to access restrictions.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}