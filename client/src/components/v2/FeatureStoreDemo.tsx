import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Database, Server, Wifi } from 'lucide-react';
import { apiV2Client, hasFallbackData, getDataQuality } from '@/lib/api-v2';
import { ApiResponse, ETFMetrics, HealthCheck } from '@shared/types/api-contracts';

export function FeatureStoreDemo() {
  const [metrics, setMetrics] = useState<ApiResponse<{ metrics: ETFMetrics[]; count: number; pipelineVersion: string; dataSource: string }> | null>(null);
  const [health, setHealth] = useState<ApiResponse<HealthCheck> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load sample ETF metrics from feature store
      const [metricsResponse, healthResponse] = await Promise.all([
        apiV2Client.getETFMetrics(['SPY', 'XLK', 'XLF']),
        apiV2Client.getHealth()
      ]);
      
      setMetrics(metricsResponse);
      setHealth(healthResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'db': return <Database className="w-4 h-4" />;
      case 'cache': return <Server className="w-4 h-4" />;
      case 'provider': return <Wifi className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'high': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'medium': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            V2 API Feature Store Demo
          </CardTitle>
          <CardDescription>
            Testing the new architecture with precomputed features and unified API contracts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Button 
              onClick={loadData} 
              disabled={loading}
              data-testid="button-refresh"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Refresh Data
            </Button>
          </div>

          {error && (
            <div className="text-red-600 mb-4" data-testid="text-error">
              Error: {error}
            </div>
          )}

          {/* Health Status */}
          {health && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(health.source)}
                    <span className="text-sm text-gray-600">Source: {health.source}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={health.data.ok ? "default" : "destructive"}>
                      {health.data.ok ? "Healthy" : "Degraded"}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    Valid Features: {health.data.validFeatures}%
                  </div>
                  <div className="text-sm text-gray-600">
                    Uptime: {Math.floor((health.data.uptime || 0) / 60)}m
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ETF Metrics */}
          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  ETF Metrics from Feature Store
                  <div className="flex items-center gap-2">
                    {getSourceIcon(metrics.source)}
                    <Badge className={getQualityColor(getDataQuality(metrics))}>
                      {getDataQuality(metrics)} quality
                    </Badge>
                    {metrics.cached && <Badge variant="outline">Cached</Badge>}
                    {hasFallbackData(metrics) && <Badge variant="destructive">Fallback</Badge>}
                  </div>
                </CardTitle>
                <CardDescription>
                  Pipeline: {(metrics.data as any)?.pipelineVersion || 'unknown'} | 
                  Source: {(metrics.data as any)?.dataSource || 'unknown'} | 
                  Count: {(metrics.data as any)?.count || 0} symbols
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(metrics.data as any)?.metrics?.map((metric: ETFMetrics) => (
                    <div 
                      key={metric.symbol} 
                      className="border rounded-lg p-4"
                      data-testid={`card-etf-${metric.symbol}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{metric.symbol}</h3>
                        <div className="flex items-center gap-2">
                          {metric.fallback && <Badge variant="destructive">Fallback</Badge>}
                          {metric.dataQuality && (
                            <Badge className={getQualityColor(metric.dataQuality)}>
                              {metric.dataQuality}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">RSI:</span>
                          <span className="ml-2 font-mono">
                            {metric.rsi?.toFixed(2) || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">MACD:</span>
                          <span className="ml-2 font-mono">
                            {metric.macd?.toFixed(4) || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Z-Score:</span>
                          <span className="ml-2 font-mono">
                            {metric.zScoreData?.compositeZScore?.toFixed(3) || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Signal:</span>
                          <span className="ml-2">
                            <Badge variant={
                              metric.zScoreData?.signal === 'BUY' ? 'default' :
                              metric.zScoreData?.signal === 'SELL' ? 'destructive' :
                              'secondary'
                            }>
                              {metric.zScoreData?.signal || 'HOLD'}
                            </Badge>
                          </span>
                        </div>
                      </div>
                      
                      {metric.zScoreData?.regimeAware && (
                        <div className="mt-2">
                          <Badge variant="outline">Multi-Horizon Analysis</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {metrics.warning && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ {metrics.warning}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}