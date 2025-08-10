import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataSufficiencyWarning, DataSufficiencySummary } from "@/components/DataSufficiencyWarning";
import { PlayCircle, RefreshCw, AlertTriangle, CheckCircle2, Database, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DataSufficiencyReport {
  symbol: string;
  assetClass: 'equity' | 'etf' | 'economic';
  currentDataPoints: number;
  requiredDataPoints: number;
  sufficiencyRatio: number;
  confidence: number;
  reliability: 'high' | 'medium' | 'low' | 'unreliable';
  recommendation: string;
  lastUpdated: string;
}

interface BackfillResult {
  symbol: string;
  recordsAdded: number;
  apiCallsUsed: number;
  dataGaps: number;
  qualityScore: number;
  completionStatus: 'complete' | 'partial' | 'failed';
  errors: string[];
}

/**
 * Data Sufficiency Management Page
 * Addresses the data sufficiency problem identified in the analysis
 * Provides tools for monitoring and backfilling historical data
 */
export default function DataSufficiencyPage() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([
    'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
  ]);
  const [backfillTargetMonths, setBackfillTargetMonths] = useState(18);
  
  const queryClient = useQueryClient();

  // Fetch data sufficiency reports
  const { data: reportsData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/data-sufficiency/reports'],
    queryFn: async () => {
      const response = await fetch('/api/data-sufficiency/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: selectedSymbols })
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    }
  });

  // Execute backfill mutation
  const backfillMutation = useMutation({
    mutationFn: async ({ symbols, targetMonths }: { symbols: string[], targetMonths: number }) => {
      const response = await fetch('/api/data-sufficiency/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, targetMonths })
      });
      if (!response.ok) throw new Error('Failed to execute backfill');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Backfill Complete",
        description: `Successfully processed ${data.data.summary.totalRecords} records for ${data.data.summary.successful} symbols.`
      });
      // Refresh reports after backfill
      queryClient.invalidateQueries({ queryKey: ['/api/data-sufficiency/reports'] });
    },
    onError: (error) => {
      toast({
        title: "Backfill Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const reports: DataSufficiencyReport[] = reportsData?.data?.reports || [];
  const summary = reportsData?.data?.summary || {};

  // Group reports by reliability
  const groupedReports = {
    critical: reports.filter(r => r.reliability === 'unreliable'),
    needsImprovement: reports.filter(r => r.reliability === 'low'),
    moderate: reports.filter(r => r.reliability === 'medium'),
    good: reports.filter(r => r.reliability === 'high')
  };

  const executeBackfill = () => {
    const criticalSymbols = groupedReports.critical.map(r => r.symbol);
    const improvementSymbols = groupedReports.needsImprovement.map(r => r.symbol);
    const prioritySymbols = [...criticalSymbols, ...improvementSymbols];
    
    backfillMutation.mutate({
      symbols: prioritySymbols.length > 0 ? prioritySymbols : selectedSymbols,
      targetMonths: backfillTargetMonths
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Sufficiency Management</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and improve historical data coverage for reliable z-score calculations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
            data-testid="refresh-reports-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={executeBackfill}
            disabled={backfillMutation.isPending}
            data-testid="execute-backfill-button"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            {backfillMutation.isPending ? 'Running Backfill...' : 'Start Backfill'}
          </Button>
        </div>
      </div>

      {/* Data Sufficiency Problem Alert */}
      <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10" data-testid="data-sufficiency-alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Data Sufficiency Problem Identified</AlertTitle>
        <AlertDescription>
          Your z-score calculations currently rely on insufficient historical data. 
          This analysis tool addresses the critical gap between your statistical methodology requirements 
          (252 days for equities, 63 days for ETFs) and available data (~20-60 days).
          <div className="mt-2 text-sm">
            <strong>Impact:</strong> Z-scores with insufficient data may be 40-50% noise, leading to unreliable trading signals.
          </div>
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="critical-issues-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {groupedReports.critical.length}
            </div>
            <p className="text-xs text-muted-foreground">Unreliable z-scores</p>
          </CardContent>
        </Card>

        <Card data-testid="needs-improvement-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              Needs Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {groupedReports.needsImprovement.length}
            </div>
            <p className="text-xs text-muted-foreground">Limited reliability</p>
          </CardContent>
        </Card>

        <Card data-testid="moderate-reliability-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Moderate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {groupedReports.moderate.length}
            </div>
            <p className="text-xs text-muted-foreground">Acceptable quality</p>
          </CardContent>
        </Card>

        <Card data-testid="good-reliability-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Good
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {groupedReports.good.length}
            </div>
            <p className="text-xs text-muted-foreground">Reliable z-scores</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="overview-tab">Overview</TabsTrigger>
          <TabsTrigger value="critical" data-testid="critical-tab">
            Critical Issues ({groupedReports.critical.length})
          </TabsTrigger>
          <TabsTrigger value="all-symbols" data-testid="all-symbols-tab">All Symbols</TabsTrigger>
          <TabsTrigger value="backfill" data-testid="backfill-tab">Backfill Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataSufficiencySummary reports={reports} />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Statistical Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Confidence</span>
                    <span className="font-medium">{Math.round((summary.averageConfidence || 0) * 100)}%</span>
                  </div>
                  <Progress value={(summary.averageConfidence || 0) * 100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Data Sufficiency</span>
                    <span className="font-medium">{Math.round((summary.averageSufficiency || 0) * 100)}%</span>
                  </div>
                  <Progress value={(summary.averageSufficiency || 0) * 100} className="h-2" />
                </div>

                <div className="pt-2 text-xs text-muted-foreground">
                  <p>Target: 90%+ for reliable trading signals</p>
                  <p>Current reliability may result in 40-50% noise in z-score calculations</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="critical" className="space-y-4">
          <div className="space-y-4">
            {groupedReports.critical.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Critical Issues</h3>
                  <p className="text-muted-foreground">All symbols have at least minimal data coverage.</p>
                </CardContent>
              </Card>
            ) : (
              groupedReports.critical.map((report) => (
                <DataSufficiencyWarning
                  key={report.symbol}
                  symbol={report.symbol}
                  dataPoints={report.currentDataPoints}
                  requiredDataPoints={report.requiredDataPoints}
                  confidence={report.confidence}
                  reliability={report.reliability}
                  message={report.recommendation}
                  hasWarning={true}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="all-symbols" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <Card key={report.symbol} data-testid={`symbol-card-${report.symbol.toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{report.symbol}</CardTitle>
                    <Badge 
                      variant={
                        report.reliability === 'high' ? 'default' :
                        report.reliability === 'medium' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {report.reliability}
                    </Badge>
                  </div>
                  <CardDescription>{report.assetClass.toUpperCase()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Data Coverage</span>
                    <span>{Math.round(report.sufficiencyRatio * 100)}%</span>
                  </div>
                  <Progress value={report.sufficiencyRatio * 100} className="h-2" />
                  
                  <div className="flex justify-between text-sm">
                    <span>Confidence</span>
                    <span className="font-medium">{Math.round(report.confidence * 100)}%</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {report.currentDataPoints}/{report.requiredDataPoints} data points
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="backfill" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Historical Data Backfill
              </CardTitle>
              <CardDescription>
                Systematically backfill historical data from Twelve Data API while respecting rate limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">Target Months</label>
                  <select 
                    value={backfillTargetMonths}
                    onChange={(e) => setBackfillTargetMonths(Number(e.target.value))}
                    className="w-full mt-1 p-2 border rounded-md"
                    data-testid="target-months-select"
                  >
                    <option value={12}>12 months (252 trading days)</option>
                    <option value={18}>18 months (378 trading days)</option>
                    <option value={24}>24 months (504 trading days)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">Priority Symbols</label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {groupedReports.critical.length + groupedReports.needsImprovement.length} symbols need attention
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Backfill Strategy</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Prioritizes symbols with critical data gaps</li>
                  <li>• Respects Twelve Data API rate limits (8 calls/minute)</li>
                  <li>• Targets {backfillTargetMonths} months of historical data</li>
                  <li>• Provides comprehensive progress tracking</li>
                </ul>
              </div>

              {backfillMutation.isPending && (
                <div className="bg-blue-50 dark:bg-blue-950/10 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="font-medium">Backfill in Progress</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fetching historical data while respecting API rate limits...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}