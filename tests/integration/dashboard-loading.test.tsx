import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Router } from 'wouter';
import Dashboard from '../../client/src/pages/dashboard';

// Mock all dashboard components
vi.mock('../../client/src/components/ETFMetricsTable', () => ({
  default: () => <div data-testid="etf-metrics-mock">ETF Metrics</div>
}));

vi.mock('../../client/src/components/TopMovers', () => ({
  default: () => <div data-testid="top-movers-mock">Top Movers</div>
}));

vi.mock('../../client/src/components/EconomicHealthScore', () => ({
  default: () => <div data-testid="economic-health-mock">Economic Health</div>
}));

vi.mock('../../client/src/components/EconomicIndicatorsList', () => ({
  default: () => <div data-testid="economic-indicators-mock">Economic Indicators</div>
}));

global.fetch = vi.fn();

describe('Dashboard Loading Prevention Integration', () => {
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

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Router>
          <Dashboard />
        </Router>
      </QueryClientProvider>
    );
  };

  it('should prevent any component from getting stuck in infinite loading', async () => {
    // Mock all API endpoints
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/etf-metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [],
            count: 0
          })
        });
      }
      if (url.includes('/api/market-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            status: { isOpen: true }
          })
        });
      }
      if (url.includes('/api/top-movers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            etfMovers: { gainers: [], losers: [] }
          })
        });
      }
      if (url.includes('/api/economic-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            economicHealthScore: 65,
            componentScores: {}
          })
        });
      }
      if (url.includes('/api/macroeconomic-indicators')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            indicators: []
          })
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    renderDashboard();

    // All components should render without infinite loading
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-mock')).toBeInTheDocument();
      expect(screen.getByTestId('top-movers-mock')).toBeInTheDocument();
      expect(screen.getByTestId('economic-health-mock')).toBeInTheDocument();
      expect(screen.getByTestId('economic-indicators-mock')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify no loading states persist
    expect(screen.queryByText('Loading from database...')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should handle mixed success/failure states gracefully', async () => {
    let etfCallCount = 0;
    
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/etf-metrics')) {
        etfCallCount++;
        if (etfCallCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ symbol: 'SPY', name: 'S&P 500' }],
            count: 1
          })
        });
      }
      // Other endpoints succeed immediately
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });

    renderDashboard();

    // Should eventually resolve all components
    await waitFor(() => {
      expect(screen.getByTestId('etf-metrics-mock')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Should not make excessive retry calls
    expect(etfCallCount).toBeLessThanOrEqual(3);
  });
});