import { vi } from 'vitest';

/**
 * Test utilities to prevent loading state issues in components
 */

export const createMockETFResponse = (count: number = 2) => ({
  success: true,
  data: Array.from({ length: count }, (_, i) => ({
    symbol: `ETF${i + 1}`,
    name: `Test ETF ${i + 1}`,
    price: 100 + i * 10,
    changePercent: (i % 2 === 0 ? 1 : -1) * Math.random(),
    rsi: 50 + i * 5,
    weightedScore: (i % 2 === 0 ? 1 : -1) * 0.5,
    weightedSignal: i % 2 === 0 ? 'BUY' : 'SELL',
    bollingerStatus: 'Neutral',
    atr: 5 + i,
    sma_20: 98 + i * 10,
    sma_50: 95 + i * 10,
    zScoreData: {
      compositeZScore: (i % 2 === 0 ? 1 : -1) * 0.8,
      signal: i % 2 === 0 ? 'BULLISH' : 'BEARISH'
    }
  })),
  metrics: [],
  count,
  timestamp: new Date().toISOString(),
  source: 'database'
});

export const createLoadingStateTest = (
  componentName: string,
  apiEndpoint: string,
  testId: string
) => {
  return {
    'should not get stuck in loading state': async () => {
      const mockResponse = createMockETFResponse();
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      // Test implementation would be added here
      // This is a template for standardized loading tests
    },

    'should handle empty data without infinite loading': async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [],
          count: 0
        })
      });

      // Test implementation would be added here
    },

    'should recover from API errors': async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockETFResponse())
        });

      // Test implementation would be added here
    }
  };
};

/**
 * Mock console methods to verify debug logging
 */
export const mockConsoleForTesting = () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  return {
    logSpy,
    warnSpy,
    errorSpy,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
};

/**
 * Verify that debug logs show proper data flow
 */
export const verifyDataExtractionLogs = (logSpy: any, expectedDataLength: number) => {
  expect(logSpy).toHaveBeenCalledWith(
    '🔍 ETF Data Extraction:',
    expect.objectContaining({
      hasData: true,
      dataLength: expectedDataLength,
      success: true
    })
  );

  expect(logSpy).toHaveBeenCalledWith(
    '✅ Using data field:',
    expectedDataLength,
    'ETFs'
  );
};

/**
 * Test that components properly transition from loading to data display
 */
export const testLoadingTransition = async (
  screen: any,
  waitFor: any,
  loadingTestId: string,
  dataTestId: string
) => {
  // Should show loading initially (if no cached data)
  const loadingElement = screen.queryByTestId(loadingTestId);
  if (loadingElement) {
    expect(loadingElement).toBeInTheDocument();
  }

  // Should transition to data display
  await waitFor(() => {
    expect(screen.getByTestId(dataTestId)).toBeInTheDocument();
  }, { timeout: 2000 });

  // Should not show loading anymore
  expect(screen.queryByTestId(loadingTestId)).not.toBeInTheDocument();
};