import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ETFMetricsTable from '../../client/src/components/ETFMetricsTable';

// Mock fetch for API calls
global.fetch = vi.fn();

const mockETFResponse = {
  success: true,
  data: [
    {
      symbol: 'SPY',
      name: 'S&P 500 INDEX',
      price: 630.50,
      changePercent: 0.75,
      rsi: 65.2,
      weightedScore: 0.85,
      weightedSignal: 'BUY',
      bollingerStatus: 'Neutral',
      atr: 5.8,
      sma_20: 625.0,
      sma_50: 615.0,
      zScoreData: {
        compositeZScore: 1.2,
        signal: 'BULLISH'
      }
    },
    {
      symbol: 'XLK',
      name: 'Technology',
      price: 265.92,
      changePercent: 1.25,
      rsi: 72.1,
      weightedScore: -0.45,
      weightedSignal: 'SELL',
      bollingerStatus: 'Overbought',
      atr: 8.2,
      sma_20: 261.0,
      sma_50: 252.0,
      zScoreData: {
        compositeZScore: -0.8,
        signal: 'BEARISH'
      }
    }
  ],
  metrics: [],
  count: 2,
  timestamp: '2025-08-11T18:00:00.000Z',
  source: 'database'
};

describe('ETFMetricsTable Loading States', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should show loading state only when no data is available', async () => {
    // Mock initial loading state
    (fetch as any).mockImplementationOnce(() => 
      new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockETFResponse)
        }), 100);
      })
    );

    renderWithQueryClient(<ETFMetricsTable />);

    // Should show loading initially
    expect(screen.getByTestId('etf-metrics-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading from database...')).toBeInTheDocument();

    // Should transition to data display
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-table')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Should not show loading anymore
    expect(screen.queryByTestId('etf-metrics-loading')).not.toBeInTheDocument();
  });

  it('should immediately show data if available even when isLoading is true', async () => {
    // Mock response that resolves immediately with data
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockETFResponse)
    });

    renderWithQueryClient(<ETFMetricsTable />);

    // Should quickly transition to data display without getting stuck in loading
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-table')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Verify data is displayed
    expect(screen.getByText('SPY')).toBeInTheDocument();
    expect(screen.getByText('XLK')).toBeInTheDocument();
    expect(screen.getByText('(2 ETFs)')).toBeInTheDocument();
  });

  it('should handle empty data response correctly', async () => {
    // Mock empty response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        metrics: [],
        count: 0
      })
    });

    renderWithQueryClient(<ETFMetricsTable />);

    // Should show empty state, not loading
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-empty')).toBeInTheDocument();
    });

    expect(screen.getByText('No ETF data available')).toBeInTheDocument();
    expect(screen.queryByTestId('etf-metrics-loading')).not.toBeInTheDocument();
  });

  it('should handle API errors without infinite loading', async () => {
    // Mock API error
    (fetch as any).mockRejectedValueOnce(new Error('API Error'));

    renderWithQueryClient(<ETFMetricsTable />);

    // Should show error state, not loading
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Unable to load data')).toBeInTheDocument();
    expect(screen.queryByTestId('etf-metrics-loading')).not.toBeInTheDocument();
  });

  it('should extract data from both data and metrics fields', async () => {
    // Mock response with data in metrics field
    const responseWithMetrics = {
      ...mockETFResponse,
      data: null,
      metrics: mockETFResponse.data
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseWithMetrics)
    });

    renderWithQueryClient(<ETFMetricsTable />);

    // Should still display data correctly
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-table')).toBeInTheDocument();
    });

    expect(screen.getByText('SPY')).toBeInTheDocument();
    expect(screen.getByText('XLK')).toBeInTheDocument();
  });

  it('should prevent infinite loading loops', async () => {
    let callCount = 0;
    
    // Mock that simulates loading state issues
    (fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockETFResponse)
        });
      }
      return Promise.reject(new Error('Too many calls'));
    });

    renderWithQueryClient(<ETFMetricsTable />);

    // Should resolve to data display without infinite calls
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-table')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify it doesn't make excessive API calls
    expect(callCount).toBeLessThanOrEqual(3);
  });

  it('should display loading state with proper accessibility', async () => {
    (fetch as any).mockImplementation(() => 
      new Promise(() => {}) // Never resolves to test loading state
    );

    renderWithQueryClient(<ETFMetricsTable />);

    const loadingElement = screen.getByTestId('etf-metrics-loading');
    expect(loadingElement).toBeInTheDocument();
    
    // Check for proper loading indicators
    expect(screen.getByText('ETF Technical Metrics')).toBeInTheDocument();
    expect(screen.getByText('Loading from database...')).toBeInTheDocument();
    
    // Should have animated loading skeletons
    const skeletons = screen.getAllByRole('generic');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('ETFMetricsTable Data Flow Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should handle the complete data flow from API to display', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockETFResponse)
    });

    renderWithQueryClient(<ETFMetricsTable />);

    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-table')).toBeInTheDocument();
    });

    // Verify debug logs show proper data extraction
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '🔍 ETF Data Extraction:',
      expect.objectContaining({
        hasData: true,
        dataLength: 2,
        success: true
      })
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '✅ Using data field:',
      2,
      'ETFs'
    );

    consoleLogSpy.mockRestore();
  });
});