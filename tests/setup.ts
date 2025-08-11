import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock global fetch for all tests
global.fetch = vi.fn();

// Mock console methods to reduce noise during testing
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});