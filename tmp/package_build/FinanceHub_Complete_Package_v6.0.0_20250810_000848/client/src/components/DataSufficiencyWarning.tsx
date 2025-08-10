import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataSufficiencyWarningProps {
  symbol: string;
  dataPoints: number;
  requiredDataPoints: number;
  confidence: number;
  reliability: 'high' | 'medium' | 'low' | 'unreliable';
  message: string;
  hasWarning: boolean;
  className?: string;
}

/**
 * Data Sufficiency Warning Component
 * Displays warnings and confidence scores for z-score calculations
 * Addresses the data sufficiency problem identified in the analysis
 */
export function DataSufficiencyWarning({
  symbol,
  dataPoints,
  requiredDataPoints,
  confidence,
  reliability,
  message,
  hasWarning,
  className
}: DataSufficiencyWarningProps) {
  const sufficiencyRatio = (dataPoints / requiredDataPoints) * 100;
  
  // Determine alert variant and icon based on reliability
  const getAlertConfig = () => {
    switch (reliability) {
      case 'high':
        return {
          variant: 'default' as const,
          icon: <CheckCircle2 className="h-4 w-4" />,
          bgColor: 'bg-green-50 dark:bg-green-950/10',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-800 dark:text-green-200'
        };
      case 'medium':
        return {
          variant: 'default' as const,
          icon: <Info className="h-4 w-4" />,
          bgColor: 'bg-blue-50 dark:bg-blue-950/10',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200'
        };
      case 'low':
        return {
          variant: 'destructive' as const,
          icon: <AlertTriangle className="h-4 w-4" />,
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/10',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200'
        };
      case 'unreliable':
        return {
          variant: 'destructive' as const,
          icon: <XCircle className="h-4 w-4" />,
          bgColor: 'bg-red-50 dark:bg-red-950/10',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200'
        };
    }
  };

  const config = getAlertConfig();

  // Don't show warning for high reliability data
  if (!hasWarning && reliability === 'high') {
    return null;
  }

  return (
    <Alert 
      className={cn(
        config.bgColor,
        config.borderColor,
        config.textColor,
        "mb-4",
        className
      )}
      data-testid={`data-sufficiency-warning-${symbol.toLowerCase()}`}
    >
      {config.icon}
      <AlertTitle className="flex items-center justify-between">
        <span>Data Reliability: {symbol}</span>
        <div className="flex items-center gap-2">
          <Badge 
            variant={reliability === 'high' ? 'default' : reliability === 'medium' ? 'secondary' : 'destructive'}
            data-testid={`reliability-badge-${symbol.toLowerCase()}`}
          >
            {reliability.toUpperCase()}
          </Badge>
          <Badge 
            variant="outline"
            data-testid={`confidence-badge-${symbol.toLowerCase()}`}
          >
            {Math.round(confidence * 100)}% Confidence
          </Badge>
        </div>
      </AlertTitle>
      
      <AlertDescription className="mt-2 space-y-3">
        <p data-testid={`warning-message-${symbol.toLowerCase()}`}>{message}</p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Data Coverage</span>
            <span>
              {dataPoints}/{requiredDataPoints} data points ({Math.round(sufficiencyRatio)}%)
            </span>
          </div>
          <Progress 
            value={Math.min(100, sufficiencyRatio)} 
            className="h-2"
            data-testid={`data-coverage-progress-${symbol.toLowerCase()}`}
          />
        </div>

        {/* Statistical Impact Explanation */}
        <div className="text-xs opacity-80 mt-2" data-testid={`statistical-impact-${symbol.toLowerCase()}`}>
          {reliability === 'unreliable' && (
            <p className="font-medium">
              ⚠️ Z-scores may be 40-50% noise. Consider postponing trading decisions.
            </p>
          )}
          {reliability === 'low' && (
            <p className="font-medium">
              📊 Limited data may cause false signals. Treat as experimental indicators.
            </p>
          )}
          {reliability === 'medium' && (
            <p className="font-medium">
              📈 Moderate reliability. Consider reducing signal confidence by 30%.
            </p>
          )}
          {reliability === 'high' && (
            <p className="font-medium">
              ✅ Sufficient data for reliable statistical analysis.
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Compact Data Sufficiency Indicator
 * For use in smaller UI contexts like cards or tables
 */
export function DataSufficiencyIndicator({
  reliability,
  confidence,
  className
}: {
  reliability: 'high' | 'medium' | 'low' | 'unreliable';
  confidence: number;
  className?: string;
}) {
  const getIndicatorColor = () => {
    switch (reliability) {
      case 'high': return 'bg-green-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-yellow-500';
      case 'unreliable': return 'bg-red-500';
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="data-sufficiency-indicator">
      <div className={cn("w-2 h-2 rounded-full", getIndicatorColor())} />
      <span className="text-xs text-muted-foreground">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  );
}

/**
 * Data Sufficiency Summary Card
 * Shows overall data health across multiple symbols
 */
export function DataSufficiencySummary({
  reports,
  className
}: {
  reports: Array<{
    symbol: string;
    reliability: 'high' | 'medium' | 'low' | 'unreliable';
    confidence: number;
    sufficiencyRatio: number;
  }>;
  className?: string;
}) {
  const summary = {
    total: reports.length,
    high: reports.filter(r => r.reliability === 'high').length,
    medium: reports.filter(r => r.reliability === 'medium').length,
    low: reports.filter(r => r.reliability === 'low').length,
    unreliable: reports.filter(r => r.reliability === 'unreliable').length,
    avgConfidence: reports.reduce((sum, r) => sum + r.confidence, 0) / reports.length
  };

  return (
    <div className={cn("p-4 border rounded-lg bg-card", className)} data-testid="data-sufficiency-summary">
      <h3 className="font-semibold mb-3">Data Sufficiency Overview</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              High Reliability
            </span>
            <span>{summary.high}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Medium Reliability
            </span>
            <span>{summary.medium}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              Low Reliability
            </span>
            <span>{summary.low}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Unreliable
            </span>
            <span>{summary.unreliable}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t">
        <div className="flex justify-between text-sm">
          <span>Average Confidence</span>
          <span className="font-medium">{Math.round(summary.avgConfidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}