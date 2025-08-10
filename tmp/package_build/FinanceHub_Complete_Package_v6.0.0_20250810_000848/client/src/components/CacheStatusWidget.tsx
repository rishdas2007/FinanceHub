import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, Database, Clock } from 'lucide-react';

interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  memoryUsage: string;
  oldestEntry: string;
  newestEntry: string;
  categories: Record<string, number>;
}

interface CacheStatusResponse {
  success: boolean;
  stats: CacheStats;
  timestamp: string;
}

const CacheStatusWidget = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { data, isLoading, error, refetch } = useQuery<CacheStatusResponse>({
    queryKey: ['/api/health/cache-stats', refreshKey],
    queryFn: () => fetch('/api/health/cache-stats').then(res => {
      if (!res.ok) throw new Error('Failed to fetch cache stats');
      return res.json();
    }),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (error) {
    return null; // Hide widget if cache stats not available
  }

  if (isLoading || !data?.success) {
    return (
      <Card className="bg-gray-900/50 border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400 animate-pulse" />
            <span className="text-sm text-gray-400">Loading cache stats...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data.stats;
  const hitRateColor = 
    stats.hitRate >= 80 ? 'text-green-400 bg-green-900/20' :
    stats.hitRate >= 60 ? 'text-yellow-400 bg-yellow-900/20' :
    'text-red-400 bg-red-900/20';

  return (
    <Card className="bg-gray-900/50 border-gray-700" data-testid="cache-status-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-400" />
            Cache Performance
          </CardTitle>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Hit Rate */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Hit Rate</span>
          <Badge className={`text-xs px-2 py-1 ${hitRateColor} border-0`}>
            {stats.hitRate.toFixed(1)}%
          </Badge>
        </div>

        {/* Total Entries */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Entries</span>
          <span className="text-xs text-white font-mono">
            {stats.totalEntries.toLocaleString()}
          </span>
        </div>

        {/* Memory Usage */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Memory</span>
          <span className="text-xs text-white font-mono">
            {stats.memoryUsage}
          </span>
        </div>

        {/* Top Categories */}
        {Object.keys(stats.categories).length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Top Categories</span>
            <div className="space-y-1">
              {Object.entries(stats.categories)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 truncate">
                      {category.replace('-', ' ')}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {count}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="pt-2 border-t border-gray-800 flex items-center gap-2">
          <Clock className="h-3 w-3 text-gray-500" />
          <span className="text-xs text-gray-500">
            {new Date(data.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CacheStatusWidget;