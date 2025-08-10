import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging with context
    const errorDetails = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      retryCount: this.retryCount
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', errorDetails);
    }

    // Send to monitoring service (implement based on your monitoring solution)
    this.sendToMonitoring(errorDetails);
  }

  private async sendToMonitoring(errorDetails: any) {
    try {
      // Example: Send to your monitoring endpoint
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails),
      });
    } catch (error) {
      // Fail silently to avoid infinite error loops
      console.warn('Failed to send error to monitoring service:', error);
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: undefined });
    } else {
      // Reload the page as last resort
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              <span>Something went wrong</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-red-600 dark:text-red-400 text-sm">
              {process.env.NODE_ENV === 'development' 
                ? this.state.error?.message 
                : 'An unexpected error occurred. Our team has been notified.'}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                disabled={this.retryCount >= this.maxRetries}
              >
                <RefreshCw className="h-4 w-4" />
                <span>
                  {this.retryCount >= this.maxRetries ? 'Reload Page' : `Try Again (${this.retryCount}/${this.maxRetries})`}
                </span>
              </button>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="text-xs text-gray-600 dark:text-gray-400">
                  <summary className="cursor-pointer">Error Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              Error ID: {this.state.errorId}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Specific error boundaries for different sections
export function APIErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              <span>Unable to load data. Please check your connection and try again.</span>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function ChartErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              Chart temporarily unavailable
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}