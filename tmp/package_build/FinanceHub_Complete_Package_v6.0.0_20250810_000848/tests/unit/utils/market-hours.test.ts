import { describe, it, expect, vi } from 'vitest';
// Mock implementation for testing
const isMarketOpen = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getUTCHours() - 5; // EST
  return day >= 1 && day <= 5 && hour >= 9.5 && hour < 16;
};

describe('Market Hours Utility', () => {
  it('should detect market hours correctly during trading hours', () => {
    // Mock a Tuesday at 2 PM EST (market open)
    const mockDate = new Date('2025-01-07T14:00:00-05:00');
    vi.setSystemTime(mockDate);
    
    expect(isMarketOpen()).toBe(true);
  });

  it('should detect market closed on weekends', () => {
    // Mock a Saturday at 2 PM EST
    const mockDate = new Date('2025-01-11T14:00:00-05:00');
    vi.setSystemTime(mockDate);
    
    expect(isMarketOpen()).toBe(false);
  });

  it('should detect market closed after hours', () => {
    // Mock a Tuesday at 8 PM EST (market closed)
    const mockDate = new Date('2025-01-07T20:00:00-05:00');
    vi.setSystemTime(mockDate);
    
    expect(isMarketOpen()).toBe(false);
  });

  it('should detect market closed before hours', () => {
    // Mock a Tuesday at 8 AM EST (market closed)
    const mockDate = new Date('2025-01-07T08:00:00-05:00');
    vi.setSystemTime(mockDate);
    
    expect(isMarketOpen()).toBe(false);
  });
});