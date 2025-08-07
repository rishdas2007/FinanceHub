import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'wouter';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundaryOptimized extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.retry} />;
      }

      return (
        <Card className="bg-gray-900/95 backdrop-blur rounded-lg border border-red-700 max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              An unexpected error occurred while rendering this component.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <h4 className="text-red-400 font-medium mb-2">Error Details:</h4>
                <p className="text-xs text-gray-400 font-mono mb-2">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-400">Stack trace</summary>
                    <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
                  </details>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <Button onClick={this.retry} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Link href="/">
                <Button variant="outline" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Custom fallback components for specific use cases
export const DashboardErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="bg-gray-900/95 backdrop-blur rounded-lg border border-red-700 p-6">
    <div className="flex items-center gap-2 mb-4">
      <AlertTriangle className="h-5 w-5 text-red-400" />
      <h3 className="text-lg font-semibold text-white">Dashboard Loading Error</h3>
    </div>
    <p className="text-gray-300 mb-4">
      Unable to load dashboard components. This might be due to a network issue or server error.
    </p>
    <div className="flex items-center gap-3">
      <Button onClick={retry} size="sm" className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        Reload Dashboard
      </Button>
      <Button onClick={() => window.location.reload()} variant="outline" size="sm">
        Refresh Page
      </Button>
    </div>
  </div>
);

export const ChartErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <Card className="bg-gray-900/95 backdrop-blur rounded-lg border border-gray-700">
    <CardContent className="p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-3" />
      <h4 className="text-white font-medium mb-2">Chart Unavailable</h4>
      <p className="text-gray-400 text-sm mb-4">
        Unable to render chart data. Please try refreshing or check back later.
      </p>
      <Button onClick={retry} size="sm" variant="outline">
        Retry Chart
      </Button>
    </CardContent>
  </Card>
);

export default ErrorBoundaryOptimized;