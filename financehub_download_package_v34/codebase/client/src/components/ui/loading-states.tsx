import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, BarChart3, Activity } from 'lucide-react';

/**
 * WEEK 4: ENHANCED LOADING STATES & USER EXPERIENCE
 * Contextual loading states with progress indicators and error handling
 */

export interface LoadingStateProps {
  type?: 'skeleton' | 'spinner' | 'progress' | 'contextual';
  message?: string;
  progress?: number;
  context?: 'market' | 'economic' | 'technical' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  showCancel?: boolean;
  onCancel?: () => void;
}

export interface ErrorStateProps {
  error: Error | string;
  context?: string;
  actionable?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Enhanced loading component with contextual information
 */
export function EnhancedLoading({ 
  type = 'contextual',
  message,
  progress,
  context = 'market',
  size = 'md',
  showCancel = false,
  onCancel
}: LoadingStateProps) {
  const getContextIcon = () => {
    switch (context) {
      case 'market':
        return <TrendingUp className="h-5 w-5 text-blue-400 animate-pulse" />;
      case 'economic':
        return <BarChart3 className="h-5 w-5 text-green-400 animate-pulse" />;
      case 'technical':
        return <Activity className="h-5 w-5 text-yellow-400 animate-pulse" />;
      case 'ai':
        return <div className="h-5 w-5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse" />;
      default:
        return <div className="h-5 w-5 rounded-full bg-blue-400 animate-pulse" />;
    }
  };

  const getContextMessage = () => {
    if (message) return message;
    
    switch (context) {
      case 'market':
        return 'Loading market data...';
      case 'economic':
        return 'Fetching economic indicators...';
      case 'technical':
        return 'Calculating technical analysis...';
      case 'ai':
        return 'Generating AI insights...';
      default:
        return 'Loading...';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'p-3';
      case 'lg':
        return 'p-8';
      default:
        return 'p-6';
    }
  };

  if (type === 'skeleton') {
    return <MarketDataSkeleton />;
  }

  if (type === 'progress' && typeof progress === 'number') {
    return (
      <Card className={`bg-financial-card border-financial-border ${getSizeClasses()}`}>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            {getContextIcon()}
            <span className="text-sm text-gray-300">{getContextMessage()}</span>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>{Math.round(progress)}% complete</span>
            {showCancel && onCancel && (
              <button 
                onClick={onCancel}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`bg-financial-card border-financial-border ${getSizeClasses()}`}>
      <div className="flex items-center justify-center space-x-3">
        {getContextIcon()}
        <div className="space-y-2">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-gray-300">{getContextMessage()}</span>
            </div>
          </div>
          {showCancel && onCancel && (
            <div className="text-center">
              <button 
                onClick={onCancel}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Market-specific skeleton loader
 */
export function MarketDataSkeleton() {
  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32 bg-gray-700" />
          <Skeleton className="h-4 w-20 bg-gray-700" />
        </div>
        
        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16 bg-gray-700" />
              <Skeleton className="h-8 w-24 bg-gray-700" />
              <Skeleton className="h-3 w-20 bg-gray-700" />
            </div>
          ))}
        </div>
        
        {/* Chart area */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 bg-gray-700" />
          <Skeleton className="h-32 w-full bg-gray-700" />
        </div>
        
        {/* Bottom indicators */}
        <div className="flex space-x-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 rounded-full bg-gray-700" />
              <Skeleton className="h-3 w-16 bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Economic indicators skeleton
 */
export function EconomicIndicatorsSkeleton() {
  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40 bg-gray-700" />
          <Skeleton className="h-4 w-24 bg-gray-700" />
        </div>
        
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded border border-gray-700">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32 bg-gray-700" />
                <Skeleton className="h-3 w-20 bg-gray-700" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-16 bg-gray-700" />
                <Skeleton className="h-3 w-12 bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Enhanced error state with contextual actions
 */
export function EnhancedError({ 
  error, 
  context = 'loading data',
  actionable = true,
  onRetry,
  onDismiss 
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const getErrorType = (message: string): 'network' | 'auth' | 'data' | 'server' | 'unknown' => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) return 'network';
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized')) return 'auth';
    if (lowerMessage.includes('data') || lowerMessage.includes('parse')) return 'data';
    if (lowerMessage.includes('server') || lowerMessage.includes('500')) return 'server';
    return 'unknown';
  };

  const errorType = getErrorType(errorMessage);
  
  const getErrorSuggestion = (type: string): string => {
    switch (type) {
      case 'network':
        return 'Check your internet connection and try again.';
      case 'auth':
        return 'Authentication required. Please refresh the page.';
      case 'data':
        return 'Data formatting issue. This usually resolves automatically.';
      case 'server':
        return 'Server temporarily unavailable. Please try again in a moment.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  return (
    <Card className="bg-financial-card border-red-500/20 p-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-red-400 font-medium">Error {context}</h3>
            <p className="text-sm text-gray-300">{getErrorSuggestion(errorType)}</p>
          </div>
        </div>
        
        {actionable && (
          <div className="flex items-center space-x-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                data-testid="button-retry"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 text-sm transition-colors"
                data-testid="button-dismiss"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
        
        {/* Technical details (collapsed by default) */}
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-400">Technical details</summary>
          <pre className="mt-2 p-2 bg-gray-800 rounded text-xs overflow-auto">
            {errorMessage}
          </pre>
        </details>
      </div>
    </Card>
  );
}

/**
 * Progressive loading with stages
 */
export interface ProgressiveLoadingProps {
  stages: Array<{
    name: string;
    completed: boolean;
    loading: boolean;
    error?: string;
  }>;
  currentStage: number;
}

export function ProgressiveLoading({ stages, currentStage }: ProgressiveLoadingProps) {
  const completedStages = stages.filter(s => s.completed).length;
  const progress = (completedStages / stages.length) * 100;

  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium">Loading Dashboard</h3>
          <span className="text-sm text-gray-400">{completedStages}/{stages.length}</span>
        </div>
        
        <Progress value={progress} className="w-full" />
        
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <div 
              key={index}
              className={`flex items-center space-x-3 p-2 rounded ${
                index === currentStage ? 'bg-blue-500/10' : ''
              }`}
            >
              <div className={`h-3 w-3 rounded-full ${
                stage.completed 
                  ? 'bg-green-400' 
                  : stage.loading 
                    ? 'bg-blue-400 animate-pulse' 
                    : stage.error 
                      ? 'bg-red-400' 
                      : 'bg-gray-600'
              }`} />
              <span className={`text-sm ${
                stage.completed 
                  ? 'text-green-400' 
                  : stage.error 
                    ? 'text-red-400' 
                    : 'text-gray-300'
              }`}>
                {stage.name}
                {stage.error && ` - ${stage.error}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Data freshness indicator
 */
export interface DataFreshnessProps {
  lastUpdated: Date;
  updateInterval?: number;
  status: 'fresh' | 'stale' | 'error';
}

export function DataFreshnessIndicator({ 
  lastUpdated, 
  updateInterval = 5 * 60 * 1000, // 5 minutes default
  status 
}: DataFreshnessProps) {
  const timeAgo = Date.now() - lastUpdated.getTime();
  const isStale = timeAgo > updateInterval;
  
  const getStatusColor = () => {
    switch (status) {
      case 'fresh': return 'text-green-400';
      case 'stale': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    if (status === 'error') return 'Update failed';
    if (isStale) return 'Data may be stale';
    
    const minutes = Math.floor(timeAgo / 60000);
    if (minutes < 1) return 'Just updated';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  return (
    <div className={`flex items-center space-x-2 text-xs ${getStatusColor()}`}>
      <div className={`h-2 w-2 rounded-full ${
        status === 'fresh' ? 'bg-green-400' :
        status === 'stale' ? 'bg-yellow-400' : 'bg-red-400'
      } ${status === 'fresh' ? 'animate-pulse' : ''}`} />
      <span>{getStatusText()}</span>
    </div>
  );
}