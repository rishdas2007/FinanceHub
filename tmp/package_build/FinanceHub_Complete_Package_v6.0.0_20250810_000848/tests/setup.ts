import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
beforeEach(() => {
  vi.clearAllMocks();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.FRED_API_KEY = 'test_fred_key';
  process.env.TWELVE_DATA_API_KEY = 'test_twelve_data_key';
  process.env.OPENAI_API_KEY = 'test_openai_key';
});

// Mock external APIs
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mock OpenAI response',
              },
            },
          ],
        }),
      },
    },
  })),
}));

// Mock FRED API calls
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

// Mock database connections
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock WebSocket
global.WebSocket = vi.fn() as any;