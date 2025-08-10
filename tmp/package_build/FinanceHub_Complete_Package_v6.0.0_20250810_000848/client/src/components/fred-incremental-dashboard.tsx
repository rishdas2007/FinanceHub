import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Activity, Database, Clock, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SchedulerStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  lastResult: 'success' | 'failure' | 'partial' | null;
  lastError: string | null;
  totalRuns: number;
  successfulRuns: number;
}

interface FredHealth {
  schedulerStatus: string;
  lastUpdate: string | null;
  nextUpdate: string | null;
  apiHealth: any;
  databaseHealth: string;
}

interface SeriesInfo {
  seriesId: string;
  recordCount: number;
  latestDate: string | null;
}

export function FredIncrementalDashboard() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch scheduler status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['fred-incremental-status'],
    queryFn: async () => {
      const response = await fetch('/api/fred-incremental/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch health check
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['fred-incremental-health'],
    queryFn: async () => {
      const response = await fetch('/api/fred-incremental/health');
      if (!response.ok) {
        throw new Error('Failed to fetch health');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch series information
  const { data: seriesData, isLoading: seriesLoading } = useQuery({
    queryKey: ['fred-incremental-series'],
    queryFn: async () => {
      const response = await fetch('/api/fred-incremental/series');
      if (!response.ok) {
        throw new Error('Failed to fetch series');
      }
      return response.json();
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Manual update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/fred-incremental/update', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to trigger update');
      }
      return response.json();
    },
    onSuccess: () => {
      // Refresh all queries after successful update
      queryClient.invalidateQueries({ queryKey: ['fred-incremental'] });
      setRefreshing(false);
    },
    onError: () => {
      setRefreshing(false);
    },
  });

  const handleManualUpdate = () => {
    setRefreshing(true);
    updateMutation.mutate();
  };

  const scheduler: SchedulerStatus | undefined = statusData?.data?.scheduler;
  const health: FredHealth | undefined = healthData?.health;
  const series: SeriesInfo[] = seriesData?.data?.series || [];

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getResultColor = (result: string | null) => {
    switch (result) {
      case 'success': return 'text-green-600';
      case 'failure': return 'text-red-600';
      case 'partial': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">FRED Incremental Updates</h2>
          <p className="text-muted-foreground">
            Monitor and manage Federal Reserve data updates
          </p>
        </div>
        <Button
          onClick={handleManualUpdate}
          disabled={refreshing || updateMutation.isPending}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Manual Update
        </Button>
      </div>

      {updateMutation.isError && (
        <Alert>
          <AlertDescription>
            Failed to trigger update: {updateMutation.error?.message}
          </AlertDescription>
        </Alert>
      )}

      {updateMutation.isSuccess && (
        <Alert>
          <AlertDescription>
            Update triggered successfully! New data points: {updateMutation.data?.data?.newDataPoints || 0}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Scheduler Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduler Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : scheduler ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(scheduler.isRunning ? 'running' : 'stopped')}`} />
                  <span className="font-medium">
                    {scheduler.isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <div>Last Run: {formatDate(scheduler.lastRun)}</div>
                  <div>Next Run: {formatDate(scheduler.nextRun)}</div>
                  <div className={getResultColor(scheduler.lastResult)}>
                    Last Result: {scheduler.lastResult || 'None'}
                  </div>
                  <div>Success Rate: {scheduler.totalRuns > 0 ? 
                    Math.round((scheduler.successfulRuns / scheduler.totalRuns) * 100) : 0}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-red-500">Failed to load status</div>
            )}
          </CardContent>
        </Card>

        {/* Health Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : health ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={health.schedulerStatus === 'running' ? 'default' : 'secondary'}>
                    {health.schedulerStatus}
                  </Badge>
                </div>
                <div className="text-sm space-y-1">
                  <div>Last Update: {formatDate(health.lastUpdate)}</div>
                  <div>Next Update: {formatDate(health.nextUpdate)}</div>
                  <div>API Status: {health.apiHealth?.status || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {health.databaseHealth}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-red-500">Failed to load health</div>
            )}
          </CardContent>
        </Card>

        {/* Database Stats Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Stats</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {seriesLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : series.length > 0 ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{series.length}</div>
                <div className="text-sm text-muted-foreground">Total Series</div>
                <div className="text-sm">
                  Total Records: {series.reduce((sum, s) => sum + s.recordCount, 0)}
                </div>
                <div className="text-sm">
                  Avg per Series: {Math.round(series.reduce((sum, s) => sum + s.recordCount, 0) / series.length)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No series data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Series Details Table */}
      {series.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Series Details
            </CardTitle>
            <CardDescription>
              Individual series tracking information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Series ID</th>
                    <th className="text-right py-2">Records</th>
                    <th className="text-right py-2">Latest Date</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.seriesId} className="border-b hover:bg-muted/50">
                      <td className="py-2 font-mono text-xs">{s.seriesId}</td>
                      <td className="text-right py-2">{s.recordCount}</td>
                      <td className="text-right py-2 text-xs">
                        {s.latestDate || 'No data'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}