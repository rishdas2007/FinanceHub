import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, Database, Activity } from 'lucide-react';

interface QualityMetric {
  seriesId: string;
  metricName: string;
  totalRecords: number;
  validRecords: number;
  validityRate: number;
  meanValue: string;
  standardDeviation: string;
  earliestDate: string;
  latestDate: string;
  dataAge: number;
  qualityScore: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface QualityDashboardData {
  success: boolean;
  metrics: QualityMetric[];
  summary: {
    totalSeries: number;
    highQuality: number;
    mediumQuality: number;
    lowQuality: number;
    avgValidityRate: number;
  };
  processingTime: number;
}

interface EnhancedMetric {
  seriesId: string;
  metricName: string;
  currentValue: number;
  monthOverMonth: number;
  yearOverYear: number;
  seasonallyAdjusted: number;
  trendComponent: number;
  volatility: number;
  zScore: number;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
}

export default function DataQualityDashboard() {
  const [qualityData, setQualityData] = useState<QualityDashboardData | null>(null);
  const [enhancedMetrics, setEnhancedMetrics] = useState<EnhancedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load quality metrics
      const qualityResponse = await fetch('/api/data-quality/quality-metrics');
      if (!qualityResponse.ok) {
        throw new Error('Failed to load quality metrics');
      }
      const qualityData = await qualityResponse.json();
      
      setQualityData(qualityData);
      
      // Try to load enhanced metrics (this might not be available initially)
      try {
        const enhancedResponse = await fetch('/api/data-quality/enhanced-metrics');
        if (enhancedResponse.ok) {
          const enhancedData = await enhancedResponse.json();
          setEnhancedMetrics(enhancedData.metrics || []);
        }
      } catch (err) {
        console.log('Enhanced metrics not available yet:', err);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const executeGoldStandardPipeline = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data-quality/execute-pipeline', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Pipeline execution failed');
      }
      
      const result = await response.json();
      console.log('Pipeline execution result:', result);
      
      // Reload dashboard data
      await loadDashboardData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline execution failed');
    } finally {
      setLoading(false);
    }
  };

  const refreshEconomicData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data-quality/refresh-economic-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'manual_ui_trigger_fresh_data'
        })
      });
      
      if (!response.ok) {
        throw new Error('Economic data refresh failed');
      }
      
      const result = await response.json();
      console.log('Economic data refresh result:', result);
      
      // Reload dashboard data after refresh
      await loadDashboardData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Economic data refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const getQualityIcon = (score: string) => {
    switch (score) {
      case 'HIGH': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'MEDIUM': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'LOW': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[confidence as keyof typeof variants] || variants.low}>
        {confidence.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Gold Standard Data Pipeline</h1>
          <div className="flex space-x-2">
            <div className="animate-pulse bg-gray-200 h-10 w-24 rounded"></div>
            <div className="animate-pulse bg-gray-200 h-10 w-32 rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-32 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert>
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <Button onClick={loadDashboardData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gold Standard Data Pipeline</h1>
        <div className="flex space-x-2">
          <Button onClick={loadDashboardData} variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={refreshEconomicData} variant="outline" className="bg-orange-600 hover:bg-orange-700 text-white">
            <Database className="h-4 w-4 mr-2" />
            Refresh Economic Data
          </Button>
          <Button onClick={executeGoldStandardPipeline}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Execute Pipeline
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      {qualityData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Series</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qualityData.summary.totalSeries}</div>
              <p className="text-xs text-muted-foreground">
                Economic indicators tracked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qualityData.summary.avgValidityRate}%</div>
              <Progress value={qualityData.summary.avgValidityRate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Average validity rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Quality</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{qualityData.summary.highQuality}</div>
              <p className="text-xs text-muted-foreground">
                Series with excellent data
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qualityData.processingTime}ms</div>
              <p className="text-xs text-muted-foreground">
                Last analysis duration
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Metrics</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {qualityData && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>High Quality Series</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600 font-semibold">{qualityData.summary.highQuality}</span>
                      <Progress value={(qualityData.summary.highQuality / qualityData.summary.totalSeries) * 100} className="w-20" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Medium Quality Series</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-yellow-600 font-semibold">{qualityData.summary.mediumQuality}</span>
                      <Progress value={(qualityData.summary.mediumQuality / qualityData.summary.totalSeries) * 100} className="w-20" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Low Quality Series</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-red-600 font-semibold">{qualityData.summary.lowQuality}</span>
                      <Progress value={(qualityData.summary.lowQuality / qualityData.summary.totalSeries) * 100} className="w-20" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Series Quality Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {qualityData && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {qualityData.metrics.slice(0, 20).map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getQualityIcon(metric.qualityScore)}
                        <div>
                          <div className="font-medium">{metric.metricName}</div>
                          <div className="text-sm text-gray-500">{metric.seriesId}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{metric.validityRate}%</div>
                        <div className="text-xs text-gray-500">{metric.totalRecords} records</div>
                        <Badge variant={metric.qualityScore === 'HIGH' ? 'default' : 
                                     metric.qualityScore === 'MEDIUM' ? 'secondary' : 'destructive'}>
                          {metric.qualityScore}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enhanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Statistical Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {enhancedMetrics.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {enhancedMetrics.slice(0, 15).map((metric, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{metric.metricName}</div>
                          <div className="text-sm text-gray-500">{metric.seriesId}</div>
                        </div>
                        {getConfidenceBadge(metric.confidence)}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Current Value</div>
                          <div className="font-semibold">{metric.currentValue.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">MoM Change</div>
                          <div className={`font-semibold ${metric.monthOverMonth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {metric.monthOverMonth > 0 ? '+' : ''}{metric.monthOverMonth.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">YoY Change</div>
                          <div className={`font-semibold ${metric.yearOverYear > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {metric.yearOverYear > 0 ? '+' : ''}{metric.yearOverYear.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Z-Score</div>
                          <div className="font-semibold">{metric.zScore.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Volatility</div>
                          <div className="font-semibold">{metric.volatility.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Trend</div>
                          <div className="font-semibold">{metric.trendComponent.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Enhanced metrics not available</p>
                  <p className="text-sm">Execute the pipeline to generate advanced analytics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Execution Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Gold Standard Data Pipeline includes:
                    <ul className="list-disc ml-6 mt-2">
                      <li>Comprehensive data quality validation</li>
                      <li>Complete audit trail tracking</li>
                      <li>Feature engineering (YoY, MoM calculations)</li>
                      <li>Statistical analysis with confidence scoring</li>
                      <li>Enterprise reporting capabilities</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Phase 1: Data Quality Foundation</h4>
                    <Progress value={100} />
                    <p className="text-sm text-green-600">✓ Schema validation & quality scoring</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Phase 2: Complete Audit Trail</h4>
                    <Progress value={100} />
                    <p className="text-sm text-green-600">✓ Lineage tracking & performance monitoring</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Phase 3: Advanced Analytics</h4>
                    <Progress value={85} />
                    <p className="text-sm text-yellow-600">⚠ Feature engineering & seasonal adjustment</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Phase 4: Enterprise Features</h4>
                    <Progress value={75} />
                    <p className="text-sm text-yellow-600">⚠ Report generation & data export</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}